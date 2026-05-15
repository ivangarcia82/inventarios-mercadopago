# POS Terminal — Módulo de Salidas Rápidas

**Fecha:** 2026-04-09
**Proyecto:** Sistema de Inventario de Promocionales — Essity/GI

---

## Objetivo

Agregar un módulo de punto de venta (POS) que permita registrar salidas de múltiples productos en una sola operación, desde una interfaz de grilla de tarjetas rápida y visual. Reemplaza el flujo actual de `/movements/new` para el caso de uso de salidas frecuentes.

---

## Ruta

`/pos` — protegida por el middleware existente de NextAuth. Accesible para ambos roles (`ADMIN_GI` y `USER_ESSITY`).

---

## Archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/app/(app)/pos/page.tsx` | Crear | Server component — carga almacenes disponibles según rol |
| `src/components/pos/pos-terminal.tsx` | Crear | Client component — UI completa del POS (layout split panel) |
| `src/app/actions/movements.ts` | Modificar | Agregar `createBatchMovements` |
| `src/components/sidebar.tsx` | Modificar | Agregar link "POS" en nav principal |

---

## Layout — Panel dividido

```
┌─────────────────────────────────┬──────────────────────┐
│  [Almacén ▼]  [Buscar...]       │  Carrito             │
│                                 │  ─────────────────── │
│  ┌────────┐ ┌────────┐          │  Taza ×1  [2] [x]   │
│  │ Taza   │ │ Pluma  │          │  Pluma ×1 [1] [x]   │
│  │ 12 pza │ │  0 pza │          │                      │
│  └────────┘ └────────┘          │  2 productos·3 uds   │
│  (gris/disabled si stock=0)     │                      │
│                                 │  [Registrar Salida]  │
└─────────────────────────────────┴──────────────────────┘
```

**Panel izquierdo (≈60%):**
- Dropdown de almacén en la parte superior
- Campo de búsqueda (filtra por nombre o SKU, client-side)
- Grilla de tarjetas 2–3 columnas (responsive)
- Tarjeta: nombre, SKU, stock disponible en almacén seleccionado
- Stock = 0 → tarjeta gris, deshabilitada
- Clic en tarjeta → agrega al carrito (cantidad 1). Si ya está en carrito → incrementa en 1 hasta el máximo de stock disponible

**Panel derecho (≈40%):**
- Lista de ítems en carrito
- Cada ítem: nombre, input numérico (min 1, max = stock disponible), botón eliminar
- Resumen al pie: "X productos · Y unidades totales"
- Botón "Registrar Salida POS" — deshabilitado si carrito vacío
- Al hacer submit: estado de carga → éxito (limpia carrito + mensaje) o error (muestra mensaje sin limpiar)

---

## Server Action — `createBatchMovements`

```typescript
interface BatchMovementItem {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export async function createBatchMovements(
  items: BatchMovementItem[],
  reason: string
): Promise<{ success: boolean; error?: string }>
```

- Requiere sesión activa
- Corre todos los movimientos en **una sola transacción Prisma** (`prisma.$transaction`)
- Tipo fijo: `EXIT`; `fromWarehouseId` = el almacén seleccionado; `reason` = `"Salida POS"`
- Si cualquier producto no tiene stock suficiente → rollback completo, retorna error descriptivo
- Al éxito: `revalidatePath("/inventory")`, `revalidatePath("/movements")`, `revalidatePath("/dashboard")`

---

## Carga de datos

| Dato | Cuándo | Cómo |
|---|---|---|
| Almacenes | Al cargar la página | Server component → `getWarehouses` / `getAllWarehouses` según rol |
| Inventario del almacén | Al cambiar almacén | Client → nueva action `getWarehouseInventory(warehouseId)` |
| Submit | Al presionar botón | Client → `createBatchMovements` |

> **Nueva action `getWarehouseInventory(warehouseId: string)`:** consulta `InventoryItem.findMany({ where: { warehouseId, quantity: { gt: 0 } } })` incluyendo `product { id, name, sku, unit }`. Requiere sesión. Se agrega a `src/app/actions/inventory.ts`.

---

## Cambio al Sidebar

Agregar en `navItems` (disponible para todos los roles):

```typescript
{ label: "POS — Salidas", href: "/pos", icon: ShoppingCart }
```

---

## Manejo de errores

- Stock insuficiente detectado en servidor → muestra el mensaje de error en el carrito sin limpiar el estado
- Producto sin stock en tarjeta → deshabilitada visualmente antes de agregar
- Almacén sin inventario → grilla vacía con mensaje "Sin productos en este almacén"

---

## Fuera de alcance

- Tipos de movimiento distintos a EXIT (eso sigue en `/movements/new`)
- Impresión de ticket
- Descuentos o precios
- Historial dentro del POS (usar `/movements`)
