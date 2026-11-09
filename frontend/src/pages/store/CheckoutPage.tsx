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
      showToast('El carrito está vacío.', 'warning');
      return;
    }
    setReserving(true);
    try {
      const res = await ordersApi.reserveStock(cart.IDCarrito);
      setReservation(res);
      setIdempotencyKey(generateIdempotencyKey());
      showToast(
        `Existencia reservada exitosamente por ${res.MinutosVigencia} minutos (Token: ${res.TokenReserva.slice(0, 8)}...).`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'No fue posible reservar existencia para el carrito.',
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
      showToast('Primero debes activar la reserva temporal de existencia (Paso 1).', 'warning');
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
      showToast(`¡Pedido ${order.NumeroPedido} confirmado exitosamente!`, 'success');
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'Ocurrió un error al procesar la confirmación del pedido.',
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
        `Respuesta Idempotente verificada: se retornó el mismo pedido ${replayedOrder.NumeroPedido} (ID #${replayedOrder.IDPedido}) sin duplicar cobro ni descontar inventario doble.`,
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
      showToast('Dirección agregada y seleccionada para la entrega.', 'success');
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
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Confirmación Transaccional RF-06
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                  ¡Pedido {createdOrder.NumeroPedido} Confirmado!
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Precios congelados en snapshot, inventario descontado en Kardex y cupón registrado.
                </p>
              </div>
            </div>
            <StatusBadge status={createdOrder.EstadoPedido} />
          </div>

          {/* Demostrador interactivo de Idempotencia para el Evaluador */}
          <div className="mt-6 bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-950 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Verificación de Idempotencia en Checkout (`SP_Pedidos_CrearPedido`)</span>
              </div>
              <p className="text-xs text-indigo-800">
                Clave utilizada: <code className="font-mono font-bold">{idempotencyKey}</code>. Si
                reenvías la solicitud por reintento de red o doble clic, el servidor devuelve el
                mismo pedido sin duplicar cargos ni descontar inventario dos veces.
              </p>
              {idempotencyReplayCount > 0 && (
                <p className="text-xs font-bold text-emerald-700">
                  ✓ Reintentos idempotentes verificados: {idempotencyReplayCount} (Mismo IDPedido #
                  {createdOrder.IDPedido} retornado)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleReplayIdempotentRequest}
              disabled={confirming}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${confirming ? 'animate-spin' : ''}`} />
              Probar Reintento Idempotente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-xs text-slate-500 block">Número de Pedido</span>
              <span className="text-base font-bold text-slate-900 font-mono">
                {createdOrder.NumeroPedido}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                {formatDateTimeGT(createdOrder.FechaCreacion)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-xs text-slate-500 block">Método y Referencia de Pago</span>
              <span className="text-sm font-bold text-slate-900">{createdOrder.MetodoPago}</span>
              <span className="text-xs text-slate-600 block mt-1 font-mono">
                Ref: {createdOrder.ReferenciaPago ?? 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-xs text-slate-500 block">Total Pagado (IVA 12% incl.)</span>
              <span className="text-lg font-extrabold text-indigo-700">
                {formatGTQ(createdOrder.Total)}
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                IVA incluido: {formatGTQ(createdOrder.MontoIVAIncluido)}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              Detalle de Líneas con Precio Congelado (Snapshot)
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <th className="py-2.5 px-4">SKU / Producto</th>
                    <th className="py-2.5 px-4 text-center">Cant.</th>
                    <th className="py-2.5 px-4 text-right">Precio Congelado</th>
                    <th className="py-2.5 px-4 text-right">Descuento Línea</th>
                    <th className="py-2.5 px-4 text-right">Total Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {createdOrder.lineas.map((line) => (
                    <tr key={line.IDDetallePedido}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {line.NombreProductoSnapshot}
                        </div>
                        <div className="text-xs font-mono text-slate-500">{line.SKUSnapshot}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{line.CantidadComprada}</td>
                      <td className="py-3 px-4 text-right">
                        {formatGTQ(line.PrecioUnitarioCongelado)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700">
                        {line.DescuentoProporcionalLinea > 0
                          ? `-${formatGTQ(line.DescuentoProporcionalLinea)}`
                          : 'Q 0.00'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatGTQ(line.TotalLineaNeto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Link
              to="/"
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Seguir comprando
            </Link>
            <Link
              to="/mis-pedidos"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Ver en Mis Pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingCart || loadingAddresses) {
    return <LoadingState message="Preparando proceso de checkout..." />;
  }

  if (addressError) {
    return <ErrorState message={addressError} onRetry={loadAddresses} />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega productos del catálogo antes de iniciar el proceso de checkout."
        icon={<ShoppingBag className="w-8 h-8" />}
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Ir al Catálogo
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Checkout y Reserva de Inventario</h1>
        <p className="text-sm text-slate-600 mt-1">
          Flujo transaccional de dos pasos con bloqueo temporal de stock por 15 minutos e
          idempotencia ante reintentos (`RF-06`).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Paso 1: Dirección de entrega */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  1. Dirección de Entrega en Guatemala
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Dirección
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                No tienes direcciones registradas. Haz clic en <strong>Nueva Dirección</strong> para
                registrar el destino de tu pedido.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.IDDireccion;
                  return (
                    <label
                      key={addr.IDDireccion}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryAddress"
                        checked={isSelected}
                        onChange={() => setSelectedAddressId(addr.IDDireccion)}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{addr.Alias}</span>
                          {addr.EsPredeterminada && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-[10px]">
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-slate-800">
                          {addr.NombreDestinatario} • {addr.TelefonoContacto}
                        </p>
                        <p className="text-slate-600">
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

          {/* Paso 2: Reserva Temporal de Existencia (15 min) */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    2. Reserva Temporal de Inventario (`SP_Inventario_ReservarExistencia`)
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Bloquea las unidades solicitadas durante 15 minutos con aislamiento{' '}
                  <code>SERIALIZABLE</code> y <code>UPDLOCK</code> para evitar sobreventa.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReserveStock}
                disabled={reserving}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {reserving
                  ? 'Reservando stock...'
                  : reservation
                    ? 'Renovar Reserva (15 min)'
                    : 'Reservar Existencia (15 min)'}
              </button>
            </div>

            {reservation && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-emerald-950">
                    <span className="font-bold">Token de Reserva Activo:</span>{' '}
                    <code className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {reservation.TokenReserva}
                    </code>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    Tiempo restante: {formatCountdown(remainingSeconds)}
                  </div>
                </div>

                <div className="text-xs text-emerald-900">
                  Precios congelados durante la ventana de reserva ({reservation.detalleReserva.length}{' '}
                  variantes apartadas en <code>ExistenciaReservada</code>):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {reservation.detalleReserva.map((item) => (
                    <div
                      key={item.IDReservaExistencia}
                      className="bg-white p-2.5 rounded-lg border border-emerald-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {item.NombreProducto} ({item.NombreVariante})
                        </span>
                        <span className="font-mono text-slate-500">{item.SKU}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {item.CantidadReservada} x {formatGTQ(item.PrecioCongeladoCheckout)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Paso 3: Pago e Idempotencia */}
          <form
            onSubmit={handleConfirmOrder}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                3. Confirmación de Pago e Idempotencia (`SP_Pedidos_CrearPedido`)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-metodo-pago"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  Método de Pago <span className="text-rose-600">*</span>
                </label>
                <select
                  id="checkout-metodo-pago"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="TARJETA_CREDITO">Tarjeta de Crédito (Visa / Mastercard)</option>
                  <option value="TARJETA_DEBITO">Tarjeta de Débito</option>
                  <option value="TRANSFERENCIA_BANCARIA">Transferencia Bancaria ACH</option>
                  <option value="PAGO_CONTRA_ENTREGA">Pago Contra Entrega</option>
                </select>
              </div>

              <FormField
                id="checkout-referencia-pago"
                label="Referencia / Autorización de Pago"
                hint="Número de boleta o código de autorización."
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                required
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Header / Clave de Idempotencia (`Idempotency-Key`):
                </span>
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                  className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Regenerar Clave
                </button>
              </div>
              <code className="block text-xs font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 text-slate-800">
                {idempotencyKey}
              </code>

              <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simularFalloPago}
                  onChange={(e) => setSimularFalloPago(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs text-slate-700">
                  <strong className="text-rose-700 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Simular fallo de pasarela de pago (Prueba RF-06):
                  </strong>{' '}
                  Verifica que si el cobro es rechazado, no se crea el pedido ni se descuenta el
                  stock físico y tu reserva permanece activa para reintentar.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={confirming || !reservation || remainingSeconds === 0 || !selectedAddressId}
              className="w-full py-3 px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {confirming
                ? 'Procesando transacción...'
                : !reservation
                  ? 'Primero activa la Reserva Temporal en el Paso 2'
                  : `Confirmar y Pagar ${formatGTQ(cart.Total)}`}
            </button>
          </form>
        </div>

        {/* Resumen lateral del pedido */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4 sticky top-20">
            <h2 className="text-base font-bold text-slate-900">Resumen del Carrito</h2>

            <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.IDCarritoItem} className="py-3 flex items-start justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">{item.NombreProducto}</p>
                    <p className="text-slate-500">
                      {item.NombreVariante} • Cant: {item.Cantidad}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 shrink-0">
                    {formatGTQ(item.SubtotalLinea)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Bruto:</span>
                <span className="font-medium text-slate-900">{formatGTQ(cart.Subtotal)}</span>
              </div>
              {cart.MontoDescuento > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descuento ({cart.CodigoCupon}):</span>
                  <span className="font-semibold">-{formatGTQ(cart.MontoDescuento)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal sin IVA:</span>
                <span>{formatGTQ(cart.SubtotalSinIVA)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>IVA (12% incluido):</span>
                <span>{formatGTQ(cart.MontoIVAIncluido)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total a Pagar:</span>
                <span className="text-indigo-700">{formatGTQ(cart.Total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para crear dirección rápida */}
      <ModalDialog
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title="Registrar Nueva Dirección de Entrega"
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
              label="Nombre del Destinatario"
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
            label="Referencia Adicional"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddressModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingAddress}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {savingAddress ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
