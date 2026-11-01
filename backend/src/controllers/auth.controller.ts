import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { UserRole } from '../middlewares/authMiddleware';

export class AuthController {
  async registrarCliente(req: Request, res: Response): Promise<void> {
    const tokenInvitado =
      (req.body.tokenInvitado as string | undefined) ??
      (req.headers['x-guest-token'] as string | undefined) ??
      null;

    const result = await authService.registrarCliente({
      nombreCompleto: req.body.nombreCompleto,
      correo: req.body.correo,
      password: req.body.password,
      telefono: req.body.telefono ?? null,
      tokenInvitado,
    });

    res.status(201).json({ ok: true, data: result });
  }

  async iniciarSesion(req: Request, res: Response): Promise<void> {
    const tokenInvitado =
      (req.body.tokenInvitado as string | undefined) ??
      (req.headers['x-guest-token'] as string | undefined) ??
      null;

    const result = await authService.iniciarSesion({
      correo: req.body.correo,
      password: req.body.password,
      tokenInvitado,
    });

    res.status(200).json({ ok: true, data: result });
  }

  async rotarRefreshToken(req: Request, res: Response): Promise<void> {
    const result = await authService.rotarRefreshToken(req.body.refreshToken);
    res.status(200).json({ ok: true, data: result });
  }

  async cerrarSesion(req: Request, res: Response): Promise<void> {
    const result = await authService.cerrarSesion({
      refreshToken: req.body.refreshToken ?? null,
      idUsuario: req.user?.idUsuario ?? null,
      revocarTodas: Boolean(req.body.revocarTodas),
    });

    res.status(200).json({ ok: true, data: result });
  }

  async obtenerMiPerfil(req: Request, res: Response): Promise<void> {
    const profile = await authService.obtenerPerfil(req.user!.idUsuario);
    res.status(200).json({ ok: true, data: profile });
  }

  async listarUsuarios(req: Request, res: Response): Promise<void> {
    const pagina = Number(req.query.pagina ?? 1);
    const tamanoPagina = Number(req.query.tamanoPagina ?? 10);
    const nombreRol = req.query.rol as string | undefined;
    const activo =
      req.query.activo !== undefined ? req.query.activo === 'true' : undefined;
    const busqueda = req.query.busqueda as string | undefined;

    const result = await authService.listarUsuarios({
      pagina,
      tamanoPagina,
      nombreRol,
      activo,
      busqueda,
    });

    res.status(200).json({ ok: true, data: result });
  }

  async crearUsuarioInterno(req: Request, res: Response): Promise<void> {
    const user = await authService.crearUsuarioInterno({
      idUsuarioAdmin: req.user!.idUsuario,
      nombreRol: req.body.rol as UserRole,
      nombreCompleto: req.body.nombreCompleto,
      correo: req.body.correo,
      password: req.body.password,
      telefono: req.body.telefono ?? null,
    });

    res.status(201).json({ ok: true, data: user });
  }

  async actualizarUsuario(req: Request, res: Response): Promise<void> {
    const idUsuarioObjetivo = Number(req.params.id);
    const user = await authService.actualizarUsuario({
      idUsuarioEjecutor: req.user!.idUsuario,
      idUsuarioObjetivo,
      nombreCompleto: req.body.nombreCompleto,
      telefono: req.body.telefono ?? null,
      nombreRol: (req.body.rol as UserRole | undefined) ?? null,
    });

    res.status(200).json({ ok: true, data: user });
  }

  async cambiarEstadoUsuario(req: Request, res: Response): Promise<void> {
    const idUsuarioObjetivo = Number(req.params.id);
    const user = await authService.cambiarEstadoUsuario({
      idUsuarioEjecutor: req.user!.idUsuario,
      idUsuarioObjetivo,
      activo: Boolean(req.body.activo),
    });

    res.status(200).json({ ok: true, data: user });
  }

  async desactivarMiCuenta(req: Request, res: Response): Promise<void> {
    const user = await authService.cambiarEstadoUsuario({
      idUsuarioEjecutor: req.user!.idUsuario,
      idUsuarioObjetivo: req.user!.idUsuario,
      activo: false,
    });

    res.status(200).json({ ok: true, data: user });
  }

  async listarDirecciones(req: Request, res: Response): Promise<void> {
    const addresses = await authService.listarDirecciones(req.user!.idUsuario);
    res.status(200).json({ ok: true, data: addresses });
  }

  async obtenerDireccion(req: Request, res: Response): Promise<void> {
    const address = await authService.obtenerDireccion(
      Number(req.params.id),
      req.user!.idUsuario
    );
    res.status(200).json({ ok: true, data: address });
  }

  async crearDireccion(req: Request, res: Response): Promise<void> {
    const address = await authService.crearDireccion({
      idUsuario: req.user!.idUsuario,
      alias: req.body.alias,
      nombreReceptor: req.body.nombreReceptor,
      telefonoContacto: req.body.telefonoContacto,
      departamento: req.body.departamento,
      municipio: req.body.municipio,
      direccionExacta: req.body.direccionExacta,
      referencias: req.body.referencias ?? null,
      esPredeterminada: Boolean(req.body.esPredeterminada),
    });

    res.status(201).json({ ok: true, data: address });
  }

  async actualizarDireccion(req: Request, res: Response): Promise<void> {
    const address = await authService.actualizarDireccion({
      idDireccion: Number(req.params.id),
      idUsuario: req.user!.idUsuario,
      alias: req.body.alias,
      nombreReceptor: req.body.nombreReceptor,
      telefonoContacto: req.body.telefonoContacto,
      departamento: req.body.departamento,
      municipio: req.body.municipio,
      direccionExacta: req.body.direccionExacta,
      referencias: req.body.referencias ?? null,
      esPredeterminada: Boolean(req.body.esPredeterminada),
    });

    res.status(200).json({ ok: true, data: address });
  }

  async eliminarDireccion(req: Request, res: Response): Promise<void> {
    await authService.eliminarDireccion(Number(req.params.id), req.user!.idUsuario);
    res.status(200).json({
      ok: true,
      data: { idDireccion: Number(req.params.id), eliminada: true },
    });
  }
}

export const authController = new AuthController();
