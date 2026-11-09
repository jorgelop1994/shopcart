import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, Search, Ticket } from 'lucide-react';
import { cartApi } from '../../api/cart.api';
import { catalogApi } from '../../api/catalog.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  CategoryRecord,
  CouponRecord,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateGT, formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

export const CouponsManagementPage: React.FC = () => {
  const { showToast } = useToast();

  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 12,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y ordenamiento en servidor
  const [busqueda, setBusqueda] = useState<string>('');
  const [onlyActive, setOnlyActive] = useState<boolean>(false);
  const [ordenarPor, setOrdenarPor] = useState<string>('recientes');

  // Modal Crear/Editar Cupón (RF-05)
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingCouponId, setEditingCouponId] = useState<number | undefined>(undefined);
  const [codigo, setCodigo] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [tipoDescuento, setTipoDescuento] = useState<'PORCENTAJE' | 'MONTO_FIJO'>('PORCENTAJE');
  const [valorDescuento, setValorDescuento] = useState<string>('15');
  const [idCategoria, setIdCategoria] = useState<string>('');
  const [montoMinimoCompra, setMontoMinimoCompra] = useState<string>('300');
  const [limiteUsoTotal, setLimiteUsoTotal] = useState<string>('100');
  const [limiteUsoPorCliente, setLimiteUsoPorCliente] = useState<string>('2');
  const [fechaInicio, setFechaInicio] = useState<string>('2026-01-01');
  const [fechaFin, setFechaFin] = useState<string>('2026-12-31');
  const [activo, setActivo] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    catalogApi
      .listCategories(false)
      .then(setCategories)
      .catch(() => {});
  }, []);

  const fetchCoupons = useCallback(
    async (page = pagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const res = await cartApi.listCoupons({
          pagina: page,
          tamanoPagina: 12,
          activo: onlyActive ? true : undefined,
          busqueda: busqueda.trim() || undefined,
          ordenarPor,
        });
        setCoupons(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError ? err.message : 'No fue posible consultar los cupones.'
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pagina, onlyActive, busqueda, ordenarPor]
  );

  useEffect(() => {
    void fetchCoupons(1);
  }, [onlyActive, ordenarPor, fetchCoupons]);

  const handleOpenNew = () => {
    setEditingCouponId(undefined);
    setCodigo('');
    setDescripcion('');
    setTipoDescuento('PORCENTAJE');
    setValorDescuento('15');
    setIdCategoria('');
    setMontoMinimoCompra('300');
    setLimiteUsoTotal('100');
    setLimiteUsoPorCliente('2');
    setFechaInicio(new Date().toISOString().slice(0, 10));
    setFechaFin('2026-12-31');
    setActivo(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: CouponRecord) => {
    setEditingCouponId(c.IDCupon);
    setCodigo(c.Codigo);
    setDescripcion(c.Descripcion);
    setTipoDescuento(c.TipoDescuento);
    setValorDescuento(String(c.ValorDescuento));
    setIdCategoria(c.IDCategoria ? String(c.IDCategoria) : '');
    setMontoMinimoCompra(String(c.MontoMinimoCompra));
    setLimiteUsoTotal(String(c.LimiteUsoTotal));
    setLimiteUsoPorCliente(String(c.LimiteUsoPorCliente));
    setFechaInicio(c.FechaInicio.slice(0, 10));
    setFechaFin(c.FechaFin.slice(0, 10));
    setActivo(c.Activo);
    setModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(valorDescuento);
    if (tipoDescuento === 'PORCENTAJE' && (val <= 0 || val > 100)) {
      showToast('El porcentaje de descuento debe estar entre 1% y 100%.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await cartApi.saveCoupon({
        idCupon: editingCouponId,
        codigo: codigo.trim().toUpperCase(),
        descripcion: descripcion.trim(),
        tipoDescuento,
        valorDescuento: val,
        idCategoria: idCategoria ? Number(idCategoria) : null,
        montoMinimoCompra: Number(montoMinimoCompra) || 0,
        limiteUsoTotal: Number(limiteUsoTotal) || 1,
        limiteUsoPorCliente: Number(limiteUsoPorCliente) || 1,
        fechaInicio: `${fechaInicio}T00:00:00`,
        fechaFin: `${fechaFin}T23:59:59`,
        activo,
      });
      setModalOpen(false);
      showToast(
        editingCouponId
          ? `Cupón ${codigo.toUpperCase()} actualizado exitosamente.`
          : `Cupón ${codigo.toUpperCase()} creado exitosamente.`,
        'success'
      );
      await fetchCoupons(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al guardar el cupón de descuento.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<CouponRecord>[] = [
    {
      id: 'codigo',
      header: 'Código / Descripción',
      sortKey: 'codigo',
      render: (row) => (
        <div>
          <span className="font-mono font-extrabold text-indigo-700 text-sm">{row.Codigo}</span>
          <span className="block text-xs text-slate-600">{row.Descripcion}</span>
        </div>
      ),
    },
    {
      id: 'descuento',
      header: 'Beneficio',
      sortKey: 'valor',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">
            {row.TipoDescuento === 'PORCENTAJE'
              ? `${row.ValorDescuento}% OFF`
              : `${formatGTQ(row.ValorDescuento)} Fijo`}
          </span>
          <span className="block text-[11px] text-slate-500">
            Mín. compra: {formatGTQ(row.MontoMinimoCompra)}
          </span>
        </div>
      ),
    },
    {
      id: 'alcance',
      header: 'Categoría Aplicable',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {row.NombreCategoria ?? 'Todo el Catálogo'}
        </span>
      ),
    },
    {
      id: 'usos',
      header: 'Consumo / Límites',
      align: 'center',
      sortKey: 'usos',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-slate-900">
            {row.UsosActuales} / {row.LimiteUsoTotal}
          </span>
          <span className="block text-[11px] text-slate-500">
            Máx {row.LimiteUsoPorCliente} por cliente
          </span>
        </div>
      ),
    },
    {
      id: 'vigencia',
      header: 'Vigencia',
      render: (row) => (
        <div className="text-xs text-slate-600">
          <span>{formatDateGT(row.FechaInicio)}</span>
          <span className="block">al {formatDateGT(row.FechaFin)}</span>
        </div>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      align: 'center',
      render: (row) => <StatusBadge status={row.EstadoVigencia} />,
    },
    {
      id: 'acciones',
      header: 'Acción',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenEdit(row)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Editar
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-indigo-600" />
            Motor Promocional y Gestión de Cupones
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configuración de reglas de descuento porcentual o monto fijo en GTQ, límites por
            cliente y restricción por categoría (`RF-05`).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cupón Promocional
        </button>
      </div>

      {/* Filtros en servidor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="coupon-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar por Código o Descripción
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="coupon-search"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchCoupons(1);
              }}
              placeholder="Ej. BIENVENIDA10, TECH150..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="w-full sm:w-52">
          <label htmlFor="coupon-sort" className="block text-xs font-semibold text-slate-700 mb-1">
            Ordenar por
          </label>
          <select
            id="coupon-sort"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="recientes">Más recientes</option>
            <option value="codigo_asc">Código (A-Z)</option>
            <option value="usos_desc">Mayor número de usos</option>
            <option value="valor_desc">Mayor valor de descuento</option>
          </select>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="rounded text-indigo-600"
          />
          Solo Activos
        </label>

        <button
          type="button"
          onClick={() => void fetchCoupons(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          Filtrar
        </button>
      </div>

      <ServerDataTable
        caption="Listado de cupones promocionales y reglas de descuento"
        columns={columns}
        data={coupons}
        keyExtractor={(row) => row.IDCupon}
        pagination={pagination}
        onPageChange={(page) => void fetchCoupons(page)}
        sortKey={
          ordenarPor === 'codigo_asc'
            ? 'codigo'
            : ordenarPor === 'usos_desc'
              ? 'usos'
              : ordenarPor === 'valor_desc'
                ? 'valor'
                : undefined
        }
        sortDirection={ordenarPor === 'codigo_asc' ? 'asc' : 'desc'}
        onSortChange={(key) => {
          if (key === 'codigo') setOrdenarPor('codigo_asc');
          else if (key === 'usos') setOrdenarPor('usos_desc');
          else if (key === 'valor') setOrdenarPor('valor_desc');
        }}
        loading={loading}
        error={error}
        onRetry={() => void fetchCoupons(pagination.pagina)}
      />

      {/* Modal Crear/Editar Cupón (`SP_Cupones_Guardar`) */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingCouponId ? `Editar Cupón #${editingCouponId} (${codigo})` : 'Crear Nuevo Cupón'
        }
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveCoupon} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="coupon-code"
              label="Código Promocional Único"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej. PROMOGT25"
              required
            />
            <div>
              <label
                htmlFor="coupon-type"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Tipo de Descuento <span className="text-rose-600">*</span>
              </label>
              <select
                id="coupon-type"
                value={tipoDescuento}
                onChange={(e) =>
                  setTipoDescuento(e.target.value as 'PORCENTAJE' | 'MONTO_FIJO')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="PORCENTAJE">PORCENTAJE (%)</option>
                <option value="MONTO_FIJO">MONTO_FIJO (Quetzales GTQ)</option>
              </select>
            </div>
          </div>

          <FormField
            id="coupon-desc"
            label="Descripción de la Campaña"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              id="coupon-val"
              label={
                tipoDescuento === 'PORCENTAJE'
                  ? 'Porcentaje (1 - 100%)'
                  : 'Monto Descuento (GTQ)'
              }
              type="number"
              step="0.01"
              min="0.01"
              max={tipoDescuento === 'PORCENTAJE' ? 100 : undefined}
              value={valorDescuento}
              onChange={(e) => setValorDescuento(e.target.value)}
              required
            />
            <FormField
              id="coupon-min"
              label="Compra Mínima (GTQ)"
              type="number"
              step="0.01"
              min="0"
              value={montoMinimoCompra}
              onChange={(e) => setMontoMinimoCompra(e.target.value)}
              required
            />
            <div>
              <label
                htmlFor="coupon-cat"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Categoría Restringida
              </label>
              <select
                id="coupon-cat"
                value={idCategoria}
                onChange={(e) => setIdCategoria(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="">Todo el Catálogo</option>
                {categories.map((c) => (
                  <option key={c.IDCategoria} value={c.IDCategoria}>
                    Solo {c.Nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="coupon-total-limit"
              label="Límite de Uso Global"
              type="number"
              min="1"
              value={limiteUsoTotal}
              onChange={(e) => setLimiteUsoTotal(e.target.value)}
              required
            />
            <FormField
              id="coupon-user-limit"
              label="Límite de Uso por Cliente"
              type="number"
              min="1"
              value={limiteUsoPorCliente}
              onChange={(e) => setLimiteUsoPorCliente(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="coupon-start"
              label="Fecha de Inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              required
            />
            <FormField
              id="coupon-end"
              label="Fecha de Expiración"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Cupón activo y habilitado para canje
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Cupón'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
