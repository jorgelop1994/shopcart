import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  BarChart3,
  Boxes,
  TicketPercent,
  Users,
  ShieldCheck,
  LogOut,
  UserCircle2,
  MapPin,
  Menu,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { RoleBadge } from '../ui/StatusBadge';
import { formatGTQ } from '../../utils/format';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin (Arturo)',
    role: 'Administrador',
    correo: 'admin@shopcart.com.gt',
    password: 'Admin123!',
  },
  {
    label: 'Operador (Sofía)',
    role: 'Operador',
    correo: 'operador@shopcart.com.gt',
    password: 'Operador123!',
  },
  {
    label: 'Cliente (Jorge)',
    role: 'Cliente',
    correo: 'cliente@shopcart.com.gt',
    password: 'Cliente123!',
  },
  {
    label: 'Cliente (María)',
    role: 'Cliente',
    correo: 'maria.garcia@correo.gt',
    password: 'Cliente123!',
  },
] as const;

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { cart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switchingDemo, setSwitchingDemo] = useState(false);

  const totalUnits = cart?.CantidadTotalUnidades ?? 0;
  const cartTotal = cart?.Total ?? 0;

  const handleQuickSwitch = async (correo: string, password: string, label: string) => {
    setSwitchingDemo(true);
    try {
      const session = await login(correo, password);
      showToast({
        type: 'info',
        title: `Sesión cambiada a ${label}`,
        message: `Rol activo: ${session.user.rol} (${session.user.correo})`,
      });
      if (session.user.rol === 'Administrador' || session.user.rol === 'Operador') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error al cambiar cuenta de prueba',
        message: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setSwitchingDemo(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast({
      type: 'info',
      title: 'Sesión finalizada',
      message: 'Su refresh token fue revocado correctamente.',
    });
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {/* Barra superior de evaluación rápida (Cambio de rol en 1 clic) */}
      <div className="border-b border-slate-100 bg-slate-900 px-4 py-1.5 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-medium text-white">ShopCart GT</span>
            <span className="hidden sm:inline text-slate-400">
              · Precios en Quetzales (GTQ) con 12% IVA incluido · 100% Stored Procedures
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Acceso rápido evaluador:</span>
            {DEMO_ACCOUNTS.map((acc) => {
              const isCurrent = user?.correo.toLowerCase() === acc.correo.toLowerCase();
              return (
                <button
                  key={acc.correo}
                  type="button"
                  disabled={switchingDemo || isCurrent}
                  onClick={() => handleQuickSwitch(acc.correo, acc.password, acc.label)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {acc.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navegación principal dinámica según el rol */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight">ShopCart</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                Guatemala
              </span>
            </div>
          </Link>

          <nav aria-label="Menú principal" className="hidden lg:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <ShoppingBag className="h-3.5 w-3.5" />
              Tienda
            </NavLink>

            {isAuthenticated && user?.rol === 'Cliente' && (
              <>
                <NavLink to="/my-orders" className={navLinkClass}>
                  <Package className="h-3.5 w-3.5" />
                  Mis Pedidos
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  <MapPin className="h-3.5 w-3.5" />
                  Mis Direcciones
                </NavLink>
              </>
            )}

            {isAuthenticated && (user?.rol === 'Operador' || user?.rol === 'Administrador') && (
              <>
                <NavLink to="/admin/dashboard" className={navLinkClass}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Dashboard
                </NavLink>
                <NavLink to="/admin/orders" className={navLinkClass}>
                  <Package className="h-3.5 w-3.5" />
                  Pedidos y Devoluciones
                </NavLink>
                <NavLink to="/admin/inventory" className={navLinkClass}>
                  <Boxes className="h-3.5 w-3.5" />
                  Inventario y Kardex
                </NavLink>
              </>
            )}

            {isAuthenticated && user?.rol === 'Administrador' && (
              <>
                <NavLink to="/admin/catalog" className={navLinkClass}>
                  <Layers className="h-3.5 w-3.5" />
                  Catálogo
                </NavLink>
                <NavLink to="/admin/coupons" className={navLinkClass}>
                  <TicketPercent className="h-3.5 w-3.5" />
                  Cupones
                </NavLink>
                <NavLink to="/admin/users" className={navLinkClass}>
                  <Users className="h-3.5 w-3.5" />
                  Usuarios
                </NavLink>
                <NavLink to="/admin/audit" className={navLinkClass}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Bitácora
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* Acciones de Carrito y Sesión */}
        <div className="flex items-center gap-2.5">
          {(!isAuthenticated || user?.rol === 'Cliente') && (
            <Link
              to="/cart"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/60"
            >
              <div className="relative">
                <ShoppingCart className="h-4 w-4 text-indigo-600" />
                {totalUnits > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                    {totalUnits}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">{formatGTQ(cartTotal)}</span>
            </Link>
          )}

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                <UserCircle2 className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-800 max-w-36 truncate">
                  {user.nombreCompleto}
                </span>
                <RoleBadge role={user.rol} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Crear Cuenta
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menú de navegación"
            className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-700"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {mobileOpen && (
        <nav
          aria-label="Menú móvil"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1"
        >
          <NavLink to="/" end className={navLinkClass}>
            Tienda
          </NavLink>
          {isAuthenticated && user?.rol === 'Cliente' && (
            <>
              <NavLink to="/my-orders" className={navLinkClass}>
                Mis Pedidos
              </NavLink>
              <NavLink to="/profile" className={navLinkClass}>
                Mis Direcciones
              </NavLink>
            </>
          )}
          {isAuthenticated && (user?.rol === 'Operador' || user?.rol === 'Administrador') && (
            <>
              <NavLink to="/admin/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/admin/orders" className={navLinkClass}>
                Pedidos y Devoluciones
              </NavLink>
              <NavLink to="/admin/inventory" className={navLinkClass}>
                Inventario y Kardex
              </NavLink>
            </>
          )}
          {isAuthenticated && user?.rol === 'Administrador' && (
            <>
              <NavLink to="/admin/catalog" className={navLinkClass}>
                Catálogo
              </NavLink>
              <NavLink to="/admin/coupons" className={navLinkClass}>
                Cupones
              </NavLink>
              <NavLink to="/admin/users" className={navLinkClass}>
                Usuarios
              </NavLink>
              <NavLink to="/admin/audit" className={navLinkClass}>
                Bitácora
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
};
