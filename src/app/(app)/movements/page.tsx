// src/app/(app)/movements/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMovements } from "@/app/actions/movements";
import { getAllWarehouses, getWarehouses } from "@/app/actions/warehouses";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowLeftRight, RotateCcw, Inbox, Download, User } from "lucide-react";
import type { RemisionData } from "@/lib/generate-remision";

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
  request: { id: string; folio: string; status: string } | null;
};

type Warehouse = { id: string; name: string; organization: { name: string } };

const typeConfig: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  ENTRY:    { label: "Entrada",       icon: ArrowDown,      badge: "bg-emerald-100 text-emerald-700" },
  EXIT:     { label: "Salida",        icon: ArrowUp,        badge: "bg-red-100 text-red-700" },
  TRANSFER: { label: "Transferencia", icon: ArrowLeftRight, badge: "bg-primary/10 text-primary" },
  RETURN:   { label: "Devolución",    icon: RotateCcw,      badge: "bg-amber-100 text-amber-700" },
};

const TYPE_FILTERS = [
  { value: "",         label: "Todos" },
  { value: "ENTRY",    label: "Entradas" },
  { value: "EXIT",     label: "Salidas" },
  { value: "TRANSFER", label: "Transferencias" },
  { value: "RETURN",   label: "Devoluciones" },
];

export default function MovementsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const userOrgId = (session?.user as any)?.organizationId as string | undefined;

  const [movements, setMovements] = useState<Movement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadWarehouses = useCallback(async () => {
    if (!userRole) return;
    const res = userRole === "ADMIN_MP"
      ? await getAllWarehouses()
      : await getWarehouses(userOrgId);
    if (res.success) setWarehouses(res.data as any);
  }, [userRole, userOrgId]);

  const load = useCallback(async (type?: string, warehouseId?: string) => {
    setLoading(true);
    const res = await getMovements({
      ...(type ? { type: type as any } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    });
    if (res.success) setMovements(res.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);
  useEffect(() => { load(); }, [load]);

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    load(type || undefined, warehouseFilter || undefined);
  };

  const handleWarehouseFilter = (wid: string) => {
    setWarehouseFilter(wid);
    load(typeFilter || undefined, wid || undefined);
  };

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

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Movimientos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historial completo de entradas, salidas y transferencias</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Filtro tipo */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                typeFilter === f.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtro almacén */}
        {warehouses.length > 0 && (
          <select
            value={warehouseFilter}
            onChange={(e) => handleWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-600 cursor-pointer"
          >
            <option value="">Todos los almacenes</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}{userRole === "ADMIN_MP" ? ` — ${w.organization.name}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200/80">
          ¿Buscas ver las solicitudes agrupadas? Ve a{" "}
          <Link href="/requests" className="font-semibold underline">
            Solicitudes
          </Link>{" "}— aquí ves el movimiento atómico por producto.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Solicitud</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Origen → Destino</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cant.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Motivo / Receptor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuario</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  Cargando movimientos...
                </td>
              </tr>
            )}
            {!loading && movements.map((m) => {
              const cfg = typeConfig[m.type] ?? { label: m.type, icon: ArrowLeftRight, badge: "bg-slate-100 text-slate-600" };
              const Icon = cfg.icon;
              const isExit = m.type === "EXIT";
              return (
                <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.badge}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.request ? (
                      <Link
                        href={`/requests/${m.request.id}`}
                        className="font-mono text-xs font-semibold text-slate-700 hover:text-primary-foreground hover:underline"
                      >
                        {m.request.folio}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{m.product.name}</p>
                    {m.product.sku && (
                      <p className="text-xs text-slate-400 font-mono">{m.product.sku}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {m.fromWarehouse?.name ?? "—"} → {m.toWarehouse?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                    {m.quantity} <span className="font-normal text-slate-400">{m.product.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[160px]">
                    {m.reason && <p className="text-slate-500 truncate">{m.reason}</p>}
                    {isExit && m.receiverName && (
                      <p className="flex items-center gap-1 text-slate-400 mt-0.5">
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.receiverName}</span>
                      </p>
                    )}
                    {!m.reason && (!isExit || !m.receiverName) && (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.createdBy.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(m.createdAt), "dd MMM yyyy · HH:mm", { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDownloadRemision(m)}
                      title="Descargar remisión"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && movements.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin movimientos registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
