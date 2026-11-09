import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  PackageCheck,
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

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    setAdding(true);
    try {
      await addItem(selectedVariant.IDVariante, cantidad);
      showToast({
        type: 'success',
        title: 'Producto agregado al carrito',
        message: `${cantidad} x ${product?.Nombre} (${selectedVariant.NombreVariante})`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'No se pudo agregar al carrito (RF-04)',
        message: err instanceof Error ? err.message : 'Verifique la existencia disponible.',
      });
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <LoadingView message="Cargando producto y variantes desde SQL Server..." />;
  }

  if (error || !product) {
    return <ErrorStateView message={error ?? 'Producto no encontrado'} onRetry={loadProduct} />;
  }

  const maxAvailable = selectedVariant?.ExistenciaDisponible ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs lg:grid-cols-12">
        {/* Galería de imágenes */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.Nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Sin imagen disponible
              </div>
            )}
          </div>
          {product.imagenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.imagenes.map((img) => (
                <button
                  key={img.IDProductoImagen}
                  type="button"
                  onClick={() => setSelectedImage(img.UrlImagen)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                    selectedImage === img.UrlImagen ? 'border-indigo-600' : 'border-slate-200'
                  }`}
                >
                  <img
                    src={img.UrlImagen}
                    alt={img.TextoAlternativo ?? product.Nombre}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Información de producto y selector de variantes */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-semibold text-indigo-700">
                {product.NombreCategoria}
              </span>
              {product.Marca && (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  · {product.Marca}
                </span>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{product.Nombre}</h1>
            <p className="mt-2 text-sm text-slate-600">{product.Descripcion}</p>

            {/* Precio de la variante seleccionada con desglose de IVA 12% */}
            {selectedVariant && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">
                      Precio con 12% IVA incluido:
                    </span>
                    <div className="text-3xl font-extrabold text-slate-900">
                      {formatGTQ(selectedVariant.Precio)}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Base sin IVA: {formatGTQ(selectedVariant.PrecioSinIVA)} + IVA (12%):{' '}
                      {formatGTQ(selectedVariant.MontoIVAIncluido)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-semibold text-slate-700 block">
                      SKU: {selectedVariant.SKU}
                    </span>
                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        selectedVariant.ExistenciaDisponible > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {selectedVariant.ExistenciaDisponible > 0 ? (
                        <>
                          <PackageCheck className="h-3.5 w-3.5" />
                          {selectedVariant.ExistenciaDisponible} disponibles (Física:{' '}
                          {selectedVariant.ExistenciaFisica}, Reservada:{' '}
                          {selectedVariant.ExistenciaReservada})
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Sin existencia disponible
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Selector de Variantes (RF-02) */}
            <div className="mt-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Selecciona una Variante ({product.variantes.length} opciones):
              </h2>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {product.variantes.map((v) => {
                  const isSelected = selectedVariant?.IDVariante === v.IDVariante;
                  return (
                    <button
                      key={v.IDVariante}
                      type="button"
                      onClick={() => handleSelectVariant(v)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {v.NombreVariante}
                        </span>
                        <span className="text-xs font-extrabold text-indigo-700">
                          {formatGTQ(v.Precio)}
                        </span>
                      </div>
                      <span className="mt-0.5 font-mono text-[11px] text-slate-500">
                        SKU: {v.SKU} · Disp: {v.ExistenciaDisponible}
                      </span>
                      {v.Atributos && v.Atributos.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {v.Atributos.map((attr) => (
                            <span
                              key={`${attr.IDAtributo}-${attr.IDValorAtributo}`}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              {attr.Atributo}: {attr.Valor}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Control de cantidad y agregar al carrito (RF-04) */}
          <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  disabled={cantidad <= 1 || maxAvailable <= 0}
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                  className="px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, maxAvailable)}
                  value={cantidad}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(maxAvailable || 1, Number(e.target.value) || 1));
                    setCantidad(val);
                  }}
                  aria-label="Cantidad a agregar"
                  className="w-16 text-center text-sm font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={cantidad >= maxAvailable || maxAvailable <= 0}
                  onClick={() => setCantidad((c) => Math.min(maxAvailable, c + 1))}
                  className="px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={adding || maxAvailable <= 0}
                onClick={handleAddToCart}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                <ShoppingCart className="h-4 w-4" />
                {maxAvailable <= 0
                  ? 'Variante sin existencia disponible'
                  : adding
                    ? 'Agregando...'
                    : `Agregar al Carrito · ${formatGTQ((selectedVariant?.Precio ?? 0) * cantidad)}`}
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="rounded-xl border border-slate-300 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ir al Carrito
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Validación de tope de existencia en servidor (RF-04)
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                El precio se congela al confirmar tu pedido en el checkout (RF-02)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
