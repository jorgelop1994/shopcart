import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Search, UserPlus, Users } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  PaginationMeta,
  UserRecord,
  UserRole,
} from '../../types/api.types';
import { formatDateTimeGT } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

export const UsersManagementPage: React.FC = () => {
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 12,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y ordenamiento en servidor
  const [busqueda, setBusqueda] = useState<string>('');
  const [rolFiltro, setRolFiltro] = useState<string>('');
  const [activoFiltro, setActivoFiltro] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('recientes');

  // Modal Crear Usuario Interno (RF-01)
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('Operador2026!');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('Operador');
  const [creating, setCreating] = useState<boolean>(false);

  // Modal Editar Estado y Rol (RF-01 — Desactivación lógica sin eliminación física)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('Cliente');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchUsers = useCallback(
    async (page = pagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const res = await authApi.listUsers({
          pagina: page,
          tamanoPagina: 12,
          rol: rolFiltro || undefined,
          activo: activoFiltro === '' ? undefined : activoFiltro === 'true',
          busqueda: busqueda.trim() || undefined,
          ordenarPor,
        });
        setUsers(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError ? err.message : 'No fue posible consultar los usuarios.'
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pagina, rolFiltro, activoFiltro, busqueda, ordenarPor]
  );

  useEffect(() => {
    void fetchUsers(1);
  }, [rolFiltro, activoFiltro, ordenarPor, fetchUsers]);

  const handleCreateInternalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }

    setCreating(true);
    try {
      await authApi.createInternalUser({
        nombreCompleto: newName.trim(),
        correo: newEmail.trim().toLowerCase(),
        password: newPassword,
        telefono: newPhone.trim() || null,
        nombreRol: newRole,
      });
      setCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      showToast(`Usuario ${newName} (${newRole}) registrado exitosamente.`, 'success');
      await fetchUsers(1);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No fue posible crear el usuario.',
        'error'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditName(user.NombreCompleto);
    setEditPhone(user.Telefono ?? '');
    setEditRole(user.NombreRol);
    setEditActive(user.Activo);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    try {
      await authApi.updateUser(editingUser.IDUsuario, {
        nombreCompleto: editName.trim(),
        telefono: editPhone.trim() || null,
        nombreRol: editRole,
        activo: editActive,
      });
      setEditingUser(null);
      showToast(
        `Usuario ${editName} actualizado (${editRole} • ${editActive ? 'Activo' : 'Inactivo'}).`,
        'success'
      );
      await fetchUsers(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al actualizar el usuario.',
        'error'
      );
    } finally {
      setUpdating(false);
    }
  };

  const columns: TableColumn<UserRecord>[] = [
    {
      id: 'id',
      header: 'ID / Nombre Completo',
      sortKey: 'nombre',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">
            #{row.IDUsuario} — {row.NombreCompleto}
          </span>
          <span className="text-xs text-slate-500">
            Tel: {row.Telefono ?? 'No registrado'}
          </span>
        </div>
      ),
    },
    {
      id: 'correo',
      header: 'Correo Electrónico',
      sortKey: 'correo',
      render: (row) => <span className="font-mono text-xs text-slate-800">{row.Correo}</span>,
    },
    {
      id: 'rol',
      header: 'Rol RBAC',
      sortKey: 'rol',
      render: (row) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            row.NombreRol === 'Administrador'
              ? 'bg-indigo-100 text-indigo-800'
              : row.NombreRol === 'Operador'
                ? 'bg-sky-100 text-sky-800'
                : 'bg-slate-100 text-slate-700'
          }`}
        >
          {row.NombreRol}
        </span>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      align: 'center',
      render: (row) => <StatusBadge status={row.Activo ? 'ACTIVO' : 'INACTIVO'} />,
    },
    {
      id: 'fecha',
      header: 'Fecha Registro',
      render: (row) => (
        <span className="text-xs text-slate-600">{formatDateTimeGT(row.FechaCreacion)}</span>
      ),
    },
    {
      id: 'acciones',
      header: 'Acción',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenEdit(row)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Rol / Estado
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-600" />
            Gestión de Usuarios y Roles (`RBAC`)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Administración de cuentas internas (`Operador`, `Administrador`) y clientes con
            desactivación lógica sin eliminación física (`RF-01`).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Crear Usuario Interno
        </button>
      </div>

      {/* Filtros en servidor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="user-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar por Nombre o Correo
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="user-search"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchUsers(1);
              }}
              placeholder="Ej. @shopcart.gt o nombre..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="user-role-filter" className="block text-xs font-semibold text-slate-700 mb-1">
            Rol
          </label>
          <select
            id="user-role-filter"
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los roles</option>
            <option value="Administrador">Administrador</option>
            <option value="Operador">Operador</option>
            <option value="Cliente">Cliente</option>
          </select>
        </div>

        <div className="w-full sm:w-40">
          <label htmlFor="user-active-filter" className="block text-xs font-semibold text-slate-700 mb-1">
            Estado
          </label>
          <select
            id="user-active-filter"
            value={activoFiltro}
            onChange={(e) => setActivoFiltro(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="user-sort" className="block text-xs font-semibold text-slate-700 mb-1">
            Ordenar por
          </label>
          <select
            id="user-sort"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="recientes">Más recientes</option>
            <option value="nombre_asc">Nombre (A-Z)</option>
            <option value="correo_asc">Correo (A-Z)</option>
            <option value="rol_asc">Rol (A-Z)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void fetchUsers(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          Filtrar
        </button>
      </div>

      <ServerDataTable
        caption="Directorio de usuarios del sistema y permisos por rol"
        columns={columns}
        data={users}
        keyExtractor={(row) => row.IDUsuario}
        pagination={pagination}
        onPageChange={(page) => void fetchUsers(page)}
        sortKey={
          ordenarPor === 'nombre_asc'
            ? 'nombre'
            : ordenarPor === 'correo_asc'
              ? 'correo'
              : ordenarPor === 'rol_asc'
                ? 'rol'
                : undefined
        }
        sortDirection="asc"
        onSortChange={(key) => {
          if (key === 'nombre') setOrdenarPor('nombre_asc');
          else if (key === 'correo') setOrdenarPor('correo_asc');
          else if (key === 'rol') setOrdenarPor('rol_asc');
        }}
        loading={loading}
        error={error}
        onRetry={() => void fetchUsers(pagination.pagina)}
      />

      {/* Modal Crear Usuario Interno */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Registrar Nuevo Usuario (`SP_Usuarios_CrearInterno`)"
      >
        <form onSubmit={handleCreateInternalUser} className="space-y-4">
          <FormField
            id="new-user-name"
            label="Nombre Completo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <FormField
            id="new-user-email"
            label="Correo Electrónico Único"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="new-user-pass"
              label="Contraseña Inicial"
              hint="Mínimo 8 caracteres (se almacena con hash bcrypt)."
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <FormField
              id="new-user-phone"
              label="Teléfono de Contacto"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-user-role" className="block text-sm font-medium text-slate-800 mb-1.5">
              Rol Asignado <span className="text-rose-600">*</span>
            </label>
            <select
              id="new-user-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
            >
              <option value="Operador">Operador (Pedidos, Estados, Devoluciones e Inventario)</option>
              <option value="Administrador">Administrador (Control Total + Catálogo + Auditoría)</option>
              <option value="Cliente">Cliente</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Editar Rol y Estado Activo/Inactivo */}
      <ModalDialog
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={
          editingUser
            ? `Editar Usuario #${editingUser.IDUsuario} (${editingUser.Correo})`
            : 'Editar Usuario'
        }
      >
        {editingUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <FormField
              id="edit-user-name"
              label="Nombre Completo"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <FormField
              id="edit-user-phone"
              label="Teléfono"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
            <div>
              <label
                htmlFor="edit-user-role"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Rol del Usuario
              </label>
              <select
                id="edit-user-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
              >
                <option value="Cliente">Cliente</option>
                <option value="Operador">Operador</option>
                <option value="Administrador">Administrador</option>
              </select>
            </div>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600"
              />
              <span className="text-xs text-slate-700">
                <strong className="text-slate-900 block">Cuenta Activa (`RF-01`)</strong>
                Si se desactiva la cuenta, el usuario no se elimina físicamente para preservar la
                integridad histórica, pero sus sesiones activas (`RefreshTokens`) se revocan de
                inmediato.
              </span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {updating ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};
