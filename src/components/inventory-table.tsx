// src/components/inventory-table.tsx
"use client";

import { useState } from "react";
import { getInventory } from "@/app/actions/inventory";
import { AlertTriangle, Search, Inbox } from "lucide-react";

type InventoryItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string; price: number | null };
  warehouse: { id: string; name: string };
};
type Org = { id: string; name: string };

const currency = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

interface Props {
  initialItems: InventoryItem[];
  orgs: Org[];
  userRole: string;
  defaultOrgId: string;
}

export function InventoryTable({ initialItems, orgs, userRole, defaultOrgId }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedOrg, setSelectedOrg] = useState(defaultOrgId);
  const [search, setSearch] = useState("");

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrg(orgId);
    const res = await getInventory(orgId);
    if (res.success) setItems(res.data as any);
  };

  const filtered = items.filter(
    (i) =>
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      i.warehouse.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce(
    (sum, i) => sum + i.quantity * (i.product.price ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Search + filter row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
            placeholder="Buscar producto o almacén..."
          />
        </div>
        {userRole === "ADMIN_MP" && (
          <select
            value={selectedOrg}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-700 cursor-pointer"
          >
            {orgs.map((o: Org) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Producto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Almacén</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{item.product.name}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {item.product.sku ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{item.warehouse.name}</td>
                <td className="px-4 py-3 text-right">
                  {item.quantity <= 5 ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-semibold">
                      <AlertTriangle className="w-3 h-3" />
                      {item.quantity} {item.product.unit}
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {item.quantity}{" "}
                      <span className="font-normal text-slate-400 text-xs">{item.product.unit}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {item.product.price != null
                    ? currency(item.product.price)
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">
                  {item.product.price != null
                    ? currency(item.quantity * item.product.price)
                    : <span className="text-slate-300 font-normal">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    {items.length === 0 ? "Sin inventario registrado" : "Sin resultados para la búsqueda"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/50">
                <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor total
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                  {currency(totalValue)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
