// src/app/actions/requests.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notifyNewRequest, notifyReadyOrShipped } from "@/lib/email";

type DeliveryMethod = "PICKUP" | "SHIPPING";
type RequestStatus = "PENDING" | "PREPARING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session;
}

async function requireAdmin() {
  const s = await requireSession();
  if ((s.user as any).role !== "ADMIN_MP") throw new Error("Requiere permisos de administrador");
  return s;
}

function notifyEmails(): { warehouse: string[]; commercial: string[] } {
  const warehouse = (process.env.WAREHOUSE_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const commercial = (process.env.COMMERCIAL_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { warehouse, commercial };
}

async function generateFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SOL-${year}-`;
  const last = await prisma.materialRequest.findFirst({
    where: { folio: { startsWith: prefix } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  const lastNum = last ? parseInt(last.folio.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

interface CreateRequestInput {
  warehouseId: string;
  deliveryMethod: DeliveryMethod;
  shippingAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  notes?: string;
  items: { productId: string; quantity: number }[];
  // Si true y el caller es ADMIN_MP, la solicitud arranca en PREPARING (POS / solicitud rápida)
  startInPreparing?: boolean;
}

export async function createRequest(input: CreateRequestInput) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const userOrgId = (session.user as any).organizationId as string;
  const userRole = (session.user as any).role as string;

  if (!input.items?.length) return { success: false as const, error: "Agrega al menos un producto" };
  if (input.deliveryMethod === "SHIPPING" && !input.shippingAddress?.trim()) {
    return { success: false as const, error: "Falta la dirección de envío" };
  }
  for (const it of input.items) {
    if (it.quantity <= 0) return { success: false as const, error: "Las cantidades deben ser mayores a 0" };
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) return { success: false as const, error: "Almacén no encontrado" };
  if (userRole !== "ADMIN_MP" && warehouse.organizationId !== userOrgId) {
    return { success: false as const, error: "Almacén no pertenece a tu organización" };
  }

  const startInPreparing = !!input.startInPreparing && userRole === "ADMIN_MP";

  try {
    const folio = await generateFolio();
    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.materialRequest.create({
        data: {
          folio,
          requesterId: userId,
          organizationId: warehouse.organizationId,
          warehouseId: warehouse.id,
          status: startInPreparing ? "PREPARING" : "PENDING",
          deliveryMethod: input.deliveryMethod,
          shippingAddress: input.deliveryMethod === "SHIPPING" ? input.shippingAddress?.trim() : null,
          receiverName: input.receiverName?.trim() || null,
          receiverPhone: input.receiverPhone?.trim() || null,
          notes: input.notes?.trim() || null,
          preparedById: startInPreparing ? userId : null,
          preparedAt: startInPreparing ? new Date() : null,
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              quantityRequested: i.quantity,
              quantityFulfilled: startInPreparing ? i.quantity : 0,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          requester: { select: { name: true, email: true } },
        },
      });

      if (startInPreparing) {
        await deductInventoryInTx(tx, request.id, request.warehouseId, request.items, userId);
      }

      return request;
    });

    // Notificación post-commit (no bloquea el flujo si falla)
    const { warehouse: warehouseEmails, commercial: commercialEmails } = notifyEmails();
    const targets = startInPreparing
      ? commercialEmails // POS arranca en PREPARING; el almacén ya está consciente
      : [...warehouseEmails, ...commercialEmails];

    notifyNewRequest({
      to: targets,
      request: {
        folio: created.folio,
        requesterName: created.requester.name,
        deliveryMethod: created.deliveryMethod,
        shippingAddress: created.shippingAddress,
        receiverName: created.receiverName,
        notes: created.notes,
        items: created.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantityRequested,
          unit: i.product.unit,
        })),
      },
    }).catch((e) => console.error("[notify] new request:", e));

    revalidatePath("/requests");
    revalidatePath("/dashboard");
    if (startInPreparing) revalidatePath("/inventory");
    return { success: true as const, data: { id: created.id, folio: created.folio } };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error al crear solicitud" };
  }
}

async function deductInventoryInTx(
  tx: any,
  requestId: string,
  warehouseId: string,
  items: { productId: string; quantityRequested: number }[],
  userId: string,
) {
  for (const item of items) {
    const inv = await tx.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId: item.productId, warehouseId } },
      include: { product: { select: { name: true, unit: true } } },
    });
    const current = inv?.quantity ?? 0;
    if (current < item.quantityRequested) {
      throw new Error(
        `Stock insuficiente para "${inv?.product.name ?? item.productId}": hay ${current} ${inv?.product.unit ?? "pza"}`
      );
    }
    await tx.inventoryItem.update({
      where: { productId_warehouseId: { productId: item.productId, warehouseId } },
      data: { quantity: { decrement: item.quantityRequested } },
    });
    await tx.stockMovement.create({
      data: {
        type: "EXIT",
        productId: item.productId,
        fromWarehouseId: warehouseId,
        quantity: item.quantityRequested,
        reason: "Preparación de solicitud",
        requestId,
        createdById: userId,
      },
    });
  }
}

async function restoreInventoryInTx(
  tx: any,
  requestId: string,
  warehouseId: string,
  items: { productId: string; quantityFulfilled: number }[],
  userId: string,
) {
  for (const item of items) {
    if (item.quantityFulfilled <= 0) continue;
    await tx.inventoryItem.upsert({
      where: { productId_warehouseId: { productId: item.productId, warehouseId } },
      update: { quantity: { increment: item.quantityFulfilled } },
      create: { productId: item.productId, warehouseId, quantity: item.quantityFulfilled },
    });
    await tx.stockMovement.create({
      data: {
        type: "RETURN",
        productId: item.productId,
        toWarehouseId: warehouseId,
        quantity: item.quantityFulfilled,
        reason: "Cancelación de solicitud",
        requestId,
        createdById: userId,
      },
    });
  }
}

export async function startPreparation(requestId: string) {
  const session = await requireAdmin();
  const userId = (session.user as any).id as string;

  try {
    const r = await prisma.$transaction(async (tx) => {
      const req = await tx.materialRequest.findUnique({
        where: { id: requestId },
        include: { items: true },
      });
      if (!req) throw new Error("Solicitud no encontrada");
      if (req.status !== "PENDING") throw new Error(`No se puede preparar en estado ${req.status}`);

      await deductInventoryInTx(
        tx,
        req.id,
        req.warehouseId,
        req.items.map((i) => ({ productId: i.productId, quantityRequested: i.quantityRequested })),
        userId,
      );

      // Marcar items como fulfilled = requested
      for (const it of req.items) {
        await tx.materialRequestItem.update({
          where: { id: it.id },
          data: { quantityFulfilled: it.quantityRequested },
        });
      }

      return tx.materialRequest.update({
        where: { id: requestId },
        data: { status: "PREPARING", preparedById: userId, preparedAt: new Date() },
      });
    });

    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true as const, data: r };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error al preparar" };
  }
}

export async function assignTracking(requestId: string, trackingNumber: string) {
  await requireAdmin();
  const tracking = trackingNumber.trim();
  if (!tracking) return { success: false as const, error: "Número de guía vacío" };

  try {
    const req = await prisma.materialRequest.findUnique({ where: { id: requestId } });
    if (!req) return { success: false as const, error: "Solicitud no encontrada" };
    if (req.deliveryMethod !== "SHIPPING") {
      return { success: false as const, error: "La guía solo aplica a envíos" };
    }
    const r = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { trackingNumber: tracking },
    });
    revalidatePath(`/requests/${requestId}`);
    return { success: true as const, data: r };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error al asignar guía" };
  }
}

export async function markReadyForPickup(requestId: string) {
  await requireAdmin();
  try {
    const req = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        requester: { select: { name: true, email: true } },
      },
    });
    if (!req) return { success: false as const, error: "Solicitud no encontrada" };
    if (req.status !== "PREPARING") {
      return { success: false as const, error: `No se puede marcar listo en estado ${req.status}` };
    }
    if (req.deliveryMethod !== "PICKUP") {
      return { success: false as const, error: "Esta solicitud es de envío, usa marcar enviado" };
    }

    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { status: "READY", fulfilledAt: new Date() },
    });

    const { commercial } = notifyEmails();
    notifyReadyOrShipped({
      to: [...commercial, req.requester.email],
      status: "READY",
      request: {
        folio: req.folio,
        requesterName: req.requester.name,
        deliveryMethod: req.deliveryMethod,
        receiverName: req.receiverName,
        notes: req.notes,
        items: req.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantityFulfilled || i.quantityRequested,
          unit: i.product.unit,
        })),
      },
    }).catch((e) => console.error("[notify] ready:", e));

    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    return { success: true as const, data: updated };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error" };
  }
}

export async function markShipped(requestId: string, trackingNumber?: string) {
  await requireAdmin();
  try {
    const tracking = trackingNumber?.trim();
    const req = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        items: { include: { product: { select: { name: true, unit: true } } } },
        requester: { select: { name: true, email: true } },
      },
    });
    if (!req) return { success: false as const, error: "Solicitud no encontrada" };
    if (req.status !== "PREPARING") {
      return { success: false as const, error: `No se puede enviar en estado ${req.status}` };
    }
    if (req.deliveryMethod !== "SHIPPING") {
      return { success: false as const, error: "Esta solicitud es pickup, usa marcar listo" };
    }
    const finalTracking = tracking || req.trackingNumber;
    if (!finalTracking) return { success: false as const, error: "Se requiere número de guía" };

    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { status: "SHIPPED", fulfilledAt: new Date(), trackingNumber: finalTracking },
    });

    const { commercial } = notifyEmails();
    notifyReadyOrShipped({
      to: [...commercial, req.requester.email],
      status: "SHIPPED",
      request: {
        folio: req.folio,
        requesterName: req.requester.name,
        deliveryMethod: req.deliveryMethod,
        receiverName: req.receiverName,
        notes: req.notes,
        trackingNumber: finalTracking,
        items: req.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantityFulfilled || i.quantityRequested,
          unit: i.product.unit,
        })),
      },
    }).catch((e) => console.error("[notify] shipped:", e));

    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    return { success: true as const, data: updated };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error" };
  }
}

export async function markDelivered(requestId: string) {
  await requireAdmin();
  try {
    const req = await prisma.materialRequest.findUnique({ where: { id: requestId } });
    if (!req) return { success: false as const, error: "Solicitud no encontrada" };
    if (req.status !== "SHIPPED" && req.status !== "READY") {
      return { success: false as const, error: `No se puede entregar en estado ${req.status}` };
    }
    const updated = await prisma.materialRequest.update({
      where: { id: requestId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    return { success: true as const, data: updated };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error" };
  }
}

export async function cancelRequest(requestId: string, reason?: string) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.materialRequest.findUnique({
        where: { id: requestId },
        include: { items: true },
      });
      if (!req) throw new Error("Solicitud no encontrada");

      // USER_MP solo puede cancelar las suyas en PENDING; ADMIN_MP puede cancelar siempre menos DELIVERED
      if (userRole !== "ADMIN_MP") {
        if (req.requesterId !== userId) throw new Error("No autorizado");
        if (req.status !== "PENDING") throw new Error("Solo puedes cancelar solicitudes en PENDING");
      }
      if (req.status === "DELIVERED" || req.status === "CANCELLED") {
        throw new Error(`No se puede cancelar en estado ${req.status}`);
      }

      // Si ya se había descontado inventario, restaurar
      const hadInventoryDeduction = ["PREPARING", "READY", "SHIPPED"].includes(req.status);
      if (hadInventoryDeduction) {
        await restoreInventoryInTx(
          tx,
          req.id,
          req.warehouseId,
          req.items.map((i) => ({ productId: i.productId, quantityFulfilled: i.quantityFulfilled })),
          userId,
        );
      }

      return tx.materialRequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason?.trim() || null,
        },
      });
    });

    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true as const, data: result };
  } catch (e: any) {
    return { success: false as const, error: e?.message ?? "Error al cancelar" };
  }
}

export async function getRequests(filters?: {
  status?: RequestStatus | "ALL";
  deliveryMethod?: DeliveryMethod;
}) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const userOrgId = (session.user as any).organizationId as string;
  const userRole = (session.user as any).role as string;

  const where: any = {};
  if (userRole !== "ADMIN_MP") {
    where.requesterId = userId;
  }
  if (filters?.status && filters.status !== "ALL") where.status = filters.status;
  if (filters?.deliveryMethod) where.deliveryMethod = filters.deliveryMethod;

  const list = await prisma.materialRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { name: true, email: true } },
      warehouse: { select: { name: true, organization: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
    take: 200,
  });
  // Field projection ya incluye trackingNumber a través de los campos default del modelo

  return { success: true as const, data: list };
}

export async function getRequestStatusCounts() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;

  const where: any = {};
  if (userRole !== "ADMIN_MP") where.requesterId = userId;

  const rows = await prisma.materialRequest.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const data = {
    PENDING: 0,
    PREPARING: 0,
    READY: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    total: 0,
  };
  for (const r of rows) {
    if (r.status in data) (data as any)[r.status] = r._count._all;
    data.total += r._count._all;
  }
  return { success: true as const, data };
}

export async function getRequest(id: string) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;

  const req = await prisma.materialRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { name: true, email: true } },
      preparedBy: { select: { name: true, email: true } },
      warehouse: { select: { name: true, organization: { select: { name: true } } } },
      items: {
        include: { product: { select: { name: true, sku: true, unit: true } } },
      },
      movements: {
        orderBy: { createdAt: "asc" },
        include: { product: { select: { name: true } } },
      },
    },
  });
  if (!req) return { success: false as const, error: "Solicitud no encontrada" };
  if (userRole !== "ADMIN_MP" && req.requesterId !== userId) {
    return { success: false as const, error: "No autorizado" };
  }
  return { success: true as const, data: req };
}
