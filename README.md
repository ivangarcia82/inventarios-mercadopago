# Sistema de Inventarios — Mercado Pago

Aplicación Next.js para gestionar el inventario de Mercado Pago: productos, almacenes, movimientos (entradas, salidas, transferencias y devoluciones), terminal POS para salidas y reportes PDF (remisiones).

## Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**
- **Prisma** + **PostgreSQL** (driver adapter `@prisma/adapter-pg`)
- **NextAuth v5** (Credentials)
- **jsPDF** para remisiones imprimibles

## Identidad visual

- Color primario: **Mercado Pago Yellow** `#FFE600`
- Color texto/secundario: **Mercado Pago Dark Blue** `#2D3277`
- Tipografía: DM Sans
- Icono de marca: handshake (apretón de manos)

## Setup

```bash
# 1. Levantar Postgres
docker compose up -d

# 2. Variables de entorno
cp .env.example .env
# editar AUTH_SECRET y DATABASE_URL si hace falta

# 3. Migrar y sembrar
npx prisma migrate dev
npm run seed

# 4. Levantar dev server
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Credenciales demo (post `npm run seed`)

| Rol         | Email                       | Contraseña       |
| ----------- | --------------------------- | ---------------- |
| Admin       | admin@mercadopago.com       | `admin123`       |
| Usuario MP  | usuario@mercadopago.com     | `mercadopago123` |

## Roles

- **`ADMIN_MP`** — administrador global: gestiona usuarios, productos, almacenes y ve todos los movimientos.
- **`USER_MP`** — usuario operativo: opera POS y movimientos dentro de su organización.
