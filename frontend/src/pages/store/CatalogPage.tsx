import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowUpRight,
  Sparkles,
  Copy,
  Check,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import {
  CategoryRecord,
  PaginationMeta,
  ProductSummaryRecord,
} from '../../types/api.types';
import { catalogApi } from '../../api/catalog.api';
import { useToast } from '../../context/ToastContext';
import { formatGTQ } from '../../utils/format';
import {
  EmptyStateView,
  ErrorStateView,
  LoadingView,
} from '../../components/ui/EmptyAndErrorStates';

const FEATURED_VOUCHERS = [
  {
    code: 'BIENVENIDA10',
    badge: '10% OFF',
    title: 'Beneficio de Bienvenida',
    detail: 'En compras desde Q 100.00 en todo el catálogo',
  },
  {
    code: 'QUETZAL50',
    badge: 'Q 50.00 OFF',
    title: 'Bono Directo en Quetzales',
    detail: 'Descuento inmediato en pedidos desde Q 200.00',
  },
  {
    code: 'MODA20',
    badge: '20% OFF',
    title: 'Especial Moda & Estilo',
    detail: 'Exclusivo en artículos de Ropa y Accesorios',
  },
] as const;

export const CatalogPage: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [products, setProducts] = useState<ProductSummaryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filtros y ordenamiento en servidor (RF-02)
  const [busqueda, setBusqueda] = useState('');
  const [idCategoria, setIdCategoria] = useState<number | undefined>(undefined);
  const [precioMin, setPrecioMin] = useState<string>('');
  const [precioMax, setPrecioMax] = useState<string>('');
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState('recientes');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    void catalogApi
      .listCategories(true)
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listProducts({
        pagina,
        tamanoPagina: 9,
        busqueda: busqueda.trim() || undefined,
        idCategoria,
        precioMin: precioMin ? Number(precioMin) : undefined,
        precioMax: precioMax ? Number(precioMax) : undefined,
        soloDisponibles,
        soloActivos: true,
        ordenarPor,
      });
      setProducts(res.items);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, [pagina, busqueda, idCategoria, precioMin, precioMax, soloDisponibles, ordenarPor]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const handleResetFilters = () => {
    setBusqueda('');
    setIdCategoria(undefined);
    setPrecioMin('');
    setPrecioMax('');
    setSoloDisponibles(false);
    setOrdenarPor('recientes');
    setPagina(1);
  };

  const handleCopyCoupon = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast({
      type: 'success',
      title: `Cupón ${code} copiado al portapapeles`,
      message: 'Pégalo o selecciónalo con un clic al revisar tu bolsa de compras.',
    });
    window.setTimeout(() => setCopiedCode(null), 2500);
  };

  const hasActiveFilters =
    Boolean(busqueda.trim()) ||
    idCategoria !== undefined ||
    Boolean(precioMin) ||
    Boolean(precioMax) ||
    soloDisponibles ||
    ordenarPor !== 'recientes';

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Comercial Flagship (Editorial & CRO) */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0A0F1D] text-white shadow-lg border border-white/10">
        {/* Iluminación ambiental sutil */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"
        />

        <div className="relative z-10 grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>TEMPORADA OFICIAL GUATEMALA · ENVÍO EXPRESS 24–48H</span>
            </div>

            <h1 className="hero-fluid-title font-display font-extrabold text-white">
              Diseño, Tecnología y Desempeño sin Concesiones.
            </h1>

            <p className="prose-pretty text-sm sm:text-base text-stone-300 leading-relaxed">
              Equipamiento seleccionado con inventario verificado en tiempo real, facturación
              transparente en Quetzales (12% de IVA incluido) y garantía directa en toda Guatemala.
            </p>

            {/* Métricas de Prueba Social y Confianza */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10 max-w-lg">
              <div>
                <span className="font-display text-lg sm:text-xl font-extrabold text-white block">
                  100% Original
                </span>
                <span className="text-[11px] text-stone-400">Garantía local 12 meses</span>
              </div>
              <div>
                <span className="font-display text-lg sm:text-xl font-extrabold text-emerald-400 block">
                  IVA 12% Incl.
                </span>
                <span className="text-[11px] text-stone-400">Sin cargos ocultos al pagar</span>
              </div>
              <div>
                <span className="font-display text-lg sm:text-xl font-extrabold text-white block">
                  Reserva 15m
                </span>
                <span className="text-[11px] text-stone-400">Stock protegido en checkout</span>
              </div>
            </div>
          </div>

          {/* Cartera de Cupones Interactivos (1-Click Copy) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-white/6 backdrop-blur-md p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Beneficios Exclusivos de Temporada
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Clic para copiar código
                </span>
              </div>

              <div className="space-y-2.5">
                {FEATURED_VOUCHERS.map((v) => {
                  const isCopied = copiedCode === v.code;
                  return (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => handleCopyCoupon(v.code)}
                      className="w-full group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/12 hover:border-emerald-400/40 p-3 text-left transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                            {v.badge}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{v.title}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-400 truncate">{v.detail}</p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-400/40 bg-slate-950/70 px-2.5 py-1.5 font-mono text-xs font-bold text-emerald-300 group-hover:bg-emerald-500 group-hover:text-slate-950 group-hover:border-emerald-500 transition">
                        <span>{v.code}</span>
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 opacity-80" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navegación Rápida por Píldoras de Categoría (1-Click Category Bar) */}
      <section aria-label="Explorar por categoría" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-fluid-title font-display font-bold text-slate-950">
            Explorar Colección
          </h2>
          {pagination && (
            <span className="text-xs font-medium text-slate-500">
              Mostrando <strong className="text-slate-900">{products.length}</strong> de{' '}
              <strong className="text-slate-900">{pagination.totalRegistros}</strong> artículos
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setIdCategoria(undefined);
              setPagina(1);
            }}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
              idCategoria === undefined
                ? 'bg-slate-950 text-white shadow-xs'
                : 'bg-white border border-stone-200/90 text-slate-700 hover:border-slate-950 hover:text-slate-950'
            }`}
          >
            <span>Todas las Categorías</span>
          </button>

          {categories.map((cat) => {
            const active = idCategoria === cat.IDCategoria;
            return (
              <button
                key={cat.IDCategoria}
                type="button"
                onClick={() => {
                  setIdCategoria(active ? undefined : cat.IDCategoria);
                  setPagina(1);
                }}
                className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-white border border-stone-200/90 text-slate-700 hover:border-slate-950 hover:text-slate-950'
                }`}
              >
                <span>{cat.Nombre}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-stone-100 text-slate-600'
                  }`}
                >
                  {cat.TotalProductos}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Barra de Búsqueda, Rango de Precio y Ordenamiento */}
      <section
        aria-label="Filtros avanzados de catálogo"
        className="rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              name="busqueda_catalogo"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por producto, marca, modelo o código SKU..."
              aria-label="Buscar productos por texto"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 py-2.5 pl-10 pr-3.5 text-xs text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="number"
              name="precio_min"
              min="0"
              step="10"
              value={precioMin}
              onChange={(e) => {
                setPrecioMin(e.target.value);
                setPagina(1);
              }}
              placeholder="Desde Q 0.00"
              aria-label="Precio mínimo en Quetzales"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3 py-2.5 text-xs text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="number"
              name="precio_max"
              min="0"
              step="10"
              value={precioMax}
              onChange={(e) => {
                setPrecioMax(e.target.value);
                setPagina(1);
              }}
              placeholder="Hasta Q 25,000"
              aria-label="Precio máximo en Quetzales"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3 py-2.5 text-xs text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <label className="flex-1 inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <select
                name="ordenar_por"
                value={ordenarPor}
                onChange={(e) => {
                  setOrdenarPor(e.target.value);
                  setPagina(1);
                }}
                aria-label="Ordenar productos"
                className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
              >
                <option value="recientes">Destacados / Recientes</option>
                <option value="precio_asc">Menor a mayor precio</option>
                <option value="precio_desc">Mayor a menor precio</option>
                <option value="nombre_asc">Orden alfabético (A–Z)</option>
                <option value="nombre_desc">Orden alfabético (Z–A)</option>
              </select>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Restablecer filtros"
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-stone-100 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloDisponibles}
              onChange={(e) => {
                setSoloDisponibles(e.target.checked);
                setPagina(1);
              }}
              className="h-4 w-4 rounded border-stone-300"
            />
            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-700" />
            <span>Mostrar únicamente productos con entrega inmediata hoy</span>
          </label>

          <span className="text-[11px] text-slate-500">
            Precios finales en Quetzales (GTQ) · <strong>Incluyen 12% de IVA</strong>
          </span>
        </div>
      </section>

      {/* Grilla de Productos de Alta Conversión */}
      {loading ? (
        <LoadingView message="Preparando selección de productos..." />
      ) : error ? (
        <ErrorStateView message={error} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <EmptyStateView
          title="No encontramos coincidencias para tu búsqueda"
          description="Intenta ampliar el rango de precios o explorar otra categoría de la colección."
          actionLabel="Ver todo el catálogo"
          onAction={handleResetFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((prod, index) => {
              const samePrice = prod.PrecioMinimo === prod.PrecioMaximo;
              const isLowStock =
                prod.TieneDisponibilidad && prod.ExistenciaDisponibleTotal <= 5;
              // Modern Web Guidance (optimize-image-priority):
              // Primeras 2 tarjetas sobre el pliegue reciben fetchpriority="high" sin loading="lazy"
              const isHighPriorityImage = index < 2;

              return (
                <article
                  key={prod.IDProducto}
                  className="group rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-xs hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <Link
                      to={`/products/${prod.IDProducto}`}
                      className="block relative aspect-[4/3] bg-stone-100 overflow-hidden"
                    >
                      {prod.ImagenPrincipal ? (
                        <img
                          src={prod.ImagenPrincipal}
                          alt={prod.Nombre}
                          fetchPriority={isHighPriorityImage ? 'high' : undefined}
                          loading={isHighPriorityImage ? undefined : 'lazy'}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-300">
                          <ShoppingBag className="h-12 w-12" />
                        </div>
                      )}

                      {/* Etiqueta de Categoría */}
                      <div className="absolute top-3.5 left-3.5">
                        <span className="rounded-full bg-white/92 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-slate-900 shadow-xs">
                          {prod.NombreCategoria}
                        </span>
                      </div>

                      {/* Gatillo psicológico de Disponibilidad / Escasez (CRO) */}
                      <div className="absolute top-3.5 right-3.5">
                        {!prod.TieneDisponibilidad ? (
                          <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-bold text-stone-200">
                            Agotado
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold text-slate-950 shadow-xs">
                            <Flame className="h-3 w-3 fill-slate-950" />
                            ¡Últimas {prod.ExistenciaDisponibleTotal} u.!
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            En Stock ({prod.ExistenciaDisponibleTotal})
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                          {prod.Marca || 'Don Arturo Selection'}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {prod.TotalVariantesActivas}{' '}
                          {prod.TotalVariantesActivas === 1 ? 'opción' : 'opciones'}
                        </span>
                      </div>

                      <Link to={`/products/${prod.IDProducto}`}>
                        <h3 className="mt-1 font-display text-base font-bold text-slate-950 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {prod.Nombre}
                        </h3>
                      </Link>

                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {prod.Descripcion || 'Calidad garantizada con soporte oficial en Guatemala.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4 bg-stone-50/50">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {samePrice ? 'Precio final IVA incl.' : 'Desde (IVA incl.)'}
                      </span>
                      <span className="tabular-price text-lg font-extrabold text-slate-950">
                        {samePrice
                          ? formatGTQ(prod.PrecioMinimo)
                          : `${formatGTQ(prod.PrecioMinimo)} – ${formatGTQ(prod.PrecioMaximo)}`}
                      </span>
                    </div>

                    <Link
                      to={`/products/${prod.IDProducto}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white group-hover:bg-emerald-700 transition-colors"
                    >
                      <span>Elegir</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Paginación Editorial */}
          {pagination && pagination.totalPaginas > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white px-5 py-3.5 text-xs text-slate-600 shadow-xs">
              <span>
                Página <strong className="text-slate-950">{pagination.pagina}</strong> de{' '}
                <strong className="text-slate-950">{pagination.totalPaginas}</strong> ·{' '}
                {pagination.totalRegistros} productos en colección
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3.5 py-1.5 font-semibold text-slate-800 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagination.pagina >= pagination.totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3.5 py-1.5 font-semibold text-slate-800 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
