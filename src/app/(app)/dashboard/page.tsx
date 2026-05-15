// src/app/(app)/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { getInventorySummary } from "@/app/actions/inventory";
import { getMovements } from "@/app/actions/movements";
import { DashboardChart } from "@/components/dashboard-chart";
import { Package, ArrowLeftRight, AlertTriangle, TrendingUp, ArrowDown, ArrowUp, RotateCcw, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const movementTypeConfig: Record<string, { label: string; color: string }> = {
  ENTRY:    { label: "Entrada",       color: "bg-emerald-100 text-emerald-700" },
  EXIT:     { label: "Salida",        color: "bg-red-100 text-red-700" },
  TRANSFER: { label: "Transferencia", color: "bg-primary/10 text-primary" },
  RETURN:   { label: "Devolución",    color: "bg-amber-100 text-amber-700" },
};

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role as string;
  const userOrgId = (session?.user as any)?.organizationId as string;
  const userName = session?.user?.name ?? "Usuario";
  const firstName = userName.split(" ")[0];

  // ADMIN_MP ve el resumen global; USER_MP solo su org
  const summaryOrgId = userRole === "ADMIN_MP" ? undefined : userOrgId;

  const [summaryRes, movementsRes] = await Promise.all([
    getInventorySummary(summaryOrgId),
    getMovements(),
  ]);

  const summary = summaryRes.success
    ? summaryRes.data
    : { totalProducts: 0, totalStock: 0, lowStockCount: 0, totalValue: 0 };
  const recentMovements = movementsRes.success ? movementsRes.data.slice(0, 6) : [];
  const allMovements = movementsRes.success ? movementsRes.data : [];

  const chartData = ["ENTRY", "EXIT", "TRANSFER", "RETURN"].map((type) => ({
    name: { ENTRY: "Entradas", EXIT: "Salidas", TRANSFER: "Transfer.", RETURN: "Devoluciones" }[type] ?? type,
    cantidad: allMovements.filter((m) => m.type === type).length,
  }));

  const formatCurrency = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const stats = [
    {
      label: "Productos",
      value: summary.totalProducts.toLocaleString(),
      icon: Package,
      accent: "border-t-primary",
      iconColor: "text-primary",
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
    {
      label: "Movimientos",
      value: allMovements.length.toLocaleString(),
      icon: ArrowLeftRight,
      accent: "border-t-violet-500",
      iconColor: "text-violet-500",
    },
  ];

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola, {firstName}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`bg-white rounded-xl shadow-sm border border-slate-200/80 border-t-2 ${s.accent} p-5`}
            >
              <Icon className={`w-4 h-4 mb-3 ${s.iconColor}`} />
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                {s.value}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Gráfica — más ancha */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Movimientos por tipo</h2>
              <p className="text-xs text-slate-400 mt-0.5">{allMovements.length} en total</p>
            </div>
          </div>
          <DashboardChart data={chartData} />
        </div>

        {/* Últimos movimientos */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Últimos movimientos</h2>
          <div className="space-y-0">
            {recentMovements.map((m, i) => {
              const cfg = movementTypeConfig[(m as any).type] ?? { label: (m as any).type, color: "bg-slate-100 text-slate-600" };
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < recentMovements.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {(m as any).product.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(new Date(m.createdAt), "dd MMM · HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {m.quantity} uds.
                    </span>
                  </div>
                </div>
              );
            })}
            {recentMovements.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Sin movimientos aún</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
