import { Request, Response } from 'express';
import { ordersService } from '../services/orders.service';
import { registerSseClient } from '../utils/dashboardEvents';

export class OrdersController {
  async reservarExistencia(req: Request, res: Response): Promise<void> {
    const data = await ordersService.reservarExistencia({
      idCarrito: req.body.idCarrito,
      idUsuario: req.user!.idUsuario,
    });
    res.status(200).json({ ok: true, data });
  }

  async crearPedido(req: Request, res: Response): Promise<void> {
    const claveIdempotencia =
      (req.body.claveIdempotencia as string | undefined) ??
      (req.headers['idempotency-key'] as string | undefined) ??
      '';

    const data = await ordersService.crearPedido({
      idUsuario: req.user!.idUsuario,
      idCarrito: req.body.idCarrito,
      idDireccionEntrega: req.body.idDireccionEntrega,
      tokenReserva: req.body.tokenReserva,
      claveIdempotencia,
      metodoPago: req.body.metodoPago ?? 'TARJETA_CREDITO',
      referenciaPago: req.body.referenciaPago ?? null,
      simularFalloPago: Boolean(req.body.simularFalloPago),
    });

    res.status(201).json({ ok: true, data });
  }

  async listarPedidos(req: Request, res: Response): Promise<void> {
    const data = await ordersService.listarPedidos({
      idUsuarioEjecutor: req.user!.idUsuario,
      rolEjecutor: req.user!.rol,
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 15),
      estadoPedido: req.query.estadoPedido as string | undefined,
      idUsuarioFiltro: req.query.idUsuario ? Number(req.query.idUsuario) : undefined,
      fechaInicio: req.query.fechaInicio ? new Date(String(req.query.fechaInicio)) : undefined,
      fechaFin: req.query.fechaFin ? new Date(String(req.query.fechaFin)) : undefined,
      busqueda: req.query.busqueda as string | undefined,
    });

    res.status(200).json({ ok: true, data });
  }

  async obtenerDetallePedido(req: Request, res: Response): Promise<void> {
    const data = await ordersService.obtenerDetallePedido({
      idPedido: Number(req.params.id),
      idUsuarioEjecutor: req.user!.idUsuario,
      rolEjecutor: req.user!.rol,
    });

    res.status(200).json({ ok: true, data });
  }

  async cambiarEstadoPedido(req: Request, res: Response): Promise<void> {
    const data = await ordersService.cambiarEstadoPedido({
      idPedido: Number(req.params.id),
      idUsuarioEjecutor: req.user!.idUsuario,
      rolEjecutor: req.user!.rol,
      estadoNuevo: req.body.estadoNuevo,
      motivoComentario: req.body.motivoComentario ?? null,
    });

    res.status(200).json({ ok: true, data });
  }

  async registrarDevolucion(req: Request, res: Response): Promise<void> {
    const data = await ordersService.registrarDevolucion({
      idPedido: Number(req.params.id),
      idUsuarioEjecutor: req.user!.idUsuario,
      motivoDevolucion: req.body.motivoDevolucion,
      lineas: req.body.lineas,
    });

    res.status(201).json({ ok: true, data });
  }

  async obtenerMetricasDashboard(req: Request, res: Response): Promise<void> {
    const data = await ordersService.obtenerMetricasDashboard({
      fechaInicio: req.query.fechaInicio ? new Date(String(req.query.fechaInicio)) : undefined,
      fechaFin: req.query.fechaFin ? new Date(String(req.query.fechaFin)) : undefined,
    });

    res.status(200).json({ ok: true, data });
  }

  async exportarReporteDashboard(req: Request, res: Response): Promise<void> {
    const csv = await ordersService.exportarReporteDashboardCSV({
      fechaInicio: req.query.fechaInicio ? new Date(String(req.query.fechaInicio)) : undefined,
      fechaFin: req.query.fechaFin ? new Date(String(req.query.fechaFin)) : undefined,
    });

    const filename = `reporte-ventas-shopcart-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  async suscribirStreamDashboard(_req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })}\n\n`
    );

    registerSseClient(res);
  }

  async listarCarritosAbandonados(req: Request, res: Response): Promise<void> {
    const data = await ordersService.listarCarritosAbandonados({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 15),
    });

    res.status(200).json({ ok: true, data });
  }

  async listarBitacora(req: Request, res: Response): Promise<void> {
    const data = await ordersService.listarBitacora({
      pagina: Number(req.query.pagina ?? 1),
      tamanoPagina: Number(req.query.tamanoPagina ?? 20),
      modulo: req.query.modulo as string | undefined,
      accion: req.query.accion as string | undefined,
      idUsuario: req.query.idUsuario ? Number(req.query.idUsuario) : undefined,
      fechaInicio: req.query.fechaInicio ? new Date(String(req.query.fechaInicio)) : undefined,
      fechaFin: req.query.fechaFin ? new Date(String(req.query.fechaFin)) : undefined,
      busqueda: req.query.busqueda as string | undefined,
    });

    res.status(200).json({ ok: true, data });
  }
}

export const ordersController = new OrdersController();
