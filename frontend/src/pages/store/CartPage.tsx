import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  TicketPercent,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatGTQ } from '../../utils/format';
import { EmptyStateView, ErrorStateView, LoadingView } from '../../components/ui/EmptyAndErrorStates';

export const CartPage: React.FC = () => {
  const {
    cart,
    isLoadingCart,
    cartError,
    refreshCart,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  if (isLoadingCart && !cart) {
    return <LoadingView message="Calculando carrito y promociones vigentes..." />;
  }

  if (cartError && !cart) {
    return <ErrorStateView message={cartError} onRetry={refreshCart} />;
  }

  const items = cart?.items ?? [];

  const handleQtyChange = async (idVariante: number, nuevaCantidad: number) => {
    setBusyItem(idVariante);
    try {
      await updateQuantity(idVariante, nuevaCantidad);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Cantidad no disponible (RF-04)',
        message: err instanceof Error ? err.message : 'Supera la existencia disponible.',
      });
    } finally {
      setBusyItem(null);
    }
  };

  const handleRemoveItem = async (idVariante: number) => {
    setBusyItem(idVariante);
    try {
      await removeItem(idVariante);
      showToast({ type: 'info', title: 'Producto eliminado del carrito' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error al eliminar producto',
        message: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setBusyItem(null);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    setApplyingCoupon(true);
    try {
      await applyCoupon(couponCode.trim().toUpperCase());
      showToast({
        type: 'success',
        title: `Cupón ${couponCode.toUpperCase()} aplicado`,
        message: 'El descuento se ha calculado mediante FU_Cupones_CalculoDescuento.',
      });
      setCouponCode('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cupón no válido.';
      setCouponError(msg);
      showToast({ type: 'error', title: 'Cupón rechazado (RF-05)', message: msg });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponError(null);
    try {
      await removeCoupon();
      showToast({ type: 'info', title: 'Cupón removido del carrito' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error al remover cupón',
        message: err instanceof Error ? err.message : '',
      });
    }
  };

  if (items.length === 0) {
    return (
      <EmptyStateView
        title="Tu carrito de compras está vacío"
        description="Explora el catálogo y agrega productos para calcular tu compra en Quetzales (GTQ)."
        actionLabel="Explorar Catálogo"
        onAction={() => navigate('/')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mi Carrito de Compras</h1>
          <p className="text-xs text-slate-500">
            {isAuthenticated
              ? `Carrito asociado a ${user?.nombreCompleto} (${user?.correo})`
              : 'Carrito de invitado activo (se fusionará automáticamente al iniciar sesión)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void clearCart()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Vaciar Carrito
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Lista de productos en el carrito */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.IDCarritoItem}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                  {item.UrlImagen ? (
                    <img
                      src={item.UrlImagen}
                      alt={item.NombreProducto}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div>
                  <Link
                    to={`/products/${item.IDProducto}`}
                    className="text-sm font-bold text-slate-900 hover:text-indigo-600"
                  >
                    {item.NombreProducto}
                  </Link>
                  <p className="text-xs font-medium text-slate-600">{item.NombreVariante}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    SKU: {item.SKU} · Disp: {item.ExistenciaDisponible} u.
                  </p>
                  <p className="mt-1 text-xs font-semibold text-indigo-700">
                    Precio unitario: {formatGTQ(item.PrecioUnitario)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <div className="flex items-center rounded-xl border border-slate-300 bg-white">
                  <button
                    type="button"
                    disabled={busyItem === item.IDVariante || item.Cantidad <= 1}
                    onClick={() => handleQtyChange(item.IDVariante, item.Cantidad - 1)}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="px-3 text-xs font-bold text-slate-900">{item.Cantidad}</span>
                  <button
                    type="button"
                    disabled={
                      busyItem === item.IDVariante || item.Cantidad >= item.ExistenciaDisponible
                    }
                    onClick={() => handleQtyChange(item.IDVariante, item.Cantidad + 1)}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <div className="text-right min-w-24">
                  <span className="block text-[10px] text-slate-500">Subtotal línea</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatGTQ(item.SubtotalLinea)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busyItem === item.IDVariante}
                  onClick={() => handleRemoveItem(item.IDVariante)}
                  aria-label={`Eliminar ${item.NombreProducto}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen financiero en Quetzales (GTQ) y Cupón (RF-04 y RF-05) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-900">Resumen del Pedido (GTQ)</h2>

            {/* Sección de Cupón Promocional */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <TicketPercent className="h-4 w-4 text-indigo-600" />
                <span>Cupón de Descuento (RF-05)</span>
              </div>

              {cart?.CodigoCupon ? (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                  <div>
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {cart.CodigoCupon}
                    </span>
                    <span className="block text-[11px] text-emerald-700">
                      {cart.MensajeCupon || 'Cupón aplicado correctamente'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ej. BIENVENIDA10"
                    aria-label="Código de cupón"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono uppercase focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    Aplicar
                  </button>
                </form>
              )}

              {couponError && (
                <p
                  role="alert"
                  className="mt-2 flex items-start gap-1 text-[11px] font-medium text-red-600"
                >
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{couponError}</span>
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
                <span>Prueba:</span>
                {['BIENVENIDA10', 'QUETZAL50', 'MODA20', 'ULTIMO1', 'VENCIDO2025'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCouponCode(c)}
                    className="rounded bg-white px-1.5 py-0.5 font-mono border border-slate-200 hover:border-indigo-400 cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Desglose exacto sin errores de redondeo (DECIMAL(12,2)) */}
            <div className="flex flex-col gap-2 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart?.CantidadTotalUnidades} unidades):</span>
                <span className="font-semibold text-slate-900">{formatGTQ(cart?.Subtotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Descuento promocional:</span>
                <span className="font-semibold">− {formatGTQ(cart?.MontoDescuento)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Base imponible (sin IVA):</span>
                <span>{formatGTQ(cart?.SubtotalSinIVA)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>IVA incluido ({cart?.PorcentajeIVA ?? 12}%):</span>
                <span>{formatGTQ(cart?.MontoIVAIncluido)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold text-slate-900">
                <span>Total a Pagar (GTQ):</span>
                <span className="text-indigo-700">{formatGTQ(cart?.Total)}</span>
              </div>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Proceder al Checkout (Reserva 15 min)
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/login"
                state={{ from: '/checkout' }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Inicia sesión para completar la compra
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
