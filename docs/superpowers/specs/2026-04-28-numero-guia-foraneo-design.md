# Número de guía en remisiones — Envío foráneo

**Fecha:** 2026-04-28
**Autor:** Iván
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El sistema de inventarios genera una remisión PDF al registrar cualquier movimiento (entrada, salida, transferencia, devolución). Hoy la remisión no contempla envíos foráneos: cuando el destino físico de la mercancía está fuera de la ciudad y se manda por paquetería, no hay forma de capturar ni mostrar el número de guía en el documento.

Este diseño agrega un toggle "Envío foráneo" al formulario de movimientos. Cuando se activa, aparece un input para el número de guía, que se persiste en BD y se imprime en la remisión PDF.

## Decisiones de producto

| Decisión | Resultado |
|---|---|
| Cómo se determina "foráneo" | Toggle manual marcado por el usuario (no inferido del par origen/destino). |
| Tipos de movimiento donde aplica | Todos: `ENTRY`, `EXIT`, `TRANSFER`, `RETURN`. |
| Datos capturados | Solo número de guía (un input, texto libre). No se captura paquetería ni costo. |
| Persistencia | Campo `trackingNumber String?` en `StockMovement`. Sin flag booleano; "es foráneo" = "tiene guía". |
| Ubicación en el PDF | Una fila más en el grid de info, label `GUÍA`. Sin badge ni sección dedicada. |

## Cambios técnicos

### 1. Schema (Prisma)

`prisma/schema.prisma` — modelo `StockMovement`:

```prisma
model StockMovement {
  // ...campos existentes
  trackingNumber String?
  // ...
}
```

Migración nueva: `add_tracking_number_to_stock_movement`. Campo opcional, sin valor por defecto. Los movimientos existentes quedan con `NULL` (no son foráneos). La migración se aplica contra Neon (entorno productivo) tras revisión.

### 2. Server action — `src/app/actions/movements.ts`

`CreateMovementInput` agrega:

```ts
trackingNumber?: string;
```

Lógica dentro de `createMovement`:

- Hacer `input.trackingNumber?.trim()`.
- Si tras el trim queda vacío, tratarlo como ausente (`null`).
- Persistir el valor en `tx.stockMovement.create({ data: { ..., trackingNumber: tracking ?? null } })`.

No se agrega validación de formato (longitud, regex de paquetería, etc.) — campo libre.

El action `listMovements` debe retornar `trackingNumber` en los registros que devuelve, para que la re-descarga desde el historial pueda incluirlo. Confirmar al implementar si el `select` actual lo deja afuera.

### 3. UI — `src/components/pos/movement-form.tsx`

Estado local nuevo:

```ts
const [isForeign, setIsForeign] = useState(false);
const [trackingNumber, setTrackingNumber] = useState("");
```

Ninguno se envía como tal a la BD; `isForeign` es solo control de visibilidad del input.

Render: bloque nuevo entre el campo "Notas" (línea 240-249) y el bloque de error (línea 251).

```
┌──────────────────────────────────────────┐
│ [toggle]  Envío foráneo                  │
│                                          │
│ (si toggle on)                           │
│ NÚMERO DE GUÍA *                         │
│ [input texto]                            │
└──────────────────────────────────────────┘
```

- Toggle: switch tipo "pill" (botón con fondo `bg-slate-200` apagado / `bg-primary` encendido y un círculo blanco que se desliza), siguiendo el lenguaje visual existente (paleta indigo, bordes `slate-200`, transiciones suaves). Es input no-nativo construido con `<button type="button">`.
- Input "Número de guía": usa `inputCls`/`labelCls` ya definidos. Aparece solo si `isForeign === true`.

Validación en `handleSubmit`:

- Si `isForeign && !trackingNumber.trim()` → `setError("Ingresa el número de guía del envío foráneo")` y retornar.
- Si toggle on, agregar `trackingNumber: trackingNumber.trim()` al payload de `createMovement`.
- Si toggle off, no enviar el campo.

Construcción del objeto `RemisionData` (línea 88-105):

```ts
const remision: RemisionData = {
  // ...campos existentes
  trackingNumber: isForeign ? trackingNumber.trim() : undefined,
  // ...
};
```

Reset tras éxito: setear `isForeign = false` y `trackingNumber = ""` junto a los otros campos que ya se resetean (líneas 109-112).

### 4. PDF — `src/lib/generate-remision.ts`

Interfaz `RemisionData` agrega:

```ts
trackingNumber?: string | null;
```

En la construcción del array `infoRows` (línea 96-103), agregar tras el bloque de `notes`:

```ts
if (data.trackingNumber) infoRows.push({ label: "Guía", value: data.trackingNumber });
```

El grid de 2 columnas existente acomoda la nueva fila automáticamente (calcula `halfLen` y rellena izquierda/derecha). No hay otros cambios visuales: ni badge de "FORÁNEO", ni sección nueva.

### 5. Re-descarga desde historial — `src/app/(app)/movements/page.tsx`

En `handleDownloadRemision` (línea 86-107) agregar al objeto `RemisionData`:

```ts
trackingNumber: m.trackingNumber,
```

El tipo `Movement` (interno del componente, líneas 13-25) debe incluir `trackingNumber: string | null`. El action `getMovements` no usa `select` para `StockMovement`, solo `include` para relaciones, por lo que el campo escalar nuevo se devuelve automáticamente sin cambios al action.

### 6. POS terminal — flujo batch

El POS (`src/components/pos/pos-terminal.tsx`) genera una remisión consolidada por carrito vía `createBatchMovements`. El número de guía aplica al carrito completo (un envío foráneo = un carrito).

**Server action — `createBatchMovements`** (`src/app/actions/movements.ts`):

- Firma actualizada: `createBatchMovements(items: BatchMovementItem[], receiverName?: string, trackingNumber?: string)`.
- Trim y validación igual que en `createMovement`: si tras trim queda vacío, tratar como `null`.
- Persistir el mismo `trackingNumber` en cada `tx.stockMovement.create` del bucle (todos los movimientos del batch comparten guía).

**UI — `pos-terminal.tsx`:**

- Estado nuevo: `isForeign: boolean` y `trackingNumber: string`.
- Render: bloque insertado en el footer del carrito (panel derecho, dentro del `<div className="border-t border-slate-100 p-4 space-y-3">`) entre el campo "Nombre del receptor" (líneas 309-321) y el bloque de `error` (línea 323):
  - Toggle pill "Envío foráneo" (mismo componente visual que en `MovementForm`).
  - Input "Número de guía *" condicional al toggle, usando el mismo estilo compacto del input de receptor (`text-xs`, `px-3 py-2`, etc.).
- En `handleSubmit`: si `isForeign && !trackingNumber.trim()` → `setError("Ingresa el número de guía del envío foráneo")` y retornar.
- Llamada actualizada: `createBatchMovements(items, receiverName.trim(), isForeign ? trackingNumber.trim() : undefined)`.
- Construcción de `RemisionData` consolidada (línea 121-137): agregar `trackingNumber: isForeign ? trackingNumber.trim() : undefined`.
- Reset tras éxito: agregar `setIsForeign(false)` y `setTrackingNumber("")` junto a los otros resets (líneas 141-142).

El PDF consolidado del POS reutiliza `generateRemision`, así que la fila `GUÍA` aparece automáticamente con los cambios del punto 4.

## Fuera de alcance (YAGNI)

- No se agrega filtro "solo envíos foráneos" en el listado de movimientos.
- No se agrega columna `Guía` en la tabla del historial.
- No se valida formato del número de guía.
- No hay campo separado para paquetería/courier ni para costo de envío.
- No se notifica por email ni se integra con APIs de paquetería.

## Criterios de éxito

- Al crear cualquier tipo de movimiento (formulario individual o POS batch) con el toggle activo y un número de guía válido, el registro queda persistido con `trackingNumber` en BD.
- En el POS, todos los movimientos creados desde un mismo carrito comparten el mismo `trackingNumber`.
- El PDF generado tras el registro muestra una fila `GUÍA` con el número (tanto en remisiones individuales como en consolidadas del POS).
- Al re-descargar la remisión desde el historial de movimientos, el PDF incluye el número de guía intacto.
- Movimientos sin toggle activo no muestran la fila `GUÍA` en el PDF (el grid sigue viéndose limpio, no hay celda vacía).
- Activar el toggle sin escribir número bloquea el submit con un mensaje de error claro (en ambos flujos).
- Los movimientos existentes en la BD (creados antes de la migración) siguen funcionando: su PDF se genera sin la fila `GUÍA`.
