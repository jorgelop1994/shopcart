import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const state = location.state as { requiredRoles?: string[]; attemptedPath?: string } | null;

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldOff className="h-7 w-7" />
        </div>
        <span className="mt-4 inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
          HTTP 403 · Acceso No Autorizado (RF-01)
        </span>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          No tienes permisos para acceder a esta sección
        </h1>
        <p className="mt-2 text-xs text-slate-600">
          Tu sesión actual tiene el rol <strong>{user?.rol ?? 'Invitado'}</strong>.
          {state?.requiredRoles && (
            <>
              {' '}
              Esta vista requiere alguno de los siguientes roles:{' '}
              <strong>{state.requiredRoles.join(', ')}</strong>.
            </>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la Tienda
          </Link>
        </div>
      </div>
    </div>
  );
};
