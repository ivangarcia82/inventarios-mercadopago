// scripts/seed.ts
import { config as loadEnv } from "dotenv";
// Mismo orden de precedencia que Next.js: .env.local pisa a .env.
// override: true es crítico porque @prisma/client auto-carga .env al importarse,
// dejando DATABASE_URL ya seteado en process.env cuando llega esta línea.
loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env" });

import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Organizaciones
  const mpAdmin = await prisma.organization.upsert({
    where: { slug: "mercadopago-admin" },
    update: {},
    create: { name: "Mercado Pago Admin", slug: "mercadopago-admin" },
  });
  console.log("✅ Organización Admin:", mpAdmin.name);

  const mp = await prisma.organization.upsert({
    where: { slug: "mercadopago" },
    update: {},
    create: { name: "Mercado Pago", slug: "mercadopago" },
  });
  console.log("✅ Organización Mercado Pago:", mp.name);

  // Almacén Admin
  const adminAlmacen = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Almacén Central", organizationId: mpAdmin.id } },
    update: {},
    create: { name: "Almacén Central", organizationId: mpAdmin.id },
  });
  console.log("✅ Almacén Admin:", adminAlmacen.name);

  // Almacenes Mercado Pago
  const mpCDMX = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina CDMX", organizationId: mp.id } },
    update: {},
    create: { name: "Oficina CDMX", organizationId: mp.id },
  });
  const mpMTY = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina Monterrey", organizationId: mp.id } },
    update: {},
    create: { name: "Oficina Monterrey", organizationId: mp.id },
  });
  console.log("✅ Almacenes Mercado Pago:", mpCDMX.name, "|", mpMTY.name);

  // Usuario Admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mercadopago.com" },
    update: {},
    create: {
      email: "admin@mercadopago.com",
      password: adminPassword,
      name: "Administrador Mercado Pago",
      role: "ADMIN_MP",
      organizationId: mpAdmin.id,
    },
  });
  console.log("✅ Usuario admin:", admin.email);

  // Usuario demo Mercado Pago
  const mpPassword = await bcrypt.hash("mercadopago123", 10);
  const mpUser = await prisma.user.upsert({
    where: { email: "usuario@mercadopago.com" },
    update: {},
    create: {
      email: "usuario@mercadopago.com",
      password: mpPassword,
      name: "Usuario Mercado Pago Demo",
      role: "USER_MP",
      organizationId: mp.id,
    },
  });
  console.log("✅ Usuario Mercado Pago:", mpUser.email);

  console.log("\n📋 Credenciales:");
  console.log("   Admin:        admin@mercadopago.com / admin123");
  console.log("   Usuario MP:   usuario@mercadopago.com / mercadopago123");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
