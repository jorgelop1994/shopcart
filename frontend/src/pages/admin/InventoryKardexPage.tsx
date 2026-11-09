import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  History,
  PlusCircle,
  RefreshCw,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  CategoryRecord,
  InventoryStockRecord,
  KardexMovementRecord,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateTimeGT, formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

export const InventoryKardexPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'stocks' | 'kardex'>('stocks');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  // --- Estado Pestaña 1: Existencias ---
  const [stocks, setStocks] = useState<InventoryStockRecord[]>([]);
  const [stockPagination, setStockPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 12,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loadingStocks, setLoadingStocks] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockCategory, setStockCategory] = useState<string>('');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [stockSort, setStockSort] = useState<string>('stock_asc');

  // --- Estado Pestaña 2: Historial Kardex ---
  const [movements, setMovements] = useState<KardexMovementRecord[]>([]);
  const [kardexPagination, setKardexPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 15,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loadingKardex, setLoadingKardex] = useState<boolean>(false);
  const [kardexError, setKardexError] = useState<string | null>(null);
  const [kardexSearch, setKardexSearch] = useState<string>('');
  const [kardexType, setKardexType] = useState<string>('');
  const [kardexVariantFilter, setKardexVariantFilter] = useState<number | undefined>(undefined);
  const [kardexSort, setKardexSort] = useState<string>('recientes');

  // --- Modal de Movimiento Manual (RF-03) ---
  const [movementModalOpen, setMovementModalOpen] = useState<boolean>(false);
  const [selectedVariant, setSelectedVariant] = useState<InventoryStockRecord | null>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<
    'ENTRADA_COMPRA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA'
  >('ENTRADA_COMPRA');
  const [cantidad, setCantidad] = useState<string>('10');
  const [motivo, setMotivo] = useState<string>('');
  const [submittingMovement, setSubmittingMovement] = useState<boolean>(false);
  const [releasingReservations, setReleasingReservations] = useState<boolean>(false);

  useEffect(() => {
    catalogApi
      .listCategories(false)
      .then(setCategories)
      .catch(() => {});
  }, []);

  const fetchStocks = useCallback(
    async (page = stockPagination.pagina) => {
      setLoadingStocks(true);
      setStockError(null);
      try {
        const res = await catalogApi.listInventoryStock({
          pagina: page,
          tamanoPagina: 12,
          idCategoria: stockCategory ? Number(stockCategory) : undefined,
          soloStockBajo: onlyLowStock || undefined,
          busqueda: stockSearch.trim() || undefined,
          ordenarPor: stockSort,
        });
        setStocks(res.items);
        setStockPagination(res.pagination);
      } catch (err) {
        setStockError(
          err instanceof HttpError ? err.message : 'No fue posible consultar las existencias.'
        );
      } finally {
        setLoadingStocks(false);
      }
    },
    [stockPagination.pagina, stockCategory, onlyLowStock, stockSearch, stockSort]
  );

  const fetchKardex = useCallback(
    async (page = kardexPagination.pagina) => {
      setLoadingKardex(true);
      setKardexError(null);
      try {
        const res = await catalogApi.listKardex({
          pagina: page,
          tamanoPagina: 15,
          idVariante: kardexVariantFilter,
          tipoMovimiento: kardexType || undefined,
          busqueda: kardexSearch.trim() || undefined,
          ordenarPor: kardexSort,
        });
        setMovements(res.items);
        setKardexPagination(res.pagination);
      } catch (err) {
        setKardexError(
          err instanceof HttpError ? err.message : 'No fue posible consultar el historial Kardex.'
        );
      } finally {
        setLoadingKardex(false);
      }
    },
    [kardexPagination.pagina, kardexVariantFilter, kardexType, kardexSearch, kardexSort]
  );

  useEffect(() => {
    if (activeTab === 'stocks') {
      void fetchStocks(1);
    } else {
      void fetchKardex(1);
    }
  }, [activeTab, stockCategory, onlyLowStock, stockSort, kardexType, kardexVariantFilter, kardexSort, fetchStocks, fetchKardex]);

  const handleOpenMovementModal = (variant: InventoryStockRecord) => {
    setSelectedVariant(variant);
    setTipoMovimiento('ENTRADA_COMPRA');
    setCantidad('5');
    setMotivo('');
    setMovementModalOpen(true);
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    const qty = Number(cantidad);
    if (!Number.isInteger(qty) || qty <= 0) {
      showToast('La cantidad del movimiento debe ser un entero mayor a 0.', 'warning');
      return;
    }
    if (motivo.trim().length < 5) {
      showToast('El motivo del movimiento es obligatorio (mínimo 5 caracteres).', 'warning');
      return;
    }

    setSubmittingMovement(true);
    try {
      await catalogApi.registerMovement({
        idVariante: selectedVariant.IDVariante,
        tipoMovimiento,
        cantidad: qty,
        motivo: motivo.trim(),
      });
      setMovementModalOpen(false);
      showToast(
        `Movimiento ${tipoMovimiento} aplicado a ${selectedVariant.SKU}. Kardex actualizado.`,
        'success'
      );
      await fetchStocks(stockPagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al registrar movimiento en Kardex.',
        'error'
      );
    } finally {
      setSubmittingMovement(false);
    }
  };

  const handleReleaseExpiredReservations = async () => {
    setReleasingReservations(true);
    try {
      const res = await catalogApi.releaseExpiredReservations();
      const liberadas = res.TotalReservasLiberadas ?? res.reservasExpiradasLiberadas ?? 0;
      showToast(
        `Barrido de reservas completado: ${liberadas} reservas vencidas liberadas.`,
        'info'
      );
      if (activeTab === 'stocks') {
        await fetchStocks(stockPagination.pagina);
      }
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al liberar reservas vencidas.',
        'error'
      );
    } finally {
      setReleasingReservations(false);
    }
  };

  const stockColumns: TableColumn<InventoryStockRecord>[] = [
    {
      id: 'sku',
      header: 'SKU / Variante',
      sortKey: 'sku',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-slate-900">{row.SKU}</span>
          <span className="block text-xs text-slate-600">{row.NombreVariante}</span>
        </div>
      ),
    },
    {
      id: 'producto',
      header: 'Producto / Categoría',
      sortKey: 'producto',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.NombreProducto}</span>
          <span className="text-xs text-slate-500">{row.NombreCategoria}</span>
        </div>
      ),
    },
    {
      id: 'precio',
      header: 'Precio Vigente',
      align: 'right',
      render: (row) => <span className="font-semibold">{formatGTQ(row.PrecioVigente)}</span>,
    },
    {
      id: 'fisica',
      header: 'Física',
      align: 'center',
      render: (row) => <span className="font-bold text-slate-800">{row.ExistenciaFisica}</span>,
    },
    {
      id: 'reservada',
      header: 'Reservada (15m)',
      align: 'center',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            row.ExistenciaReservada > 0
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.ExistenciaReservada}
        </span>
      ),
    },
    {
      id: 'disponible',
      header: 'Disponible Real',
      align: 'center',
      sortKey: 'stock',
      render: (row) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
            row.ExistenciaDisponible === 0
              ? 'bg-rose-100 text-rose-800'
              : row.ExistenciaDisponible <= 5
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {row.ExistenciaDisponible}
        </span>
      ),
    },
    {
      id: 'cuadre',
      header: 'Auditoría Kardex',
      align: 'center',
      render: (row) =>
        row.CuadraConKardex ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Cuadra ({row.SumaMovimientosKardex})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            Desfase ({row.SumaMovimientosKardex})
          </span>
        ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setKardexVariantFilter(row.IDVariante);
              setActiveTab('kardex');
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
          >
            Ver Kardex
          </button>
          <button
            type="button"
            onClick={() => handleOpenMovementModal(row)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Ajustar
          </button>
        </div>
      ),
    },
  ];

  const kardexColumns: TableColumn<KardexMovementRecord>[] = [
    {
      id: 'fecha',
      header: 'Fecha y Hora',
      sortKey: 'fecha',
      render: (row) => (
        <span className="text-xs text-slate-600">{formatDateTimeGT(row.FechaMovimiento)}</span>
      ),
    },
    {
      id: 'variante',
      header: 'SKU / Producto',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-slate-900">{row.SKU}</span>
          <span className="block text-xs text-slate-600">
            {row.NombreProducto} ({row.NombreVariante})
          </span>
        </div>
      ),
    },
    {
      id: 'tipo',
      header: 'Tipo de Movimiento',
      render: (row) => <StatusBadge status={row.TipoMovimiento} />,
    },
    {
      id: 'cantidad',
      header: 'Cantidad',
      align: 'center',
      sortKey: 'cantidad',
      render: (row) => {
        const isPositive = row.ExistenciaNueva >= row.ExistenciaAnterior;
        return (
          <span
            className={`font-mono font-bold text-sm ${
              isPositive ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isPositive ? `+${row.Cantidad}` : `-${row.Cantidad}`}
          </span>
        );
      },
    },
    {
      id: 'transicion',
      header: 'Saldo (Ant → Nuevo)',
      align: 'center',
      render: (row) => (
        <span className="font-mono text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800">
          {row.ExistenciaAnterior} → <strong>{row.ExistenciaNueva}</strong>
        </span>
      ),
    },
    {
      id: 'motivo',
      header: 'Motivo / Pedido / Usuario',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-900">{row.Motivo}</p>
          <p className="text-slate-500">
            Por: {row.NombreUsuario}
            {row.NumeroPedido ? ` • Pedido: ${row.NumeroPedido}` : ''}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-indigo-600" />
            Inventario, Existencias y Kardex Inmutable
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Control de existencia física, reservada y disponible en tiempo real con trazabilidad
            completa en Kardex (`RF-03`).
          </p>
        </div>

        <button
          type="button"
          onClick={handleReleaseExpiredReservations}
          disabled={releasingReservations}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${releasingReservations ? 'animate-spin' : ''}`} />
          Liberar Reservas Expiradas (&gt;15m)
        </button>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('stocks')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'stocks'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Existencias Actuales y Cuadre Kardex
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kardex')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'kardex'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Historial de Movimientos Kardex
          {kardexVariantFilter && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
              Variante #{kardexVariantFilter}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'stocks' ? (
        <div className="space-y-4">
          {/* Filtros de Existencias */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="stock-search" className="block text-xs font-semibold text-slate-700 mb-1">
                Buscar por SKU o Producto
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="stock-search"
                  type="search"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void fetchStocks(1);
                  }}
                  placeholder="Ej. SKU-TECH o nombre..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="w-full sm:w-48">
              <label htmlFor="stock-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría
              </label>
              <select
                id="stock-cat"
                value={stockCategory}
                onChange={(e) => setStockCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.IDCategoria} value={c.IDCategoria}>
                    {c.Nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label htmlFor="stock-sort" className="block text-xs font-semibold text-slate-700 mb-1">
                Ordenar por
              </label>
              <select
                id="stock-sort"
                value={stockSort}
                onChange={(e) => setStockSort(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="stock_asc">Menor stock disponible</option>
                <option value="stock_desc">Mayor stock disponible</option>
                <option value="sku_asc">SKU (A-Z)</option>
                <option value="producto_asc">Producto (A-Z)</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Solo Stock Bajo (&le; 5)
            </label>

            <button
              type="button"
              onClick={() => void fetchStocks(1)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Buscar
            </button>
          </div>

          <ServerDataTable
            caption="Estado actual de existencias físicas, reservadas y disponibles por variante"
            columns={stockColumns}
            data={stocks}
            keyExtractor={(row) => row.IDVariante}
            pagination={stockPagination}
            onPageChange={(page) => void fetchStocks(page)}
            sortKey={
              stockSort.startsWith('stock')
                ? 'stock'
                : stockSort === 'sku_asc'
                  ? 'sku'
                  : 'producto'
            }
            sortDirection={stockSort === 'stock_desc' ? 'desc' : 'asc'}
            onSortChange={(key) => {
              if (key === 'stock') {
                setStockSort((prev) => (prev === 'stock_asc' ? 'stock_desc' : 'stock_asc'));
              } else if (key === 'sku') {
                setStockSort('sku_asc');
              } else {
                setStockSort('producto_asc');
              }
            }}
            loading={loadingStocks}
            error={stockError}
            onRetry={() => void fetchStocks(stockPagination.pagina)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtros de Historial Kardex */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="kardex-search" className="block text-xs font-semibold text-slate-700 mb-1">
                Buscar en Kardex (SKU, Producto o Motivo)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="kardex-search"
                  type="search"
                  value={kardexSearch}
                  onChange={(e) => setKardexSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void fetchKardex(1);
                  }}
                  placeholder="Ej. SKU, Entrada inicial, PED-2026..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="w-full sm:w-52">
              <label htmlFor="kardex-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Movimiento
              </label>
              <select
                id="kardex-type"
                value={kardexType}
                onChange={(e) => setKardexType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todos los tipos</option>
                <option value="ENTRADA_COMPRA">ENTRADA_COMPRA</option>
                <option value="SALIDA_VENTA">SALIDA_VENTA</option>
                <option value="AJUSTE_POSITIVO">AJUSTE_POSITIVO</option>
                <option value="AJUSTE_NEGATIVO">AJUSTE_NEGATIVO</option>
                <option value="SALIDA_MERMA">SALIDA_MERMA</option>
                <option value="DEVOLUCION_CLIENTE">DEVOLUCION_CLIENTE</option>
                <option value="REINGRESO_CANCELACION">REINGRESO_CANCELACION</option>
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label htmlFor="kardex-sort" className="block text-xs font-semibold text-slate-700 mb-1">
                Ordenar por
              </label>
              <select
                id="kardex-sort"
                value={kardexSort}
                onChange={(e) => setKardexSort(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="recientes">Más recientes primero</option>
                <option value="antiguos">Más antiguos primero</option>
                <option value="cantidad_desc">Mayor cantidad</option>
                <option value="cantidad_asc">Menor cantidad</option>
              </select>
            </div>

            {kardexVariantFilter && (
              <button
                type="button"
                onClick={() => setKardexVariantFilter(undefined)}
                className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
              >
                Quitar filtro Variante #{kardexVariantFilter}
              </button>
            )}

            <button
              type="button"
              onClick={() => void fetchKardex(1)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Filtrar
            </button>
          </div>

          <ServerDataTable
            caption="Bitácora transaccional de movimientos de inventario (Kardex)"
            columns={kardexColumns}
            data={movements}
            keyExtractor={(row) => row.IDMovimientoKardex}
            pagination={kardexPagination}
            onPageChange={(page) => void fetchKardex(page)}
            sortKey={kardexSort.startsWith('cantidad') ? 'cantidad' : 'fecha'}
            sortDirection={
              kardexSort === 'antiguos' || kardexSort === 'cantidad_asc' ? 'asc' : 'desc'
            }
            onSortChange={(key) => {
              if (key === 'cantidad') {
                setKardexSort((prev) =>
                  prev === 'cantidad_desc' ? 'cantidad_asc' : 'cantidad_desc'
                );
              } else {
                setKardexSort((prev) => (prev === 'recientes' ? 'antiguos' : 'recientes'));
              }
            }}
            loading={loadingKardex}
            error={kardexError}
            onRetry={() => void fetchKardex(kardexPagination.pagina)}
          />
        </div>
      )}

      {/* Modal para Registrar Movimiento de Inventario (`SP_Inventario_RegistrarMovimiento`) */}
      <ModalDialog
        open={movementModalOpen && Boolean(selectedVariant)}
        onClose={() => setMovementModalOpen(false)}
        title={
          selectedVariant
            ? `Registrar Movimiento en Kardex — ${selectedVariant.SKU}`
            : 'Registrar Movimiento en Kardex'
        }
      >
        {selectedVariant && (
          <form onSubmit={handleRegisterMovement} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm">
                {selectedVariant.NombreProducto} — {selectedVariant.NombreVariante}
              </div>
              <div className="flex flex-wrap gap-4 pt-1 text-slate-700">
                <span>
                  Física actual: <strong>{selectedVariant.ExistenciaFisica}</strong>
                </span>
                <span>
                  Reservada (15m): <strong>{selectedVariant.ExistenciaReservada}</strong>
                </span>
                <span>
                  Disponible real: <strong className="text-indigo-700">{selectedVariant.ExistenciaDisponible}</strong>
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="kardex-mov-type"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Tipo de Movimiento <span className="text-rose-600">*</span>
              </label>
              <select
                id="kardex-mov-type"
                value={tipoMovimiento}
                onChange={(e) =>
                  setTipoMovimiento(
                    e.target.value as
                      | 'ENTRADA_COMPRA'
                      | 'AJUSTE_ENTRADA'
                      | 'AJUSTE_SALIDA'
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900"
              >
                <option value="ENTRADA_COMPRA">ENTRADA_COMPRA (+ Ingreso por compra a proveedor)</option>
                <option value="AJUSTE_ENTRADA">AJUSTE_ENTRADA (+ Ajuste positivo por conteo físico)</option>
                <option value="AJUSTE_SALIDA">AJUSTE_SALIDA (- Ajuste negativo o baja por merma)</option>
              </select>
            </div>

            <FormField
              id="kardex-mov-qty"
              label="Cantidad de Unidades"
              hint={
                tipoMovimiento === 'AJUSTE_SALIDA'
                  ? `Máximo descargable sin afectar reservas activas: ${selectedVariant.ExistenciaDisponible} unidades.`
                  : 'Ingresa un número entero positivo.'
              }
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />

            <FormField
              id="kardex-mov-reason"
              label="Motivo Justificado del Movimiento"
              hint="Mínimo 5 caracteres. Quedará sellado en MovimientosKardex y BitacoraAuditoria."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Recepción de orden de compra #OC-2026-44 en bodega central..."
              required
              minLength={5}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMovementModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingMovement}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {submittingMovement ? 'Registrando...' : 'Aplicar Movimiento en Kardex'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};
