// src/components/pos/movement-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMovement } from "@/app/actions/movements";
import { CheckCircle2, Loader2, Download } from "lucide-react";
import type { RemisionData } from "@/lib/generate-remision";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Warehouse = { id: string; name: string; organizationId: string };

interface Props {
  products: Product[];
  warehouses: Warehouse[];
  userRole: string;
}

type MovementType = "ENTRY" | "EXIT" | "TRANSFER" | "RETURN";

const typeConfig: Record<MovementType, { label: string; needsFrom: boolean; needsTo: boolean; activeCls: string }> = {
  ENTRY:    { label: "Entrada",       needsFrom: false, needsTo: true,  activeCls: "bg-emerald-600 text-white border-emerald-600" },
  EXIT:     { label: "Salida",        needsFrom: true,  needsTo: false, activeCls: "bg-red-600 text-white border-red-600" },
  TRANSFER: { label: "Transferencia", needsFrom: true,  needsTo: true,  activeCls: "bg-primary text-white border-primary" },
  RETURN:   { label: "Devolución",    needsFrom: false, needsTo: true,  activeCls: "bg-amber-500 text-white border-amber-500" },
};

const submitColor: Record<MovementType, string> = {
  ENTRY:    "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
  EXIT:     "bg-red-600 hover:bg-red-700 active:bg-red-800",
  TRANSFER: "bg-primary hover:bg-primary/90 active:bg-primary/80",
  RETURN:   "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export function MovementForm({ products, warehouses, userRole }: Props) {
  const router = useRouter();
  const types: MovementType[] = userRole === "ADMIN_MP"
    ? ["ENTRY", "EXIT", "TRANSFER", "RETURN"]
    : ["EXIT", "TRANSFER", "RETURN"];

  const [type, setType] = useState<MovementType>(types[0]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [isForeign, setIsForeign] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastRemision, setLastRemision] = useState<RemisionData | null>(null);

  const config = typeConfig[type];
  const isExit = type === "EXIT";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { setError("La cantidad debe ser mayor a 0"); setLoading(false); return; }
    if (isExit && !receiverName.trim()) { setError("Ingresa el nombre de quien recoge la mercancía"); setLoading(false); return; }

    const trackingTrimmed = trackingNumber.trim();
    if (isForeign && !trackingTrimmed) {
      setError("Ingresa el número de guía del envío foráneo");
      setLoading(false);
      return;
    }

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

    if (!res.success) {
      setError(res.error ?? "Error al registrar");
    } else {
      const movement = res.data as any;
      const product = products.find((p) => p.id === productId);
      const fromWh = warehouses.find((w) => w.id === fromWarehouseId);
      const toWh = warehouses.find((w) => w.id === toWarehouseId);

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

      setLastRemision(remision);
      setSuccess(true);
      setQuantity("");
      setReason("");
      setNotes("");
      setReceiverName("");
      setIsForeign(false);
      setTrackingNumber("");

      // Auto-download PDF
      const { generateRemision } = await import("@/lib/generate-remision");
      generateRemision(remision);

      setTimeout(() => { setSuccess(false); setLastRemision(null); router.refresh(); }, 6000);
    }
    setLoading(false);
  };

  const handleRedownload = async () => {
    if (!lastRemision) return;
    const { generateRemision } = await import("@/lib/generate-remision");
    generateRemision(lastRemision);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo */}
        <div>
          <label className={labelCls}>Tipo de movimiento</label>
          <div className="flex gap-2 flex-wrap">
            {types.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border-2 cursor-pointer ${
                  type === t
                    ? typeConfig[t].activeCls
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {typeConfig[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Producto */}
        <div>
          <label className={labelCls}>Producto *</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            className={inputCls + " cursor-pointer"}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.sku ? ` — ${p.sku}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Cantidad */}
        <div>
          <label className={labelCls}>Cantidad *</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className={inputCls}
            placeholder="0"
          />
        </div>

        {/* Almacén origen */}
        {config.needsFrom && (
          <div>
            <label className={labelCls}>Almacén origen *</label>
            <select
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              required
              className={inputCls + " cursor-pointer"}
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {/* Almacén destino */}
        {config.needsTo && (
          <div>
            <label className={labelCls}>Almacén destino *</label>
            <select
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              required
              className={inputCls + " cursor-pointer"}
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {/* Receptor (solo para salidas) */}
        {isExit && (
          <div>
            <label className={labelCls}>Nombre de quien recoge *</label>
            <input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className={inputCls}
              placeholder="Nombre completo del receptor"
              required
            />
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className={labelCls}>Motivo</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="Ej. Evento de lanzamiento, campaña Q1..."
          />
        </div>

        {/* Notas */}
        <div>
          <label className={labelCls}>Notas adicionales</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls + " resize-none"}
            placeholder="Observaciones opcionales..."
          />
        </div>

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

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        {success && (
          <div className="flex items-center justify-between gap-2 text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Movimiento registrado — remisión descargada
            </span>
            {lastRemision && (
              <button
                type="button"
                onClick={handleRedownload}
                className="flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:text-emerald-800 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Volver a descargar
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || products.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer ${submitColor[type]}`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Registrando..." : `Registrar ${config.label}`}
        </button>

        {products.length === 0 && (
          <p className="text-amber-600 text-sm text-center bg-amber-50 rounded-lg p-3">
            No hay productos disponibles. El administrador debe crear productos primero.
          </p>
        )}
      </form>
    </div>
  );
}
