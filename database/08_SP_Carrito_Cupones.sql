/* ============================================================================
   Script: 08_SP_Carrito_Cupones.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Procedimientos almacenados de los módulos RF-04 (Carrito de
                compras de cliente y carrito de invitado) y RF-05 (Cupones y
                promociones de porcentaje o monto fijo).
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
   1. SP_Carrito_ObtenerDetalle
      Obtiene o crea el carrito activo para el @IDUsuario o @TokenInvitado,
      retornando sus ítems con existencia disponible y el resumen exacto
      de Subtotal, Descuentos, IVA 12% y Total en Quetzales (RF-04).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ObtenerDetalle
    @IDUsuario     INT           = NULL,
    @TokenInvitado NVARCHAR(100) = NULL,
    @IDCarrito     INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarritoResuelto INT = NULL;
    DECLARE @PropietarioActual INT = NULL;
    DECLARE @TokenActual       NVARCHAR(100) = NULL;

    IF @IDCarrito IS NOT NULL
    BEGIN
        SELECT
            @IDCarritoResuelto = c.IDCarrito,
            @PropietarioActual = c.IDUsuario,
            @TokenActual       = c.TokenInvitado
        FROM dbo.Carritos AS c
        WHERE c.IDCarrito = @IDCarrito;

        IF @IDCarritoResuelto IS NULL
            THROW 50002, N'El carrito solicitado no existe.', 1;

        -- Validación anti-IDOR: un cliente no puede consultar ni modificar el carrito de otro cliente
        IF @IDUsuario IS NOT NULL AND @PropietarioActual IS NOT NULL AND @PropietarioActual <> @IDUsuario
            THROW 50004, N'Acceso denegado: no puede consultar el carrito de otro cliente.', 1;

        IF @IDUsuario IS NULL AND @PropietarioActual IS NOT NULL
            THROW 50004, N'Acceso denegado: este carrito pertenece a un usuario autenticado.', 1;

        IF @IDUsuario IS NULL AND @TokenNorm IS NOT NULL AND @TokenActual <> @TokenNorm
            THROW 50004, N'Acceso denegado: el token de invitado no coincide con el carrito.', 1;
    END
    ELSE IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarritoResuelto = c.IDCarrito
        FROM dbo.Carritos AS c
        WHERE c.IDUsuario = @IDUsuario
          AND c.EstadoCarrito = N'ACTIVO';

        IF @IDCarritoResuelto IS NULL
        BEGIN
            INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado, EstadoCarrito)
            VALUES (@IDUsuario, NULL, N'ACTIVO');

            SET @IDCarritoResuelto = SCOPE_IDENTITY();
        END
    END
    ELSE IF @TokenNorm IS NOT NULL
    BEGIN
        SELECT @IDCarritoResuelto = c.IDCarrito
        FROM dbo.Carritos AS c
        WHERE c.TokenInvitado = @TokenNorm
          AND c.EstadoCarrito = N'ACTIVO';

        IF @IDCarritoResuelto IS NULL
        BEGIN
            INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado, EstadoCarrito)
            VALUES (NULL, @TokenNorm, N'ACTIVO');

            SET @IDCarritoResuelto = SCOPE_IDENTITY();
        END
    END
    ELSE
    BEGIN
        THROW 50001, N'Debe proporcionar IDUsuario o TokenInvitado para acceder al carrito.', 1;
    END

    SELECT
        r.IDCarrito,
        c.IDUsuario,
        c.TokenInvitado,
        c.EstadoCarrito,
        c.FechaCreacion,
        c.FechaUltimaActividad,
        r.CantidadItemsDistintos,
        r.CantidadTotalUnidades,
        r.Subtotal,
        r.IDCupon,
        r.CodigoCupon,
        r.CuponEsValido,
        r.MensajeCupon,
        r.MontoDescuento,
        r.PorcentajeIVA,
        r.SubtotalSinIVA,
        r.MontoIVAIncluido,
        r.Total,
        (
            SELECT
                ci.IDCarritoItem,
                ci.IDVariante,
                pv.IDProducto,
                pv.IDCategoria,
                pv.NombreProducto,
                pv.SKU,
                pv.NombreVariante,
                img.UrlImagen,
                ci.Cantidad,
                pv.PrecioVigente AS PrecioUnitario,
                CAST(CAST(ci.Cantidad AS DECIMAL(12, 2)) * pv.PrecioVigente AS DECIMAL(12, 2)) AS SubtotalLinea,
                pv.ExistenciaFisica,
                pv.ExistenciaReservada,
                pv.ExistenciaDisponible,
                pv.VarianteActiva,
                pv.ProductoActivo
            FROM dbo.CarritoItems AS ci
            INNER JOIN dbo.FU_Catalogo_PrecioVigente(NULL) AS pv
                ON pv.IDVariante = ci.IDVariante
            OUTER APPLY
            (
                SELECT TOP (1) pi.UrlImagen
                FROM dbo.ProductoImagenes AS pi
                WHERE pi.IDProducto = pv.IDProducto
                ORDER BY pi.EsPrincipal DESC, pi.Orden ASC
            ) AS img
            WHERE ci.IDCarrito = r.IDCarrito
            ORDER BY ci.IDCarritoItem ASC
            FOR JSON PATH
        ) AS ItemsJSON
    FROM dbo.FU_Carrito_ResumenTotales(@IDCarritoResuelto, @IDUsuario) AS r
    INNER JOIN dbo.Carritos AS c
        ON c.IDCarrito = r.IDCarrito;
END
GO

/* ============================================================================
   2. SP_Carrito_AgregarOModificarItem
      Agrega un producto/variante al carrito o reemplaza/incrementa su cantidad.
      Criterio de Aceptación RF-04:
      "No se puede agregar más cantidad que la existencia disponible."
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarOModificarItem
    @IDUsuario       INT           = NULL,
    @TokenInvitado   NVARCHAR(100) = NULL,
    @IDVariante      INT,
    @Cantidad        INT,
    @EsIncremento    BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad <= 0
        THROW 50001, N'La cantidad a agregar o establecer en el carrito debe ser mayor a cero.', 1;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarrito INT = NULL;
    DECLARE @CantidadActual INT = 0;
    DECLARE @CantidadFinal  INT = 0;
    DECLARE @ExistenciaDisponible INT = 0;
    DECLARE @VarianteActiva BIT = 0;
    DECLARE @ProductoActivo BIT = 0;
    DECLARE @NombreProducto NVARCHAR(150);
    DECLARE @NombreVariante NVARCHAR(150);

    IF @IDUsuario IS NULL AND @TokenNorm IS NULL
        THROW 50001, N'Se requiere IDUsuario o TokenInvitado para operar el carrito.', 1;

    BEGIN TRAN;

        -- 1. Obtener o crear el carrito activo del titular
        IF @IDUsuario IS NOT NULL
        BEGIN
            SELECT @IDCarrito = IDCarrito
            FROM dbo.Carritos WITH (UPDLOCK, HOLDLOCK)
            WHERE IDUsuario = @IDUsuario
              AND EstadoCarrito = N'ACTIVO';

            IF @IDCarrito IS NULL
            BEGIN
                INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado, EstadoCarrito)
                VALUES (@IDUsuario, NULL, N'ACTIVO');

                SET @IDCarrito = SCOPE_IDENTITY();
            END
        END
        ELSE
        BEGIN
            SELECT @IDCarrito = IDCarrito
            FROM dbo.Carritos WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenNorm
              AND EstadoCarrito = N'ACTIVO';

            IF @IDCarrito IS NULL
            BEGIN
                INSERT INTO dbo.Carritos (IDUsuario, TokenInvitado, EstadoCarrito)
                VALUES (NULL, @TokenNorm, N'ACTIVO');

                SET @IDCarrito = SCOPE_IDENTITY();
            END
        END

        -- 2. Consultar disponibilidad en tiempo real de la variante
        SELECT
            @ExistenciaDisponible = pv.ExistenciaDisponible,
            @VarianteActiva       = pv.VarianteActiva,
            @ProductoActivo       = pv.ProductoActivo,
            @NombreProducto       = pv.NombreProducto,
            @NombreVariante       = pv.NombreVariante
        FROM dbo.FU_Catalogo_PrecioVigente(@IDVariante) AS pv;

        IF @NombreProducto IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'La variante de producto solicitada no existe.', 1;
        END

        IF @VarianteActiva = 0 OR @ProductoActivo = 0
        BEGIN
            ROLLBACK TRAN;
            THROW 50021, N'El producto o variante seleccionada no se encuentra disponible para la venta.', 1;
        END

        SELECT @CantidadActual = ISNULL(Cantidad, 0)
        FROM dbo.CarritoItems WITH (UPDLOCK, HOLDLOCK)
        WHERE IDCarrito = @IDCarrito
          AND IDVariante = @IDVariante;

        SET @CantidadFinal = CASE
            WHEN @EsIncremento = 1 THEN @CantidadActual + @Cantidad
            ELSE @Cantidad
        END;

        IF @CantidadFinal > @ExistenciaDisponible
        BEGIN
            ROLLBACK TRAN;
            DECLARE @MensajeStock NVARCHAR(300) = CONCAT(
                N'No se puede agregar más cantidad que la existencia disponible para "',
                @NombreProducto, N' - ', @NombreVariante,
                N'" (Solicitado: ', @CantidadFinal, N', Disponible: ', @ExistenciaDisponible, N').'
            );
            THROW 50021, @MensajeStock, 1;
        END

        IF @CantidadActual > 0
        BEGIN
            UPDATE dbo.CarritoItems
            SET Cantidad = @CantidadFinal
            WHERE IDCarrito = @IDCarrito
              AND IDVariante = @IDVariante;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.CarritoItems (IDCarrito, IDVariante, Cantidad)
            VALUES (@IDCarrito, @IDVariante, @CantidadFinal);
        END

        UPDATE dbo.Carritos
        SET FechaUltimaActividad = SYSDATETIME()
        WHERE IDCarrito = @IDCarrito;

    COMMIT TRAN;

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario     = @IDUsuario,
        @TokenInvitado = @TokenNorm,
        @IDCarrito     = @IDCarrito;
END
GO

/* ============================================================================
   3. SP_Carrito_EliminarItem
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_EliminarItem
    @IDUsuario     INT           = NULL,
    @TokenInvitado NVARCHAR(100) = NULL,
    @IDVariante    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarrito INT = NULL;

    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE IDUsuario = @IDUsuario
          AND EstadoCarrito = N'ACTIVO';
    END
    ELSE IF @TokenNorm IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE TokenInvitado = @TokenNorm
          AND EstadoCarrito = N'ACTIVO';
    END

    IF @IDCarrito IS NULL
        THROW 50002, N'No se encontró un carrito activo.', 1;

    BEGIN TRAN;

        DELETE FROM dbo.CarritoItems
        WHERE IDCarrito = @IDCarrito
          AND IDVariante = @IDVariante;

        -- Si el carrito quedó vacío, limpiar cualquier cupón asociado
        IF NOT EXISTS (SELECT 1 FROM dbo.CarritoItems WHERE IDCarrito = @IDCarrito)
        BEGIN
            UPDATE dbo.Carritos
            SET IDCupon              = NULL,
                FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarrito;
        END
        ELSE
        BEGIN
            UPDATE dbo.Carritos
            SET FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarrito;
        END

    COMMIT TRAN;

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario     = @IDUsuario,
        @TokenInvitado = @TokenNorm,
        @IDCarrito     = @IDCarrito;
END
GO

/* ============================================================================
   4. SP_Carrito_Vaciar
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Vaciar
    @IDUsuario     INT           = NULL,
    @TokenInvitado NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarrito INT = NULL;

    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE IDUsuario = @IDUsuario
          AND EstadoCarrito = N'ACTIVO';
    END
    ELSE IF @TokenNorm IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE TokenInvitado = @TokenNorm
          AND EstadoCarrito = N'ACTIVO';
    END

    IF @IDCarrito IS NOT NULL
    BEGIN
        BEGIN TRAN;

            DELETE FROM dbo.CarritoItems
            WHERE IDCarrito = @IDCarrito;

            UPDATE dbo.ReservasExistencia
            SET EstadoReserva   = N'LIBERADA',
                FechaResolucion = SYSDATETIME()
            WHERE IDCarrito = @IDCarrito
              AND EstadoReserva = N'ACTIVA';

            UPDATE dbo.Carritos
            SET IDCupon              = NULL,
                FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarrito;

        COMMIT TRAN;
    END

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario     = @IDUsuario,
        @TokenInvitado = @TokenNorm;
END
GO

/* ============================================================================
   5. SP_Carrito_FusionarInvitado (Decisión Abierta DA-01)
      Transfiere los productos de un Carrito de Invitado (@TokenInvitado)
      hacia el carrito del cliente autenticado (@IDUsuario), respetando el
      tope de existencia disponible por cada variante.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_FusionarInvitado
    @IDUsuario     INT,
    @TokenInvitado NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarritoInvitado INT = NULL;
    DECLARE @IDCarritoCliente  INT = NULL;
    DECLARE @IDCuponInvitado   INT = NULL;

    IF @IDUsuario IS NULL OR @TokenNorm IS NULL
        THROW 50001, N'Se requieren tanto el IDUsuario como el TokenInvitado para fusionar el carrito.', 1;

    SELECT
        @IDCarritoInvitado = IDCarrito,
        @IDCuponInvitado   = IDCupon
    FROM dbo.Carritos
    WHERE TokenInvitado = @TokenNorm
      AND EstadoCarrito = N'ACTIVO';

    -- Si no existe carrito invitado activo, devolver el carrito del usuario tal cual
    IF @IDCarritoInvitado IS NULL
    BEGIN
        EXEC dbo.SP_Carrito_ObtenerDetalle @IDUsuario = @IDUsuario;
        RETURN;
    END

    BEGIN TRAN;

        SELECT @IDCarritoCliente = IDCarrito
        FROM dbo.Carritos WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario
          AND EstadoCarrito = N'ACTIVO';

        IF @IDCarritoCliente IS NULL
        BEGIN
            -- Si el usuario no tenía carrito activo, asignarle directamente el carrito invitado
            UPDATE dbo.Carritos
            SET IDUsuario            = @IDUsuario,
                TokenInvitado        = NULL,
                FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarritoInvitado;

            SET @IDCarritoCliente = @IDCarritoInvitado;
        END
        ELSE
        BEGIN
            -- Fusionar líneas del carrito invitado al carrito del cliente respetando la existencia disponible
            MERGE INTO dbo.CarritoItems AS Target
            USING (
                SELECT
                    ci.IDVariante,
                    ci.Cantidad,
                    pv.ExistenciaDisponible
                FROM dbo.CarritoItems AS ci
                INNER JOIN dbo.FU_Catalogo_PrecioVigente(NULL) AS pv
                    ON pv.IDVariante = ci.IDVariante
                WHERE ci.IDCarrito = @IDCarritoInvitado
                  AND pv.VarianteActiva = 1
                  AND pv.ProductoActivo = 1
                  AND pv.ExistenciaDisponible > 0
            ) AS Source
            ON Target.IDCarrito = @IDCarritoCliente
               AND Target.IDVariante = Source.IDVariante
            WHEN MATCHED THEN
                UPDATE SET Target.Cantidad = CASE
                    WHEN Target.Cantidad + Source.Cantidad <= Source.ExistenciaDisponible
                        THEN Target.Cantidad + Source.Cantidad
                    ELSE Source.ExistenciaDisponible
                END
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (IDCarrito, IDVariante, Cantidad)
                VALUES (
                    @IDCarritoCliente,
                    Source.IDVariante,
                    CASE
                        WHEN Source.Cantidad <= Source.ExistenciaDisponible THEN Source.Cantidad
                        ELSE Source.ExistenciaDisponible
                    END
                );

            UPDATE dbo.Carritos
            SET IDCupon              = ISNULL(IDCupon, @IDCuponInvitado),
                FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarritoCliente;

            DELETE FROM dbo.CarritoItems
            WHERE IDCarrito = @IDCarritoInvitado;

            UPDATE dbo.Carritos
            SET EstadoCarrito        = N'FUSIONADO',
                FechaUltimaActividad = SYSDATETIME()
            WHERE IDCarrito = @IDCarritoInvitado;
        END

    COMMIT TRAN;

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario = @IDUsuario,
        @IDCarrito = @IDCarritoCliente;
END
GO

/* ============================================================================
   6. SP_Carrito_AplicarCupon
      Valida y aplica un cupón al carrito (RF-05).
      Criterios de Aceptación:
      - Un cupón vencido, agotado o que no cumple el mínimo se rechaza con un
        mensaje específico.
      - Solo se permite un cupón por pedido/carrito.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AplicarCupon
    @IDUsuario     INT           = NULL,
    @TokenInvitado NVARCHAR(100) = NULL,
    @CodigoCupon   NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TokenNorm  NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @CodigoNorm NVARCHAR(40)  = UPPER(LTRIM(RTRIM(ISNULL(@CodigoCupon, N''))));
    DECLARE @IDCarrito  INT           = NULL;

    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE IDUsuario = @IDUsuario
          AND EstadoCarrito = N'ACTIVO';
    END
    ELSE IF @TokenNorm IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE TokenInvitado = @TokenNorm
          AND EstadoCarrito = N'ACTIVO';
    END

    IF @IDCarrito IS NULL
        THROW 50002, N'No se encontró un carrito activo para aplicar el cupón.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.CarritoItems WHERE IDCarrito = @IDCarrito)
        THROW 50001, N'Agregue productos al carrito antes de aplicar un cupón de descuento.', 1;

    DECLARE @EsValido          BIT;
    DECLARE @CodigoError       INT;
    DECLARE @MensajeValidacion NVARCHAR(250);
    DECLARE @IDCupon           INT;

    SELECT
        @EsValido          = calc.EsValido,
        @CodigoError       = calc.CodigoError,
        @MensajeValidacion = calc.MensajeValidacion,
        @IDCupon           = calc.IDCupon
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @CodigoNorm, @IDUsuario) AS calc;

    IF @EsValido = 0
    BEGIN
        THROW @CodigoError, @MensajeValidacion, 1;
    END

    UPDATE dbo.Carritos
    SET IDCupon              = @IDCupon,
        FechaUltimaActividad = SYSDATETIME()
    WHERE IDCarrito = @IDCarrito;

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario     = @IDUsuario,
        @TokenInvitado = @TokenNorm,
        @IDCarrito     = @IDCarrito;
END
GO

/* ============================================================================
   7. SP_Carrito_RemoverCupon
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_RemoverCupon
    @IDUsuario     INT           = NULL,
    @TokenInvitado NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TokenNorm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@TokenInvitado)), N'');
    DECLARE @IDCarrito INT = NULL;

    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE IDUsuario = @IDUsuario
          AND EstadoCarrito = N'ACTIVO';
    END
    ELSE IF @TokenNorm IS NOT NULL
    BEGIN
        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carritos
        WHERE TokenInvitado = @TokenNorm
          AND EstadoCarrito = N'ACTIVO';
    END

    IF @IDCarrito IS NOT NULL
    BEGIN
        UPDATE dbo.Carritos
        SET IDCupon              = NULL,
            FechaUltimaActividad = SYSDATETIME()
        WHERE IDCarrito = @IDCarrito;
    END

    EXEC dbo.SP_Carrito_ObtenerDetalle
        @IDUsuario     = @IDUsuario,
        @TokenInvitado = @TokenNorm,
        @IDCarrito     = @IDCarrito;
END
GO

/* ============================================================================
   8. SP_Cupones_Listar
      Listado paginado de cupones para administración (RF-05).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Pagina       INT          = 1,
    @TamanoPagina INT          = 15,
    @Activo       BIT          = NULL,
    @Busqueda     NVARCHAR(80) = NULL,
    @OrdenarPor   NVARCHAR(30) = N'recientes'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 15;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(80) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH CuponesFiltrados AS
    (
        SELECT
            cup.IDCupon,
            cup.Codigo,
            cup.Descripcion,
            cup.TipoDescuento,
            cup.ValorDescuento,
            cup.IDCategoria,
            cat.Nombre AS NombreCategoria,
            cup.MontoMinimoCompra,
            cup.LimiteUsoTotal,
            cup.LimiteUsoPorCliente,
            cup.UsosActuales,
            cup.FechaInicio,
            cup.FechaFin,
            cup.Activo,
            CASE
                WHEN cup.Activo = 0 THEN N'INACTIVO'
                WHEN SYSDATETIME() < cup.FechaInicio THEN N'PROGRAMADO'
                WHEN SYSDATETIME() > cup.FechaFin THEN N'VENCIDO'
                WHEN cup.UsosActuales >= cup.LimiteUsoTotal THEN N'AGOTADO'
                ELSE N'VIGENTE'
            END AS EstadoVigencia,
            cup.FechaCreacion,
            cup.FechaModificacion,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.Cupones AS cup
        LEFT JOIN dbo.Categorias AS cat
            ON cat.IDCategoria = cup.IDCategoria
        WHERE (@Activo IS NULL OR cup.Activo = @Activo)
          AND (
              @FiltroBusqueda IS NULL
              OR cup.Codigo LIKE N'%' + @FiltroBusqueda + N'%'
              OR cup.Descripcion LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT *
    FROM CuponesFiltrados
    ORDER BY
        CASE WHEN @OrdenarPor = N'codigo_asc'      THEN Codigo END ASC,
        CASE WHEN @OrdenarPor = N'codigo_desc'     THEN Codigo END DESC,
        CASE WHEN @OrdenarPor = N'valor_desc'      THEN ValorDescuento END DESC,
        CASE WHEN @OrdenarPor = N'usos_desc'       THEN UsosActuales END DESC,
        CASE WHEN @OrdenarPor = N'vencimiento_asc' THEN FechaFin END ASC,
        FechaCreacion DESC,
        IDCupon DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   9. SP_Cupones_ObtenerPorID
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_ObtenerPorID
    @IDCupon INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupones WHERE IDCupon = @IDCupon)
        THROW 50002, N'El cupón solicitado no existe.', 1;

    SELECT
        cup.IDCupon,
        cup.Codigo,
        cup.Descripcion,
        cup.TipoDescuento,
        cup.ValorDescuento,
        cup.IDCategoria,
        cat.Nombre AS NombreCategoria,
        cup.MontoMinimoCompra,
        cup.LimiteUsoTotal,
        cup.LimiteUsoPorCliente,
        cup.UsosActuales,
        cup.FechaInicio,
        cup.FechaFin,
        cup.Activo,
        cup.FechaCreacion,
        cup.FechaModificacion
    FROM dbo.Cupones AS cup
    LEFT JOIN dbo.Categorias AS cat
        ON cat.IDCategoria = cup.IDCategoria
    WHERE cup.IDCupon = @IDCupon;
END
GO

/* ============================================================================
   10. SP_Cupones_Guardar
       Crea o actualiza un cupón de descuento (PORCENTAJE o MONTO_FIJO) y
       audita el cambio en Bitácora (RF-05 y RF-09).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Guardar
    @IDUsuario           INT,
    @IDCupon             INT            = NULL,
    @Codigo              NVARCHAR(40),
    @Descripcion         NVARCHAR(200),
    @TipoDescuento       NVARCHAR(20),
    @ValorDescuento      DECIMAL(12, 2),
    @IDCategoria         INT            = NULL,
    @MontoMinimoCompra   DECIMAL(12, 2) = 0.00,
    @LimiteUsoTotal      INT,
    @LimiteUsoPorCliente INT            = 1,
    @FechaInicio         DATETIME2(3),
    @FechaFin            DATETIME2(3),
    @Activo              BIT            = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CodigoNorm NVARCHAR(40) = UPPER(LTRIM(RTRIM(ISNULL(@Codigo, N''))));

    IF LEN(@CodigoNorm) < 3
        THROW 50001, N'El código del cupón debe tener al menos 3 caracteres.', 1;

    IF @TipoDescuento NOT IN (N'PORCENTAJE', N'MONTO_FIJO')
        THROW 50001, N'El tipo de descuento debe ser PORCENTAJE o MONTO_FIJO.', 1;

    IF @ValorDescuento <= 0.00 OR (@TipoDescuento = N'PORCENTAJE' AND @ValorDescuento > 100.00)
        THROW 50001, N'El valor del descuento es inválido (porcentaje entre 0.01 y 100.00, o monto fijo mayor a 0).', 1;

    IF @FechaFin <= @FechaInicio
        THROW 50001, N'La fecha de fin de vigencia debe ser posterior a la fecha de inicio.', 1;

    IF @LimiteUsoTotal <= 0 OR @LimiteUsoPorCliente <= 0
        THROW 50001, N'Los límites de uso total y por cliente deben ser mayores a cero.', 1;

    IF @IDCategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 50002, N'La categoría especificada para el cupón no existe.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.Cupones
        WHERE UPPER(Codigo) = @CodigoNorm
          AND (@IDCupon IS NULL OR IDCupon <> @IDCupon)
    )
        THROW 50003, N'Ya existe otro cupón con ese código.', 1;

    DECLARE @IDCuponFinal INT = @IDCupon;
    DECLARE @ValorAnterior NVARCHAR(MAX) = NULL;

    BEGIN TRAN;

        IF @IDCuponFinal IS NULL
        BEGIN
            INSERT INTO dbo.Cupones
            (
                Codigo,
                Descripcion,
                TipoDescuento,
                ValorDescuento,
                IDCategoria,
                MontoMinimoCompra,
                LimiteUsoTotal,
                LimiteUsoPorCliente,
                UsosActuales,
                FechaInicio,
                FechaFin,
                Activo
            )
            VALUES
            (
                @CodigoNorm,
                LTRIM(RTRIM(@Descripcion)),
                @TipoDescuento,
                @ValorDescuento,
                @IDCategoria,
                @MontoMinimoCompra,
                @LimiteUsoTotal,
                @LimiteUsoPorCliente,
                0,
                @FechaInicio,
                @FechaFin,
                @Activo
            );

            SET @IDCuponFinal = SCOPE_IDENTITY();

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'CUPONES',
                N'Cupones',
                CAST(@IDCuponFinal AS NVARCHAR(60)),
                N'CREACION',
                NULL,
                (
                    SELECT IDCupon, Codigo, TipoDescuento, ValorDescuento, IDCategoria, MontoMinimoCompra, LimiteUsoTotal, LimiteUsoPorCliente, FechaInicio, FechaFin, Activo
                    FROM dbo.Cupones
                    WHERE IDCupon = @IDCuponFinal
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
            );
        END
        ELSE
        BEGIN
            DECLARE @UsosActuales INT;
            SELECT @UsosActuales = UsosActuales
            FROM dbo.Cupones WITH (UPDLOCK, HOLDLOCK)
            WHERE IDCupon = @IDCuponFinal;

            IF @UsosActuales IS NULL
            BEGIN
                ROLLBACK TRAN;
                THROW 50002, N'El cupón que intenta actualizar no existe.', 1;
            END

            IF @LimiteUsoTotal < @UsosActuales
            BEGIN
                ROLLBACK TRAN;
                THROW 50001, N'El límite de uso total no puede ser menor a los usos ya acumulados del cupón.', 1;
            END

            SET @ValorAnterior = (
                SELECT IDCupon, Codigo, TipoDescuento, ValorDescuento, IDCategoria, MontoMinimoCompra, LimiteUsoTotal, LimiteUsoPorCliente, FechaInicio, FechaFin, Activo
                FROM dbo.Cupones
                WHERE IDCupon = @IDCuponFinal
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );

            UPDATE dbo.Cupones
            SET Codigo              = @CodigoNorm,
                Descripcion         = LTRIM(RTRIM(@Descripcion)),
                TipoDescuento       = @TipoDescuento,
                ValorDescuento      = @ValorDescuento,
                IDCategoria         = @IDCategoria,
                MontoMinimoCompra   = @MontoMinimoCompra,
                LimiteUsoTotal      = @LimiteUsoTotal,
                LimiteUsoPorCliente = @LimiteUsoPorCliente,
                FechaInicio         = @FechaInicio,
                FechaFin            = @FechaFin,
                Activo              = @Activo,
                FechaModificacion   = SYSDATETIME()
            WHERE IDCupon = @IDCuponFinal;

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'CUPONES',
                N'Cupones',
                CAST(@IDCuponFinal AS NVARCHAR(60)),
                CASE WHEN @Activo = 0 THEN N'DESACTIVACION' ELSE N'MODIFICACION' END,
                @ValorAnterior,
                (
                    SELECT IDCupon, Codigo, TipoDescuento, ValorDescuento, IDCategoria, MontoMinimoCompra, LimiteUsoTotal, LimiteUsoPorCliente, FechaInicio, FechaFin, Activo
                    FROM dbo.Cupones
                    WHERE IDCupon = @IDCuponFinal
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
            );
        END

    COMMIT TRAN;

    EXEC dbo.SP_Cupones_ObtenerPorID @IDCupon = @IDCuponFinal;
END
GO

PRINT N'08_SP_Carrito_Cupones.sql ejecutado correctamente.';
GO
