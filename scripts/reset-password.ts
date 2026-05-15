import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const EMAIL = "admin@generandoideas.com";
const NEW_PASSWORD = "admin123";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!existing) {
    console.error(`❌ No existe el usuario ${EMAIL}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
  const updated = await prisma.user.update({
    where: { email: EMAIL },
    data: { password: hashed },
    select: { email: true, name: true, role: true },
  });

  console.log("✅ Contraseña actualizada:");
  console.log(`   ${updated.email} (${updated.role}) → ${NEW_PASSWORD}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
