import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Star, Trash2, Edit3, UserX } from 'lucide-react';
import { AddressRecord } from '../../types/api.types';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmptyStateView, ErrorStateView, LoadingView } from '../../components/ui/EmptyAndErrorStates';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';
import { RoleBadge } from '../../components/ui/StatusBadge';

export const ProfileAddressesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [alias, setAlias] = useState('Casa');
  const [nombreDestinatario, setNombreDestinatario] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [departamento, setDepartamento] = useState('Guatemala');
  const [municipio, setMunicipio] = useState('Guatemala');
  const [zonaOCodigoPostal, setZonaOCodigoPostal] = useState('Zona 10');
  const [direccionExacta, setDireccionExacta] = useState('');
  const [referencia, setReferencia] = useState('');
  const [esPredeterminada, setEsPredeterminada] = useState(true);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await authApi.listAddresses();
      setAddresses(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar direcciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const openNewModal = () => {
    setEditingAddress(null);
    setAlias('Casa');
    setNombreDestinatario(user?.nombreCompleto ?? '');
    setTelefonoContacto(user?.telefono ?? '5544-3322');
    setDepartamento('Guatemala');
    setMunicipio('Guatemala');
    setZonaOCodigoPostal('Zona 10');
    setDireccionExacta('');
    setReferencia('');
    setEsPredeterminada(addresses.length === 0);
    setModalOpen(true);
  };

  const openEditModal = (addr: AddressRecord) => {
    setEditingAddress(addr);
    setAlias(addr.Alias);
    setNombreDestinatario(addr.NombreDestinatario);
    setTelefonoContacto(addr.TelefonoContacto);
    setDepartamento(addr.Departamento);
    setMunicipio(addr.Municipio);
    setZonaOCodigoPostal(addr.ZonaOCodigoPostal ?? '');
    setDireccionExacta(addr.DireccionExacta);
    setReferencia(addr.Referencia ?? '');
    setEsPredeterminada(addr.EsPredeterminada);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        alias: alias.trim(),
        nombreDestinatario: nombreDestinatario.trim(),
        telefonoContacto: telefonoContacto.trim(),
        departamento: departamento.trim(),
        municipio: municipio.trim(),
        zonaOCodigoPostal: zonaOCodigoPostal.trim() || undefined,
        direccionExacta: direccionExacta.trim(),
        referencia: referencia.trim() || undefined,
        esPredeterminada,
      };

      if (editingAddress) {
        await authApi.updateAddress(editingAddress.IDDireccion, payload);
        showToast({ type: 'success', title: 'Dirección actualizada correctamente' });
      } else {
        await authApi.createAddress(payload);
        showToast({ type: 'success', title: 'Dirección registrada correctamente' });
      }
      setModalOpen(false);
      await loadAddresses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error al guardar dirección',
        message: err instanceof Error ? err.message : 'Verifique los datos ingresados.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (idDireccion: number) => {
    try {
      await authApi.deleteAddress(idDireccion);
      showToast({ type: 'info', title: 'Dirección eliminada' });
      await loadAddresses();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'No se pudo eliminar la dirección',
        message: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    }
  };

  const handleDeactivateSelf = async () => {
    setDeactivating(true);
    try {
      await authApi.deactivateSelf();
      await logout();
      showToast({
        type: 'info',
        title: 'Cuenta desactivada correctamente',
        message: 'Tu historial de pedidos se conserva intacto en el sistema (RF-01).',
      });
      navigate('/login');
    } catch (err) {
      showToast({
        type: 'error',
        title: 'No se pudo desactivar la cuenta',
        message: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setDeactivating(false);
      setDeactivateModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado de perfil */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{user?.nombreCompleto}</h1>
            {user && <RoleBadge role={user.rol} />}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Correo: <strong>{user?.correo}</strong> · ID Usuario: <strong>#{user?.idUsuario}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {user?.rol !== 'Administrador' && (
            <button
              type="button"
              onClick={() => setDeactivateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <UserX className="h-4 w-4" />
              Desactivar mi cuenta (RF-01)
            </button>
          )}
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva Dirección de Entrega
          </button>
        </div>
      </div>

      {/* Listado de direcciones con protección Anti-IDOR en Backend/BD */}
      <div>
        <h2 className="mb-3 text-base font-bold text-slate-900">
          Mis Direcciones de Entrega (RF-01 y RF-06)
        </h2>

        {loading ? (
          <LoadingView message="Cargando tus direcciones de entrega..." />
        ) : error ? (
          <ErrorStateView message={error} onRetry={loadAddresses} />
        ) : addresses.length === 0 ? (
          <EmptyStateView
            title="Aún no tienes direcciones registradas"
            description="Registra una dirección para agilizar tu proceso de checkout."
            actionLabel="Agregar mi primera dirección"
            onAction={openNewModal}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {addresses.map((addr) => (
              <div
                key={addr.IDDireccion}
                className={`rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between gap-4 ${
                  addr.EsPredeterminada ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                      <span className="font-bold text-sm text-slate-900">{addr.Alias}</span>
                    </div>
                    {addr.EsPredeterminada && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                        <Star className="h-3 w-3 fill-indigo-600" />
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    Recibe: {addr.NombreDestinatario} ({addr.TelefonoContacto})
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {addr.DireccionExacta}
                    {addr.ZonaOCodigoPostal ? `, ${addr.ZonaOCodigoPostal}` : ''} — {addr.Municipio},{' '}
                    {addr.Departamento}
                  </p>
                  {addr.Referencia && (
                    <p className="mt-1 text-[11px] text-slate-500">Referencia: {addr.Referencia}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.IDDireccion)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAddress ? 'Editar Dirección de Entrega' : 'Nueva Dirección de Entrega'}
        subtitle="Protección Anti-IDOR activa en SP_Direcciones_*"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Alias (Casa, Oficina, etc.)" required>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  required
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </FormField>
            <FormField label="Teléfono de Contacto" required>
              {(props) => (
                <input
                  {...props}
                  type="tel"
                  required
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </FormField>
          </div>

          <FormField label="Nombre del Destinatario" required>
            {(props) => (
              <input
                {...props}
                type="text"
                required
                value={nombreDestinatario}
                onChange={(e) => setNombreDestinatario(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Departamento" required>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  required
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </FormField>
            <FormField label="Municipio" required>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  required
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </FormField>
            <FormField label="Zona / Código Postal">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={zonaOCodigoPostal}
                  onChange={(e) => setZonaOCodigoPostal(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </FormField>
          </div>

          <FormField label="Dirección Exacta" hint="Calle, avenida, número de casa o edificio" required>
            {(props) => (
              <input
                {...props}
                type="text"
                required
                minLength={5}
                value={direccionExacta}
                onChange={(e) => setDireccionExacta(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </FormField>

          <FormField label="Referencia de Entrega (Opcional)">
            {(props) => (
              <input
                {...props}
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </FormField>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={esPredeterminada}
              onChange={(e) => setEsPredeterminada(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Establecer como mi dirección predeterminada
          </label>

          <div className="mt-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal de confirmación para autodesactivación de cuenta (RF-01) */}
      <ModalDialog
        open={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="¿Desactivar tu cuenta de ShopCart?"
        subtitle="Desactivación lógica sin pérdida de historial transaccional (RF-01)"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Al desactivar tu cuenta, tus sesiones activas se revocarán inmediatamente y no podrás
            iniciar sesión hasta que un <strong>Administrador</strong> la reactive desde el panel de
            usuarios. Tus pedidos y comprobantes históricos permanecerán intactos.
          </p>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              autoFocus
              onClick={() => setDeactivateModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Conservar cuenta activa
            </button>
            <button
              type="button"
              disabled={deactivating}
              onClick={() => void handleDeactivateSelf()}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              {deactivating ? 'Desactivando...' : 'Sí, desactivar mi cuenta'}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};
