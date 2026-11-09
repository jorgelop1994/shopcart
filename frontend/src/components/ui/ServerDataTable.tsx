import React, { useId } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { PaginationMeta } from '../../types/api.types';
import { EmptyStateView, ErrorStateView, LoadingView } from './EmptyAndErrorStates';

export interface TableColumn<T> {
  key?: string;
  id?: string;
  header: string;
  render: (row: T) => React.ReactNode;
  isRowHeader?: boolean;
  align?: 'left' | 'right' | 'center';
  sortKey?: string;
}

interface ServerDataTableProps<T> {
  caption: string;
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  isLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  sortOptions?: Array<{ value: string; label: string }>;
  currentSort?: string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (sortValue: string) => void;
}

/**
 * Tabla reutilizable con paginación, ordenamiento del lado del servidor,
 * región navegable por teclado (tabIndex=0, role="region", aria-labelledby)
 * y encabezados sticky según modern-web-guidance (responsive-table).
 */
export function ServerDataTable<T>({
  caption,
  columns,
  data,
  keyExtractor,
  isLoading,
  loading,
  error = null,
  onRetry,
  emptyTitle = 'No se encontraron registros',
  emptyDescription = 'Intente ajustar los filtros de búsqueda o crear un nuevo registro.',
  pagination,
  onPageChange,
  sortOptions,
  currentSort,
  sortKey,
  sortDirection,
  onSortChange,
}: ServerDataTableProps<T>): React.ReactElement {
  const captionId = useId();
  const busy = Boolean(isLoading ?? loading);

  if (busy) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorStateView message={error} onRetry={onRetry} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            {pagination
              ? `Mostrando página ${pagination.pagina} de ${pagination.totalPaginas} (${pagination.totalRegistros} registros en total)`
              : `${data.length} registros`}
          </span>
          <label className="inline-flex items-center gap-2 font-medium text-slate-700">
            <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
            <span>Ordenar en servidor:</span>
            <select
              value={currentSort ?? sortOptions[0]?.value}
              onChange={(e) => onSortChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {data.length === 0 ? (
        <EmptyStateView title={emptyTitle} description={emptyDescription} />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper rounded-2xl border border-slate-200 bg-white shadow-xs"
        >
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption id={captionId} className="sr-only">
              {caption}
            </caption>
            <thead className="bg-slate-50/95 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                {columns.map((col, idx) => {
                  const colId = col.key ?? col.id ?? String(idx);
                  const isSorted = Boolean(col.sortKey && sortKey === col.sortKey);
                  return (
                    <th
                      key={colId}
                      scope="col"
                      className={`border-b border-slate-200 px-4 py-3.5 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {col.sortKey && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(col.sortKey!)}
                          className="inline-flex items-center gap-1 uppercase font-semibold hover:text-indigo-600 cursor-pointer"
                        >
                          <span>{col.header}</span>
                          <ArrowUpDown
                            className={`h-3.5 w-3.5 ${
                              isSorted ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          />
                          {isSorted && sortDirection && (
                            <span className="text-[10px] text-indigo-600">
                              ({sortDirection === 'asc' ? 'ASC' : 'DESC'})
                            </span>
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((row) => (
                <tr key={keyExtractor(row)} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((col, idx) => {
                    const colId = col.key ?? col.id ?? String(idx);
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                    if (col.isRowHeader) {
                      return (
                        <th
                          key={colId}
                          scope="row"
                          className={`px-4 py-3.5 font-semibold text-slate-900 ${alignClass}`}
                        >
                          {col.render(row)}
                        </th>
                      );
                    }
                    return (
                      <td
                        key={colId}
                        data-label={col.header}
                        className={`px-4 py-3.5 text-slate-700 ${alignClass}`}
                      >
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPaginas > 1 && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
          <span>
            Página <strong>{pagination.pagina}</strong> de{' '}
            <strong>{pagination.totalPaginas}</strong> · Total:{' '}
            <strong>{pagination.totalRegistros}</strong> registros
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pagination.pagina <= 1}
              onClick={() => onPageChange(pagination.pagina - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              type="button"
              disabled={pagination.pagina >= pagination.totalPaginas}
              onClick={() => onPageChange(pagination.pagina + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
