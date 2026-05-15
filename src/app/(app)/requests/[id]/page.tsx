// src/app/(app)/requests/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRequest } from "@/app/actions/requests";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Truck,
  ShoppingBag,
  MapPin,
  User,
  Phone,
  FileText,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/requests/status-badge";
import { RequestActions } from "@/components/requests/request-actions";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as any)?.id as string;
  const userRole = (session?.user as any)?.role as string;
  const isAdmin = userRole === "ADMIN_MP";

  const res = await getRequest(id);
  if (!res.success) notFound();
  const r = res.data;
  const isShipping = r.deliveryMethod === "SHIPPING";
  const isOwner = r.requesterId === userId;

  const trackingUrl = r.trackingNumber
    ? `https://www.paquetexpress.com.mx/rastreo/${encodeURIComponent(r.trackingNumber)}`
    : null;

  const timeline = [
    { label: "Creada", at: r.createdAt, by: r.requester.name, active: true },
    { label: "Preparación iniciada", at: r.preparedAt, by: r.preparedBy?.name ?? null, active: !!r.preparedAt },
    {
      label: isShipping ? "Enviada" : "Lista para pickup",
      at: r.fulfilledAt,
      by: null,
      active: !!r.fulfilledAt,
    },
    { label: "Entregada", at: r.deliveredAt, by: null, active: !!r.deliveredAt },
    ...(r.cancelledAt
      ? [{ label: "Cancelada", at: r.cancelledAt, by: null, active: true, danger: true }]
      : []),
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <Link
          href="/requests"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a solicitudes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900 font-mono">{r.folio}</h1>
          <StatusBadge status={r.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
            {isShipping ? <Truck className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
            {isShipping ? "Envío" : "Pick-up"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Creada {format(new Date(r.createdAt), "dd 'de' MMMM yyyy · HH:mm", { locale: es })} por{" "}
          <strong className="text-slate-700">{r.requester.name}</strong>
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Items */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/80">
              <h2 className="text-sm font-semibold text-slate-800">Productos ({r.items.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitado</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Surtido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{it.product.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{it.product.sku ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {it.quantityRequested} {it.product.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {it.quantityFulfilled} {it.product.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tracking */}
          {isShipping && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Guía Paquete Express</h2>
              {r.trackingNumber ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-bold text-slate-900">{r.trackingNumber}</span>
                  <a
                    href={trackingUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90"
                  >
                    Rastrear envío <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Sin guía asignada todavía.</p>
              )}
            </div>
          )}

          {/* Movimientos asociados */}
          {r.movements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/80">
                <h2 className="text-sm font-semibold text-slate-800">Movimientos de inventario</h2>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {r.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-slate-500">
                        {format(new Date(m.createdAt), "dd MMM · HH:mm", { locale: es })}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <span className={m.type === "EXIT" ? "text-red-600" : "text-emerald-600"}>
                          {m.type === "EXIT" ? "Salida" : "Devolución"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{m.product.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{m.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Info recibe */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-2.5 text-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-1">Detalles</h2>
            <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Almacén" value={r.warehouse.name} />
            {r.shippingAddress && (
              <InfoRow icon={<Truck className="w-3.5 h-3.5" />} label="Dirección" value={r.shippingAddress} />
            )}
            {r.receiverName && (
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Recibe" value={r.receiverName} />
            )}
            {r.receiverPhone && (
              <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Teléfono" value={r.receiverPhone} />
            )}
            {r.notes && (
              <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Notas" value={r.notes} />
            )}
            {r.cancelReason && (
              <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Motivo cancelación" value={r.cancelReason} />
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Línea de tiempo</h2>
            <ol className="space-y-3">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        t.active
                          ? (t as any).danger
                            ? "bg-red-500"
                            : "bg-primary"
                          : "bg-slate-200"
                      }`}
                    />
                    {i < timeline.length - 1 && <div className="flex-1 w-px bg-slate-200 my-1" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className={`text-xs font-semibold ${t.active ? "text-slate-800" : "text-slate-400"}`}>
                      {t.label}
                    </p>
                    {t.at && (
                      <p className="text-[10px] text-slate-400">
                        {format(new Date(t.at), "dd MMM · HH:mm", { locale: es })}
                        {t.by ? ` · ${t.by}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Acciones */}
          <RequestActions
            request={{
              id: r.id,
              status: r.status,
              deliveryMethod: r.deliveryMethod,
              trackingNumber: r.trackingNumber,
            }}
            isAdmin={isAdmin}
            isOwner={isOwner}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-slate-700">{value}</p>
      </div>
    </div>
  );
}
