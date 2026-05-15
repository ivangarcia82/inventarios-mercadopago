// src/app/actions/users.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_MP") throw new Error("No autorizado");
  return session!;
}

export async function getUsers() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true, organization: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { success: true as const, data: users };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN_MP" | "USER_MP";
  organizationId: string;
}) {
  await requireAdmin();
  try {
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
    });
    revalidatePath("/admin/users");
    return { success: true as const, data: { id: user.id, email: user.email } };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "El correo ya está registrado" };
    return { success: false as const, error: "Error al crear usuario" };
  }
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if ((session.user as any).id === id) return { success: false as const, error: "No puedes eliminar tu propia cuenta" };
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Error al eliminar usuario" };
  }
}
