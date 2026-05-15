// src/app/(app)/requests/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getRequests, getRequestStatusCounts } from "@/app/actions/requests";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Inbox,
  Truck,
  ShoppingBag,
  ExternalLink,
  Clock,
  Package2,
  CheckCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/requests/status-badge";

const STATUS_ORDER = ["PENDING", "PREPARING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const STATUS_META: Record<string, { label: string; chipCls: string; activeCls: string }> = {
  ALL:       { label: "Todas",       chipCls: "border-slate-200 bg-white text-slate-600",     activeCls: "border-slate-900 bg-slate-900 text-white" },
  PENDING:   { label: "Pendiente",   chipCls: "border-amber-200 bg-amber-50 text-amber-800",  activeCls: "border-amber-500 bg-amber-500 text-white" },
  PREPARING: { label: "Preparando",  chipCls: "border-blue-200 bg-blue-50 text-blue-800",     activeCls: "border-blue-500 bg-blue-500 text-white" },
  READY:     { label: "Listo pickup",chipCls: "border-emerald-200 bg-emerald-50 text-emerald-800", activeCls: "border-emerald-500 bg-emerald-500 text-white" },
  SHIPPED:   { label: "Enviado",     chipCls: "border-violet-200 bg-violet-50 text-violet-800", activeCls: "border-violet-500 bg-violet-500 text-white" },
  DELIVERED: { label: "Entregado",   chipCls: "border-slate-300 bg-slate-100 text-slate-700",   activeCls: "border-slate-700 bg-slate-700 text-white" },
  CANCELLED: { label: "Cancelada",   chipCls: "border-red-200 bg-red-50 text-red-700",         activeCls: "border-red-500 bg-red-500 text-white" },
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.status?.toUpperCase() ?? "ALL") as keyof typeof STATUS_META;
  const filterValid = filter in STATUS_META ? filter : "ALL";

  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const isAdmin = userRole === "ADMIN_MP";

  const [listRes, countsRes] = await Promise.all([
    getRequests({ status: filterValid === "ALL" ? "ALL" : (filterValid as any) }),
    getRequestStatusCounts(),
  ]);
  const list = listRes.success ? listRes.data : [];
  const counts = countsRes.success
    ? countsRes.data
    : { PENDING: 0, PREPARING: 0, READY: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0, total: 0 };

  const summaryCards = [
    { key: "total" as const, label: "Total", value: counts.total, icon: Inbox, accent: "border-t-primary" },
    { key: "PENDING" as const, label: "Pendientes", value: counts.PENDING, icon: Clock, accent: "border-t-amber-400" },
    { key: "PREPARING" as const, label: "En preparación", value: counts.PREPARING, icon: Package2, accent: "border-t-blue-400" },
    { key: "READY" as const, label: "Listas pickup", value: counts.READY, icon: ShoppingBag, accent: "border-t-emerald-400" },
    { key: "SHIPPED" as const, label: "Enviadas", value: counts.SHIPPED, icon: Truck, accent: "border-t-violet-400" },
    { key: "DELIVERED" as const, label: "Entregadas", value: counts.DELIVERED, icon: CheckCheck, accent: "border-t-slate-400" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Solicitudes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? "Todas las solicitudes del sistema" : "Tus solicitudes de material"}
          </p>
        </div>
        <Link
          href="/requests/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </Link>
      </div>

      {/* Summary cards — actúan como filtros */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          const isActive =
            (c.key === "total" && filterValid === "ALL") || c.key === filterValid;
          const href = c.key === "total" ? "/requests" : `/requests?status=${c.key}`;
          return (
            <Link
              key={c.key}
              href={href}
              className={`bg-white rounded-xl border-t-2 ${c.accent} border-x border-b border-slate-200/80 p-4 transition-all ${
                isActive ? "shadow-md ring-2 ring-primary/30" : "hover:shadow-sm"
              }`}
            >
              <Icon className="w-4 h-4 text-slate-400 mb-2" />
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{c.value}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{c.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Filter chip activo */}
      {filterValid !== "ALL" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtrando por:</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${STATUS_META[filterValid].activeCls}`}
          >
            {STATUS_META[filterValid].label}
          </span>
          <Link href="/requests" className="text-xs text-slate-500 hover:text-slate-800 underline">
            limpiar
          </Link>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Folio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Método</th>
              {isAdmin && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitante</th>
              )}
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Almacén</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rastreo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r: any) => {
              const trackingUrl = r.trackingNumber
                ? `https://www.paquetexpress.com.mx/rastreo/${encodeURIComponent(r.trackingNumber)}`
                : null;
              return (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/requests/${r.id}`}
                      className="font-semibold text-slate-800 hover:underline"
                    >
                      {r.folio}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      {r.deliveryMethod === "SHIPPING" ? (
                        <><Truck className="w-3.5 h-3.5" /> Envío</>
                      ) : (
                        <><ShoppingBag className="w-3.5 h-3.5" /> Pick-up</>
                      )}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-slate-600">{r.requester.name}</td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{r.warehouse.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r._count.items}</td>
                  <td className="px-4 py-3">
                    {trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-violet-700 hover:text-violet-900 hover:underline"
                      >
                        {r.trackingNumber}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {format(new Date(r.createdAt), "dd MMM yyyy · HH:mm", { locale: es })}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-16 text-center">
                  <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    {filterValid === "ALL" ? "Sin solicitudes aún" : `Ninguna solicitud en estado ${STATUS_META[filterValid].label}`}
                  </p>
                  {filterValid === "ALL" && (
                    <Link href="/requests/new" className="inline-block mt-3 text-xs text-slate-600 hover:underline">
                      Crea la primera
                    </Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
