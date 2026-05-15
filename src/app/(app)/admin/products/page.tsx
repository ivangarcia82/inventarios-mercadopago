// src/app/(app)/admin/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllProducts, createProduct, deleteProduct } from "@/app/actions/products";
import { getOrganizations } from "@/app/actions/warehouses";
import { Trash2, Plus, Inbox } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; unit: string; description: string | null; price: number | null; organization: { name: string } };
type Org = { id: string; name: string };

const currency = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", unit: "pza", description: "", price: "", organizationId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [pRes, oRes] = await Promise.all([getAllProducts(), getOrganizations()]);
    if (pRes.success) setProducts(pRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const priceNum = form.price.trim() === "" ? null : Number(form.price);
    if (priceNum != null && (Number.isNaN(priceNum) || priceNum < 0)) {
      setError("El precio debe ser un número válido (≥ 0)");
      setLoading(false);
      return;
    }
    const res = await createProduct({
      name: form.name,
      sku: form.sku || undefined,
      unit: form.unit,
      description: form.description || undefined,
      price: priceNum,
      organizationId: form.organizationId,
    });
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, name: "", sku: "", description: "", price: "" })); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const res = await deleteProduct(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Productos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Catálogo de productos promocionales</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo producto</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={inputCls}
              placeholder="Ej. Taza personalizada"
            />
          </div>
          <div>
            <label className={labelCls}>SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className={inputCls}
              placeholder="Ej. TAZA-001"
            />
          </div>
          <div>
            <label className={labelCls}>Unidad</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={inputCls + " cursor-pointer"}
            >
              {["pza", "caja", "kit", "par", "rollo"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Precio (MXN)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputCls}
              placeholder="Ej. 125.50"
            />
          </div>
          <div>
            <label className={labelCls}>Organización</label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className={inputCls + " cursor-pointer"}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
              placeholder="Descripción opcional"
            />
          </div>
          <div className="col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar producto
            </button>
          </div>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Unidad</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Precio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organización</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {p.sku ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                    {p.unit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.price != null
                    ? <span className="font-medium text-slate-700">{currency(p.price)}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{p.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin productos registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
