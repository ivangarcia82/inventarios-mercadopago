# Sistema de Inventario de Promocionales — Essity / Generando Ideas

**Fecha:** 2026-04-07  
**Estado:** Aprobado  
**Autor:** Ivan (Generando Ideas)

---

## Resumen

Plataforma web multi-tenant para el manejo de inventario de productos promocionales. Generando Ideas (GI) opera como administrador de la plataforma y maneja el almacén físico. Essity es el cliente principal, con sus propios usuarios, almacenes y productos. Ambas organizaciones coexisten en la misma app bajo un esquema multi-tenant por organización.

---

## Modelo de Datos

### Entidades principales

**Organization**
- Representa a GI o Essity (y futuros clientes)
- Cada organización tiene sus propios almacenes, productos y usuarios

**Warehouse**
- Almacén físico o ubicación perteneciente a una organización
- Ejemplos: "Almacén GI Central", "Oficina Essity CDMX", "Sucursal Monterrey"

**User**
- Pertenece a una organización
- Rol: `ADMIN_GI` (acceso total a todas las organizaciones) | `USER_ESSITY` (acceso solo a su organización)

**Product**
- Catálogo de productos promocionales por organización
- Campos: nombre, SKU, descripción, unidad de medida, imagen (opcional)
- Soporta variantes (talla, color, etc.) via `ProductVariant`

**InventoryItem**
- Representa el stock de un producto (o variante) en un almacén específico
- Campos: `productId`, `warehouseId`, `quantity`
- Se actualiza en cada movimiento

**StockMovement** (log inmutable)
- Registro permanente de cada operación sobre el inventario
- Campos:
  - `type`: `ENTRY` | `EXIT` | `TRANSFER` | `RETURN`
  - `productId`, `variantId` (opcional)
  - `fromWarehouseId` (para EXIT, TRANSFER, RETURN)
  - `toWarehouseId` (para ENTRY, TRANSFER, RETURN)
  - `quantity`
  - `createdById` (usuario que realizó el movimiento)
  - `reason` / `notes` (texto libre)
  - `createdAt`

### Regla de integridad
Toda operación que modifica `InventoryItem` ocurre dentro de una transacción de base de datos. Si cualquier parte falla, se revierte completo. Los registros de `StockMovement` son inmutables — no se eliminan ni editan.

---

## Roles y Permisos

| Acción | Admin GI | Usuario Essity |
|--------|----------|----------------|
| Ver inventario de todas las org. | ✅ | ❌ |
| Ver inventario de su organización | ✅ | ✅ |
| CRUD productos y almacenes | ✅ | ❌ |
| Registrar entrada de inventario | ✅ | ❌ |
| Registrar salida (POS) | ✅ | ✅ |
| Registrar transferencia | ✅ | ✅ |
| Registrar devolución | ✅ | ✅ |
| Ver todos los movimientos | ✅ | Solo los suyos |
| Gestión de usuarios | ✅ | ❌ |

---

## Pantallas y Rutas

```
/login                     → Autenticación
/dashboard                 → Resumen de inventario (gráficas, alertas de stock bajo)
/inventory                 → Tabla de productos con stock por almacén
/movements                 → Historial de movimientos (filtros: fecha, tipo, almacén)
/movements/new             → Registrar nuevo movimiento (salida / transferencia / devolución)
/admin/products            → CRUD de productos [solo Admin GI]
/admin/warehouses          → CRUD de almacenes [solo Admin GI]
/admin/users               → Gestión de usuarios [solo Admin GI]
```

---

## Flujos Clave

### Entrada de inventario (Admin GI)
1. Selecciona organización → almacén destino → producto → cantidad
2. Confirma → `StockMovement(ENTRY)` creado + `InventoryItem.quantity` incrementado

### Salida / Consumo (POS — Usuario Essity)
1. Navega catálogo con stock disponible por almacén
2. Selecciona producto → cantidad → almacén origen
3. Validación: stock disponible ≥ cantidad solicitada
4. Confirma → `StockMovement(EXIT)` + `InventoryItem.quantity` decrementado

### Transferencia entre almacenes
1. Selecciona producto → cantidad → almacén origen → almacén destino
2. Validación: stock origen ≥ cantidad
3. Confirma (transacción atómica) → `StockMovement(TRANSFER)` + resta origen + suma destino

### Devolución
1. Selecciona producto → cantidad → almacén destino
2. Referencia opcional a un movimiento previo
3. Confirma → `StockMovement(RETURN)` + `InventoryItem.quantity` incrementado en destino

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Autenticación | NextAuth v5 (credentials) |
| UI | Tailwind CSS + shadcn/ui |
| Validación | Zod + React Hook Form |
| Gráficas | Recharts |
| Dev local | Docker Compose (PostgreSQL) |

---

## Estructura del Proyecto

```
sistema-inventarios-essity/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (app)/dashboard/
│   │   ├── (app)/inventory/
│   │   ├── (app)/movements/
│   │   └── (app)/admin/
│   ├── components/
│   │   ├── pos/              ← Componentes del dashboard POS
│   │   └── ui/               ← shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   └── actions/          ← Server Actions por módulo
│   └── types/
└── docker-compose.yml
```

---

## Fuera de Alcance (v1)

- Integración con APIs externas (4Promo, Shopify)
- App móvil
- Generación de reportes PDF
- Notificaciones por correo
- Importación masiva desde Excel
