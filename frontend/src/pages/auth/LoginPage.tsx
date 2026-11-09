import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogIn, ShieldAlert, Terminal, Eye, EyeOff, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FormField } from '../../components/ui/FormField';

const DEMO_USERS = [
  {
    rol: 'Cliente',
    nombre: 'Jorge López (Comprador)',
    correo: 'cliente@shopcart.com.gt',
    password: 'Cliente123!',
    desc: 'Experiencia de cliente: Bolsa de compras, cupones, checkout y seguimiento de pedidos.',
  },
  {
    rol: 'Operador',
    nombre: 'Sofía Morales (Operaciones)',
    correo: 'operador@shopcart.com.gt',
    password: 'Operador123!',
    desc: 'Despacho de órdenes, devoluciones parciales/totales, Kardex e indicadores.',
  },
  {
    rol: 'Administrador',
    nombre: 'Arturo Castillo (Dirección)',
    correo: 'admin@shopcart.com.gt',
    password: 'Admin123!',
    desc: 'Control total: Catálogo, variantes, cupones, usuarios, dashboard y auditoría.',
  },
] as const;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        message: `Has ingresado con el perfil ${session.user.rol}.`,
      });
      if (fromPath) {
        navigate(fromPath, { replace: true });
      } else if (session.user.rol === 'Administrador' || session.user.rol === 'Operador') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Credenciales incorrectas.');
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
    <div className="mx-auto max-w-5xl py-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-stretch">
        {/* Columna Izquierda: Formulario Comercial */}
        <div className="md:col-span-7 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-10 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <ShoppingBag className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 block">
                  Don Arturo · Guatemala
                </span>
                <h1 className="font-display text-2xl font-extrabold text-slate-950">
                  Ingresar a tu Cuenta
                </h1>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <FormField label="Correo Electrónico" required>
                {(fieldProps) => (
                  <input
                    {...fieldProps}
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="nombre@correo.com.gt"
                    className="rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
                  />
                )}
              </FormField>

              <FormField label="Contraseña" required>
                {(fieldProps) => (
                  <div className="relative">
                    <input
                      {...fieldProps}
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-stone-300 bg-stone-50/40 pl-3.5 pr-10 py-2.5 text-sm text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
                    />
                    <button
                      type="button"
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </FormField>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                {submitting ? 'Verificando acceso...' : 'Continuar a Don Arturo'}
              </button>
            </form>
          </div>

          <p className="mt-8 border-t border-stone-100 pt-5 text-center text-xs text-slate-600">
            ¿Primera vez comprando en Don Arturo?{' '}
            <Link to="/register" className="font-bold text-emerald-700 hover:underline">
              Crear cuenta de cliente →
            </Link>
          </p>
        </div>

        {/* Columna Derecha: Cápsula de Perfiles para el Evaluador */}
        <div className="md:col-span-5 rounded-3xl bg-[#0A0F1D] text-stone-200 p-6 sm:p-8 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Terminal className="h-4 w-4" />
              <span>Acceso Rápido Evaluador</span>
            </div>
            <h2 className="mt-1 font-display text-lg font-extrabold text-white">
              Perfiles Preconfigurados
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              Selecciona cualquier rol para autocompletar sus credenciales en el formulario:
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.correo}
                  type="button"
                  onClick={() => fillDemo(u.correo, u.password)}
                  className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 hover:bg-white/12 hover:border-emerald-400/40 p-3.5 text-left transition cursor-pointer"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-white">{u.nombre}</span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      {u.rol}
                    </span>
                  </div>
                  <span className="mt-1 font-mono text-[11px] text-emerald-300">{u.correo}</span>
                  <span className="mt-1 text-[11px] text-stone-400 leading-relaxed">{u.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 p-3.5 text-[11px] text-stone-300 border border-white/10 flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Si agregaste artículos a tu bolsa como visitante, se fusionarán automáticamente con tu
              cuenta al iniciar sesión.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
