// src/app/(app)/dashboard/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getInventorySummary } from "@/app/actions/inventory";
import { getRequests } from "@/app/actions/requests";
import { DashboardChart } from "@/components/dashboard-chart";
import { StatusBadge } from "@/components/requests/status-badge";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Inbox,
  ChevronRight,
  Truck,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;
  const userName = session?.user?.name ?? "Usuario";
  const firstName = userName.split(" ")[0];

  const summaryOrgId = userRole === "ADMIN_MP" ? undefined : userOrgId;

  const [summaryRes, requestsRes] = await Promise.all([
    getInventorySummary(summaryOrgId),
    getRequests({ status: "ALL" }),
  ]);

  const summary = summaryRes.success
    ? summaryRes.data
    : { totalProducts: 0, totalStock: 0, lowStockCount: 0, totalValue: 0 };
  const requests = requestsRes.success ? requestsRes.data : [];
  const recent = requests.slice(0, 6);

  const byStatus = {
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    PREPARING: requests.filter((r) => r.status === "PREPARING").length,
    READY: requests.filter((r) => r.status === "READY").length,
    SHIPPED: requests.filter((r) => r.status === "SHIPPED").length,
    DELIVERED: requests.filter((r) => r.status === "DELIVERED").length,
    CANCELLED: requests.filter((r) => r.status === "CANCELLED").length,
  };
  const openRequests = byStatus.PENDING + byStatus.PREPARING + byStatus.READY + byStatus.SHIPPED;

  const chartData = [
    { name: "Pendiente",    cantidad: byStatus.PENDING },
    { name: "Preparando",   cantidad: byStatus.PREPARING },
    { name: "Listo",        cantidad: byStatus.READY },
    { name: "Enviado",      cantidad: byStatus.SHIPPED },
    { name: "Entregado",    cantidad: byStatus.DELIVERED },
  ];

  const formatCurrency = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const stats = [
    {
      label: "Solicitudes activas",
      value: openRequests.toLocaleString(),
      icon: Inbox,
      accent: "border-t-primary",
      iconColor: "text-slate-700",
    },
    {
      label: "Productos",
      value: summary.totalProducts.toLocaleString(),
      icon: Package,
      accent: "border-t-slate-400",
      iconColor: "text-slate-500",
    },
    {
      label: "Unidades en stock",
      value: summary.totalStock.toLocaleString(),
      icon: TrendingUp,
      accent: "border-t-emerald-500",
      iconColor: "text-emerald-500",
    },
    {
      label: "Valor inventario",
      value: formatCurrency(summary.totalValue ?? 0),
      icon: DollarSign,
      accent: "border-t-amber-500",
      iconColor: "text-amber-500",
    },
    {
      label: "Stock bajo (≤5)",
      value: summary.lowStockCount.toLocaleString(),
      icon: AlertTriangle,
      accent: summary.lowStockCount > 0 ? "border-t-red-500" : "border-t-slate-300",
      iconColor: summary.lowStockCount > 0 ? "text-red-500" : "text-slate-400",
    },
  ];

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Hola, {firstName}</h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{today}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`bg-white rounded-xl shadow-sm border border-slate-200/80 border-t-2 ${s.accent} p-5`}
            >
              <Icon className={`w-4 h-4 mb-3 ${s.iconColor}`} />
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Solicitudes por estado</h2>
              <p className="text-xs text-slate-400 mt-0.5">{requests.length} en total</p>
            </div>
          </div>
          <DashboardChart data={chartData} />
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Últimas solicitudes</h2>
            <Link href="/requests" className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-0">
            {recent.map((r, i) => (
              <Link
                key={r.id}
                href={`/requests/${r.id}`}
                className={`flex items-center gap-3 py-2.5 hover:bg-slate-50/60 -mx-2 px-2 rounded transition-colors ${
                  i < recent.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-semibold text-slate-800 truncate">{r.folio}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                    {r.deliveryMethod === "SHIPPING" ? (
                      <Truck className="w-2.5 h-2.5" />
                    ) : (
                      <ShoppingBag className="w-2.5 h-2.5" />
                    )}
                    {r.requester.name} · {format(new Date(r.createdAt), "dd MMM HH:mm", { locale: es })}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Sin solicitudes aún</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
