import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
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
  Layers,
  Terminal,
  Truck,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { RoleBadge } from '../ui/StatusBadge';
import { formatGTQ } from '../../utils/format';

const DEMO_ACCOUNTS = [
  {
    label: 'Cliente (Jorge)',
    shortLabel: 'Cliente · Jorge',
    role: 'Cliente',
    correo: 'cliente@shopcart.com.gt',
    password: 'Cliente123!',
  },
  {
    label: 'Cliente (María)',
    shortLabel: 'Cliente · María',
    role: 'Cliente',
    correo: 'maria.garcia@correo.gt',
    password: 'Cliente123!',
  },
  {
    label: 'Operador (Sofía)',
    shortLabel: 'Operador · Sofía',
    role: 'Operador',
    correo: 'operador@shopcart.com.gt',
    password: 'Operador123!',
  },
  {
    label: 'Admin (Arturo)',
    shortLabel: 'Admin · Arturo',
    role: 'Administrador',
    correo: 'admin@shopcart.com.gt',
    password: 'Admin123!',
  },
] as const;

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { cart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switchingDemo, setSwitchingDemo] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState(false);

  const totalUnits = cart?.CantidadTotalUnidades ?? 0;
  const cartTotal = cart?.Total ?? 0;

  const handleQuickSwitch = async (correo: string, password: string, label: string) => {
    setSwitchingDemo(true);
    try {
      const session = await login(correo, password);
      showToast({
        type: 'info',
        title: `Perfil activo: ${label}`,
        message: `Sesión iniciada como ${session.user.rol} (${session.user.correo})`,
      });
      if (session.user.rol === 'Administrador' || session.user.rol === 'Operador') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'No fue posible cambiar de perfil',
        message: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setSwitchingDemo(false);
    }
  };

  const handleCopyWelcomeCoupon = () => {
    void navigator.clipboard?.writeText('BIENVENIDA10');
    setCopiedPromo(true);
    showToast({
      type: 'success',
      title: 'Código BIENVENIDA10 copiado',
      message: 'Aplícalo en tu bolsa de compras para obtener 10% de descuento inmediato.',
    });
    window.setTimeout(() => setCopiedPromo(false), 2500);
  };

  const handleLogout = async () => {
    await logout();
    showToast({
      type: 'info',
      title: 'Has cerrado sesión',
      message: '¡Gracias por visitar Don Arturo Flagship Store!',
    });
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
      isActive
        ? 'bg-slate-950 text-white shadow-xs'
        : 'text-slate-600 hover:bg-stone-200/60 hover:text-slate-950'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/90 bg-white/92 backdrop-blur-md">
      {/* Barra superior comercial + Conmutador discreto de Modo Evaluador */}
      <div className="bg-[#0A0F1D] text-stone-200 border-b border-white/10 px-4 py-1.5 text-[11px]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-200">
              <Truck className="h-3.5 w-3.5 text-emerald-400" />
              Envío Express asegurado a los 22 departamentos de Guatemala
            </span>
            <span className="hidden md:inline text-stone-600">|</span>
            <button
              type="button"
              onClick={handleCopyWelcomeCoupon}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white transition cursor-pointer"
              title="Haz clic para copiar el cupón BIENVENIDA10"
            >
              <span>10% OFF 1ra compra:</span>
              <strong className="font-mono text-emerald-300 tracking-wide">BIENVENIDA10</strong>
              {copiedPromo && <Check className="h-3 w-3 text-emerald-400" />}
            </button>
          </div>

          {/* Barra de entorno para el Evaluador (estilo Stripe / Vercel Toolbar) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-300/90 mr-1">
              <Terminal className="h-3 w-3" />
              <span className="hidden xl:inline">Simulador de Rol:</span>
            </span>
            {DEMO_ACCOUNTS.map((acc) => {
              const isCurrent = user?.correo.toLowerCase() === acc.correo.toLowerCase();
              return (
                <button
                  key={acc.correo}
                  type="button"
                  disabled={switchingDemo || isCurrent}
                  onClick={() => handleQuickSwitch(acc.correo, acc.password, acc.label)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/8 text-stone-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {acc.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navegación Principal de Marca */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link to="/" className="group flex items-center gap-3 text-slate-950">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xs group-hover:bg-emerald-700 transition-colors">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-950 block leading-none">
                DON ARTURO
              </span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                Flagship · Guatemala
              </span>
            </div>
          </Link>

          <nav aria-label="Menú principal" className="hidden lg:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <ShoppingBag className="h-3.5 w-3.5" />
              Catálogo
            </NavLink>

            {isAuthenticated && user?.rol === 'Cliente' && (
              <>
                <NavLink to="/my-orders" className={navLinkClass}>
                  <Package className="h-3.5 w-3.5" />
                  Mis Compras
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  <MapPin className="h-3.5 w-3.5" />
                  Direcciones
                </NavLink>
              </>
            )}

            {isAuthenticated && (user?.rol === 'Operador' || user?.rol === 'Administrador') && (
              <>
                <span className="mx-1.5 h-4 w-px bg-stone-200" aria-hidden="true" />
                <NavLink to="/admin/dashboard" className={navLinkClass}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Dashboard
                </NavLink>
                <NavLink to="/admin/orders" className={navLinkClass}>
                  <Package className="h-3.5 w-3.5" />
                  Pedidos
                </NavLink>
                <NavLink to="/admin/inventory" className={navLinkClass}>
                  <Boxes className="h-3.5 w-3.5" />
                  Inventario & Kardex
                </NavLink>
              </>
            )}

            {isAuthenticated && user?.rol === 'Administrador' && (
              <>
                <NavLink to="/admin/catalog" className={navLinkClass}>
                  <Layers className="h-3.5 w-3.5" />
                  Productos
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

        {/* Acciones de Bolsa de Compras y Cuenta */}
        <div className="flex items-center gap-2.5">
          {(!isAuthenticated || user?.rol === 'Cliente') && (
            <Link
              to="/cart"
              aria-label={`Bolsa de compras con ${totalUnits} artículos`}
              className="group inline-flex items-center gap-2.5 rounded-full border border-stone-300/90 bg-stone-100/80 px-4 py-2 text-xs font-semibold text-slate-900 hover:border-slate-950 hover:bg-white transition-all"
            >
              <div className="relative flex items-center">
                <ShoppingBag className="h-4 w-4 text-slate-900 group-hover:text-emerald-700 transition-colors" />
                {totalUnits > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-extrabold text-white">
                    {totalUnits}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline tabular-price font-bold text-slate-950">
                {formatGTQ(cartTotal)}
              </span>
            </Link>
          )}

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="hidden md:flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs hover:border-stone-300 transition"
              >
                <UserCircle2 className="h-4 w-4 text-slate-600" />
                <span className="font-semibold text-slate-900 max-w-36 truncate">
                  {user.nombreCompleto}
                </span>
                <RoleBadge role={user.rol} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-200/60 transition"
              >
                Ingresar
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                Crear Cuenta
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menú de navegación"
            className="lg:hidden rounded-full border border-stone-200 p-2 text-slate-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileOpen && (
        <nav
          aria-label="Menú móvil"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden border-t border-stone-200 bg-white px-4 py-3 flex flex-col gap-1"
        >
          <NavLink to="/" end className={navLinkClass}>
            Catálogo Oficial
          </NavLink>
          {isAuthenticated && user?.rol === 'Cliente' && (
            <>
              <NavLink to="/my-orders" className={navLinkClass}>
                Mis Compras
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
                Productos y Variantes
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
