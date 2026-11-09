import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { UserRole } from '../../types/api.types';
import { useAuth } from '../../context/AuthContext';
import { LoadingView } from '../ui/EmptyAndErrorStates';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

/**
 * Guardia de rutas por autenticación y rol (RF-01 y Pág. 9).
 * - Si aún está hidratando la sesión, muestra estado de carga.
 * - Si no hay sesión válida (401), redirige a /login preservando la ruta destino.
 * - Si el rol actual no está autorizado (403), redirige a /403 (Acceso Denegado).
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="mx-auto max-w-4xl py-16 px-4">
        <LoadingView message="Verificando sesión y permisos de acceso..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
    return (
      <Navigate
        to="/403"
        state={{ requiredRoles: allowedRoles, attemptedPath: location.pathname }}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
