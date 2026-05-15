// src/components/pos/pos-terminal.tsx
"use client";

import { useState } from "react";
import { getWarehouseInventory } from "@/app/actions/inventory";
import { createRequest } from "@/app/actions/requests";
import { ShoppingCart, X, Plus, Minus, PackageSearch, CheckCircle2, Loader2, Download, User, MapPin } from "lucide-react";
import type { RemisionData } from "@/lib/generate-remision";

type Warehouse = { id: string; name: string; organization: { name: string } };
type StockItem = {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string };
};
type CartItem = {
  productId: string;
  warehouseId: string;
  name: string;
  unit: string;
  qty: number;
  maxQty: number;
  sku?: string | null;
};

interface Props {
  warehouses: Warehouse[];
}

export function PosTerminal({ warehouses }: Props) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [isForeign, setIsForeign] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [lastRemision, setLastRemision] = useState<RemisionData | null>(null);

  const loadWarehouse = async (id: string) => {
    setWarehouseId(id);
    setCart([]);
    setError("");
    setLoading(true);
    const res = await getWarehouseInventory(id);
    if (res.success) setStock(res.data as any);
    setLoading(false);
  };

  // Load initial warehouse on mount
  useState(() => {
    if (warehouses[0]?.id) loadWarehouse(warehouses[0].id);
  });

  const filtered = stock.filter(
    (s) =>
      s.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.product.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: StockItem) => {
    const existing = cart.find((c) => c.productId === item.product.id);
    if (existing) {
      if (existing.qty >= existing.maxQty) return;
      setCart(cart.map((c) =>
        c.productId === item.product.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, {
        productId: item.product.id,
        warehouseId,
        name: item.product.name,
        unit: item.product.unit,
        sku: item.product.sku,
        qty: 1,
        maxQty: item.quantity,
      }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.productId !== productId) return c;
      const newQty = Math.max(1, Math.min(c.maxQty, c.qty + delta));
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const totalUnits = cart.reduce((sum, c) => sum + c.qty, 0);

  const currentWarehouse = warehouses.find((w) => w.id === warehouseId);

  const handleSubmit = async () => {
    if (!cart.length) return;
    if (!receiverName.trim()) {
      setError("Ingresa el nombre de quien recoge la mercancía");
      return;
    }
    const trackingTrimmed = trackingNumber.trim();
    if (isForeign) {
      if (!trackingTrimmed) {
        setError("Ingresa el número de guía del envío foráneo");
        return;
      }
      if (!shippingAddress.trim()) {
        setError("Ingresa la dirección de envío");
        return;
      }
    }
    setSubmitting(true);
    setError("");

    // Solicitud rápida: arranca en PREPARING, descuenta inventario en el mismo paso.
    const res = await createRequest({
      warehouseId,
      deliveryMethod: isForeign ? "SHIPPING" : "PICKUP",
      receiverName: receiverName.trim(),
      shippingAddress: isForeign ? shippingAddress.trim() : undefined,
      notes: "Solicitud rápida (POS)",
      items: cart.map((c) => ({ productId: c.productId, quantity: c.qty })),
      startInPreparing: true,
    });

    if (!res.success) {
      setError(res.error ?? "Error al registrar");
    } else {
      const folio = res.data.folio;
      const remision: RemisionData = {
        folio,
        type: "EXIT",
        createdAt: new Date(),
        createdByName: "—",
        receiverName: receiverName.trim(),
        reason: "Solicitud rápida (POS)",
        trackingNumber: isForeign ? trackingTrimmed : undefined,
        warehouseName: currentWarehouse?.name,
        items: cart.map((c) => ({
          productName: c.name,
          sku: c.sku,
          unit: c.unit,
          quantity: c.qty,
          fromWarehouse: currentWarehouse?.name ?? null,
          toWarehouse: null,
        })),
      };

      setLastRemision(remision);
      setSuccess(true);
      setCart([]);
      setReceiverName("");
      setIsForeign(false);
      setTrackingNumber("");
      setShippingAddress("");

      // Auto-download PDF
      const { generateRemision } = await import("@/lib/generate-remision");
      generateRemision(remision);

      await loadWarehouse(warehouseId);
      setTimeout(() => { setSuccess(false); setLastRemision(null); }, 8000);
    }
    setSubmitting(false);
  };

  const handleRedownload = async () => {
    if (!lastRemision) return;
    const { generateRemision } = await import("@/lib/generate-remision");
    generateRemision(lastRemision);
  };

  const cartQty = (productId: string) => cart.find((c) => c.productId === productId)?.qty ?? 0;

  return (
    <div className="flex gap-4 h-[calc(100vh-152px)]">
      {/* Panel izquierdo — productos */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controles */}
        <div className="flex gap-3 mb-4">
          <select
            value={warehouseId}
            onChange={(e) => loadWarehouse(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-700 cursor-pointer"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — {w.organization.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Grilla */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Cargando inventario...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <PackageSearch className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {stock.length === 0 ? "Sin productos con stock en este almacén" : "Sin resultados"}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
              {filtered.map((item) => {
                const inCart = cartQty(item.product.id);
                const maxed = inCart >= item.quantity;
                const outOfStock = item.quantity === 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => !outOfStock && addToCart(item)}
                    disabled={outOfStock || maxed}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                      outOfStock || maxed
                        ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                        : inCart > 0
                        ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10"
                        : "border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm"
                    }`}
                  >
                    {inCart > 0 && (
                      <span className="absolute top-2.5 right-2.5 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {inCart}
                      </span>
                    )}
                    <p className="font-semibold text-slate-800 text-sm leading-tight pr-7">
                      {item.product.name}
                    </p>
                    {item.product.sku && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.product.sku}</p>
                    )}
                    <p className={`text-xs font-medium mt-2.5 ${
                      item.quantity <= 5 ? "text-red-500" : "text-slate-500"
                    }`}>
                      {item.quantity} {item.product.unit} disponibles
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Panel derecho — carrito */}
      <div className="w-72 shrink-0 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Header carrito */}
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100">
          <ShoppingCart className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700 text-sm">Carrito de salida</span>
          {cart.length > 0 && (
            <span className="ml-auto text-xs bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
              {cart.length}
            </span>
          )}
        </div>

        {/* Items */}
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 px-4 text-center gap-2">
            <ShoppingCart className="w-8 h-8" />
            <p className="text-sm text-slate-400">Selecciona un producto</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {cart.map((item) => (
              <div key={item.productId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <p className="text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-slate-300 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.productId, -1)}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 w-6 text-center tabular-nums">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.productId, 1)}
                    disabled={item.qty >= item.maxQty}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-400 ml-0.5">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 space-y-3">
          {cart.length > 0 && (
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>{cart.length} producto{cart.length !== 1 ? "s" : ""}</span>
              <span className="font-semibold text-slate-700">{totalUnits} unidad{totalUnits !== 1 ? "es" : ""}</span>
            </div>
          )}

          {/* Receptor */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
              <User className="w-3 h-3" />
              Nombre del receptor *
            </label>
            <input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="¿Quién recoge?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
            />
          </div>

          {/* Envío foráneo */}
          <div>
            <button
              type="button"
              onClick={() => setIsForeign((v) => !v)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  isForeign ? "bg-primary" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                    isForeign ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">
                Envío foráneo
              </span>
            </button>

            {isForeign && (
              <>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Número de guía"
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400 font-mono"
                />
                <div className="mt-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                    <MapPin className="w-3 h-3" />
                    Dirección de envío *
                  </label>
                  <textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    rows={2}
                    placeholder="Calle, número, colonia, ciudad"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </p>
          )}

          {success && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Salida registrada — remisión descargada
              </div>
              {lastRemision && (
                <button
                  onClick={handleRedownload}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-primary transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Volver a descargar remisión
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!cart.length || submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Registrando..." : "Crear solicitud rápida"}
          </button>
        </div>
      </div>
    </div>
  );
}
