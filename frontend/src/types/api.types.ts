export type UserRole = 'Cliente' | 'Operador' | 'Administrador';

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/* ============================================================================
   RF-01: Autenticación, Usuarios y Direcciones
   ============================================================================ */
export interface AuthUser {
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
  rol: UserRole;
  telefono: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface UserRecord {
  IDUsuario: number;
  IDRol: number;
  NombreRol: UserRole;
  NombreCompleto: string;
  Correo: string;
  Telefono: string | null;
  Activo: boolean;
  FechaCreacion: string;
  FechaModificacion: string;
}

export interface AddressRecord {
  IDDireccion: number;
  IDUsuario: number;
  Alias: string;
  NombreDestinatario: string;
  TelefonoContacto: string;
  Departamento: string;
  Municipio: string;
  ZonaOCodigoPostal: string | null;
  DireccionExacta: string;
  Referencia: string | null;
  EsPredeterminada: boolean;
  Activa: boolean;
  FechaCreacion: string;
}

/* ============================================================================
   RF-02 y RF-03: Catálogo de Productos, Categorías, Variantes e Inventario
   ============================================================================ */
export interface CategoryRecord {
  IDCategoria: number;
  Nombre: string;
  Descripcion: string | null;
  Activa: boolean;
  TotalProductos: number;
  FechaCreacion: string;
  FechaModificacion: string;
}

export interface AttributeGroup {
  idAtributo: number;
  nombreAtributo: string;
  activo: boolean;
  valores: Array<{ IDValorAtributo: number; Valor: string }>;
}

export interface ProductSummaryRecord {
  IDProducto: number;
  IDCategoria: number;
  NombreCategoria: string;
  Nombre: string;
  Descripcion: string | null;
  Marca: string | null;
  Activo: boolean;
  ImagenPrincipal: string | null;
  PrecioMinimo: number;
  PrecioMaximo: number;
  TotalVariantesActivas: number;
  ExistenciaDisponibleTotal: number;
  TieneDisponibilidad: boolean;
  FechaCreacion: string;
}

export interface ProductImageRecord {
  IDProductoImagen: number;
  UrlImagen: string;
  TextoAlternativo: string | null;
  Orden: number;
  EsPrincipal: boolean;
}

export interface VariantAttributeItem {
  IDAtributo: number;
  Atributo: string;
  IDValorAtributo: number;
  Valor: string;
}

export interface ProductVariantRecord {
  IDVariante: number;
  SKU: string;
  NombreVariante: string;
  Precio: number;
  PrecioSinIVA: number;
  MontoIVAIncluido: number;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
  Activa: boolean;
  Atributos?: VariantAttributeItem[];
}

export interface ProductDetailRecord {
  IDProducto: number;
  IDCategoria: number;
  NombreCategoria: string;
  Nombre: string;
  Descripcion: string | null;
  Marca: string | null;
  Activo: boolean;
  FechaCreacion: string;
  FechaModificacion: string;
  imagenes: ProductImageRecord[];
  variantes: ProductVariantRecord[];
}

export interface InventoryStockRecord {
  IDVariante: number;
  SKU: string;
  NombreVariante: string;
  IDProducto: number;
  NombreProducto: string;
  IDCategoria: number;
  NombreCategoria: string;
  PrecioVigente: number;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
  SumaMovimientosKardex: number;
  CuadraConKardex: boolean;
  VarianteActiva: boolean;
  ProductoActivo: boolean;
}

export interface KardexMovementRecord {
  IDMovimientoKardex: number;
  IDVariante: number;
  SKU: string;
  NombreVariante: string;
  IDProducto: number;
  NombreProducto: string;
  TipoMovimiento: string;
  Cantidad: number;
  ExistenciaAnterior: number;
  ExistenciaNueva: number;
  Motivo: string;
  IDPedido: number | null;
  NumeroPedido: string | null;
  IDUsuario: number;
  NombreUsuario: string;
  FechaMovimiento: string;
}

/* ============================================================================
   RF-04 y RF-05: Carrito de Compras y Cupones
   ============================================================================ */
export interface CartItemRecord {
  IDCarritoItem: number;
  IDVariante: number;
  IDProducto: number;
  IDCategoria: number;
  NombreProducto: string;
  SKU: string;
  NombreVariante: string;
  UrlImagen: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  SubtotalLinea: number;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
  VarianteActiva: boolean;
  ProductoActivo: boolean;
}

export interface CartDetailRecord {
  IDCarrito: number;
  IDUsuario: number | null;
  TokenInvitado: string | null;
  EstadoCarrito: string;
  CantidadItemsDistintos: number;
  CantidadTotalUnidades: number;
  Subtotal: number;
  IDCupon: number | null;
  CodigoCupon: string | null;
  CuponEsValido: boolean;
  MensajeCupon: string | null;
  MontoDescuento: number;
  PorcentajeIVA: number;
  SubtotalSinIVA: number;
  MontoIVAIncluido: number;
  Total: number;
  items: CartItemRecord[];
}

export interface CouponRecord {
  IDCupon: number;
  Codigo: string;
  Descripcion: string;
  TipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
  ValorDescuento: number;
  IDCategoria: number | null;
  NombreCategoria: string | null;
  MontoMinimoCompra: number;
  LimiteUsoTotal: number;
  LimiteUsoPorCliente: number;
  UsosActuales: number;
  FechaInicio: string;
  FechaFin: string;
  Activo: boolean;
  EstadoVigencia: 'VIGENTE' | 'PROGRAMADO' | 'VENCIDO' | 'AGOTADO' | 'INACTIVO';
  FechaCreacion: string;
}

/* ============================================================================
   RF-06 y RF-07: Checkout, Reserva, Pedidos y Devoluciones
   ============================================================================ */
export type OrderState =
  | 'Pagado'
  | 'EnPreparacion'
  | 'Despachado'
  | 'Entregado'
  | 'Cancelado'
  | 'DevueltoParcial'
  | 'DevueltoTotal';

export interface CheckoutReservationResponse {
  TokenReserva: string;
  IDCarrito: number;
  IDUsuario: number;
  FechaInicioReserva: string;
  FechaExpiracion: string;
  MinutosVigencia: number;
  detalleReserva: Array<{
    IDReservaExistencia: number;
    IDVariante: number;
    SKU: string;
    NombreProducto: string;
    NombreVariante: string;
    CantidadReservada: number;
    PrecioCongeladoCheckout: number;
  }>;
}

export interface OrderSummaryRecord {
  IDPedido: number;
  NumeroPedido: string;
  IDUsuario: number;
  NombreCliente: string;
  CorreoCliente: string;
  IDDireccionEntrega: number;
  IDCupon: number | null;
  CodigoCuponSnapshot: string | null;
  EstadoPedido: OrderState;
  Subtotal: number;
  MontoDescuento: number;
  PorcentajeIVA: number;
  MontoIVAIncluido: number;
  TotalPagado: number;
  MontoReintegradoAcumulado: number;
  TotalNetoEfectivo: number;
  TotalLineas: number;
  TotalUnidadesCompradas: number;
  TotalUnidadesDevueltas: number;
  MetodoPago: string;
  ReferenciaPago: string | null;
  FechaCreacion: string;
  FechaModificacion: string;
  direccionEntrega: {
    Alias?: string;
    NombreDestinatario?: string;
    TelefonoContacto?: string;
    Departamento?: string;
    Municipio?: string;
    ZonaOCodigoPostal?: string;
    DireccionExacta?: string;
    Referencia?: string;
  } | null;
}

export interface OrderLineRecord {
  IDDetallePedido: number;
  IDVariante: number;
  IDProducto: number;
  SKUSnapshot: string;
  NombreProductoSnapshot: string;
  CantidadComprada: number;
  CantidadDevuelta: number;
  CantidadDisponibleDevolver: number;
  PrecioUnitarioCongelado: number;
  SubtotalLinea: number;
  DescuentoProporcionalLinea: number;
  TotalLineaNeto: number;
}

export interface OrderStateHistoryItem {
  IDHistorialEstadoPedido: number;
  IDUsuario: number;
  NombreUsuario: string;
  RolUsuario: string;
  EstadoAnterior: string | null;
  EstadoNuevo: OrderState;
  MotivoComentario: string | null;
  FechaCambio: string;
}

export interface OrderReturnItem {
  IDDevolucion: number;
  IDUsuario: number;
  NombreUsuario: string;
  TipoDevolucion: string;
  Motivo: string;
  MontoReintegrado: number;
  FechaDevolucion: string;
  LineasDevueltas?: Array<{
    IDDetalleDevolucion: number;
    IDDetallePedido: number;
    IDVariante: number;
    CantidadDevuelta: number;
    MontoLineaReintegrado: number;
  }>;
}

export interface OrderDetailRecord extends Omit<OrderSummaryRecord, 'TotalPagado'> {
  Total: number;
  lineas: OrderLineRecord[];
  historialEstados: OrderStateHistoryItem[];
  devoluciones: OrderReturnItem[];
}

/* ============================================================================
   RF-08 y RF-09: Dashboard, Carritos Abandonados y Bitácora
   ============================================================================ */
export interface DashboardMetricsResponse {
  kpis: {
    FechaInicioPeriodo: string;
    FechaFinPeriodo: string;
    TotalPedidosCompletados: number;
    TotalPedidosCancelados: number;
    VentasBrutasGTQ: number;
    DescuentosGTQ: number;
    DevolucionesGTQ: number;
    VentasNetasGTQ: number;
    TicketPromedioGTQ: number;
    TotalCarritosAbandonados: number;
    MontoPotencialCarritosAbandonadosGTQ: number;
  };
  ventasPorDia: Array<{ Fecha: string; NumeroPedidos: number; VentasNetasGTQ: number }>;
  ventasPorSemana: Array<{
    Anio: number;
    SemanaISO: number;
    EtiquetaSemana: string;
    NumeroPedidos: number;
    VentasNetasGTQ: number;
  }>;
  ventasPorMes: Array<{ Mes: string; NumeroPedidos: number; VentasNetasGTQ: number }>;
  ventasPorCategoria: Array<{
    IDCategoria: number;
    NombreCategoria: string;
    CantidadPedidos: number;
    UnidadesNetasVendidas: number;
    VentasBrutasGTQ: number;
    DescuentosGTQ: number;
    DevolucionesGTQ: number;
    VentasNetasGTQ: number;
  }>;
  top10Productos: Array<{
    IDProducto: number;
    NombreProducto: string;
    IDCategoria: number;
    NombreCategoria: string;
    TotalPedidosConProducto: number;
    UnidadesBrutasVendidas: number;
    UnidadesDevueltas: number;
    UnidadesNetasVendidas: number;
    MontoBrutoVendidoGTQ: number;
    MontoDevueltoGTQ: number;
    MontoNetoVendidoGTQ: number;
  }>;
}

export interface AbandonedCartRecord {
  IDCarrito: number;
  IDUsuario: number | null;
  NombreCliente: string;
  CorreoCliente: string | null;
  TokenInvitado: string | null;
  CantidadItemsDistintos: number;
  CantidadTotalUnidades: number;
  MontoPotencialGTQ: number;
  FechaCreacion: string;
  FechaUltimaActividad: string;
  MinutosInactividad: number;
  HorasInactividad: number;
}

export interface AuditLogRecord {
  IDBitacora: number;
  IDUsuario: number | null;
  NombreUsuario: string;
  CorreoUsuario: string | null;
  RolUsuario: string | null;
  Modulo: string;
  Entidad: string;
  IDEntidad: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
  FechaHora: string;
}
