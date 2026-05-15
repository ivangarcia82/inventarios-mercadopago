// scripts/import-initial.ts
// Carga inicial del inventario Mercado Pago desde scripts/_initial-products.json.
// Idempotente: re-ejecutarlo no duplica productos, solo actualiza stock al valor del JSON.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env" });

import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

interface InitialProduct {
  name: string;
  stock: number;
  pvs: string[];
  comments: string[];
}

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const needsSsl = /sslmode=(require|verify-ca|verify-full|prefer)/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  const products: InitialProduct[] = JSON.parse(
    readFileSync("scripts/_initial-products.json", "utf-8")
  );

  const org = await prisma.organization.findUnique({ where: { slug: "mercadopago" } });
  if (!org) throw new Error("Organización 'mercadopago' no existe. Corre `npm run seed` primero.");

  const warehouse = await prisma.warehouse.findUnique({
    where: { name_organizationId: { name: "Oficina CDMX", organizationId: org.id } },
  });
  if (!warehouse) throw new Error("Almacén 'Oficina CDMX' no existe en la org Mercado Pago.");

  console.log(`→ Cargando ${products.length} productos en ${warehouse.name} (${org.name})\n`);

  let created = 0;
  let updated = 0;
  let totalStock = 0;

  for (const p of products) {
    const sku = slug(p.name);
    const notes = [`PVs: ${p.pvs.join(", ")}`, ...p.comments].join(" | ");

    // Product (sin unique constraint en sku → findFirst + create/update)
    const existing = await prisma.product.findFirst({
      where: { sku, organizationId: org.id },
      select: { id: true },
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: { name: p.name, description: notes },
        })
      : await prisma.product.create({
          data: {
            name: p.name,
            sku,
            unit: "pza",
            description: notes,
            organizationId: org.id,
          },
        });

    const existedBefore = await prisma.inventoryItem.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });

    await prisma.inventoryItem.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: { quantity: p.stock },
      create: { productId: product.id, warehouseId: warehouse.id, quantity: p.stock },
    });

    if (existing) updated++;
    else created++;
    totalStock += p.stock;

    console.log(`  ${existing ? "↻" : "+"} ${sku.padEnd(45)} ${String(p.stock).padStart(6)} pza`);
  }

  console.log(`\n✅ Listo. Creados: ${created} · Actualizados: ${updated}`);
  console.log(`📦 Stock total cargado: ${totalStock.toLocaleString("es-MX")} piezas`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
