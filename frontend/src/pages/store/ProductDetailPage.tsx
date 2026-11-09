import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
  PackageCheck,
  Truck,
  RotateCcw,
  ChevronRight,
  Check,
} from 'lucide-react';
import { ProductDetailRecord, ProductVariantRecord } from '../../types/api.types';
import { catalogApi } from '../../api/catalog.api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatGTQ } from '../../utils/format';
import { ErrorStateView, LoadingView } from '../../components/ui/EmptyAndErrorStates';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState<ProductDetailRecord | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantRecord | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await catalogApi.getProductDetail(Number(id));
      setProduct(detail);
      const firstAvailable =
        detail.variantes.find((v) => v.Activa && v.ExistenciaDisponible > 0) ??
        detail.variantes[0] ??
        null;
      setSelectedVariant(firstAvailable);
      setSelectedImage(detail.imagenes[0]?.UrlImagen ?? null);
      setCantidad(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el producto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleSelectVariant = (variant: ProductVariantRecord) => {
    setSelectedVariant(variant);
    setCantidad(1);
  };

  const handleAddToCart = async (goToBag = false) => {
    if (!selectedVariant) return;
    setAdding(true);
    try {
      await addItem(selectedVariant.IDVariante, cantidad);
      showToast({
        type: 'success',
        title: 'Agregado a tu bolsa de compras',
        message: `${cantidad} × ${product?.Nombre} (${selectedVariant.NombreVariante})`,
      });
      if (goToBag) {
        navigate('/cart');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Existencia insuficiente',
        message: err instanceof Error ? err.message : 'Verifique la disponibilidad actual.',
      });
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <LoadingView message="Cargando especificaciones del artículo..." />;
  }

  if (error || !product) {
    return <ErrorStateView message={error ?? 'Artículo no encontrado'} onRetry={loadProduct} />;
  }

  const maxAvailable = selectedVariant?.ExistenciaDisponible ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs Semánticos */}
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="font-medium hover:text-slate-950 transition">
          Catálogo Oficial
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
        <span className="font-medium text-slate-700">{product.NombreCategoria}</span>
        <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
        <span className="font-semibold text-slate-950 truncate max-w-xs">{product.Nombre}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Columna Izquierda: Galería Visual Sticky */}
        <div className="lg:col-span-6 lg:sticky lg:top-24 flex flex-col gap-4">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.Nombre}
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                Imagen no disponible
              </div>
            )}

            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-slate-950 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Garantía Oficial Guatemala
              </span>
            </div>
          </div>

          {product.imagenes.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.imagenes.map((img) => {
                const isCurrent = selectedImage === img.UrlImagen;
                return (
                  <button
                    key={img.IDProductoImagen}
                    type="button"
                    onClick={() => setSelectedImage(img.UrlImagen)}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 transition cursor-pointer ${
                      isCurrent
                        ? 'border-slate-950 ring-2 ring-slate-950/15'
                        : 'border-stone-200 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.UrlImagen}
                      alt={img.TextoAlternativo ?? product.Nombre}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Buy-Box de Alta Conversión (Apple Store Style) */}
        <div className="lg:col-span-6 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col gap-6">
          {/* Encabezado de Marca y Producto */}
          <div className="border-b border-stone-100 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-700">
                {product.Marca || 'Don Arturo Selection'}
              </span>
              {selectedVariant && (
                <span className="font-mono text-xs font-medium text-slate-400">
                  SKU: <strong className="text-slate-700">{selectedVariant.SKU}</strong>
                </span>
              )}
            </div>

            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-slate-950 leading-tight">
              {product.Nombre}
            </h1>

            <p className="prose-pretty mt-3 text-sm text-slate-600 leading-relaxed">
              {product.Descripcion}
            </p>
          </div>

          {/* Precio Principal y Estado de Disponibilidad */}
          {selectedVariant && (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Precio Final Contado (IVA 12% Incluido)
                </span>
                <div className="tabular-price text-3xl sm:text-4xl font-extrabold text-slate-950 mt-0.5">
                  {formatGTQ(selectedVariant.Precio)}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Valor neto sin IVA: <span className="font-medium">{formatGTQ(selectedVariant.PrecioSinIVA)}</span>{' '}
                  · Impuesto IVA (12%): <span className="font-medium">{formatGTQ(selectedVariant.MontoIVAIncluido)}</span>
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                    selectedVariant.ExistenciaDisponible > 0
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {selectedVariant.ExistenciaDisponible > 0 ? (
                    <>
                      <PackageCheck className="h-4 w-4 text-emerald-600" />
                      <span>
                        {selectedVariant.ExistenciaDisponible} disponibles para envío
                        {selectedVariant.ExistenciaReservada > 0
                          ? ` (${selectedVariant.ExistenciaReservada} en proceso de compra)`
                          : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>Agotado en esta opción</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Selector de Configuración / Variantes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Elige tu Configuración ({product.variantes.length}{' '}
                {product.variantes.length === 1 ? 'opción' : 'opciones'})
              </h2>
              <span className="text-[11px] text-slate-500">
                Stock actualizado al instante
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {product.variantes.map((v) => {
                const isSelected = selectedVariant?.IDVariante === v.IDVariante;
                const outOfStock = v.ExistenciaDisponible <= 0;
                return (
                  <button
                    key={v.IDVariante}
                    type="button"
                    onClick={() => handleSelectVariant(v)}
                    className={`relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-slate-950 bg-stone-50/90 ring-2 ring-slate-950/15 shadow-xs'
                        : outOfStock
                          ? 'border-stone-200 bg-stone-50/40 opacity-65 hover:opacity-100'
                          : 'border-stone-200/90 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="text-xs font-bold text-slate-950">
                          {v.NombreVariante}
                        </span>
                      </div>
                      <span className="tabular-price text-xs font-extrabold text-slate-950 shrink-0">
                        {formatGTQ(v.Precio)}
                      </span>
                    </div>

                    {v.Atributos && v.Atributos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-6">
                        {v.Atributos.map((attr) => (
                          <span
                            key={`${attr.IDAtributo}-${attr.IDValorAtributo}`}
                            className="rounded-md bg-stone-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {attr.Atributo}: {attr.Valor}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex w-full items-center justify-between pl-6 text-[11px]">
                      <span className="font-mono text-slate-400">{v.SKU}</span>
                      <span
                        className={
                          v.ExistenciaDisponible > 0
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-rose-600'
                        }
                      >
                        {v.ExistenciaDisponible > 0
                          ? `${v.ExistenciaDisponible} en stock`
                          : 'Sin stock'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control de Cantidad y Botones de Compra */}
          <div className="border-t border-stone-100 pt-5 space-y-4">
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-1">
                <button
                  type="button"
                  disabled={cantidad <= 1 || maxAvailable <= 0}
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                  className="h-10 w-10 rounded-full text-base font-bold text-slate-800 hover:bg-white disabled:opacity-40 cursor-pointer"
                  aria-label="Disminuir cantidad"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, maxAvailable)}
                  value={cantidad}
                  onChange={(e) => {
                    const val = Math.max(
                      1,
                      Math.min(maxAvailable || 1, Number(e.target.value) || 1)
                    );
                    setCantidad(val);
                  }}
                  aria-label="Cantidad a agregar"
                  className="w-12 bg-transparent text-center text-sm font-extrabold text-slate-950 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={cantidad >= maxAvailable || maxAvailable <= 0}
                  onClick={() => setCantidad((c) => Math.min(maxAvailable, c + 1))}
                  className="h-10 w-10 rounded-full text-base font-bold text-slate-800 hover:bg-white disabled:opacity-40 cursor-pointer"
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={adding || maxAvailable <= 0}
                onClick={() => void handleAddToCart(false)}
                className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                {maxAvailable <= 0
                  ? 'Agotado en esta configuración'
                  : adding
                    ? 'Agregando a tu bolsa...'
                    : `Agregar a la Bolsa · ${formatGTQ((selectedVariant?.Precio ?? 0) * cantidad)}`}
              </button>
            </div>

            {maxAvailable > 0 && (
              <button
                type="button"
                disabled={adding}
                onClick={() => void handleAddToCart(true)}
                className="w-full rounded-full border border-slate-950 bg-white px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-stone-100 transition cursor-pointer"
              >
                Comprar Ahora e Ir a la Bolsa →
              </button>
            )}

            {/* Garantías de Conversión Post-CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5 border border-stone-200/70">
                <Truck className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="text-[11px] font-medium text-slate-700">
                  Despacho Express 24–48h en GT
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5 border border-stone-200/70">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="text-[11px] font-medium text-slate-700">
                  Precio congelado al confirmar
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-2.5 border border-stone-200/70">
                <RotateCcw className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="text-[11px] font-medium text-slate-700">
                  Devoluciones fáciles en línea
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
