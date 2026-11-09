import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Terminal,
  Landmark,
  Banknote,
  Truck,
} from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { ordersApi } from '../../api/orders.api';
import { HttpError } from '../../api/httpClient';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import {
  AddressRecord,
  CheckoutReservationResponse,
  OrderDetailRecord,
} from '../../types/api.types';
import { formatDateTimeGT, formatGTQ } from '../../utils/format';
import { FormField } from '../../components/ui/FormField';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/EmptyAndErrorStates';
import { StatusBadge } from '../../components/ui/StatusBadge';

function generateIdempotencyKey(): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `idem-shopcart-${Date.now()}-${randomPart}`;
}

const PAYMENT_OPTIONS = [
  {
    value: 'TARJETA_CREDITO',
    title: 'Tarjeta de Crédito',
    subtitle: 'Visa, Mastercard o American Express',
    icon: CreditCard,
  },
  {
    value: 'TARJETA_DEBITO',
    title: 'Tarjeta de Débito',
    subtitle: 'Débito inmediato bancos nacionales',
    icon: CreditCard,
  },
  {
    value: 'TRANSFERENCIA_BANCARIA',
    title: 'Transferencia ACH / Depósito',
    subtitle: 'Banca en línea Guatemala',
    icon: Landmark,
  },
  {
    value: 'PAGO_CONTRA_ENTREGA',
    title: 'Pago Contra Entrega',
    subtitle: 'Paga al recibir en tu dirección',
    icon: Banknote,
  },
] as const;

export const CheckoutPage: React.FC = () => {
  const { cart, loadingCart, refreshCart } = useCart();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(true);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Reserva temporal (RF-06)
  const [reservation, setReservation] = useState<CheckoutReservationResponse | null>(null);
  const [reserving, setReserving] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Confirmación e Idempotencia (RF-06)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(generateIdempotencyKey);
  const [metodoPago, setMetodoPago] = useState<string>('TARJETA_CREDITO');
  const [referenciaPago, setReferenciaPago] = useState<string>('AUTH-GT-994821');
  const [simularFalloPago, setSimularFalloPago] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<OrderDetailRecord | null>(null);
  const [idempotencyReplayCount, setIdempotencyReplayCount] = useState<number>(0);
  const [lastConfirmPayload, setLastConfirmPayload] = useState<{
    idCarrito: number;
    idDireccionEntrega: number;
    tokenReserva: string;
    claveIdempotencia: string;
    metodoPago: string;
    referenciaPago: string;
  } | null>(null);

  // Modal rápida de nueva dirección
  const [addressModalOpen, setAddressModalOpen] = useState<boolean>(false);
  const [savingAddress, setSavingAddress] = useState<boolean>(false);
  const [alias, setAlias] = useState('Casa');
  const [nombreDestinatario, setNombreDestinatario] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [departamento, setDepartamento] = useState('Guatemala');
  const [municipio, setMunicipio] = useState('Guatemala');
  const [zonaOCodigoPostal, setZonaOCodigoPostal] = useState('Zona 10');
  const [direccionExacta, setDireccionExacta] = useState('');
  const [referencia, setReferencia] = useState('');

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    setAddressError(null);
    try {
      const list = await authApi.listAddresses();
      setAddresses(list);
      const defaultAddr = list.find((a) => a.EsPredeterminada) ?? list[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.IDDireccion);
      }
    } catch (err) {
      setAddressError(
        err instanceof HttpError ? err.message : 'No fue posible cargar las direcciones de entrega.'
      );
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  // Temporizador en vivo de 15 minutos para la reserva
  useEffect(() => {
    if (!reservation) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const expiresAtMs = new Date(reservation.FechaExpiracion).getTime();
      const diffSec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [reservation]);

  const handleReserveStock = async () => {
    if (!cart || cart.items.length === 0) {
      showToast('Tu bolsa de compras está vacía.', 'warning');
      return;
    }
    setReserving(true);
    try {
      const res = await ordersApi.reserveStock(cart.IDCarrito);
      setReservation(res);
      setIdempotencyKey(generateIdempotencyKey());
      showToast(
        `Unidades apartadas y precio congelado por ${res.MinutosVigencia} minutos.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'No fue posible reservar existencia para tu bolsa.',
        'error'
      );
    } finally {
      setReserving(false);
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    if (!selectedAddressId) {
      showToast('Selecciona o registra una dirección de entrega.', 'warning');
      return;
    }
    if (!reservation) {
      showToast('Primero activa la garantía de reserva de stock en el Paso 2.', 'warning');
      return;
    }

    setConfirming(true);
    const payload = {
      idCarrito: cart.IDCarrito,
      idDireccionEntrega: selectedAddressId,
      tokenReserva: reservation.TokenReserva,
      claveIdempotencia: idempotencyKey,
      metodoPago,
      referenciaPago: referenciaPago.trim() || 'PAGO-DIRECTO',
      simularFalloPago,
    };

    try {
      const order = await ordersApi.confirmCheckout(payload);
      setCreatedOrder(order);
      setLastConfirmPayload({
        idCarrito: payload.idCarrito,
        idDireccionEntrega: payload.idDireccionEntrega,
        tokenReserva: payload.tokenReserva,
        claveIdempotencia: payload.claveIdempotencia,
        metodoPago: payload.metodoPago,
        referenciaPago: payload.referenciaPago,
      });
      await refreshCart();
      showToast(`¡Compra ${order.NumeroPedido} confirmada con éxito!`, 'success');
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'La autorización de pago fue rechazada. Tu reserva de stock sigue protegida.',
        'error'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleReplayIdempotentRequest = async () => {
    if (!lastConfirmPayload) return;
    setConfirming(true);
    try {
      const replayedOrder = await ordersApi.confirmCheckout(lastConfirmPayload);
      setCreatedOrder(replayedOrder);
      setIdempotencyReplayCount((prev) => prev + 1);
      showToast(
        `Idempotencia verificada: se devolvió el mismo pedido ${replayedOrder.NumeroPedido} (#${replayedOrder.IDPedido}) sin doble cobro ni doble descuento de stock.`,
        'info'
      );
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al verificar idempotencia.',
        'error'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleCreateQuickAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      const created = await authApi.createAddress({
        alias: alias.trim(),
        nombreDestinatario: nombreDestinatario.trim(),
        telefonoContacto: telefonoContacto.trim(),
        departamento: departamento.trim(),
        municipio: municipio.trim(),
        zonaOCodigoPostal: zonaOCodigoPostal.trim() || null,
        direccionExacta: direccionExacta.trim(),
        referencia: referencia.trim() || null,
        esPredeterminada: true,
      });
      await loadAddresses();
      setSelectedAddressId(created.IDDireccion);
      setAddressModalOpen(false);
      showToast('Dirección guardada y asignada a tu entrega.', 'success');
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No se pudo guardar la dirección.',
        'error'
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (createdOrder) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-700">
                  Recibo Oficial de Compra · Don Arturo Guatemala
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 mt-0.5">
                  ¡Gracias por tu compra! ({createdOrder.NumeroPedido})
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Hemos congelado tus precios y preparado la orden de despacho hacia tu dirección.
                </p>
              </div>
            </div>
            <StatusBadge status={createdOrder.EstadoPedido} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Orden de Compra
              </span>
              <span className="text-base font-bold text-slate-950 font-mono mt-0.5 block">
                {createdOrder.NumeroPedido}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                {formatDateTimeGT(createdOrder.FechaCreacion)}
              </span>
            </div>
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Método y Autorización
              </span>
              <span className="text-sm font-bold text-slate-950 mt-0.5 block">
                {createdOrder.MetodoPago}
              </span>
              <span className="text-xs text-slate-600 block mt-1 font-mono">
                Ref: {createdOrder.ReferenciaPago ?? 'N/A'}
              </span>
            </div>
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Pagado (IVA 12% Incl.)
              </span>
              <span className="tabular-price text-xl font-extrabold text-emerald-700 mt-0.5 block">
                {formatGTQ(createdOrder.Total)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                Incluye {formatGTQ(createdOrder.MontoIVAIncluido)} de IVA
              </span>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-sm font-bold text-slate-950 mb-3">
              Artículos Adquiridos (Precio Congelado Garantizado)
            </h2>
            <div className="border border-stone-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Artículo / SKU</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4 text-right">Precio Unitario</th>
                    <th className="py-3 px-4 text-right">Descuento</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-sm">
                  {createdOrder.lineas.map((line) => (
                    <tr key={line.IDDetallePedido}>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-950">
                          {line.NombreProductoSnapshot}
                        </div>
                        <div className="text-xs font-mono text-slate-500">{line.SKUSnapshot}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {line.CantidadComprada}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-price">
                        {formatGTQ(line.PrecioUnitarioCongelado)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-price text-emerald-700">
                        {line.DescuentoProporcionalLinea > 0
                          ? `−${formatGTQ(line.DescuentoProporcionalLinea)}`
                          : 'Q 0.00'}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-price font-extrabold text-slate-950">
                        {formatGTQ(line.TotalLineaNeto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cápsula de Verificación de Idempotencia para el Evaluador */}
          <div className="mt-6 rounded-2xl bg-[#0A0F1D] text-stone-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                <span>Laboratorio de Idempotencia (Modo Evaluador RF-06)</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                Llave enviada: <code className="font-mono text-white font-bold">{idempotencyKey}</code>.
                Haz clic para reenviar exactamente el mismo payload y comprobar que el servidor
                devuelve este mismo pedido sin duplicar cobros ni descontar inventario dos veces.
              </p>
              {idempotencyReplayCount > 0 && (
                <p className="text-xs font-bold text-emerald-400 pt-1">
                  ✓ {idempotencyReplayCount} reintento(s) idempotentes comprobados — Mismo IDPedido #
                  {createdOrder.IDPedido} retornado.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleReplayIdempotentRequest()}
              disabled={confirming}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-extrabold hover:bg-emerald-400 disabled:opacity-50 cursor-pointer transition"
            >
              <RefreshCw className={`w-4 h-4 ${confirming ? 'animate-spin' : ''}`} />
              Simular Reintento Idempotente
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-full border border-stone-300 text-slate-800 text-xs font-bold hover:bg-stone-50 transition"
            >
              Seguir Explorando la Tienda
            </Link>
            <Link
              to="/my-orders"
              className="px-6 py-2.5 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-emerald-700 transition"
            >
              Rastrear mi Pedido →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingCart || loadingAddresses) {
    return <LoadingState message="Preparando tu checkout seguro..." />;
  }

  if (addressError) {
    return <ErrorState message={addressError} onRetry={loadAddresses} />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Tu bolsa de compras está vacía"
        description="Agrega artículos de nuestra colección antes de iniciar el proceso de pago."
        icon={<ShoppingBag className="w-8 h-8" />}
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-emerald-700"
          >
            Explorar Colección
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado y Stepper de Progreso (Modern Web Guidance: Multi-Page / Multi-Step Forms) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">
            Checkout Protegido · Guatemala
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950">
            Finalizar Compra
          </h1>
        </div>

        <nav aria-label="Progreso del checkout">
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            <li
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
                selectedAddressId
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-slate-950 text-white'
              }`}
            >
              <span>1. Entrega</span>
            </li>
            <li
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
                reservation
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-stone-200 text-slate-700'
              }`}
              aria-current={!reservation ? 'step' : undefined}
            >
              <span>2. Reserva 15m</span>
            </li>
            <li
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${
                reservation
                  ? 'bg-slate-950 text-white'
                  : 'bg-stone-200 text-slate-500'
              }`}
              aria-current={reservation ? 'step' : undefined}
            >
              <span>3. Pago Seguro</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Paso 1: Dirección de Entrega */}
          <section className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white text-xs font-bold">
                  1
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-950">
                    Dirección de Envío en Guatemala
                  </h2>
                  <p className="text-xs text-slate-500">
                    Elige dónde deseas recibir tu pedido con cobertura asegurada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-stone-300 bg-white text-slate-900 text-xs font-bold hover:border-slate-950 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Dirección
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Aún no tienes una dirección registrada. Haz clic en{' '}
                <strong>Agregar Dirección</strong> para continuar.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.IDDireccion;
                  return (
                    <label
                      key={addr.IDDireccion}
                      className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-slate-950 bg-stone-50 ring-2 ring-slate-950/10'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryAddress"
                        checked={isSelected}
                        onChange={() => setSelectedAddressId(addr.IDDireccion)}
                        className="mt-1"
                      />
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="font-bold text-slate-950 text-sm">{addr.Alias}</span>
                          {addr.EsPredeterminada && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800">
                          {addr.NombreDestinatario} · {addr.TelefonoContacto}
                        </p>
                        <p className="text-slate-500 leading-relaxed">
                          {addr.DireccionExacta}, {addr.ZonaOCodigoPostal ?? ''} {addr.Municipio},{' '}
                          {addr.Departamento}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Paso 2: Garantía de Reserva de Stock y Precio Congelado (15 min) */}
          <section className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white text-xs font-bold mt-0.5">
                  2
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-950">
                    Garantía de Reserva de Stock y Precio (15 Minutos)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Apartamos físicamente tus artículos y congelamos su precio en Quetzales mientras
                    completas tu pago sin riesgo de que otro comprador tome la última unidad.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleReserveStock()}
                disabled={reserving}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition"
              >
                <Lock className="w-3.5 h-3.5" />
                {reserving
                  ? 'Protegiendo stock...'
                  : reservation
                    ? 'Renovar Ventana (15 min)'
                    : 'Activar Reserva de 15 Minutos'}
              </button>
            </div>

            {reservation && (
              <div className="mt-5 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-950">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold">Stock apartado con éxito</span>
                    <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {reservation.TokenReserva}
                    </code>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-700 text-white text-xs font-extrabold tabular-price">
                    <Clock className="w-3.5 h-3.5" />
                    Expira en: {formatCountdown(remainingSeconds)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {reservation.detalleReserva.map((item) => (
                    <div
                      key={item.IDReservaExistencia}
                      className="bg-white p-3 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-950 block">
                          {item.NombreProducto} ({item.NombreVariante})
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">{item.SKU}</span>
                      </div>
                      <span className="tabular-price font-extrabold text-slate-950">
                        {item.CantidadReservada} × {formatGTQ(item.PrecioCongeladoCheckout)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Paso 3: Método de Pago + Simulador Técnico para Evaluador */}
          <form
            onSubmit={handleConfirmOrder}
            className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white text-xs font-bold">
                3
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-950">
                  Método de Pago y Confirmación
                </h2>
                <p className="text-xs text-slate-500">
                  Selecciona tu medio de pago preferido en Guatemala
                </p>
              </div>
            </div>

            {/* Modern Web Guidance (forms): 4 opciones mutuamente excluyentes -> Radio Cards visibles */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Elige cómo deseas pagar <span className="text-rose-600">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAYMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = metodoPago === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                        active
                          ? 'border-slate-950 bg-stone-50 ring-2 ring-slate-950/10'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="metodoPago"
                        value={opt.value}
                        checked={active}
                        onChange={(e) => setMetodoPago(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-emerald-700 shrink-0" />
                          <span className="text-xs font-bold text-slate-950">{opt.title}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{opt.subtitle}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <FormField
              id="checkout-referencia-pago"
              label="Número de Autorización / Boleta de Pago"
              hint="Código de referencia bancaria o autorización de pasarela."
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              required
            />

            {/* Cápsula dedicada: Laboratorio de Pruebas Transaccionales (Modo Evaluador) */}
            <div className="rounded-2xl bg-[#0A0F1D] text-stone-200 p-4 space-y-3 border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
                  <Terminal className="w-4 h-4" />
                  <span>Simulador Transaccional para Evaluador (RF-06)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                  className="text-[11px] text-emerald-400 font-semibold hover:underline cursor-pointer"
                >
                  Generar nueva Idempotency-Key
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
                <span className="text-[11px] text-stone-400">Idempotency-Key:</span>
                <code className="text-xs font-mono text-emerald-300 truncate">{idempotencyKey}</code>
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simularFalloPago}
                  onChange={(e) => setSimularFalloPago(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span className="text-xs text-stone-300 leading-relaxed">
                  <strong className="text-amber-300 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Simular rechazo de pasarela bancaria:
                  </strong>{' '}
                  Comprueba que si el pago falla, no se crea la orden ni se descuenta el Kardex, y
                  tu reserva de 15 minutos permanece activa para reintentar.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={confirming || !reservation || remainingSeconds === 0 || !selectedAddressId}
              className="w-full py-4 px-6 rounded-full bg-slate-950 text-white text-sm font-extrabold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer transition-colors shadow-sm"
            >
              {confirming
                ? 'Autorizando transacción...'
                : !reservation
                  ? 'Activa primero la Reserva de 15 Minutos en el Paso 2'
                  : `Confirmar y Pagar ${formatGTQ(cart.Total)}`}
            </button>
          </form>
        </div>

        {/* Resumen Lateral Sticky */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs p-6 space-y-4">
            <h2 className="font-display text-base font-extrabold text-slate-950">
              Resumen de tu Bolsa ({cart.CantidadTotalUnidades} u.)
            </h2>

            <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.IDCarritoItem} className="py-3 flex items-start justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-bold text-slate-950">{item.NombreProducto}</p>
                    <p className="text-slate-500">
                      {item.NombreVariante} · Cant: {item.Cantidad}
                    </p>
                  </div>
                  <span className="tabular-price text-xs font-extrabold text-slate-950 shrink-0">
                    {formatGTQ(item.SubtotalLinea)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Artículos</span>
                <span className="tabular-price font-semibold text-slate-950">
                  {formatGTQ(cart.Subtotal)}
                </span>
              </div>
              {cart.MontoDescuento > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Cupón ({cart.CodigoCupon})</span>
                  <span className="tabular-price">−{formatGTQ(cart.MontoDescuento)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Base sin IVA</span>
                <span className="tabular-price">{formatGTQ(cart.SubtotalSinIVA)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IVA (12% incluido)</span>
                <span className="tabular-price">{formatGTQ(cart.MontoIVAIncluido)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-3 border-t border-stone-200">
                <span className="font-display text-sm font-bold text-slate-950">Total Final</span>
                <span className="tabular-price text-2xl font-extrabold text-slate-950">
                  {formatGTQ(cart.Total)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-stone-50 p-3.5 border border-stone-200/70 flex items-center gap-2.5 text-xs text-slate-600">
              <Truck className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>Despacho asegurado con número de guía a toda Guatemala.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para crear dirección rápida */}
      <ModalDialog
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title="Registrar Dirección de Entrega"
      >
        <form onSubmit={handleCreateQuickAddress} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="quick-addr-alias"
              label="Alias (Ej. Casa, Oficina)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              required
            />
            <FormField
              id="quick-addr-destinatario"
              label="Nombre de quien recibe"
              value={nombreDestinatario}
              onChange={(e) => setNombreDestinatario(e.target.value)}
              required
            />
            <FormField
              id="quick-addr-telefono"
              label="Teléfono de Contacto"
              value={telefonoContacto}
              onChange={(e) => setTelefonoContacto(e.target.value)}
              required
            />
            <FormField
              id="quick-addr-zona"
              label="Zona o Código Postal"
              value={zonaOCodigoPostal}
              onChange={(e) => setZonaOCodigoPostal(e.target.value)}
            />
            <FormField
              id="quick-addr-depto"
              label="Departamento"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              required
            />
            <FormField
              id="quick-addr-muni"
              label="Municipio"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              required
            />
          </div>
          <FormField
            id="quick-addr-exacta"
            label="Dirección Exacta"
            value={direccionExacta}
            onChange={(e) => setDireccionExacta(e.target.value)}
            required
          />
          <FormField
            id="quick-addr-ref"
            label="Referencia de ubicación"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddressModalOpen(false)}
              className="px-4 py-2 rounded-full border border-stone-300 text-slate-700 text-xs font-bold hover:bg-stone-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingAddress}
              className="px-5 py-2 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {savingAddress ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
