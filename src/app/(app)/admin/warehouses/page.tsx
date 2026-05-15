// src/app/(app)/admin/warehouses/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllWarehouses, getOrganizations, createWarehouse, deleteWarehouse } from "@/app/actions/warehouses";
import { Trash2, Plus, Inbox } from "lucide-react";

type Warehouse = { id: string; name: string; organizationId: string; organization: { name: string }; createdAt: Date };
type Org = { id: string; name: string };

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [wRes, oRes] = await Promise.all([getAllWarehouses(), getOrganizations()]);
    if (wRes.success) setWarehouses(wRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setOrgId(oRes.data[0]?.id ?? ""); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createWarehouse({ name, organizationId: orgId });
    if (!res.success) setError(res.error ?? "Error");
    else { setName(""); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este almacén?")) return;
    const res = await deleteWarehouse(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Almacenes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona los almacenes de tu organización</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo almacén</h2>
        <form onSubmit={handleCreate} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Nombre del almacén
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Ej. Bodega Norte"
            />
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Organización
            </label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white cursor-pointer"
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </form>
        {error && (
          <p className="text-red-600 text-sm mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organización</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warehouses.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{w.name}</td>
                <td className="px-4 py-3 text-slate-500">{w.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin almacenes registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
