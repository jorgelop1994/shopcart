import { Request, Response } from 'express';
import { catalogService } from '../services/catalog.service';

export class CatalogController {
  async listarCategorias(req: Request, res: Response): Promise<void> {
    const esAdmin = req.user?.rol === 'Administrador';
    const soloActivas = req.query.soloActivas !== undefined
      ? req.query.soloActivas === 'true'
      : !esAdmin;

    const data = await catalogService.listarCategorias(soloActivas);
    res.status(200).json({ ok: true, data });
  }

  async crearCategoria(req: Request, res: Response): Promise<void> {
    const data = await catalogService.crearCategoria({
      idUsuario: req.user!.idUsuario,
      nombre: req.body.nombre,
      descripcion: req.body.descripcion ?? null,
    });
    res.status(201).json({ ok: true, data });
  }

  async actualizarCategoria(req: Request, res: Response): Promise<void> {
    const data = await catalogService.actualizarCategoria({
      idUsuario: req.user!.idUsuario,
      idCategoria: Number(req.params.id),
      nombre: req.body.nombre,
      descripcion: req.body.descripcion ?? null,
      activa: req.body.activa ?? true,
    });
    res.status(200).json({ ok: true, data });
  }

  async listarAtributos(_req: Request, res: Response): Promise<void> {
    const data = await catalogService.listarAtributos();
    res.status(200).json({ ok: true, data });
  }

  async guardarAtributoYValor(req: Request, res: Response): Promise<void> {
    const data = await catalogService.guardarAtributoYValor(
      req.body.nombreAtributo,
      req.body.valor
    );
    res.status(201).json({ ok: true, data });
  }

  async listarProductos(req: Request, res: Response): Promise<void> {
    const esAdminOOperador =
      req.user?.rol === 'Administrador' || req.user?.rol === 'Operador';

    const data = await catalogService.listarProductos({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 12),
      busqueda: req.query.busqueda as string | undefined,
      idCategoria: req.query.idCategoria ? Number(req.query.idCategoria) : undefined,
      precioMin: req.query.precioMin !== undefined ? Number(req.query.precioMin) : undefined,
      precioMax: req.query.precioMax !== undefined ? Number(req.query.precioMax) : undefined,
      soloDisponibles: req.query.soloDisponibles === 'true',
      soloActivos:
        req.query.soloActivos !== undefined
          ? req.query.soloActivos === 'true'
          : !esAdminOOperador,
      ordenarPor: (req.query.ordenarPor as string | undefined) ?? 'recientes',
    });

    res.status(200).json({ ok: true, data });
  }

  async obtenerProductoDetalle(req: Request, res: Response): Promise<void> {
    const esAdminOOperador =
      req.user?.rol === 'Administrador' || req.user?.rol === 'Operador';
    const soloActivos = !esAdminOOperador;

    const data = await catalogService.obtenerProductoDetalle(
      Number(req.params.id),
      soloActivos
    );
    res.status(200).json({ ok: true, data });
  }

  async crearProducto(req: Request, res: Response): Promise<void> {
    const data = await catalogService.crearProducto({
      idUsuario: req.user!.idUsuario,
      idCategoria: req.body.idCategoria,
      nombre: req.body.nombre,
      descripcion: req.body.descripcion ?? null,
      marca: req.body.marca ?? null,
      imagenes: req.body.imagenes,
    });
    res.status(201).json({ ok: true, data });
  }

  async actualizarProducto(req: Request, res: Response): Promise<void> {
    const data = await catalogService.actualizarProducto({
      idUsuario: req.user!.idUsuario,
      idProducto: Number(req.params.id),
      idCategoria: req.body.idCategoria,
      nombre: req.body.nombre,
      descripcion: req.body.descripcion ?? null,
      marca: req.body.marca ?? null,
      activo: req.body.activo ?? true,
      imagenes: req.body.imagenes,
    });
    res.status(200).json({ ok: true, data });
  }

  async eliminarODesactivarProducto(req: Request, res: Response): Promise<void> {
    const data = await catalogService.eliminarODesactivarProducto(
      req.user!.idUsuario,
      Number(req.params.id)
    );
    res.status(200).json({ ok: true, data });
  }

  async guardarVariante(req: Request, res: Response): Promise<void> {
    const data = await catalogService.guardarVariante({
      idUsuario: req.user!.idUsuario,
      idProducto: Number(req.params.idProducto),
      idVariante: req.params.idVariante ? Number(req.params.idVariante) : req.body.idVariante ?? null,
      sku: req.body.sku,
      nombreVariante: req.body.nombreVariante,
      precio: req.body.precio,
      activa: req.body.activa ?? true,
      existenciaInicial: req.body.existenciaInicial ?? 0,
      atributos: req.body.atributos,
    });
    res.status(req.params.idVariante ? 200 : 201).json({ ok: true, data });
  }

  async registrarMovimientoInventario(req: Request, res: Response): Promise<void> {
    const data = await catalogService.registrarMovimientoInventario({
      idUsuario: req.user!.idUsuario,
      idVariante: req.body.idVariante,
      tipoMovimiento: req.body.tipoMovimiento,
      cantidad: req.body.cantidad,
      motivo: req.body.motivo,
    });
    res.status(201).json({ ok: true, data });
  }

  async consultarKardex(req: Request, res: Response): Promise<void> {
    const data = await catalogService.consultarKardex({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 20),
      idVariante: req.query.idVariante ? Number(req.query.idVariante) : undefined,
      idProducto: req.query.idProducto ? Number(req.query.idProducto) : undefined,
      tipoMovimiento: req.query.tipoMovimiento as string | undefined,
      fechaInicio: req.query.fechaInicio ? new Date(String(req.query.fechaInicio)) : undefined,
      fechaFin: req.query.fechaFin ? new Date(String(req.query.fechaFin)) : undefined,
      busqueda: req.query.busqueda as string | undefined,
      ordenarPor: req.query.ordenarPor as string | undefined,
    });
    res.status(200).json({ ok: true, data });
  }

  async obtenerExistencias(req: Request, res: Response): Promise<void> {
    const data = await catalogService.obtenerExistencias({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 20),
      idCategoria: req.query.idCategoria ? Number(req.query.idCategoria) : undefined,
      idProducto: req.query.idProducto ? Number(req.query.idProducto) : undefined,
      soloBajoStock: req.query.soloBajoStock === 'true',
      busqueda: req.query.busqueda as string | undefined,
      ordenarPor: req.query.ordenarPor as string | undefined,
    });
    res.status(200).json({ ok: true, data });
  }

  async liberarReservasVencidas(_req: Request, res: Response): Promise<void> {
    const data = await catalogService.liberarReservasVencidas();
    res.status(200).json({ ok: true, data });
  }
}

export const catalogController = new CatalogController();
