/* ============================================================================
   Script: 05_Functions_And_Views.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Creación de Funciones Tipo Tabla (FU_Modulo_Proceso) y
                Vistas (VW_Modulo_Proceso) cumpliendo estrictamente el estándar
                de nomenclatura de la empresa (Página 10).
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

/* ============================================================================
   1. FUNCIÓN TIPO TABLA: dbo.FU_Catalogo_PrecioVigente (Ejemplo explícito Pág. 10)
      Retorna el precio vigente en Quetzales (con IVA 12% incluido y desglosado),
      la existencia física, las unidades con reserva activa vigente (< 15 min)
      y la existencia disponible real de una o todas las variantes.
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_PrecioVigente
(
    @IDVariante INT = NULL
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        v.IDVariante,
        v.IDProducto,
        p.IDCategoria,
        p.Nombre AS NombreProducto,
        v.SKU,
        v.NombreVariante,
        v.Precio AS PrecioVigente,
        CAST(12.00 AS DECIMAL(5, 2)) AS PorcentajeIVA,
        CAST(ROUND(v.Precio / 1.12, 2) AS DECIMAL(12, 2)) AS PrecioSinIVA,
        CAST(v.Precio - ROUND(v.Precio / 1.12, 2) AS DECIMAL(12, 2)) AS MontoIVAIncluido,
        v.ExistenciaFisica,
        ISNULL(res.UnidadesReservadas, 0) AS ExistenciaReservada,
        CASE
            WHEN v.ExistenciaFisica - ISNULL(res.UnidadesReservadas, 0) > 0
                THEN v.ExistenciaFisica - ISNULL(res.UnidadesReservadas, 0)
            ELSE 0
        END AS ExistenciaDisponible,
        v.Activa AS VarianteActiva,
        p.Activo AS ProductoActivo
    FROM dbo.Variantes AS v
    INNER JOIN dbo.Productos AS p
        ON p.IDProducto = v.IDProducto
    OUTER APPLY
    (
        SELECT SUM(r.CantidadReservada) AS UnidadesReservadas
        FROM dbo.ReservasExistencia AS r
        WHERE r.IDVariante = v.IDVariante
          AND r.EstadoReserva = N'ACTIVA'
          AND r.FechaExpiracion > SYSDATETIME()
    ) AS res
    WHERE (@IDVariante IS NULL OR v.IDVariante = @IDVariante)
);
GO

/* ============================================================================
   2. FUNCIÓN TIPO TABLA: dbo.FU_Cupones_CalculoDescuento (Ejemplo explícito Pág. 10)
      Evalúa de forma determinista todas las reglas de negocio de RF-05:
      - Existencia y estado activo del cupón
      - Vigencia (FechaInicio <= Ahora <= FechaFin)
      - Límite total de usos (UsosActuales < LimiteUsoTotal)
      - Límite de usos por cliente (Usos del cliente < LimiteUsoPorCliente)
      - Alcance a todo el carrito o solo a una categoría (IDCategoria)
      - Monto mínimo de compra alcanzado
      - Garantía de que el descuento jamás deja el total por debajo de Q0.00
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento
(
    @IDCarrito   INT,
    @CodigoCupon NVARCHAR(40),
    @IDUsuario   INT = NULL
)
RETURNS @Resultado TABLE
(
    EsValido                BIT            NOT NULL,
    CodigoError             INT            NOT NULL,
    MensajeValidacion       NVARCHAR(250)  NOT NULL,
    IDCupon                 INT            NULL,
    Codigo                  NVARCHAR(40)   NULL,
    TipoDescuento           NVARCHAR(20)   NULL,
    ValorDescuento          DECIMAL(12, 2) NULL,
    IDCategoriaRestringida  INT            NULL,
    SubtotalCarrito         DECIMAL(12, 2) NOT NULL,
    SubtotalElegible        DECIMAL(12, 2) NOT NULL,
    MontoDescuento          DECIMAL(12, 2) NOT NULL,
    TotalConDescuento       DECIMAL(12, 2) NOT NULL
)
AS
BEGIN
    DECLARE @Ahora               DATETIME2(3)   = SYSDATETIME();
    DECLARE @SubtotalCarrito     DECIMAL(12, 2) = 0.00;
    DECLARE @SubtotalElegible    DECIMAL(12, 2) = 0.00;
    DECLARE @IDCupon             INT            = NULL;
    DECLARE @CodigoNormalizado   NVARCHAR(40)   = UPPER(LTRIM(RTRIM(ISNULL(@CodigoCupon, N''))));
    DECLARE @TipoDescuento       NVARCHAR(20);
    DECLARE @ValorDescuento      DECIMAL(12, 2);
    DECLARE @IDCategoriaCupon    INT;
    DECLARE @MontoMinimoCompra   DECIMAL(12, 2);
    DECLARE @LimiteUsoTotal      INT;
    DECLARE @LimiteUsoPorCliente INT;
    DECLARE @UsosActuales        INT;
    DECLARE @FechaInicio         DATETIME2(3);
    DECLARE @FechaFin            DATETIME2(3);
    DECLARE @Activo              BIT;
    DECLARE @UsosCliente         INT            = 0;
    DECLARE @MontoDescuento      DECIMAL(12, 2) = 0.00;

    -- 1. Calcular subtotal actual del carrito con precios vigentes exactos
    SELECT
        @SubtotalCarrito = ISNULL(SUM(CAST(ci.Cantidad AS DECIMAL(12, 2)) * v.Precio), 0.00)
    FROM dbo.CarritoItems AS ci
    INNER JOIN dbo.Variantes AS v
        ON v.IDVariante = ci.IDVariante
    WHERE ci.IDCarrito = @IDCarrito;

    -- 2. Buscar el cupón por código
    SELECT
        @IDCupon             = c.IDCupon,
        @TipoDescuento       = c.TipoDescuento,
        @ValorDescuento      = c.ValorDescuento,
        @IDCategoriaCupon    = c.IDCategoria,
        @MontoMinimoCompra   = c.MontoMinimoCompra,
        @LimiteUsoTotal      = c.LimiteUsoTotal,
        @LimiteUsoPorCliente = c.LimiteUsoPorCliente,
        @UsosActuales        = c.UsosActuales,
        @FechaInicio         = c.FechaInicio,
        @FechaFin            = c.FechaFin,
        @Activo              = c.Activo
    FROM dbo.Cupones AS c
    WHERE UPPER(c.Codigo) = @CodigoNormalizado;

    IF @IDCupon IS NULL OR @Activo = 0
    BEGIN
        INSERT INTO @Resultado
        VALUES (0, 50030, N'El cupón ingresado no existe o se encuentra inactivo.', NULL, @CodigoNormalizado, NULL, NULL, NULL, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
        RETURN;
    END

    -- 3. Validar vigencia de fechas
    IF @Ahora < @FechaInicio
    BEGIN
        INSERT INTO @Resultado
        VALUES (0, 50031, N'El cupón ingresado aún no ha iniciado su periodo de vigencia.', @IDCupon, @CodigoNormalizado, @TipoDescuento, @ValorDescuento, @IDCategoriaCupon, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
        RETURN;
    END

    IF @Ahora > @FechaFin
    BEGIN
        INSERT INTO @Resultado
        VALUES (0, 50031, N'El cupón ingresado se encuentra vencido.', @IDCupon, @CodigoNormalizado, @TipoDescuento, @ValorDescuento, @IDCategoriaCupon, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
        RETURN;
    END

    -- 4. Validar límite total de usos
    IF @UsosActuales >= @LimiteUsoTotal
    BEGIN
        INSERT INTO @Resultado
        VALUES (0, 50032, N'El cupón ingresado se encuentra agotado (alcanzó su límite máximo de usos).', @IDCupon, @CodigoNormalizado, @TipoDescuento, @ValorDescuento, @IDCategoriaCupon, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
        RETURN;
    END

    -- 5. Validar límite de usos por cliente (si se conoce el usuario)
    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @UsosCliente = COUNT(1)
        FROM dbo.UsosCupon AS uc
        WHERE uc.IDCupon = @IDCupon
          AND uc.IDUsuario = @IDUsuario
          AND uc.Activo = 1;

        IF @UsosCliente >= @LimiteUsoPorCliente
        BEGIN
            INSERT INTO @Resultado
            VALUES (0, 50033, N'Has alcanzado el límite máximo de usos permitidos por cliente para este cupón.', @IDCupon, @CodigoNormalizado, @TipoDescuento, @ValorDescuento, @IDCategoriaCupon, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
            RETURN;
        END
    END

    -- 6. Calcular el subtotal elegible (todo el carrito o solo la categoría restringida)
    SELECT
        @SubtotalElegible = ISNULL(SUM(CAST(ci.Cantidad AS DECIMAL(12, 2)) * v.Precio), 0.00)
    FROM dbo.CarritoItems AS ci
    INNER JOIN dbo.Variantes AS v
        ON v.IDVariante = ci.IDVariante
    INNER JOIN dbo.Productos AS p
        ON p.IDProducto = v.IDProducto
    WHERE ci.IDCarrito = @IDCarrito
      AND (@IDCategoriaCupon IS NULL OR p.IDCategoria = @IDCategoriaCupon);

    IF @SubtotalElegible <= 0.00
    BEGIN
        INSERT INTO @Resultado
        VALUES (0, 50034, N'El carrito no contiene productos pertenecientes a la categoría aplicable para este cupón.', @IDCupon, @CodigoNormalizado, @TipoDescuento, @ValorDescuento, @IDCategoriaCupon, @SubtotalCarrito, 0.00, 0.00, @SubtotalCarrito);
        RETURN;
    END

    -- 7. Validar monto mínimo de compra sobre el subtotal elegible
    IF @SubtotalElegible < @MontoMinimoCompra
    BEGIN
        INSERT INTO @Resultado
        VALUES (
            0,
            50034,
            CONCAT(N'No se cumple el monto mínimo de compra requerido para el cupón (Mínimo requerido: Q', FORMAT(@MontoMinimoCompra, N'N2'), N'; Subtotal elegible actual: Q', FORMAT(@SubtotalElegible, N'N2'), N').'),
            @IDCupon,
            @CodigoNormalizado,
            @TipoDescuento,
            @ValorDescuento,
            @IDCategoriaCupon,
            @SubtotalCarrito,
            @SubtotalElegible,
            0.00,
            @SubtotalCarrito
        );
        RETURN;
    END

    -- 8. Calcular monto de descuento exacto en DECIMAL(12,2) sin errores de redondeo
    IF @TipoDescuento = N'PORCENTAJE'
    BEGIN
        SET @MontoDescuento = CAST(ROUND(@SubtotalElegible * (@ValorDescuento / 100.00), 2) AS DECIMAL(12, 2));
    END
    ELSE
    BEGIN
        SET @MontoDescuento = @ValorDescuento;
    END

    -- Regla RF-05: Un descuento nunca deja el total del pedido por debajo de cero (ni supera el subtotal elegible)
    IF @MontoDescuento > @SubtotalElegible
        SET @MontoDescuento = @SubtotalElegible;

    IF @MontoDescuento > @SubtotalCarrito
        SET @MontoDescuento = @SubtotalCarrito;

    INSERT INTO @Resultado
    VALUES (
        1,
        0,
        N'Cupón aplicado correctamente.',
        @IDCupon,
        @CodigoNormalizado,
        @TipoDescuento,
        @ValorDescuento,
        @IDCategoriaCupon,
        @SubtotalCarrito,
        @SubtotalElegible,
        @MontoDescuento,
        CAST(@SubtotalCarrito - @MontoDescuento AS DECIMAL(12, 2))
    );

    RETURN;
END
GO

/* ============================================================================
   3. FUNCIÓN TIPO TABLA: dbo.FU_Carrito_ResumenTotales
      Calcula el resumen financiero exacto de un carrito (Subtotal, Descuento,
      IVA incluido del 12% y Total en Quetzales) sin errores de redondeo (RF-04).
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.FU_Carrito_ResumenTotales
(
    @IDCarrito INT,
    @IDUsuario INT = NULL
)
RETURNS @Resumen TABLE
(
    IDCarrito               INT            NOT NULL,
    CantidadItemsDistintos  INT            NOT NULL,
    CantidadTotalUnidades   INT            NOT NULL,
    Subtotal                DECIMAL(12, 2) NOT NULL,
    IDCupon                 INT            NULL,
    CodigoCupon             NVARCHAR(40)   NULL,
    CuponEsValido           BIT            NOT NULL,
    MensajeCupon            NVARCHAR(250)  NULL,
    MontoDescuento          DECIMAL(12, 2) NOT NULL,
    PorcentajeIVA           DECIMAL(5, 2)  NOT NULL,
    SubtotalSinIVA          DECIMAL(12, 2) NOT NULL,
    MontoIVAIncluido        DECIMAL(12, 2) NOT NULL,
    Total                   DECIMAL(12, 2) NOT NULL
)
AS
BEGIN
    DECLARE @ItemsDistintos   INT            = 0;
    DECLARE @TotalUnidades    INT            = 0;
    DECLARE @Subtotal         DECIMAL(12, 2) = 0.00;
    DECLARE @IDCuponCarrito   INT            = NULL;
    DECLARE @CodigoCupon      NVARCHAR(40)   = NULL;
    DECLARE @UsuarioTitular   INT            = @IDUsuario;
    DECLARE @CuponValido      BIT            = 0;
    DECLARE @MensajeCupon     NVARCHAR(250)  = NULL;
    DECLARE @MontoDescuento   DECIMAL(12, 2) = 0.00;
    DECLARE @Total            DECIMAL(12, 2) = 0.00;
    DECLARE @MontoIVAIncluido DECIMAL(12, 2) = 0.00;

    SELECT
        @IDCuponCarrito = c.IDCupon,
        @UsuarioTitular = ISNULL(@IDUsuario, c.IDUsuario)
    FROM dbo.Carritos AS c
    WHERE c.IDCarrito = @IDCarrito;

    SELECT
        @ItemsDistintos = COUNT(ci.IDCarritoItem),
        @TotalUnidades  = ISNULL(SUM(ci.Cantidad), 0),
        @Subtotal       = ISNULL(SUM(CAST(ci.Cantidad AS DECIMAL(12, 2)) * v.Precio), 0.00)
    FROM dbo.CarritoItems AS ci
    INNER JOIN dbo.Variantes AS v
        ON v.IDVariante = ci.IDVariante
    WHERE ci.IDCarrito = @IDCarrito;

    IF @IDCuponCarrito IS NOT NULL AND @Subtotal > 0.00
    BEGIN
        SELECT @CodigoCupon = Codigo
        FROM dbo.Cupones
        WHERE IDCupon = @IDCuponCarrito;

        SELECT
            @CuponValido    = calc.EsValido,
            @MensajeCupon   = calc.MensajeValidacion,
            @MontoDescuento = CASE WHEN calc.EsValido = 1 THEN calc.MontoDescuento ELSE 0.00 END
        FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @CodigoCupon, @UsuarioTitular) AS calc;
    END

    SET @Total = CASE
        WHEN @Subtotal - @MontoDescuento > 0.00 THEN CAST(@Subtotal - @MontoDescuento AS DECIMAL(12, 2))
        ELSE 0.00
    END;

    SET @MontoIVAIncluido = CAST(@Total - ROUND(@Total / 1.12, 2) AS DECIMAL(12, 2));

    INSERT INTO @Resumen
    VALUES (
        @IDCarrito,
        @ItemsDistintos,
        @TotalUnidades,
        @Subtotal,
        @IDCuponCarrito,
        @CodigoCupon,
        @CuponValido,
        @MensajeCupon,
        @MontoDescuento,
        12.00,
        CAST(@Total - @MontoIVAIncluido AS DECIMAL(12, 2)),
        @MontoIVAIncluido,
        @Total
    );

    RETURN;
END
GO

/* ============================================================================
   4. FUNCIÓN TIPO TABLA: dbo.FU_Dashboard_TopProductosPeriodo (RF-08)
      Retorna los N (por defecto 10) productos más vendidos de un periodo,
      excluyendo pedidos cancelados y descontando las unidades e importes
      de devoluciones parciales o totales.
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.FU_Dashboard_TopProductosPeriodo
(
    @FechaInicio DATETIME2(3),
    @FechaFin    DATETIME2(3),
    @TopN        INT = 10
)
RETURNS TABLE
AS
RETURN
(
    SELECT TOP (@TopN)
        pr.IDProducto,
        pr.Nombre AS NombreProducto,
        cat.IDCategoria,
        cat.Nombre AS NombreCategoria,
        COUNT(DISTINCT ped.IDPedido) AS TotalPedidosConProducto,
        SUM(dp.CantidadComprada) AS UnidadesBrutasVendidas,
        SUM(dp.CantidadDevuelta) AS UnidadesDevueltas,
        SUM(dp.CantidadComprada - dp.CantidadDevuelta) AS UnidadesNetasVendidas,
        CAST(SUM(dp.TotalLineaNeto) AS DECIMAL(12, 2)) AS MontoBrutoVendidoGTQ,
        CAST(
            SUM(
                CASE
                    WHEN dp.CantidadDevuelta > 0 AND dp.CantidadComprada > 0
                        THEN ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * dp.CantidadDevuelta, 2)
                    ELSE 0.00
                END
            ) AS DECIMAL(12, 2)
        ) AS MontoDevueltoGTQ,
        CAST(
            SUM(
                dp.TotalLineaNeto -
                CASE
                    WHEN dp.CantidadDevuelta > 0 AND dp.CantidadComprada > 0
                        THEN ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * dp.CantidadDevuelta, 2)
                    ELSE 0.00
                END
            ) AS DECIMAL(12, 2)
        ) AS MontoNetoVendidoGTQ
    FROM dbo.DetallePedidos AS dp
    INNER JOIN dbo.Pedidos AS ped
        ON ped.IDPedido = dp.IDPedido
    INNER JOIN dbo.Variantes AS v
        ON v.IDVariante = dp.IDVariante
    INNER JOIN dbo.Productos AS pr
        ON pr.IDProducto = v.IDProducto
    INNER JOIN dbo.Categorias AS cat
        ON cat.IDCategoria = pr.IDCategoria
    WHERE ped.EstadoPedido <> N'Cancelado'
      AND ped.FechaCreacion >= @FechaInicio
      AND ped.FechaCreacion <= @FechaFin
    GROUP BY
        pr.IDProducto,
        pr.Nombre,
        cat.IDCategoria,
        cat.Nombre
    HAVING SUM(dp.CantidadComprada - dp.CantidadDevuelta) > 0
    ORDER BY
        UnidadesNetasVendidas DESC,
        MontoNetoVendidoGTQ DESC
);
GO

/* ============================================================================
   5. VISTA: dbo.VW_Inventario_ExistenciaDisponible (RF-03)
      Expone la existencia física, unidades reservadas vigentes, existencia
      disponible real y la suma de movimientos del Kardex (para verificar el
      criterio de aceptación: "La existencia actual coincide con la suma de
      movimientos del kardex").
   ============================================================================ */
CREATE OR ALTER VIEW dbo.VW_Inventario_ExistenciaDisponible
AS
SELECT
    v.IDVariante,
    v.SKU,
    v.NombreVariante,
    v.Precio,
    v.Activa AS VarianteActiva,
    p.IDProducto,
    p.Nombre AS NombreProducto,
    p.Marca,
    p.Activo AS ProductoActivo,
    c.IDCategoria,
    c.Nombre AS NombreCategoria,
    attr.AtributosTexto,
    v.ExistenciaFisica,
    ISNULL(res.UnidadesReservadas, 0) AS ExistenciaReservada,
    CASE
        WHEN v.ExistenciaFisica - ISNULL(res.UnidadesReservadas, 0) > 0
            THEN v.ExistenciaFisica - ISNULL(res.UnidadesReservadas, 0)
        ELSE 0
    END AS ExistenciaDisponible,
    ISNULL(kdx.SumaMovimientosKardex, 0) AS SumaMovimientosKardex,
    CASE
        WHEN v.ExistenciaFisica = ISNULL(kdx.SumaMovimientosKardex, 0) THEN CAST(1 AS BIT)
        ELSE CAST(0 AS BIT)
    END AS CuadraConKardex,
    v.FechaModificacion
FROM dbo.Variantes AS v
INNER JOIN dbo.Productos AS p
    ON p.IDProducto = v.IDProducto
INNER JOIN dbo.Categorias AS c
    ON c.IDCategoria = p.IDCategoria
OUTER APPLY
(
    SELECT SUM(r.CantidadReservada) AS UnidadesReservadas
    FROM dbo.ReservasExistencia AS r
    WHERE r.IDVariante = v.IDVariante
      AND r.EstadoReserva = N'ACTIVA'
      AND r.FechaExpiracion > SYSDATETIME()
) AS res
OUTER APPLY
(
    SELECT SUM(mk.Cantidad) AS SumaMovimientosKardex
    FROM dbo.MovimientosKardex AS mk
    WHERE mk.IDVariante = v.IDVariante
) AS kdx
OUTER APPLY
(
    SELECT STRING_AGG(CONCAT(a.Nombre, N': ', va.Valor), N' | ') WITHIN GROUP (ORDER BY a.IDAtributo ASC) AS AtributosTexto
    FROM dbo.VarianteValoresAtributo AS vva
    INNER JOIN dbo.Atributos AS a
        ON a.IDAtributo = vva.IDAtributo
    INNER JOIN dbo.ValoresAtributo AS va
        ON va.IDValorAtributo = vva.IDValorAtributo
    WHERE vva.IDVariante = v.IDVariante
) AS attr;
GO

/* ============================================================================
   6. VISTA: dbo.VW_Inventario_Kardex (RF-03)
      Historial completo y trazable de entradas, salidas, devoluciones y
      ajustes de inventario por variante.
   ============================================================================ */
CREATE OR ALTER VIEW dbo.VW_Inventario_Kardex
AS
SELECT
    mk.IDMovimientoKardex,
    mk.FechaMovimiento,
    mk.TipoMovimiento,
    mk.Cantidad,
    mk.SaldoAnterior,
    mk.SaldoPosterior,
    mk.Motivo,
    v.IDVariante,
    v.SKU,
    v.NombreVariante,
    p.IDProducto,
    p.Nombre AS NombreProducto,
    c.IDCategoria,
    c.Nombre AS NombreCategoria,
    u.IDUsuario,
    u.NombreCompleto AS NombreUsuario,
    u.Correo AS CorreoUsuario,
    r.NombreRol AS RolUsuario,
    mk.IDPedido,
    ped.NumeroPedido,
    mk.IDDevolucion
FROM dbo.MovimientosKardex AS mk
INNER JOIN dbo.Variantes AS v
    ON v.IDVariante = mk.IDVariante
INNER JOIN dbo.Productos AS p
    ON p.IDProducto = v.IDProducto
INNER JOIN dbo.Categorias AS c
    ON c.IDCategoria = p.IDCategoria
INNER JOIN dbo.Usuarios AS u
    ON u.IDUsuario = mk.IDUsuario
INNER JOIN dbo.Roles AS r
    ON r.IDRol = u.IDRol
LEFT JOIN dbo.Pedidos AS ped
    ON ped.IDPedido = mk.IDPedido;
GO

/* ============================================================================
   7. VISTA: dbo.VW_Pedidos_Historial (Ejemplo explícito Pág. 10)
      Resumen integral de pedidos con cliente, cupón, montos congelados,
      devoluciones acumuladas y monto neto efectivo.
   ============================================================================ */
CREATE OR ALTER VIEW dbo.VW_Pedidos_Historial
AS
SELECT
    ped.IDPedido,
    ped.NumeroPedido,
    ped.IDUsuario,
    u.NombreCompleto AS NombreCliente,
    u.Correo AS CorreoCliente,
    ped.IDDireccionEntrega,
    ped.IDCupon,
    ped.CodigoCuponSnapshot,
    ped.EstadoPedido,
    ped.Subtotal,
    ped.MontoDescuento,
    ped.PorcentajeIVA,
    ped.MontoIVAIncluido,
    ped.Total AS TotalPagado,
    ped.MontoReintegradoAcumulado,
    CAST(ped.Total - ped.MontoReintegradoAcumulado AS DECIMAL(12, 2)) AS TotalNetoEfectivo,
    ISNULL(det.TotalLineas, 0) AS TotalLineas,
    ISNULL(det.TotalUnidadesCompradas, 0) AS TotalUnidadesCompradas,
    ISNULL(det.TotalUnidadesDevueltas, 0) AS TotalUnidadesDevueltas,
    ped.MetodoPago,
    ped.ReferenciaPago,
    ped.DireccionEntregaSnapshot,
    ped.FechaCreacion,
    ped.FechaModificacion
FROM dbo.Pedidos AS ped
INNER JOIN dbo.Usuarios AS u
    ON u.IDUsuario = ped.IDUsuario
OUTER APPLY
(
    SELECT
        COUNT(dp.IDDetallePedido) AS TotalLineas,
        SUM(dp.CantidadComprada) AS TotalUnidadesCompradas,
        SUM(dp.CantidadDevuelta) AS TotalUnidadesDevueltas
    FROM dbo.DetallePedidos AS dp
    WHERE dp.IDPedido = ped.IDPedido
) AS det;
GO

/* ============================================================================
   8. VISTA: dbo.VW_Dashboard_VentasPorCategoria (Ejemplo explícito Pág. 10)
      Agrega ventas por categoría y fecha para pedidos completados (excluyendo
      cancelados y descontando devoluciones, según criterio de RF-08).
   ============================================================================ */
CREATE OR ALTER VIEW dbo.VW_Dashboard_VentasPorCategoria
AS
SELECT
    cat.IDCategoria,
    cat.Nombre AS NombreCategoria,
    CAST(ped.FechaCreacion AS DATE) AS FechaVenta,
    COUNT(DISTINCT ped.IDPedido) AS CantidadPedidos,
    SUM(dp.CantidadComprada) AS UnidadesCompradas,
    SUM(dp.CantidadDevuelta) AS UnidadesDevueltas,
    SUM(dp.CantidadComprada - dp.CantidadDevuelta) AS UnidadesNetasVendidas,
    CAST(SUM(dp.SubtotalLinea) AS DECIMAL(12, 2)) AS VentasBrutasGTQ,
    CAST(SUM(dp.DescuentoProporcionalLinea) AS DECIMAL(12, 2)) AS DescuentosGTQ,
    CAST(
        SUM(
            CASE
                WHEN dp.CantidadDevuelta > 0 AND dp.CantidadComprada > 0
                    THEN ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * dp.CantidadDevuelta, 2)
                ELSE 0.00
            END
        ) AS DECIMAL(12, 2)
    ) AS DevolucionesGTQ,
    CAST(
        SUM(
            dp.TotalLineaNeto -
            CASE
                WHEN dp.CantidadDevuelta > 0 AND dp.CantidadComprada > 0
                    THEN ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * dp.CantidadDevuelta, 2)
                ELSE 0.00
            END
        ) AS DECIMAL(12, 2)
    ) AS VentasNetasGTQ
FROM dbo.DetallePedidos AS dp
INNER JOIN dbo.Pedidos AS ped
    ON ped.IDPedido = dp.IDPedido
INNER JOIN dbo.Variantes AS v
    ON v.IDVariante = dp.IDVariante
INNER JOIN dbo.Productos AS pr
    ON pr.IDProducto = v.IDProducto
INNER JOIN dbo.Categorias AS cat
    ON cat.IDCategoria = pr.IDCategoria
WHERE ped.EstadoPedido <> N'Cancelado'
GROUP BY
    cat.IDCategoria,
    cat.Nombre,
    CAST(ped.FechaCreacion AS DATE);
GO

/* ============================================================================
   9. VISTA: dbo.VW_Dashboard_CarritosAbandonados (Glosario / Página 3 / RF-08)
      Identifica en tiempo real los carritos activos con productos que superan
      el periodo configurable de inactividad (MINUTOS_CARRITO_ABANDONADO).
   ============================================================================ */
CREATE OR ALTER VIEW dbo.VW_Dashboard_CarritosAbandonados
AS
SELECT
    c.IDCarrito,
    c.IDUsuario,
    ISNULL(u.NombreCompleto, N'Visitante (Carrito de Invitado)') AS NombreCliente,
    u.Correo AS CorreoCliente,
    c.TokenInvitado,
    c.FechaCreacion,
    c.FechaUltimaActividad,
    DATEDIFF(MINUTE, c.FechaUltimaActividad, SYSDATETIME()) AS MinutosInactividad,
    items.CantidadItemsDistintos,
    items.CantidadTotalUnidades,
    items.MontoPotencialGTQ
FROM dbo.Carritos AS c
LEFT JOIN dbo.Usuarios AS u
    ON u.IDUsuario = c.IDUsuario
CROSS APPLY
(
    SELECT
        COUNT(ci.IDCarritoItem) AS CantidadItemsDistintos,
        SUM(ci.Cantidad) AS CantidadTotalUnidades,
        CAST(SUM(CAST(ci.Cantidad AS DECIMAL(12, 2)) * v.Precio) AS DECIMAL(12, 2)) AS MontoPotencialGTQ
    FROM dbo.CarritoItems AS ci
    INNER JOIN dbo.Variantes AS v
        ON v.IDVariante = ci.IDVariante
    WHERE ci.IDCarrito = c.IDCarrito
    HAVING COUNT(ci.IDCarritoItem) > 0
) AS items
WHERE c.EstadoCarrito = N'ACTIVO'
  AND DATEDIFF(MINUTE, c.FechaUltimaActividad, SYSDATETIME()) >= ISNULL(
      (
          SELECT TRY_CAST(cfg.Valor AS INT)
          FROM dbo.ConfiguracionSistema AS cfg
          WHERE cfg.Clave = N'MINUTOS_CARRITO_ABANDONADO'
      ),
      120
  );
GO

PRINT N'05_Functions_And_Views.sql ejecutado correctamente.';
GO
