// src/app/actions/products.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_MP") throw new Error("No autorizado");
  return session!;
}

function serializeProduct<T extends { price?: any } | null | undefined>(p: T): T {
  if (!p) return p;
  return { ...p, price: p.price != null ? Number(p.price) : null } as T;
}

export async function getProducts(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const orgId = organizationId ?? (session.user as any).organizationId;

  if (userRole !== "ADMIN_MP" && orgId !== (session.user as any).organizationId) {
    return { success: false as const, error: "No autorizado" };
  }

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
    include: { organization: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return { success: true as const, data: products.map(serializeProduct) };
}

export async function getAllProducts() {
  await requireAdmin();
  const products = await prisma.product.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  });
  return { success: true as const, data: products.map(serializeProduct) };
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  unit: string;
  description?: string;
  price?: number | null;
  organizationId: string;
}) {
  await requireAdmin();
  try {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        description: data.description,
        price: data.price != null ? data.price : null,
        organizationId: data.organizationId,
      },
    });
    revalidatePath("/admin/products");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true as const, data: serializeProduct(product) };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Ya existe un producto con ese SKU en la organización" };
    return { success: false as const, error: "Error al crear producto" };
  }
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/products");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "No se puede eliminar: tiene movimientos o inventario asociado" };
  }
}
