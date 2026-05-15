// src/components/requests/request-actions.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startPreparation,
  markReadyForPickup,
  markShipped,
  markDelivered,
  cancelRequest,
  assignTracking,
} from "@/app/actions/requests";
import { Loader2, PlayCircle, Truck, PackageCheck, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  request: {
    id: string;
    status: string;
    deliveryMethod: string;
    trackingNumber: string | null;
  };
  isAdmin: boolean;
  isOwner: boolean;
}

export function RequestActions({ request, isAdmin, isOwner }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(request.trackingNumber ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const isShipping = request.deliveryMethod === "SHIPPING";
  const canCancel =
    (isAdmin && !["DELIVERED", "CANCELLED"].includes(request.status)) ||
    (isOwner && request.status === "PENDING");

  const run = (fn: () => Promise<any>) => {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res?.success === false) setError(res.error);
      else router.refresh();
    });
  };

  // Sin acciones disponibles
  if (!isAdmin && !canCancel) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">Acciones</h2>

      {isAdmin && request.status === "PENDING" && (
        <button
          onClick={() => run(() => startPreparation(request.id))}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          Iniciar preparación
        </button>
      )}

      {isAdmin && request.status === "PREPARING" && isShipping && (
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Guía Paquete Express
          </label>
          <input
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Número de guía"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={() => run(() => assignTracking(request.id, tracking))}
              disabled={pending || !tracking.trim() || tracking === request.trackingNumber}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50"
            >
              Guardar guía
            </button>
            <button
              onClick={() => run(() => markShipped(request.id, tracking))}
              disabled={pending || !tracking.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              Marcar enviado
            </button>
          </div>
        </div>
      )}

      {isAdmin && request.status === "PREPARING" && !isShipping && (
        <button
          onClick={() => run(() => markReadyForPickup(request.id))}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
          Marcar listo para pick-up
        </button>
      )}

      {isAdmin && (request.status === "SHIPPED" || request.status === "READY") && (
        <button
          onClick={() => run(() => markDelivered(request.id))}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Marcar entregado
        </button>
      )}

      {canCancel && (
        <div className="pt-2 border-t border-slate-100">
          {showCancel ? (
            <div className="space-y-2">
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo (opcional)"
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Atrás
                </button>
                <button
                  onClick={() => run(() => cancelRequest(request.id, cancelReason))}
                  disabled={pending}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmar cancelación
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar solicitud
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
