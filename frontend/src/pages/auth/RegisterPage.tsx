import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ShieldAlert, Eye, EyeOff, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FormField } from '../../components/ui/FormField';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const session = await register({
        nombreCompleto: nombreCompleto.trim(),
        correo: correo.trim(),
        password,
        telefono: telefono.trim() || undefined,
      });
      showToast({
        type: 'success',
        title: `¡Bienvenido, ${session.user.nombreCompleto}!`,
        message: 'Tu cuenta ha sido creada y tu bolsa de compras está sincronizada.',
      });
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No fue posible completar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <ShoppingBag className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 block">
              Don Arturo · Flagship Store
            </span>
            <h1 className="font-display text-2xl font-extrabold text-slate-950">
              Crear Cuenta de Cliente
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
          <FormField label="Nombre Completo" hint="Como aparecerá en tus pedidos y entregas" required>
            {(fieldProps) => (
              <input
                {...fieldProps}
                name="name"
                type="text"
                required
                minLength={3}
                autoComplete="name"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Ana Lucía Gómez"
                className="rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
              />
            )}
          </FormField>

          <FormField label="Correo Electrónico" required>
            {(fieldProps) => (
              <input
                {...fieldProps}
                name="email"
                type="email"
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ana.gomez@correo.com.gt"
                className="rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
              />
            )}
          </FormField>

          <FormField label="Teléfono Celular (Guatemala)" hint="Opcional · Ej. 5544-3322">
            {(fieldProps) => (
              <input
                {...fieldProps}
                name="tel"
                type="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="5544-3322"
                className="rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-slate-950 focus:border-slate-950 focus:bg-white focus:outline-none transition"
              />
            )}
          </FormField>

          <FormField
            label="Contraseña"
            hint="Al menos 8 caracteres, incluyendo letras y números."
            required
          >
            {(fieldProps) => (
              <div className="relative">
                <input
                  {...fieldProps}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
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
            <UserPlus className="h-4 w-4" />
            {submitting ? 'Creando cuenta...' : 'Crear mi Cuenta y Continuar'}
          </button>
        </form>

        <p className="mt-6 border-t border-stone-100 pt-5 text-center text-xs text-slate-600">
          ¿Ya tienes una cuenta registrada?{' '}
          <Link to="/login" className="font-bold text-emerald-700 hover:underline">
            Ingresar aquí →
          </Link>
        </p>
      </div>
    </div>
  );
};
