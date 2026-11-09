import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Search, ShieldCheck } from 'lucide-react';
import { ordersApi } from '../../api/orders.api';
import { HttpError } from '../../api/httpClient';
import {
  AuditLogRecord,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateTimeGT, formatJsonPretty } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { ModalDialog } from '../../components/ui/ModalDialog';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 15,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y ordenamiento en servidor
  const [modulo, setModulo] = useState<string>('');
  const [busqueda, setBusqueda] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('recientes');

  // Modal de inspección de diferencias JSON
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const fetchLogs = useCallback(
    async (page = pagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.listAuditLogs({
          pagina: page,
          tamanoPagina: 15,
          modulo: modulo || undefined,
          busqueda: busqueda.trim() || undefined,
          ordenarPor,
        });
        setLogs(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError
            ? err.message
            : 'No fue posible consultar la bitácora de auditoría.'
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pagina, modulo, busqueda, ordenarPor]
  );

  useEffect(() => {
    void fetchLogs(1);
  }, [modulo, ordenarPor, fetchLogs]);

  const columns: TableColumn<AuditLogRecord>[] = [
    {
      id: 'id',
      header: 'ID / Fecha',
      sortKey: 'fecha',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-slate-900">#{row.IDBitacora}</span>
          <span className="block text-xs text-slate-500">{formatDateTimeGT(row.FechaHora)}</span>
        </div>
      ),
    },
    {
      id: 'modulo',
      header: 'Módulo / Entidad',
      sortKey: 'modulo',
      render: (row) => (
        <div>
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
            {row.Modulo}
          </span>
          <span className="block text-xs text-slate-600 mt-1">
            {row.Entidad} (ID: <code className="font-mono">{row.IDEntidad}</code>)
          </span>
        </div>
      ),
    },
    {
      id: 'accion',
      header: 'Acción Ejecutada',
      sortKey: 'accion',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.Accion}</span>
      ),
    },
    {
      id: 'usuario',
      header: 'Usuario Ejecutor',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900 block">{row.NombreUsuario}</span>
          <span className="text-slate-500">
            {row.RolUsuario ?? 'Sistema'} {row.CorreoUsuario ? `• ${row.CorreoUsuario}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'payload',
      header: 'Snapshot JSON (Antes / Después)',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedLog(row)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver Payload JSON
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          Bitácora Inmutable de Auditoría (`RF-09`)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Registro protegido por trigger <code>TR_BitacoraAuditoria_Inmutable</code> (`INSTEAD OF
          UPDATE, DELETE`) con valores previos y posteriores de cada operación crítica.
        </p>
      </div>

      {/* Filtros en servidor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="audit-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar en Bitácora (Entidad, Acción, Usuario o Contenido JSON)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="audit-search"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchLogs(1);
              }}
              placeholder="Ej. CAMBIO_PRECIO, CREAR_PEDIDO, SKU..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="audit-module" className="block text-xs font-semibold text-slate-700 mb-1">
            Módulo Auditado
          </label>
          <select
            id="audit-module"
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los módulos</option>
            <option value="PEDIDOS">PEDIDOS</option>
            <option value="DEVOLUCIONES">DEVOLUCIONES</option>
            <option value="INVENTARIO">INVENTARIO</option>
            <option value="PRODUCTOS">PRODUCTOS</option>
            <option value="VARIANTES">VARIANTES</option>
            <option value="CATEGORIAS">CATEGORIAS</option>
            <option value="CUPONES">CUPONES</option>
            <option value="USUARIOS">USUARIOS</option>
          </select>
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="audit-sort" className="block text-xs font-semibold text-slate-700 mb-1">
            Ordenar por
          </label>
          <select
            id="audit-sort"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="recientes">Más recientes primero</option>
            <option value="antiguos">Más antiguos primero</option>
            <option value="modulo_asc">Módulo (A-Z)</option>
            <option value="accion_asc">Acción (A-Z)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void fetchLogs(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          Filtrar
        </button>
      </div>

      <ServerDataTable
        caption="Registros inmutables de la tabla BitacoraAuditoria"
        columns={columns}
        data={logs}
        keyExtractor={(row) => row.IDBitacora}
        pagination={pagination}
        onPageChange={(page) => void fetchLogs(page)}
        sortKey={
          ordenarPor === 'modulo_asc'
            ? 'modulo'
            : ordenarPor === 'accion_asc'
              ? 'accion'
              : 'fecha'
        }
        sortDirection={
          ordenarPor === 'antiguos' || ordenarPor === 'modulo_asc' || ordenarPor === 'accion_asc'
            ? 'asc'
            : 'desc'
        }
        onSortChange={(key) => {
          if (key === 'modulo') setOrdenarPor('modulo_asc');
          else if (key === 'accion') setOrdenarPor('accion_asc');
          else setOrdenarPor((prev) => (prev === 'recientes' ? 'antiguos' : 'recientes'));
        }}
        loading={loading}
        error={error}
        onRetry={() => void fetchLogs(pagination.pagina)}
      />

      {/* Modal Comparador de ValorAnterior vs ValorNuevo */}
      <ModalDialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={
          selectedLog
            ? `Evento de Auditoría #${selectedLog.IDBitacora} — ${selectedLog.Modulo} / ${selectedLog.Accion}`
            : 'Detalle de Auditoría'
        }
        maxWidthClass="max-w-4xl"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Entidad y Registro</span>
                <span className="font-bold text-slate-900">
                  {selectedLog.Entidad} (ID #{selectedLog.IDEntidad})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Ejecutado por</span>
                <span className="font-bold text-slate-900">
                  {selectedLog.NombreUsuario} ({selectedLog.RolUsuario ?? 'Sistema'})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Fecha y Hora Exacta</span>
                <span className="font-bold text-slate-900">
                  {formatDateTimeGT(selectedLog.FechaHora)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Valor Anterior (`ValorAnterior`)
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-amber-200 text-xs font-mono overflow-x-auto max-h-80">
                  {formatJsonPretty(selectedLog.ValorAnterior)}
                </pre>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                  Valor Nuevo (`ValorNuevo`)
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-200 text-xs font-mono overflow-x-auto max-h-80">
                  {formatJsonPretty(selectedLog.ValorNuevo)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
};
