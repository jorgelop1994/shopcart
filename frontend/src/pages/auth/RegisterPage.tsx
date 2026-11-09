import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ShieldAlert } from 'lucide-react';
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
        title: 'Cuenta creada exitosamente',
        message: `Bienvenido ${session.user.nombreCompleto}. Tu carrito ha sido sincronizado.`,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No fue posible registrar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Registro de Cliente</h1>
            <p className="text-xs text-slate-500">
              Contraseñas almacenadas con hash bcrypt seguro en SQL Server (RF-01)
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
            label="Nombre Completo"
            hint="Mínimo 3 caracteres"
            required
          >
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                required
                minLength={3}
                autoComplete="name"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Ana Lucía Gómez"
                className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            )}
          </FormField>

          <FormField
            label="Correo Electrónico"
            hint="Formato: correo@dominio.com"
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
                placeholder="ana.gomez@correo.com.gt"
                className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            )}
          </FormField>

          <FormField
            label="Teléfono de Contacto (Guatemala)"
            hint="Opcional. Ej. 5544-3322"
          >
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="5544-3322"
                className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            )}
          </FormField>

          <FormField
            label="Contraseña"
            hint="Debe contener al menos 8 caracteres, incluyendo letras y números."
            required
          >
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            )}
          </FormField>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? 'Registrando cuenta...' : 'Crear Cuenta de Cliente'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
};
