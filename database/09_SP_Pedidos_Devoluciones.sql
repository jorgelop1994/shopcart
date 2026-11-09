/* ============================================================================
   Script: 09_SP_Pedidos_Devoluciones.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Procedimientos almacenados de los módulos RF-06 (Checkout y
                pago atómico e idempotente con SP_Pedidos_CrearPedido) y
                RF-07 (Gestión de pedidos, máquina de estados en BD,
                cancelaciones y devoluciones totales/parciales por línea).
   Estándar de Nomenclatura: SP_Modulo_Proceso
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ============================================================================
   1. SP_Pedidos_ObtenerDetalle
      Obtiene un pedido con sus líneas, historial de estados y devoluciones.
      Valida estrictamente que un Cliente solo pueda ver sus propios pedidos
      (Criterio de Aceptación RF-01: anti-IDOR).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerDetalle
    @IDPedido          INT,
    @IDUsuarioEjecutor INT,
    @RolEjecutor       NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDPropietario INT;

    SELECT @IDPropietario = p.IDUsuario
    FROM dbo.Pedidos AS p
    WHERE p.IDPedido = @IDPedido;

    IF @IDPropietario IS NULL
        THROW 50002, N'El pedido solicitado no existe.', 1;

    IF @RolEjecutor = N'Cliente' AND @IDPropietario <> @IDUsuarioEjecutor
        THROW 50004, N'Acceso denegado: no tiene permiso para consultar pedidos de otro cliente.', 1;

    SELECT
        vh.IDPedido,
        vh.NumeroPedido,
        vh.IDUsuario,
        vh.NombreCliente,
        vh.CorreoCliente,
        vh.IDDireccionEntrega,
        vh.IDCupon,
        vh.CodigoCuponSnapshot,
        vh.EstadoPedido,
        vh.Subtotal,
        vh.MontoDescuento,
        vh.PorcentajeIVA,
        vh.MontoIVAIncluido,
        vh.TotalPagado AS Total,
        vh.MontoReintegradoAcumulado,
        vh.TotalNetoEfectivo,
        vh.TotalLineas,
        vh.TotalUnidadesCompradas,
        vh.TotalUnidadesDevueltas,
        vh.MetodoPago,
        vh.ReferenciaPago,
        vh.DireccionEntregaSnapshot,
        vh.FechaCreacion,
        vh.FechaModificacion,
        (
            SELECT
                dp.IDDetallePedido,
                dp.IDVariante,
                v.IDProducto,
                dp.SKUSnapshot,
                dp.NombreProductoSnapshot,
                dp.CantidadComprada,
                dp.CantidadDevuelta,
                (dp.CantidadComprada - dp.CantidadDevuelta) AS CantidadDisponibleDevolver,
                dp.PrecioUnitarioCongelado,
                dp.SubtotalLinea,
                dp.DescuentoProporcionalLinea,
                dp.TotalLineaNeto
            FROM dbo.DetallePedidos AS dp
            INNER JOIN dbo.Variantes AS v
                ON v.IDVariante = dp.IDVariante
            WHERE dp.IDPedido = vh.IDPedido
            ORDER BY dp.IDDetallePedido ASC
            FOR JSON PATH
        ) AS LineasJSON,
        (
            SELECT
                hep.IDHistorialEstadoPedido,
                hep.IDUsuario,
                u.NombreCompleto AS NombreUsuario,
                r.NombreRol AS RolUsuario,
                hep.EstadoAnterior,
                hep.EstadoNuevo,
                hep.MotivoComentario,
                hep.FechaCambio
            FROM dbo.HistorialEstadosPedido AS hep
            INNER JOIN dbo.Usuarios AS u
                ON u.IDUsuario = hep.IDUsuario
            INNER JOIN dbo.Roles AS r
                ON r.IDRol = u.IDRol
            WHERE hep.IDPedido = vh.IDPedido
            ORDER BY hep.FechaCambio ASC, hep.IDHistorialEstadoPedido ASC
            FOR JSON PATH
        ) AS HistorialEstadosJSON,
        (
            SELECT
                dev.IDDevolucion,
                dev.TipoDevolucion,
                dev.MotivoDevolucion,
                dev.MontoTotalReintegrado,
                dev.FechaDevolucion,
                uDev.NombreCompleto AS RegistradaPor,
                (
                    SELECT
                        ddev.IDDetalleDevolucion,
                        ddev.IDDetallePedido,
                        ddev.IDVariante,
                        ddev.CantidadDevuelta,
                        ddev.MontoReintegradoLinea
                    FROM dbo.DetalleDevoluciones AS ddev
                    WHERE ddev.IDDevolucion = dev.IDDevolucion
                    FOR JSON PATH
                ) AS LineasDevolucion
            FROM dbo.Devoluciones AS dev
            INNER JOIN dbo.Usuarios AS uDev
                ON uDev.IDUsuario = dev.IDUsuarioRegistra
            WHERE dev.IDPedido = vh.IDPedido
            ORDER BY dev.FechaDevolucion ASC
            FOR JSON PATH
        ) AS DevolucionesJSON
    FROM dbo.VW_Pedidos_Historial AS vh
    WHERE vh.IDPedido = @IDPedido;
END
GO

/* ============================================================================
   2. SP_Pedidos_CrearPedido (Nombre exacto requerido en Página 10)
      Criterios de Aceptación RF-06:
      - Si dos clientes intentan comprar la última unidad al mismo tiempo, solo
        uno lo logra y el otro recibe un mensaje claro. Nunca hay sobreventa.
      - Repetir la misma solicitud de pago (doble clic o reintento por falla de
        red) no genera dos pedidos ni dos cobros (Idempotencia por ClaveIdempotencia).
      - La creación del pedido es atómica: pedido, detalle con precios congelados,
        movimientos de inventario en el Kardex y uso de cupón se guardan juntos
        o no se guarda nada.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDUsuario          INT,
    @IDCarrito          INT,
    @IDDireccionEntrega INT,
    @TokenReserva       NVARCHAR(64),
    @ClaveIdempotencia  NVARCHAR(100),
    @MetodoPago         NVARCHAR(40)  = N'TARJETA_CREDITO',
    @ReferenciaPago     NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ClaveIdempNorm NVARCHAR(100) = LTRIM(RTRIM(ISNULL(@ClaveIdempotencia, N'')));
    DECLARE @TokenResNorm   NVARCHAR(64)  = LTRIM(RTRIM(ISNULL(@TokenReserva, N'')));

    IF LEN(@ClaveIdempNorm) < 5
        THROW 50001, N'La clave de idempotencia (ClaveIdempotencia) es obligatoria para procesar el pago.', 1;

    IF LEN(@TokenResNorm) < 5
        THROW 50001, N'El token de reserva de existencia (TokenReserva) es obligatorio.', 1;

    -- 1. Verificación de Idempotencia: si ya se procesó esta ClaveIdempotencia, devolver el pedido existente sin cobrar ni descontar de nuevo
    DECLARE @IDPedidoExistente INT = NULL;
    DECLARE @IDUsuarioPedidoExistente INT = NULL;

    SELECT
        @IDPedidoExistente        = p.IDPedido,
        @IDUsuarioPedidoExistente = p.IDUsuario
    FROM dbo.Pedidos AS p
    WHERE p.ClaveIdempotencia = @ClaveIdempNorm;

    IF @IDPedidoExistente IS NOT NULL
    BEGIN
        IF @IDUsuarioPedidoExistente <> @IDUsuario
            THROW 50004, N'La clave de idempotencia pertenece a otro cliente.', 1;

        EXEC dbo.SP_Pedidos_ObtenerDetalle
            @IDPedido          = @IDPedidoExistente,
            @IDUsuarioEjecutor = @IDUsuario,
            @RolEjecutor       = N'Cliente';
        RETURN;
    END

    -- 2. Validar propiedad de Dirección y Carrito (Anti-IDOR RF-01)
    DECLARE @DireccionSnapshot NVARCHAR(MAX);
    DECLARE @PropietarioDireccion INT;
    DECLARE @DireccionActiva BIT;

    SELECT
        @PropietarioDireccion = d.IDUsuario,
        @DireccionActiva      = d.Activa,
        @DireccionSnapshot    = (
            SELECT
                d.IDDireccion,
                d.Alias,
                d.NombreReceptor,
                d.TelefonoContacto,
                d.Departamento,
                d.Municipio,
                d.DireccionExacta,
                d.Referencias
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
    FROM dbo.Direcciones AS d
    WHERE d.IDDireccion = @IDDireccionEntrega;

    IF @PropietarioDireccion IS NULL OR @DireccionActiva = 0
        THROW 50002, N'La dirección de entrega seleccionada no existe o fue eliminada.', 1;

    IF @PropietarioDireccion <> @IDUsuario
        THROW 50004, N'Acceso denegado: no puede utilizar una dirección de entrega que pertenece a otro cliente.', 1;

    DECLARE @Ahora          DATETIME2(3) = SYSDATETIME();
    DECLARE @IDPedidoNuevo  INT;
    DECLARE @NumeroPedido   NVARCHAR(30);
    DECLARE @IDCuponCarrito INT = NULL;
    DECLARE @CodigoCupon    NVARCHAR(40) = NULL;
    DECLARE @IDCatCupon     INT = NULL;
    DECLARE @Subtotal       DECIMAL(12, 2) = 0.00;
    DECLARE @MontoDescuento DECIMAL(12, 2) = 0.00;
    DECLARE @Total          DECIMAL(12, 2) = 0.00;
    DECLARE @MontoIVA       DECIMAL(12, 2) = 0.00;

    BEGIN TRAN;

        -- 3. Bloquear el carrito y verificar que siga ACTIVO y pertenezca al cliente
        DECLARE @PropietarioCarrito INT;
        DECLARE @EstadoCarrito      NVARCHAR(20);

        SELECT
            @PropietarioCarrito = c.IDUsuario,
            @EstadoCarrito      = c.EstadoCarrito,
            @IDCuponCarrito     = c.IDCupon
        FROM dbo.Carritos AS c WITH (UPDLOCK, HOLDLOCK)
        WHERE c.IDCarrito = @IDCarrito;

        IF @EstadoCarrito IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'El carrito especificado no existe.', 1;
        END

        IF @PropietarioCarrito IS NULL OR @PropietarioCarrito <> @IDUsuario
        BEGIN
            ROLLBACK TRAN;
            THROW 50004, N'Acceso denegado: no puede procesar el carrito de otro cliente.', 1;
        END

        -- Re-verificar idempotencia dentro del bloqueo por si 2 hilos simultáneos entraron al mismo milisegundo
        SELECT @IDPedidoExistente = p.IDPedido
        FROM dbo.Pedidos AS p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.ClaveIdempotencia = @ClaveIdempNorm
          AND p.IDUsuario = @IDUsuario;

        IF @IDPedidoExistente IS NOT NULL
        BEGIN
            COMMIT TRAN;
            EXEC dbo.SP_Pedidos_ObtenerDetalle
                @IDPedido          = @IDPedidoExistente,
                @IDUsuarioEjecutor = @IDUsuario,
                @RolEjecutor       = N'Cliente';
            RETURN;
        END

        IF @EstadoCarrito <> N'ACTIVO'
        BEGIN
            ROLLBACK TRAN;
            THROW 50021, N'El carrito ya fue convertido en pedido anteriormente.', 1;
        END

        -- 4. Verificar que la reserva de existencia de 15 minutos siga vigente para este carrito y token
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.ReservasExistencia AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.TokenReserva = @TokenResNorm
              AND r.IDCarrito = @IDCarrito
              AND r.IDUsuario = @IDUsuario
              AND r.EstadoReserva = N'ACTIVA'
              AND r.FechaExpiracion > @Ahora
        )
        BEGIN
            UPDATE dbo.ReservasExistencia
            SET EstadoReserva   = N'EXPIRADA',
                FechaResolucion = @Ahora
            WHERE TokenReserva = @TokenResNorm
              AND EstadoReserva = N'ACTIVA'
              AND FechaExpiracion <= @Ahora;

            COMMIT TRAN;
            THROW 50022, N'La reserva de existencia de 15 minutos ha expirado o no es válida. Por favor confirme nuevamente su compra.', 1;
        END

        -- 5. Bloquear las variantes del carrito en orden ascendente de IDVariante (prevención de deadlocks y sobreventa)
        DECLARE @LineasCompra TABLE
        (
            IDVariante                 INT            NOT NULL PRIMARY KEY,
            IDProducto                 INT            NOT NULL,
            IDCategoria                INT            NOT NULL,
            SKU                        NVARCHAR(60)   NOT NULL,
            NombreProductoSnapshot     NVARCHAR(200)  NOT NULL,
            Cantidad                   INT            NOT NULL,
            ExistenciaFisicaActual     INT            NOT NULL,
            PrecioUnitarioCongelado    DECIMAL(12, 2) NOT NULL,
            SubtotalLinea              DECIMAL(12, 2) NOT NULL,
            EsElegibleCupon            BIT            NOT NULL DEFAULT (0),
            DescuentoProporcionalLinea DECIMAL(12, 2) NOT NULL DEFAULT (0.00),
            TotalLineaNeto             DECIMAL(12, 2) NOT NULL DEFAULT (0.00)
        );

        INSERT INTO @LineasCompra
        (
            IDVariante,
            IDProducto,
            IDCategoria,
            SKU,
            NombreProductoSnapshot,
            Cantidad,
            ExistenciaFisicaActual,
            PrecioUnitarioCongelado,
            SubtotalLinea
        )
        SELECT
            v.IDVariante,
            p.IDProducto,
            p.IDCategoria,
            v.SKU,
            CONCAT(p.Nombre, N' - ', v.NombreVariante),
            ci.Cantidad,
            v.ExistenciaFisica,
            v.Precio,
            CAST(CAST(ci.Cantidad AS DECIMAL(12, 2)) * v.Precio AS DECIMAL(12, 2))
        FROM dbo.CarritoItems AS ci
        INNER JOIN dbo.Variantes AS v WITH (UPDLOCK, HOLDLOCK)
            ON v.IDVariante = ci.IDVariante
        INNER JOIN dbo.Productos AS p
            ON p.IDProducto = v.IDProducto
        WHERE ci.IDCarrito = @IDCarrito
        ORDER BY v.IDVariante ASC;

        IF NOT EXISTS (SELECT 1 FROM @LineasCompra)
        BEGIN
            ROLLBACK TRAN;
            THROW 50001, N'El carrito no contiene productos para procesar el pedido.', 1;
        END

        -- Validar que todas las líneas coincidan con la reserva activa y tengan stock físico suficiente
        IF EXISTS (
            SELECT 1
            FROM @LineasCompra AS lc
            LEFT JOIN dbo.ReservasExistencia AS r
                ON r.TokenReserva = @TokenResNorm
               AND r.IDVariante = lc.IDVariante
               AND r.EstadoReserva = N'ACTIVA'
               AND r.FechaExpiracion > @Ahora
            WHERE lc.Cantidad > lc.ExistenciaFisicaActual
               OR r.IDReservaExistencia IS NULL
               OR r.CantidadReservada < lc.Cantidad
        )
        BEGIN
            ROLLBACK TRAN;
            THROW 50021, N'La existencia disponible cambió o el carrito fue modificado después de iniciar la reserva. Por favor reintente el checkout.', 1;
        END

        SELECT @Subtotal = SUM(SubtotalLinea)
        FROM @LineasCompra;

        -- 6. Si el carrito tiene cupón, bloquear la fila del cupón (UPDLOCK, HOLDLOCK) y revalidar límites bajo concurrencia (RF-05)
        IF @IDCuponCarrito IS NOT NULL
        BEGIN
            SELECT
                @CodigoCupon = c.Codigo,
                @IDCatCupon  = c.IDCategoria
            FROM dbo.Cupones AS c WITH (UPDLOCK, HOLDLOCK)
            WHERE c.IDCupon = @IDCuponCarrito;

            DECLARE @CuponEsValido  BIT;
            DECLARE @CuponCodError  INT;
            DECLARE @CuponMsgError  NVARCHAR(250);
            DECLARE @SubElegible    DECIMAL(12, 2);

            SELECT
                @CuponEsValido  = calc.EsValido,
                @CuponCodError  = calc.CodigoError,
                @CuponMsgError  = calc.MensajeValidacion,
                @SubElegible    = calc.SubtotalElegible,
                @MontoDescuento = calc.MontoDescuento
            FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @CodigoCupon, @IDUsuario) AS calc;

            IF @CuponEsValido = 0
            BEGIN
                ROLLBACK TRAN;
                THROW @CuponCodError, @CuponMsgError, 1;
            END

            -- Marcar líneas elegibles y prorratear el descuento proporcionalmente sin errores de redondeo (DA-02)
            UPDATE @LineasCompra
            SET EsElegibleCupon = CASE
                WHEN @IDCatCupon IS NULL OR IDCategoria = @IDCatCupon THEN 1
                ELSE 0
            END;

            IF @MontoDescuento > 0.00 AND @SubElegible > 0.00
            BEGIN
                UPDATE @LineasCompra
                SET DescuentoProporcionalLinea = CAST(ROUND(@MontoDescuento * (SubtotalLinea / @SubElegible), 2) AS DECIMAL(12, 2))
                WHERE EsElegibleCupon = 1;

                -- Ajustar cualquier diferencia de centavos (ej. Q0.01) en la línea elegible de mayor valor
                DECLARE @SumaDescuentoLineas DECIMAL(12, 2);
                SELECT @SumaDescuentoLineas = ISNULL(SUM(DescuentoProporcionalLinea), 0.00)
                FROM @LineasCompra;

                DECLARE @DiferenciaCentavos DECIMAL(12, 2) = @MontoDescuento - @SumaDescuentoLineas;

                IF @DiferenciaCentavos <> 0.00
                BEGIN
                    DECLARE @IDVarianteAjuste INT;
                    SELECT TOP (1) @IDVarianteAjuste = IDVariante
                    FROM @LineasCompra
                    WHERE EsElegibleCupon = 1
                    ORDER BY SubtotalLinea DESC, IDVariante ASC;

                    UPDATE @LineasCompra
                    SET DescuentoProporcionalLinea = DescuentoProporcionalLinea + @DiferenciaCentavos
                    WHERE IDVariante = @IDVarianteAjuste;
                END
            END
        END

        UPDATE @LineasCompra
        SET TotalLineaNeto = SubtotalLinea - DescuentoProporcionalLinea;

        SET @Total = CASE
            WHEN @Subtotal - @MontoDescuento > 0.00 THEN CAST(@Subtotal - @MontoDescuento AS DECIMAL(12, 2))
            ELSE 0.00
        END;

        SET @MontoIVA = CAST(@Total - ROUND(@Total / 1.12, 2) AS DECIMAL(12, 2));

        -- 7. Insertar cabecera de Pedido
        SET @NumeroPedido = CONCAT(
            N'ORD-',
            FORMAT(@Ahora, N'yyyyMMdd'),
            N'-',
            UPPER(LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 6))
        );

        INSERT INTO dbo.Pedidos
        (
            NumeroPedido,
            IDUsuario,
            IDDireccionEntrega,
            IDCarritoOrigen,
            IDCupon,
            CodigoCuponSnapshot,
            ClaveIdempotencia,
            TokenReservaUtilizado,
            EstadoPedido,
            Subtotal,
            MontoDescuento,
            PorcentajeIVA,
            MontoIVAIncluido,
            Total,
            MontoReintegradoAcumulado,
            DireccionEntregaSnapshot,
            MetodoPago,
            ReferenciaPago,
            FechaCreacion,
            FechaModificacion
        )
        VALUES
        (
            @NumeroPedido,
            @IDUsuario,
            @IDDireccionEntrega,
            @IDCarrito,
            @IDCuponCarrito,
            @CodigoCupon,
            @ClaveIdempNorm,
            @TokenResNorm,
            N'Pagado',
            @Subtotal,
            @MontoDescuento,
            12.00,
            @MontoIVA,
            @Total,
            0.00,
            @DireccionSnapshot,
            UPPER(LTRIM(RTRIM(ISNULL(@MetodoPago, N'TARJETA_CREDITO')))),
            ISNULL(NULLIF(LTRIM(RTRIM(@ReferenciaPago)), N''), CONCAT(N'AUTH-', UPPER(LEFT(CONVERT(NVARCHAR(36), NEWID()), 8)))),
            @Ahora,
            @Ahora
        );

        SET @IDPedidoNuevo = SCOPE_IDENTITY();

        -- Actualizar NumeroPedido con el ID secuencial para que sea 100% legible y único
        SET @NumeroPedido = CONCAT(N'ORD-', FORMAT(@Ahora, N'yyyyMMdd'), N'-', RIGHT(CONCAT(N'00000', CAST(@IDPedidoNuevo AS NVARCHAR(10))), 5));

        UPDATE dbo.Pedidos
        SET NumeroPedido = @NumeroPedido
        WHERE IDPedido = @IDPedidoNuevo;

        -- 8. Insertar detalle del pedido con precios y descuentos congelados
        INSERT INTO dbo.DetallePedidos
        (
            IDPedido,
            IDVariante,
            SKUSnapshot,
            NombreProductoSnapshot,
            CantidadComprada,
            CantidadDevuelta,
            PrecioUnitarioCongelado,
            SubtotalLinea,
            DescuentoProporcionalLinea,
            TotalLineaNeto
        )
        SELECT
            @IDPedidoNuevo,
            lc.IDVariante,
            lc.SKU,
            lc.NombreProductoSnapshot,
            lc.Cantidad,
            0,
            lc.PrecioUnitarioCongelado,
            lc.SubtotalLinea,
            lc.DescuentoProporcionalLinea,
            lc.TotalLineaNeto
        FROM @LineasCompra AS lc
        ORDER BY lc.IDVariante ASC;

        -- 9. Descontar existencia física en Variantes y registrar salidas en el Kardex (RF-03 y RF-06)
        UPDATE v
        SET v.ExistenciaFisica  = v.ExistenciaFisica - lc.Cantidad,
            v.FechaModificacion = @Ahora
        FROM dbo.Variantes AS v
        INNER JOIN @LineasCompra AS lc
            ON lc.IDVariante = v.IDVariante;

        INSERT INTO dbo.MovimientosKardex
        (
            IDVariante,
            IDUsuario,
            IDPedido,
            IDDevolucion,
            TipoMovimiento,
            Cantidad,
            SaldoAnterior,
            SaldoPosterior,
            Motivo,
            FechaMovimiento
        )
        SELECT
            lc.IDVariante,
            @IDUsuario,
            @IDPedidoNuevo,
            NULL,
            N'SALIDA_VENTA',
            -lc.Cantidad,
            lc.ExistenciaFisicaActual,
            lc.ExistenciaFisicaActual - lc.Cantidad,
            CONCAT(N'Salida por venta confirmada en pedido ', @NumeroPedido),
            @Ahora
        FROM @LineasCompra AS lc
        ORDER BY lc.IDVariante ASC;

        -- 10. Consumir reserva y convertir carrito
        UPDATE dbo.ReservasExistencia
        SET EstadoReserva   = N'CONSUMIDA',
            FechaResolucion = @Ahora
        WHERE TokenReserva = @TokenResNorm
          AND IDCarrito = @IDCarrito
          AND EstadoReserva = N'ACTIVA';

        UPDATE dbo.Carritos
        SET EstadoCarrito        = N'CONVERTIDO',
            FechaUltimaActividad = @Ahora
        WHERE IDCarrito = @IDCarrito;

        -- 11. Registrar uso del cupón si aplica
        IF @IDCuponCarrito IS NOT NULL
        BEGIN
            UPDATE dbo.Cupones
            SET UsosActuales      = UsosActuales + 1,
                FechaModificacion = @Ahora
            WHERE IDCupon = @IDCuponCarrito;

            INSERT INTO dbo.UsosCupon
            (
                IDCupon,
                IDUsuario,
                IDPedido,
                MontoDescuentoAplicado,
                Activo,
                FechaUso
            )
            VALUES
            (
                @IDCuponCarrito,
                @IDUsuario,
                @IDPedidoNuevo,
                @MontoDescuento,
                1,
                @Ahora
            );
        END

        -- 12. Registrar historial inicial de estado del pedido y Bitácora (RF-07 y RF-09)
        INSERT INTO dbo.HistorialEstadosPedido
        (
            IDPedido,
            IDUsuario,
            EstadoAnterior,
            EstadoNuevo,
            MotivoComentario,
            FechaCambio
        )
        VALUES
        (
            @IDPedidoNuevo,
            @IDUsuario,
            NULL,
            N'Pagado',
            N'Pedido creado y pago confirmado exitosamente.',
            @Ahora
        );

        INSERT INTO dbo.Bitacora
        (
            IDUsuario,
            Modulo,
            Entidad,
            IDEntidad,
            Accion,
            ValorAnterior,
            ValorNuevo,
            FechaHora
        )
        VALUES
        (
            @IDUsuario,
            N'PEDIDOS',
            N'Pedidos',
            CAST(@IDPedidoNuevo AS NVARCHAR(60)),
            N'CREACION',
            NULL,
            CONCAT(
                N'{"IDPedido":', @IDPedidoNuevo,
                N',"NumeroPedido":"', @NumeroPedido,
                N'","EstadoPedido":"Pagado","Total":', FORMAT(@Total, N'0.00'), N'}'
            ),
            @Ahora
        );

    COMMIT TRAN;

    EXEC dbo.SP_Pedidos_ObtenerDetalle
        @IDPedido          = @IDPedidoNuevo,
        @IDUsuarioEjecutor = @IDUsuario,
        @RolEjecutor       = N'Cliente';
END
GO

/* ============================================================================
   3. SP_Pedidos_Listar
      Listado de pedidos con paginación y filtros del lado del servidor por
      estado, cliente y rango de fechas (RF-07 y RF-08).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @IDUsuarioEjecutor INT,
    @RolEjecutor       NVARCHAR(30),
    @Pagina            INT           = 1,
    @TamanoPagina      INT           = 15,
    @EstadoPedido      NVARCHAR(30)  = NULL,
    @IDUsuarioFiltro   INT           = NULL,
    @FechaInicio       DATETIME2(3)  = NULL,
    @FechaFin          DATETIME2(3)  = NULL,
    @Busqueda          NVARCHAR(100) = NULL,
    @OrdenarPor        NVARCHAR(30)  = N'recientes'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 15;

    -- Si quien consulta es un Cliente, forzar que solo vea sus propios pedidos (RF-01)
    IF @RolEjecutor = N'Cliente'
        SET @IDUsuarioFiltro = @IDUsuarioEjecutor;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH PedidosFiltrados AS
    (
        SELECT
            vh.*,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.VW_Pedidos_Historial AS vh
        WHERE (@IDUsuarioFiltro IS NULL OR vh.IDUsuario = @IDUsuarioFiltro)
          AND (@EstadoPedido IS NULL OR vh.EstadoPedido = @EstadoPedido)
          AND (@FechaInicio IS NULL OR vh.FechaCreacion >= @FechaInicio)
          AND (@FechaFin IS NULL OR vh.FechaCreacion <= @FechaFin)
          AND (
              @FiltroBusqueda IS NULL
              OR vh.NumeroPedido LIKE N'%' + @FiltroBusqueda + N'%'
              OR vh.NombreCliente LIKE N'%' + @FiltroBusqueda + N'%'
              OR vh.CorreoCliente LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT *
    FROM PedidosFiltrados
    ORDER BY
        CASE WHEN @OrdenarPor = N'antiguos'   THEN FechaCreacion END ASC,
        CASE WHEN @OrdenarPor = N'total_desc' THEN TotalPagado END DESC,
        CASE WHEN @OrdenarPor = N'total_asc'  THEN TotalPagado END ASC,
        CASE WHEN @OrdenarPor = N'estado_asc' THEN EstadoPedido END ASC,
        FechaCreacion DESC,
        IDPedido DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   4. SP_Pedidos_CambiarEstado
      Avanza un pedido de estado o lo cancela, validando la transición en la
      tabla TransicionesEstadoPedido.
      Criterios de Aceptación RF-07:
      - Una transición de estado no permitida se rechaza en el backend y en la BD.
      - Un pedido puede cancelarse mientras no haya sido despachado.
      - Cancelar reintegra la existencia mediante movimientos en el Kardex y se
        refleja en los reportes.
      - Cada cambio de estado registra usuario, fecha y hora, estado anterior y nuevo.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDPedido          INT,
    @IDUsuarioEjecutor INT,
    @RolEjecutor       NVARCHAR(30),
    @EstadoNuevo       NVARCHAR(30),
    @MotivoComentario  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Ahora           DATETIME2(3) = SYSDATETIME();
    DECLARE @IDPropietario   INT;
    DECLARE @EstadoActual    NVARCHAR(30);
    DECLARE @NumeroPedido    NVARCHAR(30);
    DECLARE @IDCuponAplicado INT;

    BEGIN TRAN;

        SELECT
            @IDPropietario   = p.IDUsuario,
            @EstadoActual    = p.EstadoPedido,
            @NumeroPedido    = p.NumeroPedido,
            @IDCuponAplicado = p.IDCupon
        FROM dbo.Pedidos AS p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.IDPedido = @IDPedido;

        IF @EstadoActual IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'El pedido especificado no existe.', 1;
        END

        -- Validación anti-IDOR si el ejecutor es Cliente
        IF @RolEjecutor = N'Cliente' AND @IDPropietario <> @IDUsuarioEjecutor
        BEGIN
            ROLLBACK TRAN;
            THROW 50004, N'Acceso denegado: no puede modificar un pedido de otro cliente.', 1;
        END

        -- Las devoluciones deben procesarse mediante SP_Pedidos_RegistrarDevolucion para especificar las líneas
        IF @EstadoNuevo IN (N'DevueltoParcial', N'DevueltoTotal')
        BEGIN
            ROLLBACK TRAN;
            THROW 50040, N'Para pasar un pedido a estado devuelto debe utilizar el proceso de registro de devolución por línea.', 1;
        END

        -- Validar en la tabla de la Máquina de Estados si la transición y el rol están permitidos
        DECLARE @PermiteCliente       BIT = 0;
        DECLARE @PermiteOperador      BIT = 0;
        DECLARE @PermiteAdministrador BIT = 0;
        DECLARE @TransicionExiste     BIT = 0;

        SELECT
            @TransicionExiste     = 1,
            @PermiteCliente       = t.PermiteCliente,
            @PermiteOperador      = t.PermiteOperador,
            @PermiteAdministrador = t.PermiteAdministrador
        FROM dbo.TransicionesEstadoPedido AS t
        WHERE t.EstadoOrigen = @EstadoActual
          AND t.EstadoDestino = @EstadoNuevo;

        IF @TransicionExiste = 0
        BEGIN
            ROLLBACK TRAN;
            DECLARE @MsgTransicion NVARCHAR(250) = CONCAT(
                N'Transición de estado no permitida en la base de datos: no se puede pasar de "',
                @EstadoActual, N'" a "', @EstadoNuevo, N'".'
            );
            THROW 50040, @MsgTransicion, 1;
        END

        IF (@RolEjecutor = N'Cliente' AND @PermiteCliente = 0)
           OR (@RolEjecutor = N'Operador' AND @PermiteOperador = 0)
           OR (@RolEjecutor = N'Administrador' AND @PermiteAdministrador = 0)
        BEGIN
            ROLLBACK TRAN;
            THROW 50004, N'Su rol de usuario no tiene permiso para ejecutar esta transición de estado.', 1;
        END

        -- Si el nuevo estado es Cancelado (pre-despacho), reintegrar las unidades al inventario y registrar en el Kardex
        IF @EstadoNuevo = N'Cancelado'
        BEGIN
            DECLARE @LineasReintegro TABLE
            (
                IDVariante             INT NOT NULL PRIMARY KEY,
                CantidadAReintegrar    INT NOT NULL,
                ExistenciaFisicaActual INT NOT NULL
            );

            INSERT INTO @LineasReintegro (IDVariante, CantidadAReintegrar, ExistenciaFisicaActual)
            SELECT
                v.IDVariante,
                (dp.CantidadComprada - dp.CantidadDevuelta),
                v.ExistenciaFisica
            FROM dbo.DetallePedidos AS dp
            INNER JOIN dbo.Variantes AS v WITH (UPDLOCK, HOLDLOCK)
                ON v.IDVariante = dp.IDVariante
            WHERE dp.IDPedido = @IDPedido
              AND (dp.CantidadComprada - dp.CantidadDevuelta) > 0
            ORDER BY v.IDVariante ASC;

            UPDATE v
            SET v.ExistenciaFisica  = v.ExistenciaFisica + lr.CantidadAReintegrar,
                v.FechaModificacion = @Ahora
            FROM dbo.Variantes AS v
            INNER JOIN @LineasReintegro AS lr
                ON lr.IDVariante = v.IDVariante;

            INSERT INTO dbo.MovimientosKardex
            (
                IDVariante,
                IDUsuario,
                IDPedido,
                IDDevolucion,
                TipoMovimiento,
                Cantidad,
                SaldoAnterior,
                SaldoPosterior,
                Motivo,
                FechaMovimiento
            )
            SELECT
                lr.IDVariante,
                @IDUsuarioEjecutor,
                @IDPedido,
                NULL,
                N'REINGRESO_CANCELACION',
                lr.CantidadAReintegrar,
                lr.ExistenciaFisicaActual,
                lr.ExistenciaFisicaActual + lr.CantidadAReintegrar,
                CONCAT(N'Reingreso de existencia por cancelación del pedido ', @NumeroPedido),
                @Ahora
            FROM @LineasReintegro AS lr
            ORDER BY lr.IDVariante ASC;

            -- Si el pedido utilizó un cupón, liberar ese uso para no penalizar al cliente (DA-03)
            IF @IDCuponAplicado IS NOT NULL
            BEGIN
                UPDATE dbo.UsosCupon
                SET Activo = 0
                WHERE IDPedido = @IDPedido
                  AND Activo = 1;

                IF @@ROWCOUNT > 0
                BEGIN
                    UPDATE dbo.Cupones
                    SET UsosActuales      = CASE WHEN UsosActuales > 0 THEN UsosActuales - 1 ELSE 0 END,
                        FechaModificacion = @Ahora
                    WHERE IDCupon = @IDCuponAplicado;
                END
            END
        END

        -- Actualizar estado en Pedidos
        UPDATE dbo.Pedidos
        SET EstadoPedido      = @EstadoNuevo,
            FechaModificacion = @Ahora
        WHERE IDPedido = @IDPedido;

        -- Registrar en HistorialEstadosPedido y en Bitacora (RF-07 y RF-09)
        INSERT INTO dbo.HistorialEstadosPedido
        (
            IDPedido,
            IDUsuario,
            EstadoAnterior,
            EstadoNuevo,
            MotivoComentario,
            FechaCambio
        )
        VALUES
        (
            @IDPedido,
            @IDUsuarioEjecutor,
            @EstadoActual,
            @EstadoNuevo,
            ISNULL(NULLIF(LTRIM(RTRIM(@MotivoComentario)), N''), CONCAT(N'Cambio de estado de ', @EstadoActual, N' a ', @EstadoNuevo)),
            @Ahora
        );

        INSERT INTO dbo.Bitacora
        (
            IDUsuario,
            Modulo,
            Entidad,
            IDEntidad,
            Accion,
            ValorAnterior,
            ValorNuevo,
            FechaHora
        )
        VALUES
        (
            @IDUsuarioEjecutor,
            N'PEDIDOS',
            N'Pedidos',
            CAST(@IDPedido AS NVARCHAR(60)),
            N'CAMBIO_ESTADO_PEDIDO',
            CONCAT(N'{"IDPedido":', @IDPedido, N',"NumeroPedido":"', @NumeroPedido, N'","EstadoPedido":"', @EstadoActual, N'"}'),
            CONCAT(N'{"IDPedido":', @IDPedido, N',"NumeroPedido":"', @NumeroPedido, N'","EstadoPedido":"', @EstadoNuevo, N'"}'),
            @Ahora
        );

    COMMIT TRAN;

    EXEC dbo.SP_Pedidos_ObtenerDetalle
        @IDPedido          = @IDPedido,
        @IDUsuarioEjecutor = @IDUsuarioEjecutor,
        @RolEjecutor       = @RolEjecutor;
END
GO

/* ============================================================================
   5. SP_Pedidos_RegistrarDevolucion
      Procesa devoluciones totales o parciales por línea de pedido (RF-07).
      Criterios de Aceptación:
      - No se puede devolver más cantidad de la vendida en cada línea del pedido.
      - Devolver reintegra la existencia mediante movimientos en el Kardex y se
        refleja en los reportes.
      - Cada cambio de estado registra usuario, fecha y hora, estado anterior y nuevo.
      Formato esperado de @LineasDevolucionJSON:
      [{"idDetallePedido": 1, "cantidadADevolver": 2}]
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_RegistrarDevolucion
    @IDPedido             INT,
    @IDUsuarioEjecutor    INT,
    @MotivoDevolucion     NVARCHAR(300),
    @LineasDevolucionJSON NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MotivoNorm NVARCHAR(300) = LTRIM(RTRIM(ISNULL(@MotivoDevolucion, N'')));

    IF LEN(@MotivoNorm) < 3
        THROW 50001, N'Debe especificar un motivo válido para la devolución (mínimo 3 caracteres).', 1;

    IF @LineasDevolucionJSON IS NULL OR ISJSON(@LineasDevolucionJSON) = 0
        THROW 50001, N'Debe proporcionar las líneas y cantidades a devolver en formato JSON válido.', 1;

    DECLARE @Ahora        DATETIME2(3) = SYSDATETIME();
    DECLARE @EstadoActual NVARCHAR(30);
    DECLARE @NumeroPedido NVARCHAR(30);
    DECLARE @EstadoNuevo  NVARCHAR(30);
    DECLARE @TipoDev      NVARCHAR(20);
    DECLARE @IDDevolucion INT;

    BEGIN TRAN;

        SELECT
            @EstadoActual = p.EstadoPedido,
            @NumeroPedido = p.NumeroPedido
        FROM dbo.Pedidos AS p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.IDPedido = @IDPedido;

        IF @EstadoActual IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'El pedido especificado no existe.', 1;
        END

        IF @EstadoActual NOT IN (N'Entregado', N'DevueltoParcial')
        BEGIN
            ROLLBACK TRAN;
            THROW 50040, N'Solo se pueden registrar devoluciones sobre pedidos que ya han sido entregados.', 1;
        END

        DECLARE @Solicitudes TABLE
        (
            IDDetallePedido   INT NOT NULL PRIMARY KEY,
            CantidadADevolver INT NOT NULL
        );

        INSERT INTO @Solicitudes (IDDetallePedido, CantidadADevolver)
        SELECT
            IDDetallePedido,
            SUM(CantidadADevolver)
        FROM OPENJSON(@LineasDevolucionJSON)
        WITH (
            IDDetallePedido   INT N'$.idDetallePedido',
            CantidadADevolver INT N'$.cantidadADevolver'
        )
        WHERE IDDetallePedido IS NOT NULL
        GROUP BY IDDetallePedido;

        IF NOT EXISTS (SELECT 1 FROM @Solicitudes)
        BEGIN
            ROLLBACK TRAN;
            THROW 50001, N'No se recibió ninguna línea de pedido para devolver.', 1;
        END

        IF EXISTS (SELECT 1 FROM @Solicitudes WHERE CantidadADevolver <= 0)
        BEGIN
            ROLLBACK TRAN;
            THROW 50001, N'La cantidad a devolver en cada línea debe ser mayor a cero.', 1;
        END

        -- Validar que todas las líneas pertenezcan al pedido
        IF EXISTS (
            SELECT 1
            FROM @Solicitudes AS s
            LEFT JOIN dbo.DetallePedidos AS dp WITH (UPDLOCK, HOLDLOCK)
                ON dp.IDDetallePedido = s.IDDetallePedido
               AND dp.IDPedido = @IDPedido
            WHERE dp.IDDetallePedido IS NULL
        )
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'Una o más líneas especificadas no pertenecen a este pedido.', 1;
        END

        -- Validar que en ninguna línea se devuelva más cantidad de la vendida disponible (RF-07)
        IF EXISTS (
            SELECT 1
            FROM @Solicitudes AS s
            INNER JOIN dbo.DetallePedidos AS dp
                ON dp.IDDetallePedido = s.IDDetallePedido
            WHERE dp.CantidadDevuelta + s.CantidadADevolver > dp.CantidadComprada
        )
        BEGIN
            ROLLBACK TRAN;
            THROW 50041, N'Operación rechazada: No se puede devolver más cantidad de la vendida en cada línea del pedido.', 1;
        END

        -- Calcular monto exacto a reintegrar por línea y bloquear Variantes en orden IDVariante ASC
        DECLARE @LineasProcesadas TABLE
        (
            IDDetallePedido        INT            NOT NULL PRIMARY KEY,
            IDVariante             INT            NOT NULL,
            CantidadADevolver      INT            NOT NULL,
            MontoReintegradoLinea  DECIMAL(12, 2) NOT NULL,
            ExistenciaFisicaActual INT            NOT NULL
        );

        INSERT INTO @LineasProcesadas
        (
            IDDetallePedido,
            IDVariante,
            CantidadADevolver,
            MontoReintegradoLinea,
            ExistenciaFisicaActual
        )
        SELECT
            dp.IDDetallePedido,
            dp.IDVariante,
            s.CantidadADevolver,
            CASE
                -- Si con esta devolución se devuelve el 100% de la línea, reintegrar el saldo exacto restante de TotalLineaNeto
                WHEN dp.CantidadDevuelta + s.CantidadADevolver = dp.CantidadComprada
                    THEN CAST(
                        dp.TotalLineaNeto - ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * dp.CantidadDevuelta, 2)
                        AS DECIMAL(12, 2)
                    )
                ELSE
                    CAST(ROUND((dp.TotalLineaNeto / dp.CantidadComprada) * s.CantidadADevolver, 2) AS DECIMAL(12, 2))
            END,
            v.ExistenciaFisica
        FROM @Solicitudes AS s
        INNER JOIN dbo.DetallePedidos AS dp
            ON dp.IDDetallePedido = s.IDDetallePedido
        INNER JOIN dbo.Variantes AS v WITH (UPDLOCK, HOLDLOCK)
            ON v.IDVariante = dp.IDVariante
        ORDER BY v.IDVariante ASC;

        DECLARE @MontoTotalDevolucion DECIMAL(12, 2);
        SELECT @MontoTotalDevolucion = SUM(MontoReintegradoLinea)
        FROM @LineasProcesadas;

        -- Actualizar CantidadDevuelta en DetallePedidos
        UPDATE dp
        SET dp.CantidadDevuelta = dp.CantidadDevuelta + lp.CantidadADevolver
        FROM dbo.DetallePedidos AS dp
        INNER JOIN @LineasProcesadas AS lp
            ON lp.IDDetallePedido = dp.IDDetallePedido;

        -- Determinar si el pedido quedó DevueltoTotal o DevueltoParcial
        IF EXISTS (
            SELECT 1
            FROM dbo.DetallePedidos
            WHERE IDPedido = @IDPedido
              AND CantidadDevuelta < CantidadComprada
        )
        BEGIN
            SET @EstadoNuevo = N'DevueltoParcial';
            SET @TipoDev     = N'PARCIAL';
        END
        ELSE
        BEGIN
            SET @EstadoNuevo = N'DevueltoTotal';
            SET @TipoDev     = N'TOTAL';
        END

        -- Insertar cabecera y detalle de Devolución
        INSERT INTO dbo.Devoluciones
        (
            IDPedido,
            IDUsuarioRegistra,
            TipoDevolucion,
            MotivoDevolucion,
            MontoTotalReintegrado,
            FechaDevolucion
        )
        VALUES
        (
            @IDPedido,
            @IDUsuarioEjecutor,
            @TipoDev,
            @MotivoNorm,
            @MontoTotalDevolucion,
            @Ahora
        );

        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT INTO dbo.DetalleDevoluciones
        (
            IDDevolucion,
            IDDetallePedido,
            IDVariante,
            CantidadDevuelta,
            MontoReintegradoLinea
        )
        SELECT
            @IDDevolucion,
            lp.IDDetallePedido,
            lp.IDVariante,
            lp.CantidadADevolver,
            lp.MontoReintegradoLinea
        FROM @LineasProcesadas AS lp
        ORDER BY lp.IDDetallePedido ASC;

        -- Reintegrar existencias físicas en Variantes y registrar en MovimientosKardex (RF-03 y RF-07)
        UPDATE v
        SET v.ExistenciaFisica  = v.ExistenciaFisica + lp.CantidadADevolver,
            v.FechaModificacion = @Ahora
        FROM dbo.Variantes AS v
        INNER JOIN @LineasProcesadas AS lp
            ON lp.IDVariante = v.IDVariante;

        INSERT INTO dbo.MovimientosKardex
        (
            IDVariante,
            IDUsuario,
            IDPedido,
            IDDevolucion,
            TipoMovimiento,
            Cantidad,
            SaldoAnterior,
            SaldoPosterior,
            Motivo,
            FechaMovimiento
        )
        SELECT
            lp.IDVariante,
            @IDUsuarioEjecutor,
            @IDPedido,
            @IDDevolucion,
            N'DEVOLUCION_CLIENTE',
            lp.CantidadADevolver,
            lp.ExistenciaFisicaActual,
            lp.ExistenciaFisicaActual + lp.CantidadADevolver,
            CONCAT(N'Reingreso por devolución ', @TipoDev, N' en pedido ', @NumeroPedido, N': ', @MotivoNorm),
            @Ahora
        FROM @LineasProcesadas AS lp
        ORDER BY lp.IDVariante ASC;

        -- Actualizar estado y monto reintegrado acumulado en Pedidos
        UPDATE dbo.Pedidos
        SET EstadoPedido              = @EstadoNuevo,
            MontoReintegradoAcumulado = CASE
                WHEN MontoReintegradoAcumulado + @MontoTotalDevolucion <= Total
                    THEN MontoReintegradoAcumulado + @MontoTotalDevolucion
                ELSE Total
            END,
            FechaModificacion         = @Ahora
        WHERE IDPedido = @IDPedido;

        -- Registrar cambio de estado en HistorialEstadosPedido y Bitacora
        INSERT INTO dbo.HistorialEstadosPedido
        (
            IDPedido,
            IDUsuario,
            EstadoAnterior,
            EstadoNuevo,
            MotivoComentario,
            FechaCambio
        )
        VALUES
        (
            @IDPedido,
            @IDUsuarioEjecutor,
            @EstadoActual,
            @EstadoNuevo,
            CONCAT(N'Devolución ', @TipoDev, N' registrada (Q', FORMAT(@MontoTotalDevolucion, N'N2'), N'): ', @MotivoNorm),
            @Ahora
        );

        INSERT INTO dbo.Bitacora
        (
            IDUsuario,
            Modulo,
            Entidad,
            IDEntidad,
            Accion,
            ValorAnterior,
            ValorNuevo,
            FechaHora
        )
        VALUES
        (
            @IDUsuarioEjecutor,
            N'PEDIDOS',
            N'Pedidos',
            CAST(@IDPedido AS NVARCHAR(60)),
            N'CAMBIO_ESTADO_PEDIDO',
            CONCAT(N'{"IDPedido":', @IDPedido, N',"EstadoPedido":"', @EstadoActual, N'"}'),
            CONCAT(N'{"IDPedido":', @IDPedido, N',"EstadoPedido":"', @EstadoNuevo, N'","IDDevolucion":', @IDDevolucion, N',"MontoReintegrado":', FORMAT(@MontoTotalDevolucion, N'0.00'), N'}'),
            @Ahora
        );

    COMMIT TRAN;

    EXEC dbo.SP_Pedidos_ObtenerDetalle
        @IDPedido          = @IDPedido,
        @IDUsuarioEjecutor = @IDUsuarioEjecutor,
        @RolEjecutor       = N'Operador';
END
GO

PRINT N'09_SP_Pedidos_Devoluciones.sql ejecutado correctamente.';
GO
