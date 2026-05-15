# Número de guía en remisiones (envío foráneo) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un toggle "Envío foráneo" en el formulario de movimientos y en el POS para capturar un número de guía que se persiste en BD y aparece en la remisión PDF.

**Architecture:** Un campo opcional `trackingNumber String?` en `StockMovement`. El toggle es estado puro de UI; "es foráneo" se infiere de "tiene guía". El generador de PDF agrega una fila `GUÍA` solo si el campo viene presente. POS comparte el mismo `trackingNumber` entre todos los movimientos de un carrito.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma 6 + Postgres (Neon), React 19, jsPDF, Tailwind v4. Sin framework de tests (verificación manual).

**Spec asociado:** `docs/superpowers/specs/2026-04-28-numero-guia-foraneo-design.md`

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `prisma/schema.prisma` | Modificar | Agregar `trackingNumber String?` al modelo `StockMovement`. |
| `prisma/migrations/<timestamp>_add_tracking_number/migration.sql` | Crear (auto) | Migración que añade la columna en Postgres. |
| `src/app/actions/movements.ts` | Modificar | Aceptar `trackingNumber` en `createMovement` y `createBatchMovements`; persistirlo. |
| `src/lib/generate-remision.ts` | Modificar | Tipo `RemisionData` agrega `trackingNumber`; renderiza fila `GUÍA` cuando existe. |
| `src/components/pos/movement-form.tsx` | Modificar | Toggle "Envío foráneo" + input "Número de guía"; payload y `RemisionData`. |
| `src/components/pos/pos-terminal.tsx` | Modificar | Mismo toggle + input en footer del carrito; payload y `RemisionData` consolidada. |
| `src/app/(app)/movements/page.tsx` | Modificar | Tipo `Movement` incluye `trackingNumber`; re-descarga incluye campo. |

---

## Task 1: Agregar campo `trackingNumber` a Prisma schema y migrar BD

**Files:**
- Modify: `prisma/schema.prisma:79-99`
- Create: `prisma/migrations/<timestamp>_add_tracking_number/migration.sql`

- [ ] **Step 1: Editar el modelo `StockMovement`**

En `prisma/schema.prisma`, dentro del bloque `model StockMovement` (línea 79), agregar la línea `trackingNumber` justo después de `receiverName`:

```prisma
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
  receiverName    String?
  trackingNumber  String?
  createdById     String
  createdBy       User       @relation(fields: [createdById], references: [id])
  createdAt       DateTime   @default(now())

  @@index([productId])
  @@index([createdById])
  @@index([createdAt])
}
```

- [ ] **Step 2: Generar la migración contra Neon**

Run:

```bash
npx prisma migrate dev --name add_tracking_number_to_stock_movement
```

Expected:
- Crea `prisma/migrations/<timestamp>_add_tracking_number_to_stock_movement/migration.sql`.
- El SQL debe contener: `ALTER TABLE "StockMovement" ADD COLUMN "trackingNumber" TEXT;`.
- Prisma regenera el cliente (`@prisma/client`).
- En Neon la columna queda creada y nullable.

Si Prisma reporta drift o pide reset, **NO** acepte un reset destructivo — investigue primero. Si todo está limpio, debería completar sin prompts.

- [ ] **Step 3: Verificar que el SQL generado sea el esperado**

Read: `prisma/migrations/<timestamp>_add_tracking_number_to_stock_movement/migration.sql`

Expected content:

```sql
-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "trackingNumber" TEXT;
```

- [ ] **Step 4: Verificación manual contra BD**

Run:

```bash
npx prisma studio
```

Abrir tabla `StockMovement`, confirmar que la columna `trackingNumber` existe y los registros previos tienen `null`. Cerrar Studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): agregar trackingNumber opcional a StockMovement"
```

---

## Task 2: Aceptar y persistir `trackingNumber` en `createMovement`

**Files:**
- Modify: `src/app/actions/movements.ts:10-90`

- [ ] **Step 1: Extender `CreateMovementInput`**

En `src/app/actions/movements.ts`, modificar la interfaz (líneas 10-19):

```ts
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
```

- [ ] **Step 2: Persistir el campo en el `create`**

Dentro de `createMovement`, en el bloque `tx.stockMovement.create({ data: { ... } })` (líneas 63-74), modificar para hacer trim y persistir:

```ts
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
```

La lógica `tracking && tracking.length > 0 ? tracking : null` garantiza que un input vacío o con solo espacios se guarde como `null`.

- [ ] **Step 3: Verificación de tipos**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores. El cliente Prisma regenerado en Task 1 ya conoce el campo.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/movements.ts
git commit -m "feat(actions): aceptar trackingNumber en createMovement"
```

---

## Task 3: Aceptar y persistir `trackingNumber` en `createBatchMovements`

**Files:**
- Modify: `src/app/actions/movements.ts:152-200`

- [ ] **Step 1: Extender la firma de `createBatchMovements`**

En `src/app/actions/movements.ts`, modificar la firma (línea 152):

```ts
export async function createBatchMovements(
  items: BatchMovementItem[],
  receiverName?: string,
  trackingNumber?: string,
) {
```

- [ ] **Step 2: Aplicar el mismo `trackingNumber` a cada movimiento del batch**

Reemplazar el cuerpo completo de `await prisma.$transaction(async (tx) => { ... });` (líneas 163-200 del archivo actual) por el siguiente bloque, que sanea el tracking una sola vez antes del bucle y lo persiste en cada `stockMovement.create`:

```ts
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
```

Único cambio respecto al original: dos líneas nuevas (`const tracking` / `const trackingValue`) al inicio de la transacción, y la nueva clave `trackingNumber: trackingValue` dentro del `data` del `stockMovement.create`. El resto del bloque queda idéntico.

- [ ] **Step 3: Verificación de tipos**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/movements.ts
git commit -m "feat(actions): aceptar trackingNumber en createBatchMovements"
```

---

## Task 4: Renderizar fila `GUÍA` en el PDF

**Files:**
- Modify: `src/lib/generate-remision.ts:24-34, 96-103`

- [ ] **Step 1: Extender el tipo `RemisionData`**

En `src/lib/generate-remision.ts`, modificar la interfaz (líneas 24-34):

```ts
export interface RemisionData {
  folio: string;
  type: string;
  createdAt: Date | string;
  items: RemisionItem[];
  reason?: string | null;
  notes?: string | null;
  receiverName?: string | null;
  trackingNumber?: string | null;
  createdByName: string;
  warehouseName?: string | null;
}
```

- [ ] **Step 2: Agregar la fila al `infoRows`**

En la construcción de `infoRows` (líneas 96-103), agregar la fila `GUÍA` justo después del bloque de `notes`:

```ts
const infoRows: { label: string; value: string }[] = [
  { label: "Registrado por", value: data.createdByName },
  { label: "Fecha y hora", value: dateStr },
];
if (data.warehouseName) infoRows.push({ label: "Almacén", value: data.warehouseName });
if (data.reason) infoRows.push({ label: "Motivo", value: data.reason });
if (isExit && data.receiverName) infoRows.push({ label: "Recibe", value: data.receiverName });
if (data.notes) infoRows.push({ label: "Notas", value: data.notes });
if (data.trackingNumber) infoRows.push({ label: "Guía", value: data.trackingNumber });
```

- [ ] **Step 3: Verificación de tipos**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/generate-remision.ts
git commit -m "feat(remision): renderizar fila GUÍA en PDF cuando hay trackingNumber"
```

---

## Task 5: Toggle y campo de guía en `MovementForm`

**Files:**
- Modify: `src/components/pos/movement-form.tsx`

- [ ] **Step 1: Agregar estado local para toggle e input**

En `MovementForm`, junto a los `useState` existentes (líneas 44-55), agregar:

```ts
const [isForeign, setIsForeign] = useState(false);
const [trackingNumber, setTrackingNumber] = useState("");
```

- [ ] **Step 2: Validar y enviar el campo en `handleSubmit`**

En `handleSubmit` (líneas 60-121):

a) Después de la validación de `receiverName` (línea 67), agregar:

```ts
const trackingTrimmed = trackingNumber.trim();
if (isForeign && !trackingTrimmed) {
  setError("Ingresa el número de guía del envío foráneo");
  setLoading(false);
  return;
}
```

b) En la llamada a `createMovement` (líneas 69-78), agregar el campo:

```ts
const res = await createMovement({
  type,
  productId,
  quantity: qty,
  fromWarehouseId: config.needsFrom ? fromWarehouseId : undefined,
  toWarehouseId: config.needsTo ? toWarehouseId : undefined,
  reason: reason || undefined,
  notes: notes || undefined,
  receiverName: isExit ? receiverName.trim() : undefined,
  trackingNumber: isForeign ? trackingTrimmed : undefined,
});
```

c) En la construcción de `RemisionData` (líneas 88-105), agregar el campo:

```ts
const remision: RemisionData = {
  folio: movement.id.slice(-8).toUpperCase(),
  type,
  createdAt: movement.createdAt,
  createdByName: movement.createdBy?.name ?? "—",
  receiverName: isExit ? receiverName.trim() : undefined,
  reason: reason || undefined,
  notes: notes || undefined,
  trackingNumber: isForeign ? trackingTrimmed : undefined,
  warehouseName: config.needsFrom ? fromWh?.name : toWh?.name,
  items: [{
    productName: product?.name ?? "—",
    sku: product?.sku,
    unit: product?.unit ?? "pza",
    quantity: qty,
    fromWarehouse: config.needsFrom ? fromWh?.name : null,
    toWarehouse: config.needsTo ? toWh?.name : null,
  }],
};
```

d) En el bloque de reset tras éxito (líneas 109-112), agregar:

```ts
setIsForeign(false);
setTrackingNumber("");
```

- [ ] **Step 3: Renderizar el toggle y el input condicional**

En el JSX, insertar el bloque nuevo entre la sección de "Notas adicionales" (que termina en línea 249) y el bloque de error (línea 251):

```tsx
{/* Envío foráneo */}
<div>
  <button
    type="button"
    onClick={() => setIsForeign((v) => !v)}
    className="flex items-center gap-3 group cursor-pointer"
  >
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        isForeign ? "bg-primary" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          isForeign ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </span>
    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
      Envío foráneo
    </span>
  </button>

  {isForeign && (
    <div className="mt-3">
      <label className={labelCls}>Número de guía *</label>
      <input
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        className={inputCls}
        placeholder="Ej. 1234567890"
        required
      />
    </div>
  )}
</div>
```

- [ ] **Step 4: Verificación manual en navegador**

Run:

```bash
npm run dev
```

Iniciar sesión como `admin@generandoideas.com` / `admin123`. Ir a la página que monta `MovementForm` (probablemente `/movements/new` o el dashboard). Verificar:

1. El toggle aparece bajo "Notas adicionales".
2. Toggle apagado: input "Número de guía" no se ve.
3. Toggle encendido: input aparece, animación del switch ocurre, label es `NÚMERO DE GUÍA *`.
4. Toggle on + input vacío + submit → error rojo "Ingresa el número de guía del envío foráneo". El movimiento NO se registra.
5. Toggle on + número (ej. "TEST-1234") + submit → movimiento registrado, PDF descargado, fila `GUÍA: TEST-1234` visible en el PDF.
6. Toggle off + submit → movimiento registrado, PDF sin fila `GUÍA`.
7. Tras éxito, ambos campos quedan reseteados (toggle apagado, input vacío).

Cerrar el dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/movement-form.tsx
git commit -m "feat(movement-form): toggle envío foráneo y captura de número de guía"
```

---

## Task 6: Toggle y campo de guía en POS terminal

**Files:**
- Modify: `src/components/pos/pos-terminal.tsx`

- [ ] **Step 1: Agregar estado local**

En `PosTerminal`, junto a los `useState` existentes (líneas 31-40), agregar:

```ts
const [isForeign, setIsForeign] = useState(false);
const [trackingNumber, setTrackingNumber] = useState("");
```

- [ ] **Step 2: Validar y enviar en `handleSubmit`**

En `handleSubmit` (líneas 99-152):

a) Después de la validación de `receiverName` (línea 101-104), agregar:

```ts
const trackingTrimmed = trackingNumber.trim();
if (isForeign && !trackingTrimmed) {
  setError("Ingresa el número de guía del envío foráneo");
  return;
}
```

b) Modificar la llamada a `createBatchMovements` (líneas 108-111):

```ts
const res = await createBatchMovements(
  cart.map((c) => ({ productId: c.productId, warehouseId: c.warehouseId, quantity: c.qty })),
  receiverName.trim(),
  isForeign ? trackingTrimmed : undefined,
);
```

c) En la construcción de `RemisionData` consolidada (líneas 121-137), agregar el campo:

```ts
const remision: RemisionData = {
  folio,
  type: "EXIT",
  createdAt,
  createdByName: firstMovement?.createdBy?.name ?? "—",
  receiverName: receiverName.trim(),
  reason: "Salida POS",
  trackingNumber: isForeign ? trackingTrimmed : undefined,
  warehouseName: currentWarehouse?.name,
  items: cart.map((c, i) => ({
    productName: c.name,
    sku: c.sku,
    unit: c.unit,
    quantity: c.qty,
    fromWarehouse: currentWarehouse?.name ?? null,
    toWarehouse: null,
  })),
};
```

d) En el reset tras éxito (líneas 141-142), agregar:

```ts
setIsForeign(false);
setTrackingNumber("");
```

- [ ] **Step 3: Renderizar el toggle y el input en el footer del carrito**

En el JSX, dentro del footer del carrito (`<div className="border-t border-slate-100 p-4 space-y-3">`, línea 301), insertar el bloque nuevo entre el campo "Nombre del receptor" (cierra en línea 321) y el bloque de error (línea 323):

```tsx
{/* Envío foráneo */}
<div>
  <button
    type="button"
    onClick={() => setIsForeign((v) => !v)}
    className="flex items-center gap-2 group cursor-pointer"
  >
    <span
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        isForeign ? "bg-primary" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
          isForeign ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </span>
    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">
      Envío foráneo
    </span>
  </button>

  {isForeign && (
    <input
      value={trackingNumber}
      onChange={(e) => setTrackingNumber(e.target.value)}
      placeholder="Número de guía"
      className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
    />
  )}
</div>
```

Nota: el switch es más pequeño (`h-4 w-7`) que en `MovementForm` para acomodar la densidad visual del panel del carrito.

- [ ] **Step 4: Verificación manual en navegador**

Run:

```bash
npm run dev
```

Iniciar sesión, ir al POS (`/pos`). Con productos en stock:

1. Agregar 2 productos al carrito.
2. Llenar receptor.
3. Toggle apagado + Registrar → remisión consolidada SIN fila `GUÍA`. Los movimientos creados en BD tienen `trackingNumber = null`.
4. Repetir con un nuevo carrito: toggle encendido sin guía → error visible "Ingresa el número de guía del envío foráneo". No se registra nada.
5. Mismo carrito, escribir "POS-TEST-9999" en guía → registrar → PDF tiene una sola fila `GUÍA: POS-TEST-9999`. En BD, todos los `StockMovement` del batch comparten el mismo `trackingNumber`.
6. Verificar reset post-éxito: toggle apagado, input vacío.

Verificación BD (opcional, abrir Studio):

```bash
npx prisma studio
```

Filtrar `StockMovement` por `trackingNumber = "POS-TEST-9999"` → debería listar tantas filas como productos llevaba el carrito.

Cerrar dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/pos-terminal.tsx
git commit -m "feat(pos): toggle envío foráneo y guía consolidada para batch"
```

---

## Task 7: Re-descarga desde historial incluye número de guía

**Files:**
- Modify: `src/app/(app)/movements/page.tsx:13-25, 86-107`

- [ ] **Step 1: Extender el tipo `Movement`**

En `src/app/(app)/movements/page.tsx`, modificar el tipo (líneas 13-25):

```ts
type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  notes: string | null;
  receiverName: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  product: { name: string; unit: string; sku: string | null };
  fromWarehouse: { name: string } | null;
  toWarehouse: { name: string } | null;
  createdBy: { name: string };
};
```

- [ ] **Step 2: Pasar el campo a `RemisionData` en `handleDownloadRemision`**

Modificar `handleDownloadRemision` (líneas 86-107):

```ts
const handleDownloadRemision = async (m: Movement) => {
  const remision: RemisionData = {
    folio: m.id.slice(-8).toUpperCase(),
    type: m.type,
    createdAt: m.createdAt,
    createdByName: m.createdBy.name,
    receiverName: m.receiverName,
    reason: m.reason,
    notes: m.notes,
    trackingNumber: m.trackingNumber,
    warehouseName: m.fromWarehouse?.name ?? m.toWarehouse?.name,
    items: [{
      productName: m.product.name,
      sku: m.product.sku,
      unit: m.product.unit,
      quantity: m.quantity,
      fromWarehouse: m.fromWarehouse?.name ?? null,
      toWarehouse: m.toWarehouse?.name ?? null,
    }],
  };
  const { generateRemision } = await import("@/lib/generate-remision");
  generateRemision(remision);
};
```

- [ ] **Step 3: Verificación manual en navegador**

Run:

```bash
npm run dev
```

1. Ir a `/movements`.
2. Localizar un movimiento creado en Task 5 con guía "TEST-1234".
3. Click en el botón de descarga → PDF debe tener fila `GUÍA: TEST-1234`.
4. Localizar un movimiento previo a la migración (creado antes de Task 1) → PDF se descarga sin fila `GUÍA`, sin errores.
5. Localizar uno de los movimientos del POS batch con guía "POS-TEST-9999" → PDF descargado individualmente debe tener `GUÍA: POS-TEST-9999`.

- [ ] **Step 4: Verificación de tipos**

Run:

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(app)/movements/page.tsx'
git commit -m "feat(movements-history): incluir trackingNumber en re-descarga de remisión"
```

---

## Task 8: Verificación final end-to-end y build

- [ ] **Step 1: Build de producción**

Run:

```bash
npm run build
```

Expected: build exitoso. Sin errores de tipos ni de Prisma. La generación del cliente Prisma se hace antes del build de Next.

- [ ] **Step 2: Lint**

Run:

```bash
npm run lint
```

Expected: sin errores nuevos. Si hay warnings preexistentes en otros archivos, ignorar (no son responsabilidad de este plan).

- [ ] **Step 3: Smoke test final**

Run:

```bash
npm run dev
```

Pasar por los tres flujos en una sola sesión:

1. **MovementForm con guía:** registrar entrada con toggle on + guía "FINAL-1" → PDF tiene `GUÍA: FINAL-1`.
2. **POS con guía:** carrito con 2 productos + toggle on + guía "FINAL-2" → PDF consolidado tiene `GUÍA: FINAL-2`.
3. **Re-descarga histórica:** ir a `/movements`, descargar una remisión nueva (foránea) y una vieja (sin guía). La nueva muestra `GUÍA`, la vieja no. Sin errores en consola.
4. **Sin guía:** registrar un movimiento con toggle off → PDF sin fila `GUÍA`, BD con `trackingNumber = null`.

Cerrar dev server.

- [ ] **Step 4: Commit final si hay cambios menores derivados de la verificación**

Si surgió algún ajuste menor durante la verificación, commitearlo aparte. Si no, este step no produce commit.

```bash
git status
# Si hay cambios:
git add <archivos>
git commit -m "fix: ajustes menores tras verificación e2e"
```

---

## Notas adicionales

- **Sin tests automatizados:** El proyecto no tiene framework de pruebas configurado. La verificación es manual en cada task. Si más adelante se introduce Jest/Vitest, los criterios de éxito del spec son la base para escribir las pruebas.
- **Migración en producción:** `prisma migrate dev` se aplica directamente contra Neon (la BD que está en `DATABASE_URL`). Es seguro porque la columna es opcional y nullable; los registros existentes no se ven afectados. Si el equipo opera con un workflow distinto (`migrate deploy` separado para prod), ajustar la Task 1 al workflow real.
- **Reusabilidad del componente toggle:** Se duplica la implementación del switch entre `movement-form.tsx` (tamaño normal) y `pos-terminal.tsx` (compacto). Si en el futuro se necesita un tercer lugar, vale la pena extraer a `src/components/ui/toggle.tsx`. No se hace ahora (YAGNI con dos llamantes).
