// src/app/actions/movements.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type MovementType = "ENTRY" | "EXIT" | "TRANSFER" | "RETURN";

interface CreateMovementInput {
  type: MovementType;
  productId: string;
  quantity: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  reason?: string;
  notes?: string;
  receiverName?: string;
  trackingNumber?: string;
}

export async function createMovement(input: CreateMovementInput) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userId = (session.user as any).id as string;
  const userOrgId = (session.user as any).organizationId as string;
  const userRole = (session.user as any).role as string;

  if (input.quantity <= 0) return { success: false as const, error: "La cantidad debe ser mayor a 0" };

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) return { success: false as const, error: "Producto no encontrado" };
  if (userRole !== "ADMIN_MP" && product.organizationId !== userOrgId) {
    return { success: false as const, error: "No autorizado para mover este producto" };
  }

  try {
    const movement = await prisma.$transaction(async (tx) => {
      if (input.fromWarehouseId) {
        const originItem = await tx.inventoryItem.findUnique({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
        });
        const currentQty = originItem?.quantity ?? 0;
        if (currentQty < input.quantity) {
          throw new Error(`Stock insuficiente: hay ${currentQty} ${product.unit} en el almacén de origen`);
        }

        await tx.inventoryItem.upsert({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
          update: { quantity: { decrement: input.quantity } },
          create: { productId: input.productId, warehouseId: input.fromWarehouseId, quantity: 0 },
        });
      }

      if (input.toWarehouseId) {
        await tx.inventoryItem.upsert({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.toWarehouseId } },
          update: { quantity: { increment: input.quantity } },
          create: { productId: input.productId, warehouseId: input.toWarehouseId, quantity: input.quantity },
        });
      }

      const tracking = input.trackingNumber?.trim();
      const m = await tx.stockMovement.create({
        data: {
          type: input.type,
          productId: input.productId,
          fromWarehouseId: input.fromWarehouseId ?? null,
          toWarehouseId: input.toWarehouseId ?? null,
          quantity: input.quantity,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          receiverName: input.receiverName ?? null,
          trackingNumber: tracking && tracking.length > 0 ? tracking : null,
          createdById: userId,
        },
        include: {
          product: { select: { name: true, unit: true, sku: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      });
      return m;
    });

    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    return { success: true as const, data: movement };
  } catch (e: any) {
    return { success: false as const, error: e.message ?? "Error al registrar movimiento" };
  }
}

export async function getMovements(filters?: {
  organizationId?: string;
  type?: MovementType;
  productId?: string;
  warehouseId?: string;
  from?: Date;
  to?: Date;
}) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role as string;
  const userOrgId = (session.user as any).organizationId as string;

  // USER_MP ve todos los movimientos de su org (los crea admin al preparar sus solicitudes).
  // ADMIN_MP ve todos salvo que se filtre por org.
  const orgFilter: any =
    userRole === "ADMIN_MP" && !filters?.organizationId
      ? {}
      : { product: { organizationId: filters?.organizationId ?? userOrgId } };

  const warehouseFilter: any = filters?.warehouseId
    ? { OR: [{ fromWarehouseId: filters.warehouseId }, { toWarehouseId: filters.warehouseId }] }
    : {};

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...orgFilter,
      ...warehouseFilter,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.from || filters?.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    include: {
      product: { select: { name: true, unit: true, sku: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      request: { select: { id: true, folio: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { success: true as const, data: movements };
}

interface BatchMovementItem {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export async function createBatchMovements(
  items: BatchMovementItem[],
  receiverName?: string,
  trackingNumber?: string,
) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userId = (session.user as any).id as string;

  if (!items.length) return { success: false as const, error: "El carrito está vacío" };

  try {
    const movements: any[] = [];

    await prisma.$transaction(async (tx) => {
      const tracking = trackingNumber?.trim();
      const trackingValue = tracking && tracking.length > 0 ? tracking : null;

      for (const item of items) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          include: { product: { select: { unit: true, name: true } } },
        });
        const currentQty = inventoryItem?.quantity ?? 0;
        if (currentQty < item.quantity) {
          throw new Error(
            `Stock insuficiente para "${inventoryItem?.product?.name ?? item.productId}": hay ${currentQty} ${inventoryItem?.product?.unit ?? "uds"}`
          );
        }
        await tx.inventoryItem.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          data: { quantity: { decrement: item.quantity } },
        });
        const m = await tx.stockMovement.create({
          data: {
            type: "EXIT",
            productId: item.productId,
            fromWarehouseId: item.warehouseId,
            toWarehouseId: null,
            quantity: item.quantity,
            reason: "Salida POS",
            notes: null,
            receiverName: receiverName ?? null,
            trackingNumber: trackingValue,
            createdById: userId,
          },
          include: {
            product: { select: { name: true, unit: true, sku: true } },
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        });
        movements.push(m);
      }
    });

    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    return { success: true as const, data: movements };
  } catch (e: any) {
    return { success: false as const, error: e.message ?? "Error al registrar salida" };
  }
}
