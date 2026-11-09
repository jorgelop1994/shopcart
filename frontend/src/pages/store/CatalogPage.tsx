import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Tag,
  ArrowUpDown,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  CategoryRecord,
  PaginationMeta,
  ProductSummaryRecord,
} from '../../types/api.types';
import { catalogApi } from '../../api/catalog.api';
import { formatGTQ } from '../../utils/format';
import {
  EmptyStateView,
  ErrorStateView,
  LoadingView,
} from '../../components/ui/EmptyAndErrorStates';

export const CatalogPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [products, setProducts] = useState<ProductSummaryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y ordenamiento del lado del servidor (RF-02)
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

  return (
    <div className="flex flex-col gap-6">
      {/* Banner principal */}
      <section className="rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-6 py-8 text-white shadow-sm sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-300/30">
              <Tag className="h-3.5 w-3.5" />
              Cupones activos: BIENVENIDA10 (10%) · QUETZAL50 (Q 50) · MODA20 (20% Ropa y Moda)
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Catálogo Oficial ShopCart Guatemala
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-indigo-100/90">
              Todos nuestros precios están expresados en Quetzales (GTQ) con el 12% de IVA incluido.
              Disponibilidad calculada en tiempo real descontando reservas activas de checkout.
            </p>
          </div>
        </div>
      </section>

      {/* Barra de búsqueda, filtros y ordenamiento en servidor (RF-02) */}
      <section
        aria-label="Filtros de catálogo"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, marca, descripción o SKU..."
              aria-label="Buscar productos por texto"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={idCategoria ?? ''}
              onChange={(e) => {
                setIdCategoria(e.target.value ? Number(e.target.value) : undefined);
                setPagina(1);
              }}
              aria-label="Filtrar por categoría"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.IDCategoria} value={cat.IDCategoria}>
                  {cat.Nombre} ({cat.TotalProductos})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <input
              type="number"
              min="0"
              step="10"
              value={precioMin}
              onChange={(e) => {
                setPrecioMin(e.target.value);
                setPagina(1);
              }}
              placeholder="Precio mín (Q)"
              aria-label="Precio mínimo en Quetzales"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="10"
                value={precioMax}
                onChange={(e) => {
                  setPrecioMax(e.target.value);
                  setPagina(1);
                }}
                placeholder="Precio máx (Q)"
                aria-label="Precio máximo en Quetzales"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleResetFilters}
                title="Limpiar filtros"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={soloDisponibles}
                onChange={(e) => {
                  setSoloDisponibles(e.target.checked);
                  setPagina(1);
                }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
              Mostrar solo con existencia disponible
            </label>
            {pagination && (
              <span className="text-xs text-slate-500">
                Mostrando <strong>{products.length}</strong> de{' '}
                <strong>{pagination.totalRegistros}</strong> productos
              </span>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
            <span>Ordenar por:</span>
            <select
              value={ordenarPor}
              onChange={(e) => {
                setOrdenarPor(e.target.value);
                setPagina(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="recientes">Más recientes</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
              <option value="nombre_asc">Nombre: A - Z</option>
              <option value="nombre_desc">Nombre: Z - A</option>
            </select>
          </label>
        </div>
      </section>

      {/* Grilla de productos */}
      {loading ? (
        <LoadingView message="Consultando catálogo mediante SP_Catalogo_ListarProductos..." />
      ) : error ? (
        <ErrorStateView message={error} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <EmptyStateView
          title="No encontramos productos con esos filtros"
          description="Prueba ampliando el rango de precio o seleccionando otra categoría."
          actionLabel="Restablecer todos los filtros"
          onAction={handleResetFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((prod) => {
              const samePrice = prod.PrecioMinimo === prod.PrecioMaximo;
              return (
                <article
                  key={prod.IDProducto}
                  className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <Link
                      to={`/products/${prod.IDProducto}`}
                      className="block relative aspect-[16/10] bg-slate-100 overflow-hidden"
                    >
                      {prod.ImagenPrincipal ? (
                        <img
                          src={prod.ImagenPrincipal}
                          alt={prod.Nombre}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <ShoppingBag className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-900/80 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          {prod.NombreCategoria}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        {prod.TieneDisponibilidad ? (
                          <span className="rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            {prod.ExistenciaDisponibleTotal} disp.
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            Agotado
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="p-5">
                      {prod.Marca && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                          {prod.Marca}
                        </span>
                      )}
                      <Link to={`/products/${prod.IDProducto}`}>
                        <h2 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-indigo-600 line-clamp-1">
                          {prod.Nombre}
                        </h2>
                      </Link>
                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                        {prod.Descripcion || 'Sin descripción adicional.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-slate-50/60">
                    <div>
                      <span className="block text-[10px] font-medium text-slate-500">
                        {prod.TotalVariantesActivas} variante(s) · IVA 12% incl.
                      </span>
                      <span className="text-base font-extrabold text-slate-900">
                        {samePrice
                          ? formatGTQ(prod.PrecioMinimo)
                          : `${formatGTQ(prod.PrecioMinimo)} – ${formatGTQ(prod.PrecioMaximo)}`}
                      </span>
                    </div>
                    <Link
                      to={`/products/${prod.IDProducto}`}
                      className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Ver variantes
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Paginación del servidor */}
          {pagination && pagination.totalPaginas > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-600">
              <span>
                Página <strong>{pagination.pagina}</strong> de{' '}
                <strong>{pagination.totalPaginas}</strong> ({pagination.totalRegistros} productos)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagination.pagina >= pagination.totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
