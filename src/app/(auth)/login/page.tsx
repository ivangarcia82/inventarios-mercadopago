// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Handshake, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFE600] via-[#FFEC4D] to-[#FFF5A0] relative overflow-hidden">
      {/* Decorative blurred shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-[#FFFFFF]/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-32 w-[480px] h-[480px] bg-[#2D3277]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#2D3277]/10 shadow-[0_20px_60px_-15px_rgba(45,50,119,0.25)] p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FFE600] shadow-lg shadow-[#FFE600]/40 mb-5 ring-4 ring-white">
              <Handshake className="w-8 h-8 text-[#2D3277]" strokeWidth={2.4} />
            </div>
            <h1 className="text-xl font-bold text-[#2D3277] leading-tight">
              Inventario Mercado Pago
            </h1>
            <p className="text-sm text-slate-500 mt-1">Tu cuenta para gestionar el inventario</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#2D3277] mb-1.5 uppercase tracking-wide">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#2D3277] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFE600] focus:border-transparent text-sm transition-all"
                placeholder="tu@mercadopago.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[#2D3277] mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#2D3277] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFE600] focus:border-transparent text-sm transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFE600] text-[#2D3277] font-bold text-sm hover:bg-[#FFEC4D] active:bg-[#F5DC00] transition-colors disabled:opacity-60 cursor-pointer mt-2 shadow-lg shadow-[#FFE600]/40"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#2D3277]/70 mt-6 font-medium">
          © Mercado Pago · Sistema de Inventario
        </p>
      </div>
    </div>
  );
}
