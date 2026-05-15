// src/components/requests/new-request-form.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getWarehouseInventory } from "@/app/actions/inventory";
import { createRequest } from "@/app/actions/requests";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  PackageSearch,
  Loader2,
  Truck,
  ShoppingBag,
  CheckCircle2,
} from "lucide-react";

type Warehouse = { id: string; name: string; organization: { name: string } };
type StockItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string };
};
type CartItem = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  maxQty: number;
  sku?: string | null;
};

interface Props {
  warehouses: Warehouse[];
  isAdmin: boolean;
}

export function NewRequestForm({ warehouses, isAdmin }: Props) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "SHIPPING">("PICKUP");
  const [shippingAddress, setShippingAddress] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ folio: string; id: string } | null>(null);

  useEffect(() => {
    if (!warehouseId) return;
    setCart([]);
    setLoadingStock(true);
    getWarehouseInventory(warehouseId).then((res) => {
      if (res.success) setStock(res.data as any);
      setLoadingStock(false);
    });
  }, [warehouseId]);

  const filtered = stock.filter(
    (s) =>
      s.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.product.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (s: StockItem) => {
    const existing = cart.find((c) => c.productId === s.product.id);
    if (existing) {
      if (existing.qty >= existing.maxQty) return;
      setCart(cart.map((c) => (c.productId === s.product.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          productId: s.product.id,
          name: s.product.name,
          unit: s.product.unit,
          sku: s.product.sku,
          qty: 1,
          maxQty: s.quantity,
        },
      ]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((c) =>
      c
        .map((it) =>
          it.productId === productId
            ? { ...it, qty: Math.max(1, Math.min(it.maxQty, it.qty + delta)) }
            : it
        )
        .filter((it) => it.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((c) => c.filter((it) => it.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!cart.length) {
      setError("Agrega al menos un producto");
      return;
    }
    if (deliveryMethod === "SHIPPING" && !shippingAddress.trim()) {
      setError("Falta la dirección de envío");
      return;
    }

    startTransition(async () => {
      const res = await createRequest({
        warehouseId,
        deliveryMethod,
        shippingAddress: shippingAddress || undefined,
        receiverName: receiverName || undefined,
        receiverPhone: receiverPhone || undefined,
        notes: notes || undefined,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.qty })),
      });
      if (res.success) {
        setSuccess({ folio: res.data.folio, id: res.data.id });
      } else {
        setError(res.error);
      }
    });
  };

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Solicitud enviada</h2>
        <p className="text-sm text-slate-500 mt-1">
          Tu folio es <span className="font-mono font-bold text-slate-800">{success.folio}</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">Almacenista y comercial recibirán la notificación por correo.</p>
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => router.push(`/requests/${success.id}`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Ver solicitud
          </button>
          <button
            onClick={() => {
              setSuccess(null);
              setCart([]);
              setSearch("");
              setNotes("");
              setShippingAddress("");
              setReceiverName("");
              setReceiverPhone("");
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Nueva solicitud
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-5">
      {/* Catálogo */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Almacén
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {isAdmin ? ` — ${w.organization.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Buscar
              </label>
              <div className="relative">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Producto o SKU..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loadingStock ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Cargando inventario...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Sin productos con stock</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {filtered.map((s) => {
                const inCart = cart.find((c) => c.productId === s.product.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => addToCart(s)}
                    disabled={(inCart?.qty ?? 0) >= s.quantity}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{s.product.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.product.sku ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {s.quantity} {s.product.unit}
                      </span>
                      {inCart ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 text-slate-900 text-xs font-semibold">
                          ×{inCart.qty}
                        </span>
                      ) : (
                        <Plus className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Carrito + detalles */}
      <div className="space-y-4 lg:sticky lg:top-4 self-start">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Carrito ({cart.length})</h2>
          </div>
          {cart.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Agrega productos del catálogo</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{c.sku ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => updateQty(c.productId, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold tabular-nums">{c.qty}</span>
                    <button type="button" onClick={() => updateQty(c.productId, 1)} disabled={c.qty >= c.maxQty} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => removeFromCart(c.productId)} className="ml-1 w-6 h-6 rounded text-slate-400 hover:text-red-500 flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Método de entrega</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryMethod("PICKUP")}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium ${
                deliveryMethod === "PICKUP"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Pick-up
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod("SHIPPING")}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium ${
                deliveryMethod === "SHIPPING"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Truck className="w-4 h-4" />
              Envío
            </button>
          </div>

          {deliveryMethod === "SHIPPING" && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Dirección de envío *
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                placeholder="Calle, número, colonia, ciudad..."
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Quién recibe (opcional)
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              placeholder="Nombre del destinatario"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              placeholder="55..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              placeholder="Indicaciones adicionales..."
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Enviando..." : `Enviar solicitud (${cart.length})`}
          </button>
        </div>
      </div>
    </form>
  );
}
