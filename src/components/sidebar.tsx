// src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Warehouse,
  Users,
  Zap,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Handshake,
  Inbox,
} from "lucide-react";

// Visible para todos los roles
const navItems = [
  { label: "Dashboard",     href: "/dashboard",  icon: LayoutDashboard },
  { label: "Solicitudes",   href: "/requests",   icon: Inbox },
  { label: "Inventario",    href: "/inventory",  icon: Package },
  { label: "Movimientos",   href: "/movements",  icon: ClipboardList },
];

// Solo admin
const adminItems = [
  { label: "Solicitud rápida", href: "/pos",              icon: Zap },
  { label: "Almacenes",        href: "/admin/warehouses", icon: Warehouse },
  { label: "Productos",        href: "/admin/products",   icon: Package },
  { label: "Usuarios",         href: "/admin/users",      icon: Users },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  orgName: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Sidebar({ userName, userRole, orgName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = userRole === "ADMIN_MP";

  const roleLabel = userRole === "ADMIN_MP" ? "Admin" : "Mercado Pago";

  return (
    <aside
      className={`relative flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0 ${
        collapsed ? "w-[64px]" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center h-14 border-b border-sidebar-border shrink-0 ${
          collapsed ? "justify-center px-0" : "gap-2.5 px-4"
        }`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary shrink-0">
          <Handshake className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight tracking-tight truncate">
              Mercado Pago
            </p>
            <p className="text-[10px] text-slate-400 leading-tight tracking-wide uppercase truncate">
              Inventario
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && active && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-60 shrink-0" />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className={`pt-4 pb-1 ${collapsed ? "px-0" : "px-2.5"}`}>
              {!collapsed ? (
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Administración
                </p>
              ) : (
                <div className="h-px bg-sidebar-border mx-1" />
              )}
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && active && (
                    <ChevronRight className="w-3 h-3 ml-auto opacity-60 shrink-0" />
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* User info */}
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-primary border border-primary/60 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary-foreground">
                {getInitials(userName)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate leading-tight">
                {userName}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">
                {roleLabel} · {orgName}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="flex justify-center py-1"
            title={`${userName} — ${roleLabel}`}
          >
            <div className="w-7 h-7 rounded-full bg-primary border border-primary/60 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground">
                {getInitials(userName)}
              </span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-sm transition-colors cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="text-xs">Colapsar</span>
            </>
          )}
        </button>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-xs">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
