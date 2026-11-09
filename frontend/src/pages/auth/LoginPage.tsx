import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogIn, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FormField } from '../../components/ui/FormField';

const DEMO_USERS = [
  {
    rol: 'Administrador',
    nombre: 'Arturo Castillo',
    correo: 'admin@shopcart.com.gt',
    password: 'Admin123!',
    desc: 'Acceso total: Dashboard, Catálogo, Precios, Cupones, Usuarios y Bitácora',
  },
  {
    rol: 'Operador',
    nombre: 'Sofía Morales',
    correo: 'operador@shopcart.com.gt',
    password: 'Operador123!',
    desc: 'Gestión de Pedidos, Devoluciones, Inventario, Kardex y Dashboard',
  },
  {
    rol: 'Cliente',
    nombre: 'Jorge López',
    correo: 'cliente@shopcart.com.gt',
    password: 'Cliente123!',
    desc: 'Compras, Carrito, Checkout con Reserva 15m, Mis Pedidos y Direcciones',
  },
] as const;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fromPath = (location.state as { from?: string } | null)?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const session = await login(correo.trim(), password);
      showToast({
        type: 'success',
        title: `Bienvenido, ${session.user.nombreCompleto}`,
        message: `Sesión iniciada como ${session.user.rol}.`,
      });
      if (fromPath) {
        navigate(fromPath, { replace: true });
      } else if (session.user.rol === 'Administrador' || session.user.rol === 'Operador') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoCorreo: string, demoPass: string) => {
    setCorreo(demoCorreo);
    setPassword(demoPass);
    setErrorMsg(null);
  };

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Formulario principal */}
        <div className="md:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Iniciar Sesión</h1>
              <p className="text-xs text-slate-500">
                Autenticación JWT de corta duración + Refresh Token rotativo
              </p>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <FormField
              label="Correo Electrónico"
              hint="Formato: usuario@dominio.com.gt"
              required
            >
              {(fieldProps) => (
                <input
                  {...fieldProps}
                  type="email"
                  required
                  autoComplete="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="ejemplo@shopcart.com.gt"
                  className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              )}
            </FormField>

            <FormField label="Contraseña" required>
              {(fieldProps) => (
                <input
                  {...fieldProps}
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              )}
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {submitting ? 'Autenticando...' : 'Ingresar a ShopCart'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            ¿Aún no tienes cuenta de cliente?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
              Regístrate aquí (fusiona tu carrito de invitado automáticamente)
            </Link>
          </p>
        </div>

        {/* Panel de credenciales de prueba para el evaluador */}
        <div className="md:col-span-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-950">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-bold">Credenciales Semilla (Evaluación)</h2>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Haz clic en cualquiera de los 3 roles para autocompletar las credenciales de prueba:
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.correo}
                  type="button"
                  onClick={() => fillDemo(u.correo, u.password)}
                  className="flex flex-col items-start rounded-xl border border-indigo-200/80 bg-white p-3 text-left transition hover:border-indigo-500 hover:shadow-xs"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{u.nombre}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                      {u.rol}
                    </span>
                  </div>
                  <span className="mt-0.5 font-mono text-[11px] text-indigo-700">{u.correo}</span>
                  <span className="mt-1 text-[11px] text-slate-500">{u.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/80 p-3 text-[11px] text-slate-600 border border-slate-200">
            <strong>Nota RF-04:</strong> Si agregaste productos como visitante antes de iniciar
            sesión como Cliente, el procedimiento <code>SP_Carrito_FusionarInvitado</code> unificará
            automáticamente tu carrito.
          </div>
        </div>
      </div>
    </div>
  );
};
