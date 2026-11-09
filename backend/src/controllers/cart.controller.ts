import { Request, Response } from 'express';
import { cartService } from '../services/cart.service';

function resolveCartIdentity(req: Request): {
  idUsuario: number | null;
  tokenInvitado: string | null;
} {
  const idUsuario = req.user?.idUsuario ?? null;
  const tokenInvitado =
    (req.headers['x-guest-token'] as string | undefined) ??
    (req.body?.tokenInvitado as string | undefined) ??
    (req.query?.tokenInvitado as string | undefined) ??
    null;

  return { idUsuario, tokenInvitado };
}

export class CartController {
  async obtenerCarrito(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const idCarrito = req.query.idCarrito ? Number(req.query.idCarrito) : null;

    const data = await cartService.obtenerDetalle({
      idUsuario,
      tokenInvitado,
      idCarrito,
    });
    res.status(200).json({ ok: true, data });
  }

  async agregarOModificarItem(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const data = await cartService.agregarOModificarItem({
      idUsuario,
      tokenInvitado,
      idVariante: req.body.idVariante,
      cantidad: req.body.cantidad,
      esIncremento: Boolean(req.body.esIncremento),
    });
    res.status(200).json({ ok: true, data });
  }

  async eliminarItem(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const data = await cartService.eliminarItem({
      idUsuario,
      tokenInvitado,
      idVariante: Number(req.params.idVariante),
    });
    res.status(200).json({ ok: true, data });
  }

  async vaciarCarrito(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const data = await cartService.vaciarCarrito({ idUsuario, tokenInvitado });
    res.status(200).json({ ok: true, data });
  }

  async fusionarInvitado(req: Request, res: Response): Promise<void> {
    const tokenInvitado =
      (req.body.tokenInvitado as string | undefined) ??
      (req.headers['x-guest-token'] as string | undefined) ??
      '';

    const data = await cartService.fusionarCarritoInvitado({
      idUsuario: req.user!.idUsuario,
      tokenInvitado,
    });
    res.status(200).json({ ok: true, data });
  }

  async aplicarCupon(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const data = await cartService.aplicarCupon({
      idUsuario,
      tokenInvitado,
      codigoCupon: req.body.codigoCupon,
    });
    res.status(200).json({ ok: true, data });
  }

  async removerCupon(req: Request, res: Response): Promise<void> {
    const { idUsuario, tokenInvitado } = resolveCartIdentity(req);
    const data = await cartService.removerCupon({ idUsuario, tokenInvitado });
    res.status(200).json({ ok: true, data });
  }

  async listarCupones(req: Request, res: Response): Promise<void> {
    const data = await cartService.listarCupones({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 15),
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
      busqueda: req.query.busqueda as string | undefined,
      ordenarPor: req.query.ordenarPor as string | undefined,
    });
    res.status(200).json({ ok: true, data });
  }

  async obtenerCuponPorId(req: Request, res: Response): Promise<void> {
    const data = await cartService.obtenerCuponPorId(Number(req.params.id));
    res.status(200).json({ ok: true, data });
  }

  async guardarCupon(req: Request, res: Response): Promise<void> {
    const data = await cartService.guardarCupon({
      idUsuario: req.user!.idUsuario,
      idCupon: req.params.id ? Number(req.params.id) : req.body.idCupon ?? null,
      codigo: req.body.codigo,
      descripcion: req.body.descripcion,
      tipoDescuento: req.body.tipoDescuento,
      valorDescuento: req.body.valorDescuento,
      idCategoria: req.body.idCategoria ?? null,
      montoMinimoCompra: req.body.montoMinimoCompra ?? 0,
      limiteUsoTotal: req.body.limiteUsoTotal,
      limiteUsoPorCliente: req.body.limiteUsoPorCliente ?? 1,
      fechaInicio: new Date(req.body.fechaInicio),
      fechaFin: new Date(req.body.fechaFin),
      activo: req.body.activo ?? true,
    });
    res.status(req.params.id ? 200 : 201).json({ ok: true, data });
  }
}

export const cartController = new CartController();
