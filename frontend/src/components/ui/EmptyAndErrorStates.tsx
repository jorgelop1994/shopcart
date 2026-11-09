import React from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export const LoadingView: React.FC<{ message?: string }> = ({
  message = 'Cargando información desde SQL Server...',
}) => (
  <div
    role="status"
    className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-14 px-6 text-center shadow-xs"
  >
    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
  </div>
);

export const LoadingState = LoadingView;

export const EmptyStateView: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, actionLabel, onAction, icon, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-14 px-6 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      {icon ?? <Inbox className="h-6 w-6" />}
    </div>
    <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>
    {action ? (
      <div className="mt-4">{action}</div>
    ) : actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export const EmptyState = EmptyStateView;

export const ErrorStateView: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'No fue posible completar la consulta', message, onRetry }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/70 py-10 px-6 text-center"
  >
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
      <AlertTriangle className="h-6 w-6" />
    </div>
    <h3 className="mt-3 text-sm font-bold text-red-950">{title}</h3>
    <p className="mt-1 max-w-lg text-xs text-red-800">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </button>
    )}
  </div>
);

export const ErrorState = ErrorStateView;
