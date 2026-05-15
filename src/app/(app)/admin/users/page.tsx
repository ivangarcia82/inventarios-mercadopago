// src/app/(app)/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getUsers, createUser, deleteUser } from "@/app/actions/users";
import { getOrganizations } from "@/app/actions/warehouses";
import { Trash2, Plus, Inbox } from "lucide-react";

type User = { id: string; email: string; name: string; role: string; organization: { name: string }; createdAt: Date };
type Org = { id: string; name: string };

const roleLabel: Record<string, string> = { ADMIN_MP: "Admin", USER_MP: "Usuario Mercado Pago" };
const roleBadge: Record<string, string> = {
  ADMIN_MP: "bg-primary/20 text-slate-900 border border-primary",
  USER_MP: "bg-emerald-100 text-emerald-700",
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white";
const labelCls = "block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "USER_MP" as "ADMIN_MP" | "USER_MP",
    organizationId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [uRes, oRes] = await Promise.all([getUsers(), getOrganizations()]);
    if (uRes.success) setUsers(uRes.data as any);
    if (oRes.success) { setOrgs(oRes.data); setForm((f) => ({ ...f, organizationId: oRes.data[0]?.id ?? "" })); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await createUser(form);
    if (!res.success) setError(res.error ?? "Error");
    else { setForm((f) => ({ ...f, email: "", password: "", name: "" })); await load(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await deleteUser(id);
    if (!res.success) alert(res.error);
    else await load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Administra el acceso al sistema</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo usuario</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={inputCls}
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="off"
              className={inputCls}
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className={labelCls}>Contraseña *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="USER_MP">Usuario Mercado Pago</option>
              <option value="ADMIN_MP">Admin</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Organización</label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className={inputCls + " cursor-pointer"}
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear usuario
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Organización</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleBadge[u.role] ?? "bg-slate-100 text-slate-700"}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.organization.name}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin usuarios registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
