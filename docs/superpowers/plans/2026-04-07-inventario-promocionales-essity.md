# Sistema de Inventario de Promocionales — Essity/GI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una plataforma web multi-tenant con Next.js para que Generando Ideas administre el inventario de promocionales de Essity y los propios, con dashboard tipo POS, movimientos de stock, multi-almacén y dos roles de usuario.

**Architecture:** Monolito Next.js 15 con App Router y Server Actions. Multi-tenant por campo `organizationId` en cada entidad. La sesión JWT lleva `role` y `organizationId` para filtrar datos en cada acción del servidor. Todas las mutaciones de stock usan transacciones de Prisma para garantizar consistencia.

**Tech Stack:** Next.js 16, Prisma 6 + @prisma/adapter-pg, PostgreSQL 15 (Docker), NextAuth v5 (credentials + JWT), Tailwind CSS v4, shadcn/ui, Recharts, Zod, React Hook Form, bcryptjs.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `docker-compose.yml` | PostgreSQL local |
| `prisma/schema.prisma` | Modelos: Organization, Warehouse, User, Product, InventoryItem, StockMovement |
| `prisma.config.ts` | Config de Prisma CLI |
| `scripts/seed.ts` | Datos iniciales: orgs GI/Essity, almacenes, usuario admin |
| `src/middleware.ts` | Protección de rutas via NextAuth |
| `src/lib/auth.config.ts` | Config edge-compatible de NextAuth (callbacks JWT/session) |
| `src/lib/auth.ts` | NextAuth completo con proveedor Credentials |
| `src/lib/prisma.ts` | Singleton PrismaClient con pg adapter |
| `src/types/next-auth.d.ts` | Extensión de tipos de sesión (role, organizationId) |
| `src/app/layout.tsx` | Root layout |
| `src/app/globals.css` | Estilos globales Tailwind |
| `src/app/(auth)/login/page.tsx` | Página de login |
| `src/app/(app)/layout.tsx` | Layout protegido con sidebar |
| `src/components/sidebar.tsx` | Navegación lateral con items por rol |
| `src/app/(app)/dashboard/page.tsx` | Resumen: stock total, movimientos recientes |
| `src/app/(app)/inventory/page.tsx` | Stock por producto y almacén |
| `src/app/(app)/movements/page.tsx` | Historial de movimientos con filtros |
| `src/app/(app)/movements/new/page.tsx` | Formulario POS para registrar movimiento |
| `src/app/(app)/admin/warehouses/page.tsx` | CRUD almacenes (ADMIN_GI) |
| `src/app/(app)/admin/products/page.tsx` | CRUD productos (ADMIN_GI) |
| `src/app/(app)/admin/users/page.tsx` | CRUD usuarios (ADMIN_GI) |
| `src/app/actions/warehouses.ts` | Server actions: getWarehouses, createWarehouse, deleteWarehouse |
| `src/app/actions/products.ts` | Server actions: getProducts, createProduct, deleteProduct |
| `src/app/actions/users.ts` | Server actions: getUsers, createUser, deleteUser |
| `src/app/actions/inventory.ts` | Server actions: getInventory, getInventorySummary |
| `src/app/actions/movements.ts` | Server actions: getMovements, createMovement (ENTRY/EXIT/TRANSFER/RETURN) |

---

## Task 1: Scaffold del proyecto

**Files:**
- Create: `sistema-inventarios-essity/` (directorio raíz del proyecto)

- [ ] **Step 1: Crear proyecto Next.js**

```bash
cd /Users/ivan/Documents
npx create-next-app@16.1.6 sistema-inventarios-essity \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack
cd sistema-inventarios-essity
```

- [ ] **Step 2: Instalar dependencias de producción**

```bash
npm install next-auth@beta \
  @prisma/client@^6.4.1 \
  @prisma/adapter-pg@^6.4.1 \
  pg@^8.18.0 \
  bcryptjs@^3.0.3 \
  zod@^4.3.6 \
  react-hook-form@^7.71.1 \
  @hookform/resolvers@^5.2.2 \
  recharts@^3.7.0 \
  lucide-react@^0.563.0 \
  clsx@^2.1.1 \
  tailwind-merge@^3.4.0 \
  class-variance-authority@^0.7.1 \
  date-fns@^4.1.0 \
  dotenv@^17.3.1
```

- [ ] **Step 3: Instalar dependencias de desarrollo**

```bash
npm install -D prisma@^6.4.1 \
  @types/bcryptjs@^2.4.6 \
  @types/pg@^8.16.0 \
  shadcn@^3.8.4 \
  tw-animate-css@^1.4.0
```

- [ ] **Step 4: Inicializar shadcn/ui**

```bash
npx shadcn@latest init
```
Cuando pregunte: style → Default, base color → Slate, CSS variables → Yes.

- [ ] **Step 5: Agregar componentes de shadcn necesarios**

```bash
npx shadcn@latest add button input label card table badge select dialog form
```

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
npm run build
```
Expected: compilación exitosa sin errores.

- [ ] **Step 7: Commit inicial**

```bash
git add -A
git commit -m "feat: scaffold inicial Next.js + shadcn/ui"
```

---

## Task 2: Docker Compose y variables de entorno

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.local`
- Create: `.env.example`
- Create: `prisma.config.ts`

- [ ] **Step 1: Crear docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: essity_inventory_postgres
    restart: always
    environment:
      POSTGRES_USER: essity_user
      POSTGRES_PASSWORD: essity_password
      POSTGRES_DB: essity_inventory_db
    ports:
      - "5441:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Crear .env.local**

```bash
# .env.local
DATABASE_URL="postgresql://essity_user:essity_password@localhost:5441/essity_inventory_db"
AUTH_SECRET="generate-a-random-secret-here-min-32-chars"
```

Para generar el secret: `openssl rand -base64 32`

- [ ] **Step 3: Crear .env.example**

```bash
# .env.example
DATABASE_URL="postgresql://user:password@localhost:5441/essity_inventory_db"
AUTH_SECRET="your-nextauth-secret-min-32-chars"
```

- [ ] **Step 4: Crear prisma.config.ts**

```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 5: Agregar .env.local al .gitignore**

Verificar que `.gitignore` ya incluya `.env*.local` (create-next-app lo hace por defecto). Si no está:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 6: Levantar la base de datos**

```bash
docker compose up -d
```
Expected: contenedor `essity_inventory_postgres` corriendo.

```bash
docker compose ps
```
Expected: estado `running`.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example prisma.config.ts .gitignore
git commit -m "feat: docker compose PostgreSQL y variables de entorno"
```

---

## Task 3: Schema de Prisma y migraciones

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Inicializar Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Reemplazar prisma/schema.prisma con el schema completo**

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(uuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())

  warehouses Warehouse[]
  products   Product[]
  users      User[]
}

model Warehouse {
  id             String       @id @default(uuid())
  name           String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now())

  inventoryItems InventoryItem[]
  movementsFrom  StockMovement[] @relation("FromWarehouse")
  movementsTo    StockMovement[] @relation("ToWarehouse")

  @@unique([name, organizationId])
}

model User {
  id             String       @id @default(uuid())
  email          String       @unique
  password       String
  name           String
  role           String       @default("USER_ESSITY") // "ADMIN_GI" | "USER_ESSITY"
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now())

  movements StockMovement[]
}

model Product {
  id             String       @id @default(uuid())
  name           String
  sku            String?
  unit           String       @default("pza")
  description    String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now())

  inventoryItems InventoryItem[]
  movements      StockMovement[]

  @@index([organizationId])
}

model InventoryItem {
  id          String    @id @default(uuid())
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  quantity    Int       @default(0)
  updatedAt   DateTime  @updatedAt

  @@unique([productId, warehouseId])
}

model StockMovement {
  id              String     @id @default(uuid())
  type            String     // "ENTRY" | "EXIT" | "TRANSFER" | "RETURN"
  productId       String
  product         Product    @relation(fields: [productId], references: [id])
  fromWarehouseId String?
  fromWarehouse   Warehouse? @relation("FromWarehouse", fields: [fromWarehouseId], references: [id])
  toWarehouseId   String?
  toWarehouse     Warehouse? @relation("ToWarehouse", fields: [toWarehouseId], references: [id])
  quantity        Int
  reason          String?
  notes           String?
  createdById     String
  createdBy       User       @relation(fields: [createdById], references: [id])
  createdAt       DateTime   @default(now())

  @@index([productId])
  @@index([createdById])
  @@index([createdAt])
}
```

- [ ] **Step 3: Ejecutar migración inicial**

```bash
npx prisma migrate dev --name init
```
Expected: migración `0001_init` creada y aplicada sin errores.

- [ ] **Step 4: Generar el cliente de Prisma**

```bash
npx prisma generate
```
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: schema prisma con Organization, Warehouse, Product, InventoryItem, StockMovement"
```

---

## Task 4: Seed — datos iniciales

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json` (agregar script `seed`)

- [ ] **Step 1: Crear scripts/seed.ts**

```typescript
// scripts/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Organizaciones
  const gi = await prisma.organization.upsert({
    where: { slug: "generando-ideas" },
    update: {},
    create: { name: "Generando Ideas", slug: "generando-ideas" },
  });
  console.log("✅ Organización GI:", gi.name);

  const essity = await prisma.organization.upsert({
    where: { slug: "essity" },
    update: {},
    create: { name: "Essity", slug: "essity" },
  });
  console.log("✅ Organización Essity:", essity.name);

  // Almacenes GI
  const giAlmacen = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Almacén Central GI", organizationId: gi.id } },
    update: {},
    create: { name: "Almacén Central GI", organizationId: gi.id },
  });
  console.log("✅ Almacén GI:", giAlmacen.name);

  // Almacenes Essity
  const essityCDMX = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina CDMX", organizationId: essity.id } },
    update: {},
    create: { name: "Oficina CDMX", organizationId: essity.id },
  });
  const essityMTY = await prisma.warehouse.upsert({
    where: { name_organizationId: { name: "Oficina Monterrey", organizationId: essity.id } },
    update: {},
    create: { name: "Oficina Monterrey", organizationId: essity.id },
  });
  console.log("✅ Almacenes Essity:", essityCDMX.name, "|", essityMTY.name);

  // Usuario Admin GI
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@generandoideas.com" },
    update: {},
    create: {
      email: "admin@generandoideas.com",
      password: adminPassword,
      name: "Administrador GI",
      role: "ADMIN_GI",
      organizationId: gi.id,
    },
  });
  console.log("✅ Usuario admin:", admin.email);

  // Usuario demo Essity
  const essityPassword = await bcrypt.hash("essity123", 10);
  const essityUser = await prisma.user.upsert({
    where: { email: "usuario@essity.com" },
    update: {},
    create: {
      email: "usuario@essity.com",
      password: essityPassword,
      name: "Usuario Essity Demo",
      role: "USER_ESSITY",
      organizationId: essity.id,
    },
  });
  console.log("✅ Usuario Essity:", essityUser.email);

  console.log("\n📋 Credenciales:");
  console.log("   Admin GI:     admin@generandoideas.com / admin123");
  console.log("   Usuario Essity: usuario@essity.com / essity123");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Agregar script seed en package.json**

Abrir `package.json` y agregar dentro de `"scripts"`:

```json
"seed": "npx tsx scripts/seed.ts"
```

- [ ] **Step 3: Instalar tsx para ejecutar TypeScript directamente**

```bash
npm install -D tsx
```

- [ ] **Step 4: Ejecutar el seed**

```bash
npm run seed
```
Expected:
```
✅ Organización GI: Generando Ideas
✅ Organización Essity: Essity
✅ Almacén GI: Almacén Central GI
✅ Almacenes Essity: Oficina CDMX | Oficina Monterrey
✅ Usuario admin: admin@generandoideas.com
✅ Usuario Essity: usuario@essity.com
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: seed con organizaciones GI/Essity, almacenes y usuarios demo"
```

---

## Task 5: Autenticación (NextAuth v5)

**Files:**
- Create: `src/types/next-auth.d.ts`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/auth.config.ts`
- Create: `src/lib/auth.ts`
- Create: `src/middleware.ts`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Crear src/types/next-auth.d.ts**

```typescript
// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    organizationId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    organizationId: string;
  }
}
```

- [ ] **Step 2: Crear src/lib/prisma.ts**

```typescript
// src/lib/prisma.ts
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as any);
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();
export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
```

- [ ] **Step 3: Crear src/lib/auth.config.ts**

```typescript
// src/lib/auth.config.ts
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      if (nextUrl.pathname.startsWith("/admin")) {
        return (auth?.user as any)?.role === "ADMIN_GI";
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
```

- [ ] **Step 4: Crear src/lib/auth.ts**

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        const match = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!match) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});
```

- [ ] **Step 5: Crear src/middleware.ts**

```typescript
// src/middleware.ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Crear src/lib/utils.ts**

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Agregar ruta de handlers de NextAuth**

Crear `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 8: Verificar compilación**

```bash
npm run build
```
Expected: sin errores de TypeScript.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: auth NextAuth v5 con roles ADMIN_GI y USER_ESSITY"
```

---

## Task 6: App shell — layouts, sidebar y login

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/globals.css` (reemplazar el generado)
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/sidebar.tsx`

- [ ] **Step 1: Reemplazar src/app/layout.tsx**

```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inventario Promocionales",
  description: "Sistema de Inventario de Promocionales Essity / Generando Ideas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Crear src/app/(auth)/login/page.tsx**

```typescript
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Credenciales inválidas.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Inventario Promocionales</h1>
            <p className="text-slate-400 mt-1 text-sm">Essity · Generando Ideas</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-red-300 text-sm text-center bg-red-500/20 border border-red-500/30 rounded-xl p-3">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear src/components/sidebar.tsx**

```typescript
// src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard, Package, ArrowLeftRight, Warehouse,
  Users, ShoppingCart, ChevronLeft, ChevronRight, LogOut,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventario", href: "/inventory", icon: Package },
  { label: "Movimientos", href: "/movements", icon: ArrowLeftRight },
  { label: "Registrar Movimiento", href: "/movements/new", icon: ShoppingCart },
];

const adminItems = [
  { label: "Almacenes", href: "/admin/warehouses", icon: Warehouse },
  { label: "Productos", href: "/admin/products", icon: Package },
  { label: "Usuarios", href: "/admin/users", icon: Users },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  orgName: string;
}

export function Sidebar({ userName, userRole, orgName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = userRole === "ADMIN_GI";

  return (
    <aside className={`flex flex-col h-screen bg-slate-900 text-white border-r border-slate-800 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-[240px]"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shrink-0">
          <Package className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-sm tracking-tight whitespace-nowrap">Inventario Promo</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            {!collapsed && <p className="text-xs text-slate-500 uppercase px-3 pt-4 pb-1 font-semibold tracking-wider">Admin</p>}
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        {!collapsed && (
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{orgName}</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white text-sm transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Colapsar</span>}
        </button>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-red-900/40 hover:text-red-400 text-sm transition-colors">
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Crear src/app/(app)/layout.tsx**

```typescript
// src/app/(app)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import prisma from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userRole = (session.user as any).role as string;
  const orgId = (session.user as any).organizationId as string;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          userName={session.user.name ?? "Usuario"}
          userRole={userRole}
          orgName={org?.name ?? ""}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 px-8 py-6">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
```

- [ ] **Step 5: Crear placeholder para la raíz que redirija a /dashboard**

```typescript
// src/app/page.tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: Verificar que el login funciona**

```bash
npm run dev
```
Abrir `http://localhost:3000/login` e ingresar con `admin@generandoideas.com / admin123`. Debe redirigir a `/dashboard` (página aún vacía está bien).

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: app shell con layout, sidebar y login"
```

---

## Task 7: Server Actions — Almacenes y página admin/warehouses

**Files:**
- Create: `src/app/actions/warehouses.ts`
- Create: `src/app/(app)/admin/warehouses/page.tsx`

- [ ] **Step 1: Crear src/app/actions/warehouses.ts**

```typescript
// src/app/actions/warehouses.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
  return session!;
}

export async function getWarehouses(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const orgId = organizationId ?? (session.user as any).organizationId;
  const userRole = (session.user as any).role;

  // USER_ESSITY solo puede ver su propia org
  if (userRole !== "ADMIN_GI" && orgId !== (session.user as any).organizationId) {
    return { success: false as const, error: "No autorizado" };
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId: orgId },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { success: true as const, data: warehouses };
}

export async function getAllWarehouses() {
  await requireAdmin();
  const warehouses = await prisma.warehouse.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  });
  return { success: true as const, data: warehouses };
}

export async function getOrganizations() {
  await requireAdmin();
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  return { success: true as const, data: orgs };
}

export async function createWarehouse(data: { name: string; organizationId: string }) {
  await requireAdmin();
  try {
    const warehouse = await prisma.warehouse.create({ data });
    revalidatePath("/admin/warehouses");
    revalidatePath("/inventory");
    return { success: true as const, data: warehouse };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false as const, error: "Ya existe un almacén con ese nombre en la organización" };
    return { success: false as const, error: "Error al crear almacén" };
  }
}

export async function deleteWarehouse(id: string) {
  await requireAdmin();
  try {
    await prisma.warehouse.delete({ where: { id } });
    revalidatePath("/admin/warehouses");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "No se puede eliminar: tiene movimientos o inventario asociado" };
  }
}
```

- [ ] **Step 2: Crear src/app/(app)/admin/warehouses/page.tsx**

```typescript
// src/app/(app)/admin/warehouses/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllWarehouses, getOrganizations, createWarehouse, deleteWarehouse } from "@/app/actions/warehouses";
import { Trash2, Plus } from "lucide-react";

type Warehouse = { id: string; name: string; organizationId: string; organization: { name: string }; createdAt: Date };
type Org = { id: string; name: string };

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [wRes, oRes] = await Promise.all([getAllWarehouses(), getOrganizations()]);
    if (wRes.success) setWarehouses(wRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setOrgId(oRes.data[0]?.id ?? ""); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createWarehouse({ name, organizationId: orgId });
    if (!res.success) setError(res.error ?? "Error");
    else { setName(""); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este almacén?")) return;
    const res = await deleteWarehouse(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Almacenes</h1>

      {/* Formulario */}
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del almacén</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej. Bodega Norte" />
        </div>
        <div className="w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">Organización</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </form>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Organización</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warehouses.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{w.name}</td>
                <td className="px-4 py-3 text-slate-500">{w.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(w.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Sin almacenes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Iniciar sesión como admin e ir a `/admin/warehouses`. Crear un almacén de prueba para Essity. Verificar que aparece en la tabla y se puede eliminar.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: CRUD almacenes — server actions + página admin"
```

---

## Task 8: Server Actions — Productos y página admin/products

**Files:**
- Create: `src/app/actions/products.ts`
- Create: `src/app/(app)/admin/products/page.tsx`

- [ ] **Step 1: Crear src/app/actions/products.ts**

```typescript
// src/app/actions/products.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
  return session!;
}

export async function getProducts(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const orgId = organizationId ?? (session.user as any).organizationId;

  if (userRole !== "ADMIN_GI" && orgId !== (session.user as any).organizationId) {
    return { success: false as const, error: "No autorizado" };
  }

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
    include: { organization: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return { success: true as const, data: products };
}

export async function getAllProducts() {
  await requireAdmin();
  const products = await prisma.product.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  });
  return { success: true as const, data: products };
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  unit: string;
  description?: string;
  organizationId: string;
}) {
  await requireAdmin();
  try {
    const product = await prisma.product.create({ data });
    revalidatePath("/admin/products");
    revalidatePath("/inventory");
    return { success: true as const, data: product };
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
```

- [ ] **Step 2: Crear src/app/(app)/admin/products/page.tsx**

```typescript
// src/app/(app)/admin/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllProducts, getOrganizations, createProduct, deleteProduct } from "@/app/actions/products";
import { getOrganizations as getOrgs } from "@/app/actions/warehouses";
import { Trash2, Plus } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; unit: string; description: string | null; organization: { name: string } };
type Org = { id: string; name: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", unit: "pza", description: "", organizationId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [pRes, oRes] = await Promise.all([getAllProducts(), getOrgs()]);
    if (pRes.success) setProducts(pRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createProduct({
      name: form.name,
      sku: form.sku || undefined,
      unit: form.unit,
      description: form.description || undefined,
      organizationId: form.organizationId,
    });
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, name: "", sku: "", description: "" })); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const res = await deleteProduct(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Productos</h1>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej. Taza personalizada" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej. TAZA-001" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {["pza", "caja", "kit", "par", "rollo"].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Organización</label>
          <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descripción opcional" />
        </div>
        <div className="col-span-2 flex justify-end">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Agregar producto
          </button>
        </div>
      </form>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Unidad</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Organización</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.sku ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                <td className="px-4 py-3 text-slate-500">{p.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin productos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Ir a `/admin/products`. Crear 2–3 productos de prueba para Essity. Verificar que aparecen y se pueden eliminar.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: CRUD productos — server actions + página admin"
```

---

## Task 9: Server Actions — Usuarios y página admin/users

**Files:**
- Create: `src/app/actions/users.ts`
- Create: `src/app/(app)/admin/users/page.tsx`

- [ ] **Step 1: Crear src/app/actions/users.ts**

```typescript
// src/app/actions/users.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN_GI") throw new Error("No autorizado");
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
  role: "ADMIN_GI" | "USER_ESSITY";
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
```

- [ ] **Step 2: Crear src/app/(app)/admin/users/page.tsx**

```typescript
// src/app/(app)/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getUsers, createUser, deleteUser } from "@/app/actions/users";
import { getOrganizations } from "@/app/actions/warehouses";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type User = { id: string; email: string; name: string; role: string; organization: { name: string }; createdAt: Date };
type Org = { id: string; name: string };

const roleLabel: Record<string, string> = { ADMIN_GI: "Admin GI", USER_ESSITY: "Usuario Essity" };
const roleBadge: Record<string, string> = { ADMIN_GI: "bg-indigo-100 text-indigo-700", USER_ESSITY: "bg-green-100 text-green-700" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "USER_ESSITY" as "ADMIN_GI" | "USER_ESSITY", organizationId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [uRes, oRes] = await Promise.all([getUsers(), getOrganizations()]);
    if (uRes.success) setUsers(uRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createUser(form);
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, email: "", password: "", name: "" })); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await deleteUser(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Usuarios</h1>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 mb-6 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="USER_ESSITY">Usuario Essity</option>
            <option value="ADMIN_GI">Admin GI</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Organización</label>
          <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex justify-end">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Crear usuario
          </button>
        </div>
      </form>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Organización</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role] ?? "bg-slate-100 text-slate-700"}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(u.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Ir a `/admin/users`. Crear un usuario de prueba para Essity. Verificar que aparece con el badge correcto.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: CRUD usuarios — server actions + página admin"
```

---

## Task 10: Server Actions — Inventario y página /inventory

**Files:**
- Create: `src/app/actions/inventory.ts`
- Create: `src/app/(app)/inventory/page.tsx`

- [ ] **Step 1: Crear src/app/actions/inventory.ts**

```typescript
// src/app/actions/inventory.ts
"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function getInventory(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const userOrgId = (session.user as any).organizationId;
  const targetOrgId = organizationId ?? userOrgId;

  if (userRole !== "ADMIN_GI" && targetOrgId !== userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const items = await prisma.inventoryItem.findMany({
    where: { product: { organizationId: targetOrgId } },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
  });

  return { success: true as const, data: items };
}

export async function getInventorySummary(organizationId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userRole = (session.user as any).role;
  const userOrgId = (session.user as any).organizationId;
  const targetOrgId = organizationId ?? userOrgId;

  if (userRole !== "ADMIN_GI" && targetOrgId !== userOrgId) {
    return { success: false as const, error: "No autorizado" };
  }

  const [totalProducts, totalStock, lowStockCount] = await Promise.all([
    prisma.product.count({ where: { organizationId: targetOrgId } }),
    prisma.inventoryItem.aggregate({
      where: { product: { organizationId: targetOrgId } },
      _sum: { quantity: true },
    }),
    prisma.inventoryItem.count({
      where: { product: { organizationId: targetOrgId }, quantity: { lte: 5 } },
    }),
  ]);

  return {
    success: true as const,
    data: {
      totalProducts,
      totalStock: totalStock._sum.quantity ?? 0,
      lowStockCount,
    },
  };
}
```

- [ ] **Step 2: Crear src/app/(app)/inventory/page.tsx**

```typescript
// src/app/(app)/inventory/page.tsx
import { auth } from "@/lib/auth";
import { getInventory } from "@/app/actions/inventory";
import { getOrganizations } from "@/app/actions/warehouses";
import { InventoryTable } from "@/components/inventory-table";

export default async function InventoryPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userOrgId = (session?.user as any)?.organizationId;

  const orgsRes = userRole === "ADMIN_GI" ? await getOrganizations() : { success: true, data: [] };
  const inventoryRes = await getInventory(userOrgId);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Inventario</h1>
      <InventoryTable
        initialItems={inventoryRes.success ? (inventoryRes.data as any) : []}
        orgs={orgsRes.success ? (orgsRes as any).data : []}
        userRole={userRole}
        defaultOrgId={userOrgId}
      />
    </div>
  );
}
```

- [ ] **Step 3: Crear src/components/inventory-table.tsx**

```typescript
// src/components/inventory-table.tsx
"use client";

import { useState } from "react";
import { getInventory } from "@/app/actions/inventory";
import { AlertTriangle } from "lucide-react";

type InventoryItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string };
  warehouse: { id: string; name: string };
};
type Org = { id: string; name: string };

interface Props {
  initialItems: InventoryItem[];
  orgs: Org[];
  userRole: string;
  defaultOrgId: string;
}

export function InventoryTable({ initialItems, orgs, userRole, defaultOrgId }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedOrg, setSelectedOrg] = useState(defaultOrgId);
  const [search, setSearch] = useState("");

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrg(orgId);
    const res = await getInventory(orgId);
    if (res.success) setItems(res.data as any);
  };

  const filtered = items.filter(
    (i) =>
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      i.warehouse.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar producto o almacén..." />
        {userRole === "ADMIN_GI" && (
          <select value={selectedOrg} onChange={(e) => handleOrgChange(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {orgs.map((o: Org) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Almacén</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{item.product.name}</td>
                <td className="px-4 py-3 text-slate-500">{item.product.sku ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{item.warehouse.name}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 font-semibold ${item.quantity <= 5 ? "text-red-600" : "text-slate-800"}`}>
                    {item.quantity <= 5 && <AlertTriangle className="w-3.5 h-3.5" />}
                    {item.quantity} {item.product.unit}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                {items.length === 0 ? "Sin inventario registrado" : "Sin resultados para la búsqueda"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar en el navegador**

Ir a `/inventory`. Debe mostrar la tabla (vacía por ahora). Luego de agregar movimientos en tasks posteriores, aquí se verá el stock.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: página de inventario con filtro por organización y búsqueda"
```

---

## Task 11: Server Actions — Movimientos de stock (lógica core)

**Files:**
- Create: `src/app/actions/movements.ts`

- [ ] **Step 1: Crear src/app/actions/movements.ts**

```typescript
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
}

export async function createMovement(input: CreateMovementInput) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "No autorizado" };

  const userId = (session.user as any).id as string;
  const userOrgId = (session.user as any).organizationId as string;
  const userRole = (session.user as any).role as string;

  if (input.quantity <= 0) return { success: false as const, error: "La cantidad debe ser mayor a 0" };

  // Verificar que el producto pertenece a la organización del usuario (o admin puede moverlo)
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) return { success: false as const, error: "Producto no encontrado" };
  if (userRole !== "ADMIN_GI" && product.organizationId !== userOrgId) {
    return { success: false as const, error: "No autorizado para mover este producto" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Validar stock de origen si aplica
      if (input.fromWarehouseId) {
        const originItem = await tx.inventoryItem.findUnique({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
        });
        const currentQty = originItem?.quantity ?? 0;
        if (currentQty < input.quantity) {
          throw new Error(`Stock insuficiente: hay ${currentQty} ${product.unit} en el almacén de origen`);
        }

        // Restar del origen
        await tx.inventoryItem.upsert({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
          update: { quantity: { decrement: input.quantity } },
          create: { productId: input.productId, warehouseId: input.fromWarehouseId, quantity: 0 },
        });
      }

      // Sumar al destino si aplica
      if (input.toWarehouseId) {
        await tx.inventoryItem.upsert({
          where: { productId_warehouseId: { productId: input.productId, warehouseId: input.toWarehouseId } },
          update: { quantity: { increment: input.quantity } },
          create: { productId: input.productId, warehouseId: input.toWarehouseId, quantity: input.quantity },
        });
      }

      // Registrar movimiento
      await tx.stockMovement.create({
        data: {
          type: input.type,
          productId: input.productId,
          fromWarehouseId: input.fromWarehouseId ?? null,
          toWarehouseId: input.toWarehouseId ?? null,
          quantity: input.quantity,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          createdById: userId,
        },
      });
    });

    revalidatePath("/inventory");
    revalidatePath("/movements");
    revalidatePath("/dashboard");
    return { success: true as const };
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
  const userId = (session.user as any).id as string;

  const orgId = filters?.organizationId ?? userOrgId;

  // USER_ESSITY solo ve sus propios movimientos
  const createdByFilter = userRole !== "ADMIN_GI" ? { createdById: userId } : {};

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...createdByFilter,
      product: { organizationId: orgId },
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
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { success: true as const, data: movements };
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```
Expected: sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/movements.ts
git commit -m "feat: server actions de movimientos de stock con transacciones atómicas"
```

---

## Task 12: Página de nuevo movimiento (POS)

**Files:**
- Create: `src/app/(app)/movements/new/page.tsx`
- Create: `src/components/pos/movement-form.tsx`

- [ ] **Step 1: Crear src/components/pos/movement-form.tsx**

```typescript
// src/components/pos/movement-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMovement } from "@/app/actions/movements";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Warehouse = { id: string; name: string; organizationId: string };

interface Props {
  products: Product[];
  warehouses: Warehouse[];
  userRole: string;
}

type MovementType = "ENTRY" | "EXIT" | "TRANSFER" | "RETURN";

const typeConfig: Record<MovementType, { label: string; needsFrom: boolean; needsTo: boolean; color: string }> = {
  ENTRY:    { label: "Entrada",       needsFrom: false, needsTo: true,  color: "bg-green-600 hover:bg-green-700" },
  EXIT:     { label: "Salida",        needsFrom: true,  needsTo: false, color: "bg-red-600 hover:bg-red-700" },
  TRANSFER: { label: "Transferencia", needsFrom: true,  needsTo: true,  color: "bg-blue-600 hover:bg-blue-700" },
  RETURN:   { label: "Devolución",    needsFrom: false, needsTo: true,  color: "bg-amber-600 hover:bg-amber-700" },
};

export function MovementForm({ products, warehouses, userRole }: Props) {
  const router = useRouter();
  const types: MovementType[] = userRole === "ADMIN_GI"
    ? ["ENTRY", "EXIT", "TRANSFER", "RETURN"]
    : ["EXIT", "TRANSFER", "RETURN"];

  const [type, setType] = useState<MovementType>(types[0]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const config = typeConfig[type];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { setError("Cantidad inválida"); setLoading(false); return; }

    const res = await createMovement({
      type,
      productId,
      quantity: qty,
      fromWarehouseId: config.needsFrom ? fromWarehouseId : undefined,
      toWarehouseId: config.needsTo ? toWarehouseId : undefined,
      reason: reason || undefined,
      notes: notes || undefined,
    });

    if (!res.success) {
      setError(res.error ?? "Error al registrar");
    } else {
      setSuccess(true);
      setQuantity("");
      setReason("");
      setNotes("");
      setTimeout(() => { setSuccess(false); router.refresh(); }, 2000);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg space-y-5">
      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de movimiento</label>
        <div className="flex gap-2 flex-wrap">
          {types.map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border-2 ${type === t ? `${typeConfig[t].color} text-white border-transparent` : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {typeConfig[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Producto */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Producto *</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
          ))}
        </select>
      </div>

      {/* Cantidad */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad *</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0" />
      </div>

      {/* Almacén origen */}
      {config.needsFrom && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Almacén origen *</label>
          <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}

      {/* Almacén destino */}
      {config.needsTo && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Almacén destino *</label>
          <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}

      {/* Motivo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ej. Evento de lanzamiento, campaña Q1..." />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notas adicionales</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Observaciones opcionales..." />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {success && <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">Movimiento registrado exitosamente</p>}

      <button type="submit" disabled={loading || products.length === 0}
        className={`w-full py-3 rounded-xl text-white font-semibold transition-colors disabled:opacity-50 ${config.color}`}>
        {loading ? "Registrando..." : `Registrar ${config.label}`}
      </button>

      {products.length === 0 && (
        <p className="text-amber-600 text-sm text-center">No hay productos disponibles. El administrador debe crear productos primero.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Crear src/app/(app)/movements/new/page.tsx**

```typescript
// src/app/(app)/movements/new/page.tsx
import { auth } from "@/lib/auth";
import { getProducts } from "@/app/actions/products";
import { getWarehouses } from "@/app/actions/warehouses";
import { MovementForm } from "@/components/pos/movement-form";

export default async function NewMovementPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;

  const [productsRes, warehousesRes] = await Promise.all([
    getProducts(userOrgId),
    getWarehouses(userOrgId),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Registrar Movimiento</h1>
      <p className="text-slate-500 text-sm mb-6">Registra entradas, salidas, transferencias o devoluciones de inventario.</p>
      <MovementForm
        products={productsRes.success ? (productsRes.data as any) : []}
        warehouses={warehousesRes.success ? (warehousesRes.data as any) : []}
        userRole={userRole}
      />
    </div>
  );
}
```

- [ ] **Step 3: Probar flujo completo**

1. Primero crear un producto en `/admin/products` y un almacén en `/admin/warehouses`
2. Ir a `/movements/new`
3. Seleccionar tipo **Entrada**, producto, almacén destino, cantidad 10
4. Confirmar → verificar en `/inventory` que el stock cambió a 10
5. Registrar una **Salida** de 3 → stock debe quedar en 7
6. Intentar salida de 20 → debe mostrar error "Stock insuficiente"
7. Registrar una **Transferencia** de 2 entre almacenes → verificar stock en ambos

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: formulario POS para registrar movimientos de inventario"
```

---

## Task 13: Página de historial de movimientos

**Files:**
- Create: `src/app/(app)/movements/page.tsx`

- [ ] **Step 1: Crear src/app/(app)/movements/page.tsx**

```typescript
// src/app/(app)/movements/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getMovements } from "@/app/actions/movements";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowLeftRight, RotateCcw } from "lucide-react";

type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  product: { name: string; unit: string; sku: string | null };
  fromWarehouse: { name: string } | null;
  toWarehouse: { name: string } | null;
  createdBy: { name: string };
};

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ENTRY:    { label: "Entrada",       icon: ArrowDown,        color: "text-green-600 bg-green-50" },
  EXIT:     { label: "Salida",        icon: ArrowUp,          color: "text-red-600 bg-red-50" },
  TRANSFER: { label: "Transferencia", icon: ArrowLeftRight,   color: "text-blue-600 bg-blue-50" },
  RETURN:   { label: "Devolución",    icon: RotateCcw,        color: "text-amber-600 bg-amber-50" },
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (type?: string) => {
    setLoading(true);
    const res = await getMovements(type ? { type: type as any } : undefined);
    if (res.success) setMovements(res.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    load(type || undefined);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Historial de Movimientos</h1>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {["", "ENTRY", "EXIT", "TRANSFER", "RETURN"].map((t) => (
          <button key={t} onClick={() => handleTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {t ? typeConfig[t]?.label : "Todos"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Origen → Destino</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Cantidad</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Motivo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Por</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
            )}
            {!loading && movements.map((m) => {
              const cfg = typeConfig[m.type] ?? { label: m.type, icon: ArrowLeftRight, color: "text-slate-600 bg-slate-50" };
              const Icon = cfg.icon;
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{m.product.name}</p>
                    {m.product.sku && <p className="text-xs text-slate-400">{m.product.sku}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {m.fromWarehouse?.name ?? "—"} → {m.toWarehouse?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {m.quantity} {m.product.unit}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{m.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{m.createdBy.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(m.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                  </td>
                </tr>
              );
            })}
            {!loading && movements.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin movimientos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar en el navegador**

Ir a `/movements`. Deben aparecer los movimientos registrados en el task anterior. Probar los filtros por tipo.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: historial de movimientos con filtros por tipo"
```

---

## Task 14: Dashboard

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/dashboard-chart.tsx`

- [ ] **Step 1: Crear src/components/dashboard-chart.tsx**

```typescript
// src/components/dashboard-chart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { name: string; cantidad: number }[];
}

export function DashboardChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip />
        <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Crear src/app/(app)/dashboard/page.tsx**

```typescript
// src/app/(app)/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { getInventorySummary } from "@/app/actions/inventory";
import { getMovements } from "@/app/actions/movements";
import { DashboardChart } from "@/components/dashboard-chart";
import { Package, ArrowLeftRight, AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function DashboardPage() {
  const session = await auth();
  const userOrgId = (session?.user as any)?.organizationId as string;
  const userRole = (session?.user as any)?.role as string;
  const userName = session?.user?.name ?? "Usuario";

  const [summaryRes, movementsRes] = await Promise.all([
    getInventorySummary(userOrgId),
    getMovements(),
  ]);

  const summary = summaryRes.success ? summaryRes.data : { totalProducts: 0, totalStock: 0, lowStockCount: 0 };
  const recentMovements = movementsRes.success ? movementsRes.data.slice(0, 5) : [];
  const allMovements = movementsRes.success ? movementsRes.data : [];

  // Datos para gráfica: movimientos por tipo
  const chartData = ["ENTRY", "EXIT", "TRANSFER", "RETURN"].map((type) => ({
    name: { ENTRY: "Entrada", EXIT: "Salida", TRANSFER: "Transfer.", RETURN: "Devolución" }[type] ?? type,
    cantidad: allMovements.filter((m) => m.type === type).length,
  }));

  const stats = [
    { label: "Productos", value: summary.totalProducts, icon: Package, color: "text-blue-600 bg-blue-50" },
    { label: "Unidades en stock", value: summary.totalStock, icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "Stock bajo (≤5)", value: summary.lowStockCount, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "Movimientos totales", value: allMovements.length, icon: ArrowLeftRight, color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Bienvenido, {userName}</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen de inventario de promocionales</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Movimientos por tipo</h2>
          <DashboardChart data={chartData} />
        </div>

        {/* Últimos movimientos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Últimos movimientos</h2>
          <div className="space-y-3">
            {recentMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{(m as any).product.name}</p>
                  <p className="text-xs text-slate-400">
                    {(m as any).type} · {format(new Date(m.createdAt), "dd MMM HH:mm", { locale: es })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{m.quantity} uds.</span>
              </div>
            ))}
            {recentMovements.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Sin movimientos aún</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar en el navegador**

Ir a `/dashboard`. Deben mostrarse las estadísticas y los últimos movimientos registrados.

- [ ] **Step 4: Build final de verificación**

```bash
npm run build
```
Expected: compilación exitosa sin errores de TypeScript ni warnings críticos.

- [ ] **Step 5: Commit final**

```bash
git add src/
git commit -m "feat: dashboard con stats, gráfica de movimientos y actividad reciente"
```

---

## Resumen de credenciales de prueba

| Usuario | Email | Contraseña | Rol |
|---|---|---|---|
| Admin GI | admin@generandoideas.com | admin123 | ADMIN_GI — acceso total |
| Usuario Essity | usuario@essity.com | essity123 | USER_ESSITY — solo su org |

## Comandos útiles

```bash
# Levantar base de datos
docker compose up -d

# Desarrollo
npm run dev

# Aplicar migraciones
npx prisma migrate dev

# Ver datos en Prisma Studio
npx prisma studio

# Re-ejecutar seed
npm run seed

# Build de producción
npm run build
```
