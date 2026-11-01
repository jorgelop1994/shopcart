/* ============================================================================
   Script: 03_Indexes.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Creación de índices no agrupados, compuestos y filtrados
                para garantizar el requisito no funcional de rendimiento
                (< 1 segundo en listados y reportes principales).
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- 1. Índices en Usuarios, TokensRefresh y Direcciones (RF-01)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Usuarios_Rol_Activo' AND object_id = OBJECT_ID(N'dbo.Usuarios'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Usuarios_Rol_Activo
        ON dbo.Usuarios (IDRol ASC, Activo ASC)
        INCLUDE (NombreCompleto, Correo, FechaCreacion);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TokensRefresh_Usuario_Familia' AND object_id = OBJECT_ID(N'dbo.TokensRefresh'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TokensRefresh_Usuario_Familia
        ON dbo.TokensRefresh (IDUsuario ASC, FamiliaToken ASC, Revocado ASC)
        INCLUDE (FechaExpiracion, TokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Direcciones_Usuario_Activa' AND object_id = OBJECT_ID(N'dbo.Direcciones'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Direcciones_Usuario_Activa
        ON dbo.Direcciones (IDUsuario ASC, Activa ASC, EsPredeterminada DESC);
END
GO

-- 2. Índices en Catálogo, Productos y Variantes (RF-02)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Productos_Categoria_Activo_Fecha' AND object_id = OBJECT_ID(N'dbo.Productos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Productos_Categoria_Activo_Fecha
        ON dbo.Productos (IDCategoria ASC, Activo ASC, FechaCreacion DESC)
        INCLUDE (Nombre, Marca);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductoImagenes_Producto_Orden' AND object_id = OBJECT_ID(N'dbo.ProductoImagenes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ProductoImagenes_Producto_Orden
        ON dbo.ProductoImagenes (IDProducto ASC, EsPrincipal DESC, Orden ASC)
        INCLUDE (UrlImagen, TextoAlternativo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Variantes_Producto_Activa_Precio' AND object_id = OBJECT_ID(N'dbo.Variantes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Variantes_Producto_Activa_Precio
        ON dbo.Variantes (IDProducto ASC, Activa ASC, Precio ASC)
        INCLUDE (SKU, NombreVariante, ExistenciaFisica);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_VarianteValoresAtributo_Variante' AND object_id = OBJECT_ID(N'dbo.VarianteValoresAtributo'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VarianteValoresAtributo_Variante
        ON dbo.VarianteValoresAtributo (IDVariante ASC)
        INCLUDE (IDAtributo, IDValorAtributo);
END
GO

-- 3. Índices en Inventario, Kardex y Reservas de Existencia (RF-03 y RF-06)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MovimientosKardex_Variante_Fecha' AND object_id = OBJECT_ID(N'dbo.MovimientosKardex'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_MovimientosKardex_Variante_Fecha
        ON dbo.MovimientosKardex (IDVariante ASC, FechaMovimiento DESC)
        INCLUDE (TipoMovimiento, Cantidad, SaldoAnterior, SaldoPosterior, IDUsuario, IDPedido, Motivo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReservasExistencia_Variante_Activas' AND object_id = OBJECT_ID(N'dbo.ReservasExistencia'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservasExistencia_Variante_Activas
        ON dbo.ReservasExistencia (IDVariante ASC, FechaExpiracion ASC)
        INCLUDE (CantidadReservada, TokenReserva, IDCarrito, IDUsuario)
        WHERE (EstadoReserva = N'ACTIVA');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReservasExistencia_TokenReserva' AND object_id = OBJECT_ID(N'dbo.ReservasExistencia'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservasExistencia_TokenReserva
        ON dbo.ReservasExistencia (TokenReserva ASC, EstadoReserva ASC)
        INCLUDE (IDCarrito, IDUsuario, IDVariante, CantidadReservada, FechaExpiracion);
END
GO

-- 4. Índices en Carrito y Cupones (RF-04 y RF-05)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Carritos_Usuario_Activo' AND object_id = OBJECT_ID(N'dbo.Carritos'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Carritos_Usuario_Activo
        ON dbo.Carritos (IDUsuario ASC)
        WHERE (IDUsuario IS NOT NULL AND EstadoCarrito = N'ACTIVO');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Carritos_TokenInvitado_Activo' AND object_id = OBJECT_ID(N'dbo.Carritos'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Carritos_TokenInvitado_Activo
        ON dbo.Carritos (TokenInvitado ASC)
        WHERE (TokenInvitado IS NOT NULL AND EstadoCarrito = N'ACTIVO');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Carritos_Actividad_Abandono' AND object_id = OBJECT_ID(N'dbo.Carritos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Carritos_Actividad_Abandono
        ON dbo.Carritos (EstadoCarrito ASC, FechaUltimaActividad ASC)
        INCLUDE (IDUsuario, TokenInvitado, IDCupon);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_UsosCupon_Cupon_Usuario' AND object_id = OBJECT_ID(N'dbo.UsosCupon'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UsosCupon_Cupon_Usuario
        ON dbo.UsosCupon (IDCupon ASC, IDUsuario ASC, Activo ASC)
        INCLUDE (IDPedido, MontoDescuentoAplicado);
END
GO

-- 5. Índices en Pedidos, Devoluciones, Reportes y Bitácora (RF-06 a RF-09)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pedidos_Cliente_Fecha' AND object_id = OBJECT_ID(N'dbo.Pedidos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Pedidos_Cliente_Fecha
        ON dbo.Pedidos (IDUsuario ASC, FechaCreacion DESC)
        INCLUDE (NumeroPedido, EstadoPedido, Subtotal, MontoDescuento, Total, MontoReintegradoAcumulado);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pedidos_Estado_Fecha_Reportes' AND object_id = OBJECT_ID(N'dbo.Pedidos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Pedidos_Estado_Fecha_Reportes
        ON dbo.Pedidos (EstadoPedido ASC, FechaCreacion DESC)
        INCLUDE (IDUsuario, NumeroPedido, Subtotal, MontoDescuento, MontoIVAIncluido, Total, MontoReintegradoAcumulado);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DetallePedidos_Variante_Pedido' AND object_id = OBJECT_ID(N'dbo.DetallePedidos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_DetallePedidos_Variante_Pedido
        ON dbo.DetallePedidos (IDVariante ASC, IDPedido ASC)
        INCLUDE (CantidadComprada, CantidadDevuelta, PrecioUnitarioCongelado, SubtotalLinea, DescuentoProporcionalLinea, TotalLineaNeto);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HistorialEstadosPedido_Pedido_Fecha' AND object_id = OBJECT_ID(N'dbo.HistorialEstadosPedido'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_HistorialEstadosPedido_Pedido_Fecha
        ON dbo.HistorialEstadosPedido (IDPedido ASC, FechaCambio ASC)
        INCLUDE (IDUsuario, EstadoAnterior, EstadoNuevo, MotivoComentario);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bitacora_Modulo_FechaHora' AND object_id = OBJECT_ID(N'dbo.Bitacora'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Bitacora_Modulo_FechaHora
        ON dbo.Bitacora (Modulo ASC, FechaHora DESC)
        INCLUDE (IDUsuario, Entidad, IDEntidad, Accion);
END
GO

PRINT N'03_Indexes.sql ejecutado correctamente.';
GO
