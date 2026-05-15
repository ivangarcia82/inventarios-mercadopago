// src/components/requests/status-badge.tsx
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pendiente",     cls: "bg-amber-100 text-amber-800 border border-amber-200" },
  PREPARING: { label: "En preparación", cls: "bg-blue-100 text-blue-800 border border-blue-200" },
  READY:     { label: "Listo pickup",   cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  SHIPPED:   { label: "Enviado",        cls: "bg-violet-100 text-violet-800 border border-violet-200" },
  DELIVERED: { label: "Entregado",      cls: "bg-slate-200 text-slate-700 border border-slate-300" },
  CANCELLED: { label: "Cancelada",      cls: "bg-red-100 text-red-700 border border-red-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
