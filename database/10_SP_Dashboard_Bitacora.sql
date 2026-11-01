/* ============================================================================
   Script: 10_SP_Dashboard_Bitacora.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Procedimientos almacenados de los módulos RF-08 (Dashboard y
                reportes: ventas por día/semana/mes en Quetzales y en número
                de pedidos, ticket promedio, ventas por categoría, top 10
                productos más vendidos y carritos abandonados) y RF-09
                (Consulta paginada de Bitácora con filtro por módulo).
   Estándar de Nomenclatura: SP_Modulo_Proceso
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

/* ============================================================================
   1. SP_Dashboard_ObtenerMetricas
      Criterios de Aceptación RF-08:
      - Ventas por día, semana y mes, en quetzales y en número de pedidos.
      - Ventas por categoría y los 10 productos más vendidos de un periodo.
      - Los reportes solo consideran pedidos completados (pagados), excluyendo
        cancelados y descontando devoluciones.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_ObtenerMetricas
    @FechaInicio DATETIME2(3) = NULL,
    @FechaFin    DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Fin    DATETIME2(3) = ISNULL(@FechaFin, SYSDATETIME());
    DECLARE @Inicio DATETIME2(3) = ISNULL(@FechaInicio, DATEADD(DAY, -30, @Fin));

    DECLARE @TotalPedidosCompletados INT            = 0;
    DECLARE @TotalPedidosCancelados  INT            = 0;
    DECLARE @VentasBrutasGTQ         DECIMAL(12, 2) = 0.00;
    DECLARE @DescuentosGTQ           DECIMAL(12, 2) = 0.00;
    DECLARE @DevolucionesGTQ         DECIMAL(12, 2) = 0.00;
    DECLARE @VentasNetasGTQ          DECIMAL(12, 2) = 0.00;
    DECLARE @TicketPromedioGTQ       DECIMAL(12, 2) = 0.00;
    DECLARE @TotalCarritosAbandonados INT           = 0;
    DECLARE @MontoPotencialAbandonado DECIMAL(12, 2) = 0.00;

    SELECT
        @TotalPedidosCompletados = ISNULL(SUM(CASE WHEN p.EstadoPedido <> N'Cancelado' THEN 1 ELSE 0 END), 0),
        @TotalPedidosCancelados  = ISNULL(SUM(CASE WHEN p.EstadoPedido = N'Cancelado'  THEN 1 ELSE 0 END), 0),
        @VentasBrutasGTQ         = ISNULL(SUM(CASE WHEN p.EstadoPedido <> N'Cancelado' THEN p.Subtotal ELSE 0.00 END), 0.00),
        @DescuentosGTQ           = ISNULL(SUM(CASE WHEN p.EstadoPedido <> N'Cancelado' THEN p.MontoDescuento ELSE 0.00 END), 0.00),
        @DevolucionesGTQ         = ISNULL(SUM(CASE WHEN p.EstadoPedido <> N'Cancelado' THEN p.MontoReintegradoAcumulado ELSE 0.00 END), 0.00),
        @VentasNetasGTQ          = ISNULL(SUM(CASE WHEN p.EstadoPedido <> N'Cancelado' THEN (p.Total - p.MontoReintegradoAcumulado) ELSE 0.00 END), 0.00)
    FROM dbo.Pedidos AS p
    WHERE p.FechaCreacion >= @Inicio
      AND p.FechaCreacion <= @Fin;

    IF @TotalPedidosCompletados > 0
        SET @TicketPromedioGTQ = CAST(ROUND(@VentasNetasGTQ / @TotalPedidosCompletados, 2) AS DECIMAL(12, 2));

    SELECT
        @TotalCarritosAbandonados = COUNT(1),
        @MontoPotencialAbandonado = ISNULL(SUM(MontoPotencialGTQ), 0.00)
    FROM dbo.VW_Dashboard_CarritosAbandonados;

    SELECT
        @Inicio AS FechaInicioPeriodo,
        @Fin AS FechaFinPeriodo,
        @TotalPedidosCompletados AS TotalPedidosCompletados,
        @TotalPedidosCancelados AS TotalPedidosCancelados,
        @VentasBrutasGTQ AS VentasBrutasGTQ,
        @DescuentosGTQ AS DescuentosGTQ,
        @DevolucionesGTQ AS DevolucionesGTQ,
        @VentasNetasGTQ AS VentasNetasGTQ,
        @TicketPromedioGTQ AS TicketPromedioGTQ,
        @TotalCarritosAbandonados AS TotalCarritosAbandonados,
        @MontoPotencialAbandonado AS MontoPotencialCarritosAbandonadosGTQ,
        -- Ventas por Día
        (
            SELECT
                CONVERT(NVARCHAR(10), CAST(p.FechaCreacion AS DATE), 23) AS Fecha,
                COUNT(p.IDPedido) AS NumeroPedidos,
                CAST(SUM(p.Total - p.MontoReintegradoAcumulado) AS DECIMAL(12, 2)) AS VentasNetasGTQ
            FROM dbo.Pedidos AS p
            WHERE p.EstadoPedido <> N'Cancelado'
              AND p.FechaCreacion >= @Inicio
              AND p.FechaCreacion <= @Fin
            GROUP BY CAST(p.FechaCreacion AS DATE)
            ORDER BY CAST(p.FechaCreacion AS DATE) ASC
            FOR JSON PATH
        ) AS VentasPorDiaJSON,
        -- Ventas por Semana
        (
            SELECT
                DATEPART(YEAR, p.FechaCreacion) AS Anio,
                DATEPART(ISO_WEEK, p.FechaCreacion) AS SemanaISO,
                CONCAT(DATEPART(YEAR, p.FechaCreacion), N'-W', RIGHT(CONCAT(N'00', DATEPART(ISO_WEEK, p.FechaCreacion)), 2)) AS EtiquetaSemana,
                COUNT(p.IDPedido) AS NumeroPedidos,
                CAST(SUM(p.Total - p.MontoReintegradoAcumulado) AS DECIMAL(12, 2)) AS VentasNetasGTQ
            FROM dbo.Pedidos AS p
            WHERE p.EstadoPedido <> N'Cancelado'
              AND p.FechaCreacion >= @Inicio
              AND p.FechaCreacion <= @Fin
            GROUP BY
                DATEPART(YEAR, p.FechaCreacion),
                DATEPART(ISO_WEEK, p.FechaCreacion)
            ORDER BY
                DATEPART(YEAR, p.FechaCreacion) ASC,
                DATEPART(ISO_WEEK, p.FechaCreacion) ASC
            FOR JSON PATH
        ) AS VentasPorSemanaJSON,
        -- Ventas por Mes
        (
            SELECT
                FORMAT(p.FechaCreacion, N'yyyy-MM') AS Mes,
                COUNT(p.IDPedido) AS NumeroPedidos,
                CAST(SUM(p.Total - p.MontoReintegradoAcumulado) AS DECIMAL(12, 2)) AS VentasNetasGTQ
            FROM dbo.Pedidos AS p
            WHERE p.EstadoPedido <> N'Cancelado'
              AND p.FechaCreacion >= @Inicio
              AND p.FechaCreacion <= @Fin
            GROUP BY FORMAT(p.FechaCreacion, N'yyyy-MM')
            ORDER BY FORMAT(p.FechaCreacion, N'yyyy-MM') ASC
            FOR JSON PATH
        ) AS VentasPorMesJSON,
        -- Ventas por Categoría (usando VW_Dashboard_VentasPorCategoria)
        (
            SELECT
                vc.IDCategoria,
                vc.NombreCategoria,
                SUM(vc.CantidadPedidos) AS CantidadPedidos,
                SUM(vc.UnidadesNetasVendidas) AS UnidadesNetasVendidas,
                CAST(SUM(vc.VentasBrutasGTQ) AS DECIMAL(12, 2)) AS VentasBrutasGTQ,
                CAST(SUM(vc.DescuentosGTQ) AS DECIMAL(12, 2)) AS DescuentosGTQ,
                CAST(SUM(vc.DevolucionesGTQ) AS DECIMAL(12, 2)) AS DevolucionesGTQ,
                CAST(SUM(vc.VentasNetasGTQ) AS DECIMAL(12, 2)) AS VentasNetasGTQ
            FROM dbo.VW_Dashboard_VentasPorCategoria AS vc
            WHERE vc.FechaVenta >= CAST(@Inicio AS DATE)
              AND vc.FechaVenta <= CAST(@Fin AS DATE)
            GROUP BY vc.IDCategoria, vc.NombreCategoria
            ORDER BY VentasNetasGTQ DESC
            FOR JSON PATH
        ) AS VentasPorCategoriaJSON,
        -- Top 10 Productos Más Vendidos del Periodo (usando FU_Dashboard_TopProductosPeriodo)
        (
            SELECT
                tp.IDProducto,
                tp.NombreProducto,
                tp.IDCategoria,
                tp.NombreCategoria,
                tp.TotalPedidosConProducto,
                tp.UnidadesBrutasVendidas,
                tp.UnidadesDevueltas,
                tp.UnidadesNetasVendidas,
                tp.MontoBrutoVendidoGTQ,
                tp.MontoDevueltoGTQ,
                tp.MontoNetoVendidoGTQ
            FROM dbo.FU_Dashboard_TopProductosPeriodo(@Inicio, @Fin, 10) AS tp
            ORDER BY tp.UnidadesNetasVendidas DESC, tp.MontoNetoVendidoGTQ DESC
            FOR JSON PATH
        ) AS Top10ProductosJSON;
END
GO

/* ============================================================================
   2. SP_Dashboard_ListarCarritosAbandonados
      Listado paginado del lado del servidor para inspeccionar carritos
      abandonados sin esperar reportes manuales (Página 3 y Glosario).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_ListarCarritosAbandonados
    @Pagina       INT = 1,
    @TamanoPagina INT = 15
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 15;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;

    ;WITH Abandonados AS
    (
        SELECT
            ca.*,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.VW_Dashboard_CarritosAbandonados AS ca
    )
    SELECT *
    FROM Abandonados
    ORDER BY MinutosInactividad DESC, MontoPotencialGTQ DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   3. SP_Bitacora_Listar
      Consulta paginada del lado del servidor para Administradores con filtro
      por módulo (PRODUCTOS, PRECIOS, EXISTENCIAS, CUPONES, PEDIDOS, CATEGORIAS,
      USUARIOS), acción, usuario y rango de fechas (RF-09).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Listar
    @Pagina       INT           = 1,
    @TamanoPagina INT           = 20,
    @Modulo       NVARCHAR(40)  = NULL,
    @Accion       NVARCHAR(40)  = NULL,
    @IDUsuario    INT           = NULL,
    @FechaInicio  DATETIME2(3)  = NULL,
    @FechaFin     DATETIME2(3)  = NULL,
    @Busqueda     NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 20;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH BitacoraFiltrada AS
    (
        SELECT
            b.IDBitacora,
            b.IDUsuario,
            ISNULL(u.NombreCompleto, N'Sistema') AS NombreUsuario,
            u.Correo AS CorreoUsuario,
            r.NombreRol AS RolUsuario,
            b.Modulo,
            b.Entidad,
            b.IDEntidad,
            b.Accion,
            b.ValorAnterior,
            b.ValorNuevo,
            b.FechaHora,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.Bitacora AS b
        LEFT JOIN dbo.Usuarios AS u
            ON u.IDUsuario = b.IDUsuario
        LEFT JOIN dbo.Roles AS r
            ON r.IDRol = u.IDRol
        WHERE (@Modulo IS NULL OR b.Modulo = @Modulo)
          AND (@Accion IS NULL OR b.Accion = @Accion)
          AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
          AND (@FechaInicio IS NULL OR b.FechaHora >= @FechaInicio)
          AND (@FechaFin IS NULL OR b.FechaHora <= @FechaFin)
          AND (
              @FiltroBusqueda IS NULL
              OR b.Entidad LIKE N'%' + @FiltroBusqueda + N'%'
              OR b.IDEntidad LIKE N'%' + @FiltroBusqueda + N'%'
              OR u.NombreCompleto LIKE N'%' + @FiltroBusqueda + N'%'
              OR u.Correo LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT *
    FROM BitacoraFiltrada
    ORDER BY FechaHora DESC, IDBitacora DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

PRINT N'10_SP_Dashboard_Bitacora.sql ejecutado correctamente.';
GO
