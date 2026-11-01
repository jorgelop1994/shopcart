/* ============================================================================
   Script: 07_SP_Catalogo_Inventario.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Procedimientos almacenados de los módulos RF-02 (Catálogo de
                productos, categorías, variantes y atributos) y RF-03 / RF-06
                (Inventario, Kardex y SP_Inventario_ReservarExistencia).
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
   1. SP_Catalogo_ListarCategorias
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategorias
    @SoloActivas BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.IDCategoria,
        c.Nombre,
        c.Descripcion,
        c.Activa,
        c.FechaCreacion,
        c.FechaModificacion,
        (
            SELECT COUNT(1)
            FROM dbo.Productos AS p
            WHERE p.IDCategoria = c.IDCategoria
              AND (@SoloActivas = 0 OR p.Activo = 1)
        ) AS TotalProductos
    FROM dbo.Categorias AS c
    WHERE (@SoloActivas = 0 OR c.Activa = 1)
    ORDER BY c.Nombre ASC;
END
GO

/* ============================================================================
   2. SP_Catalogo_CrearCategoria
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearCategoria
    @IDUsuario   INT,
    @Nombre      NVARCHAR(100),
    @Descripcion NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NombreNorm NVARCHAR(100) = LTRIM(RTRIM(ISNULL(@Nombre, N'')));
    DECLARE @IDCategoriaNueva INT;

    IF LEN(@NombreNorm) < 2
        THROW 50001, N'El nombre de la categoría debe tener al menos 2 caracteres.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE UPPER(Nombre) = UPPER(@NombreNorm))
        THROW 50003, N'Ya existe una categoría con ese nombre.', 1;

    BEGIN TRAN;

        INSERT INTO dbo.Categorias (Nombre, Descripcion, Activa)
        VALUES (@NombreNorm, NULLIF(LTRIM(RTRIM(@Descripcion)), N''), 1);

        SET @IDCategoriaNueva = SCOPE_IDENTITY();

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuario,
            N'CATEGORIAS',
            N'Categorias',
            CAST(@IDCategoriaNueva AS NVARCHAR(60)),
            N'CREACION',
            NULL,
            (
                SELECT IDCategoria, Nombre, Descripcion, Activa
                FROM dbo.Categorias
                WHERE IDCategoria = @IDCategoriaNueva
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    SELECT
        IDCategoria,
        Nombre,
        Descripcion,
        Activa,
        FechaCreacion,
        FechaModificacion
    FROM dbo.Categorias
    WHERE IDCategoria = @IDCategoriaNueva;
END
GO

/* ============================================================================
   3. SP_Catalogo_ActualizarCategoria
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarCategoria
    @IDUsuario   INT,
    @IDCategoria INT,
    @Nombre      NVARCHAR(100),
    @Descripcion NVARCHAR(300) = NULL,
    @Activa      BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NombreNorm NVARCHAR(100) = LTRIM(RTRIM(ISNULL(@Nombre, N'')));

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 50002, N'La categoría solicitada no existe.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Categorias WHERE UPPER(Nombre) = UPPER(@NombreNorm) AND IDCategoria <> @IDCategoria)
        THROW 50003, N'Ya existe otra categoría con ese nombre.', 1;

    DECLARE @ValorAnterior NVARCHAR(MAX) = (
        SELECT IDCategoria, Nombre, Descripcion, Activa
        FROM dbo.Categorias
        WHERE IDCategoria = @IDCategoria
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRAN;

        UPDATE dbo.Categorias
        SET Nombre            = @NombreNorm,
            Descripcion       = NULLIF(LTRIM(RTRIM(@Descripcion)), N''),
            Activa            = @Activa,
            FechaModificacion = SYSDATETIME()
        WHERE IDCategoria = @IDCategoria;

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuario,
            N'CATEGORIAS',
            N'Categorias',
            CAST(@IDCategoria AS NVARCHAR(60)),
            CASE WHEN @Activa = 0 THEN N'DESACTIVACION' ELSE N'MODIFICACION' END,
            @ValorAnterior,
            (
                SELECT IDCategoria, Nombre, Descripcion, Activa
                FROM dbo.Categorias
                WHERE IDCategoria = @IDCategoria
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    SELECT
        IDCategoria,
        Nombre,
        Descripcion,
        Activa,
        FechaCreacion,
        FechaModificacion
    FROM dbo.Categorias
    WHERE IDCategoria = @IDCategoria;
END
GO

/* ============================================================================
   4. SP_Catalogo_ListarAtributos
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarAtributos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        a.IDAtributo,
        a.Nombre AS NombreAtributo,
        a.Activo,
        (
            SELECT
                va.IDValorAtributo,
                va.Valor
            FROM dbo.ValoresAtributo AS va
            WHERE va.IDAtributo = a.IDAtributo
            ORDER BY va.IDValorAtributo ASC
            FOR JSON PATH
        ) AS ValoresJSON
    FROM dbo.Atributos AS a
    WHERE a.Activo = 1
    ORDER BY a.IDAtributo ASC;
END
GO

/* ============================================================================
   5. SP_Catalogo_GuardarAtributoYValor
      Asegura la existencia de un atributo (ej. Talla, Color) y un valor.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_GuardarAtributoYValor
    @NombreAtributo NVARCHAR(60),
    @Valor          NVARCHAR(80)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @AtributoNorm NVARCHAR(60) = LTRIM(RTRIM(ISNULL(@NombreAtributo, N'')));
    DECLARE @ValorNorm    NVARCHAR(80) = LTRIM(RTRIM(ISNULL(@Valor, N'')));
    DECLARE @IDAtributo INT;
    DECLARE @IDValorAtributo INT;

    IF LEN(@AtributoNorm) < 2 OR LEN(@ValorNorm) < 1
        THROW 50001, N'El nombre del atributo y su valor son obligatorios.', 1;

    BEGIN TRAN;

        SELECT @IDAtributo = IDAtributo
        FROM dbo.Atributos
        WHERE UPPER(Nombre) = UPPER(@AtributoNorm);

        IF @IDAtributo IS NULL
        BEGIN
            INSERT INTO dbo.Atributos (Nombre, Activo)
            VALUES (@AtributoNorm, 1);

            SET @IDAtributo = SCOPE_IDENTITY();
        END

        SELECT @IDValorAtributo = IDValorAtributo
        FROM dbo.ValoresAtributo
        WHERE IDAtributo = @IDAtributo
          AND UPPER(Valor) = UPPER(@ValorNorm);

        IF @IDValorAtributo IS NULL
        BEGIN
            INSERT INTO dbo.ValoresAtributo (IDAtributo, Valor)
            VALUES (@IDAtributo, @ValorNorm);

            SET @IDValorAtributo = SCOPE_IDENTITY();
        END

    COMMIT TRAN;

    SELECT
        @IDAtributo AS IDAtributo,
        @AtributoNorm AS NombreAtributo,
        @IDValorAtributo AS IDValorAtributo,
        @ValorNorm AS Valor;
END
GO

/* ============================================================================
   6. SP_Catalogo_ListarProductos
      Búsqueda por texto y filtros por categoría, rango de precio y
      disponibilidad, con ordenamiento y paginación del lado del servidor (RF-02).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarProductos
    @Pagina          INT            = 1,
    @TamanoPagina    INT            = 12,
    @Busqueda        NVARCHAR(150)  = NULL,
    @IDCategoria     INT            = NULL,
    @PrecioMin       DECIMAL(12, 2) = NULL,
    @PrecioMax       DECIMAL(12, 2) = NULL,
    @SoloDisponibles BIT            = 0,
    @SoloActivos     BIT            = 1,
    @OrdenarPor      NVARCHAR(30)   = N'recientes'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 12;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH ProductosConMetricas AS
    (
        SELECT
            p.IDProducto,
            p.IDCategoria,
            c.Nombre AS NombreCategoria,
            p.Nombre,
            p.Descripcion,
            p.Marca,
            p.Activo,
            p.FechaCreacion,
            p.FechaModificacion,
            img.UrlImagenPrincipal,
            ISNULL(varStats.TotalVariantes, 0) AS TotalVariantes,
            ISNULL(varStats.PrecioMinimo, 0.00) AS PrecioMinimo,
            ISNULL(varStats.PrecioMaximo, 0.00) AS PrecioMaximo,
            ISNULL(varStats.ExistenciaFisicaTotal, 0) AS ExistenciaFisicaTotal,
            ISNULL(varStats.ExistenciaDisponibleTotal, 0) AS ExistenciaDisponibleTotal
        FROM dbo.Productos AS p
        INNER JOIN dbo.Categorias AS c
            ON c.IDCategoria = p.IDCategoria
        OUTER APPLY
        (
            SELECT TOP (1) pi.UrlImagen AS UrlImagenPrincipal
            FROM dbo.ProductoImagenes AS pi
            WHERE pi.IDProducto = p.IDProducto
            ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
        ) AS img
        OUTER APPLY
        (
            SELECT
                COUNT(pv.IDVariante) AS TotalVariantes,
                MIN(pv.PrecioVigente) AS PrecioMinimo,
                MAX(pv.PrecioVigente) AS PrecioMaximo,
                SUM(pv.ExistenciaFisica) AS ExistenciaFisicaTotal,
                SUM(pv.ExistenciaDisponible) AS ExistenciaDisponibleTotal
            FROM dbo.FU_Catalogo_PrecioVigente(NULL) AS pv
            WHERE pv.IDProducto = p.IDProducto
              AND (@SoloActivos = 0 OR pv.VarianteActiva = 1)
        ) AS varStats
        WHERE (@SoloActivos = 0 OR (p.Activo = 1 AND c.Activa = 1))
          AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
          AND (
              @FiltroBusqueda IS NULL
              OR p.Nombre LIKE N'%' + @FiltroBusqueda + N'%'
              OR p.Descripcion LIKE N'%' + @FiltroBusqueda + N'%'
              OR p.Marca LIKE N'%' + @FiltroBusqueda + N'%'
              OR EXISTS (
                  SELECT 1
                  FROM dbo.Variantes AS vSub
                  WHERE vSub.IDProducto = p.IDProducto
                    AND vSub.SKU LIKE N'%' + @FiltroBusqueda + N'%'
              )
          )
          AND (
              @PrecioMin IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM dbo.Variantes AS vMin
                  WHERE vMin.IDProducto = p.IDProducto
                    AND (@SoloActivos = 0 OR vMin.Activa = 1)
                    AND vMin.Precio >= @PrecioMin
              )
          )
          AND (
              @PrecioMax IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM dbo.Variantes AS vMax
                  WHERE vMax.IDProducto = p.IDProducto
                    AND (@SoloActivos = 0 OR vMax.Activa = 1)
                    AND vMax.Precio <= @PrecioMax
              )
          )
          AND (
              @SoloDisponibles = 0
              OR ISNULL(varStats.ExistenciaDisponibleTotal, 0) > 0
          )
    )
    SELECT
        IDProducto,
        IDCategoria,
        NombreCategoria,
        Nombre,
        Descripcion,
        Marca,
        Activo,
        UrlImagenPrincipal,
        TotalVariantes,
        PrecioMinimo,
        PrecioMaximo,
        ExistenciaFisicaTotal,
        ExistenciaDisponibleTotal,
        FechaCreacion,
        FechaModificacion,
        COUNT(1) OVER() AS TotalRegistros
    FROM ProductosConMetricas
    ORDER BY
        CASE WHEN @OrdenarPor = N'precio_asc'  THEN PrecioMinimo END ASC,
        CASE WHEN @OrdenarPor = N'precio_desc' THEN PrecioMinimo END DESC,
        CASE WHEN @OrdenarPor = N'nombre_asc'  THEN Nombre END ASC,
        CASE WHEN @OrdenarPor = N'nombre_desc' THEN Nombre END DESC,
        FechaCreacion DESC,
        IDProducto DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   7. SP_Catalogo_ObtenerProductoDetalle
      Retorna el detalle completo del producto junto con sus imágenes y
      variantes en formato JSON y tabular.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProductoDetalle
    @IDProducto  INT,
    @SoloActivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Productos AS p
        WHERE p.IDProducto = @IDProducto
          AND (@SoloActivos = 0 OR p.Activo = 1)
    )
        THROW 50002, N'El producto solicitado no existe o no está disponible.', 1;

    SELECT
        p.IDProducto,
        p.IDCategoria,
        c.Nombre AS NombreCategoria,
        p.Nombre,
        p.Descripcion,
        p.Marca,
        p.Activo,
        p.FechaCreacion,
        p.FechaModificacion,
        (
            SELECT
                pi.IDProductoImagen,
                pi.UrlImagen,
                pi.TextoAlternativo,
                pi.Orden,
                pi.EsPrincipal
            FROM dbo.ProductoImagenes AS pi
            WHERE pi.IDProducto = p.IDProducto
            ORDER BY pi.EsPrincipal DESC, pi.Orden ASC
            FOR JSON PATH
        ) AS ImagenesJSON,
        (
            SELECT
                pv.IDVariante,
                pv.SKU,
                pv.NombreVariante,
                pv.PrecioVigente AS Precio,
                pv.PrecioSinIVA,
                pv.MontoIVAIncluido,
                pv.ExistenciaFisica,
                pv.ExistenciaReservada,
                pv.ExistenciaDisponible,
                pv.VarianteActiva AS Activa,
                (
                    SELECT
                        a.IDAtributo,
                        a.Nombre AS Atributo,
                        va.IDValorAtributo,
                        va.Valor
                    FROM dbo.VarianteValoresAtributo AS vva
                    INNER JOIN dbo.Atributos AS a
                        ON a.IDAtributo = vva.IDAtributo
                    INNER JOIN dbo.ValoresAtributo AS va
                        ON va.IDValorAtributo = vva.IDValorAtributo
                    WHERE vva.IDVariante = pv.IDVariante
                    ORDER BY a.IDAtributo ASC
                    FOR JSON PATH
                ) AS Atributos
            FROM dbo.FU_Catalogo_PrecioVigente(NULL) AS pv
            WHERE pv.IDProducto = p.IDProducto
              AND (@SoloActivos = 0 OR pv.VarianteActiva = 1)
            ORDER BY pv.IDVariante ASC
            FOR JSON PATH
        ) AS VariantesJSON
    FROM dbo.Productos AS p
    INNER JOIN dbo.Categorias AS c
        ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;
END
GO

/* ============================================================================
   8. SP_Catalogo_CrearProducto
      Crea un producto junto con sus imágenes opcionales (JSON) y audita en
      Bitácora (RF-02 y RF-09).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDUsuario    INT,
    @IDCategoria  INT,
    @Nombre       NVARCHAR(150),
    @Descripcion  NVARCHAR(MAX) = NULL,
    @Marca        NVARCHAR(80)  = NULL,
    @ImagenesJSON NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NombreNorm NVARCHAR(150) = LTRIM(RTRIM(ISNULL(@Nombre, N'')));
    DECLARE @IDProductoNuevo INT;

    IF LEN(@NombreNorm) < 2
        THROW 50001, N'El nombre del producto debe tener al menos 2 caracteres.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 50002, N'La categoría seleccionada no existe.', 1;

    BEGIN TRAN;

        INSERT INTO dbo.Productos (IDCategoria, Nombre, Descripcion, Marca, Activo)
        VALUES (
            @IDCategoria,
            @NombreNorm,
            NULLIF(LTRIM(RTRIM(@Descripcion)), N''),
            NULLIF(LTRIM(RTRIM(@Marca)), N''),
            1
        );

        SET @IDProductoNuevo = SCOPE_IDENTITY();

        IF @ImagenesJSON IS NOT NULL AND ISJSON(@ImagenesJSON) = 1
        BEGIN
            INSERT INTO dbo.ProductoImagenes (IDProducto, UrlImagen, TextoAlternativo, Orden, EsPrincipal)
            SELECT
                @IDProductoNuevo,
                LTRIM(RTRIM(UrlImagen)),
                TextoAlternativo,
                ISNULL(Orden, 1),
                ISNULL(EsPrincipal, 0)
            FROM OPENJSON(@ImagenesJSON)
            WITH (
                UrlImagen        NVARCHAR(500) N'$.urlImagen',
                TextoAlternativo NVARCHAR(150) N'$.textoAlternativo',
                Orden            INT           N'$.orden',
                EsPrincipal      BIT           N'$.esPrincipal'
            )
            WHERE LEN(LTRIM(RTRIM(ISNULL(UrlImagen, N'')))) >= 5;
        END

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuario,
            N'PRODUCTOS',
            N'Productos',
            CAST(@IDProductoNuevo AS NVARCHAR(60)),
            N'CREACION',
            NULL,
            (
                SELECT IDProducto, IDCategoria, Nombre, Marca, Activo
                FROM dbo.Productos
                WHERE IDProducto = @IDProductoNuevo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    EXEC dbo.SP_Catalogo_ObtenerProductoDetalle @IDProducto = @IDProductoNuevo;
END
GO

/* ============================================================================
   9. SP_Catalogo_ActualizarProducto
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDUsuario    INT,
    @IDProducto   INT,
    @IDCategoria  INT,
    @Nombre       NVARCHAR(150),
    @Descripcion  NVARCHAR(MAX) = NULL,
    @Marca        NVARCHAR(80)  = NULL,
    @Activo       BIT           = 1,
    @ImagenesJSON NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 50002, N'El producto solicitado no existe.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE IDCategoria = @IDCategoria)
        THROW 50002, N'La categoría seleccionada no existe.', 1;

    DECLARE @ValorAnterior NVARCHAR(MAX) = (
        SELECT IDProducto, IDCategoria, Nombre, Marca, Activo
        FROM dbo.Productos
        WHERE IDProducto = @IDProducto
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRAN;

        UPDATE dbo.Productos
        SET IDCategoria       = @IDCategoria,
            Nombre            = LTRIM(RTRIM(@Nombre)),
            Descripcion       = NULLIF(LTRIM(RTRIM(@Descripcion)), N''),
            Marca             = NULLIF(LTRIM(RTRIM(@Marca)), N''),
            Activo            = @Activo,
            FechaModificacion = SYSDATETIME()
        WHERE IDProducto = @IDProducto;

        IF @ImagenesJSON IS NOT NULL AND ISJSON(@ImagenesJSON) = 1
        BEGIN
            DELETE FROM dbo.ProductoImagenes WHERE IDProducto = @IDProducto;

            INSERT INTO dbo.ProductoImagenes (IDProducto, UrlImagen, TextoAlternativo, Orden, EsPrincipal)
            SELECT
                @IDProducto,
                LTRIM(RTRIM(UrlImagen)),
                TextoAlternativo,
                ISNULL(Orden, 1),
                ISNULL(EsPrincipal, 0)
            FROM OPENJSON(@ImagenesJSON)
            WITH (
                UrlImagen        NVARCHAR(500) N'$.urlImagen',
                TextoAlternativo NVARCHAR(150) N'$.textoAlternativo',
                Orden            INT           N'$.orden',
                EsPrincipal      BIT           N'$.esPrincipal'
            )
            WHERE LEN(LTRIM(RTRIM(ISNULL(UrlImagen, N'')))) >= 5;
        END

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuario,
            N'PRODUCTOS',
            N'Productos',
            CAST(@IDProducto AS NVARCHAR(60)),
            CASE WHEN @Activo = 0 THEN N'DESACTIVACION' ELSE N'MODIFICACION' END,
            @ValorAnterior,
            (
                SELECT IDProducto, IDCategoria, Nombre, Marca, Activo
                FROM dbo.Productos
                WHERE IDProducto = @IDProducto
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    EXEC dbo.SP_Catalogo_ObtenerProductoDetalle @IDProducto = @IDProducto;
END
GO

/* ============================================================================
   10. SP_Catalogo_EliminarODesactivarProducto
       Regla RF-02: "Los productos con ventas asociadas no se eliminan
       físicamente; se desactivan y dejan de mostrarse en la tienda."
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarODesactivarProducto
    @IDUsuario  INT,
    @IDProducto INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 50002, N'El producto solicitado no existe.', 1;

    DECLARE @TieneVentasOMovimientos BIT = 0;

    IF EXISTS (
        SELECT 1
        FROM dbo.Variantes AS v
        INNER JOIN dbo.DetallePedidos AS dp
            ON dp.IDVariante = v.IDVariante
        WHERE v.IDProducto = @IDProducto
    )
    OR EXISTS (
        SELECT 1
        FROM dbo.Variantes AS v
        INNER JOIN dbo.MovimientosKardex AS mk
            ON mk.IDVariante = v.IDVariante
        WHERE v.IDProducto = @IDProducto
    )
    BEGIN
        SET @TieneVentasOMovimientos = 1;
    END

    DECLARE @ValorAnterior NVARCHAR(MAX) = (
        SELECT IDProducto, Nombre, Activo
        FROM dbo.Productos
        WHERE IDProducto = @IDProducto
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRAN;

        IF @TieneVentasOMovimientos = 1
        BEGIN
            UPDATE dbo.Productos
            SET Activo            = 0,
                FechaModificacion = SYSDATETIME()
            WHERE IDProducto = @IDProducto;

            UPDATE dbo.Variantes
            SET Activa            = 0,
                FechaModificacion = SYSDATETIME()
            WHERE IDProducto = @IDProducto;

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'PRODUCTOS',
                N'Productos',
                CAST(@IDProducto AS NVARCHAR(60)),
                N'DESACTIVACION',
                @ValorAnterior,
                (
                    SELECT IDProducto, Nombre, Activo
                    FROM dbo.Productos
                    WHERE IDProducto = @IDProducto
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
            );
        END
        ELSE
        BEGIN
            DELETE vva
            FROM dbo.VarianteValoresAtributo AS vva
            INNER JOIN dbo.Variantes AS v
                ON v.IDVariante = vva.IDVariante
            WHERE v.IDProducto = @IDProducto;

            DELETE ci
            FROM dbo.CarritoItems AS ci
            INNER JOIN dbo.Variantes AS v
                ON v.IDVariante = ci.IDVariante
            WHERE v.IDProducto = @IDProducto;

            DELETE FROM dbo.Variantes WHERE IDProducto = @IDProducto;
            DELETE FROM dbo.ProductoImagenes WHERE IDProducto = @IDProducto;
            DELETE FROM dbo.Productos WHERE IDProducto = @IDProducto;

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'PRODUCTOS',
                N'Productos',
                CAST(@IDProducto AS NVARCHAR(60)),
                N'DESACTIVACION',
                @ValorAnterior,
                N'{"EliminadoFisicamente":true,"Motivo":"Sin ventas ni kardex asociado"}'
            );
        END

    COMMIT TRAN;

    SELECT
        @IDProducto AS IDProducto,
        CASE
            WHEN @TieneVentasOMovimientos = 1 THEN N'DESACTIVADO_POR_VENTAS_ASOCIADAS'
            ELSE N'ELIMINADO_SIN_VENTAS'
        END AS ResultadoOperacion;
END
GO

/* ============================================================================
   11. SP_Catalogo_GuardarVariante
       Crea o actualiza una variante (SKU único, Precio, Atributos) y audita
       explícitamente cambios de PRECIOS y PRODUCTOS en la Bitácora.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_GuardarVariante
    @IDUsuario         INT,
    @IDProducto        INT,
    @IDVariante        INT            = NULL,
    @SKU               NVARCHAR(60),
    @NombreVariante    NVARCHAR(150),
    @Precio            DECIMAL(12, 2),
    @Activa            BIT            = 1,
    @ExistenciaInicial INT            = 0,
    @AtributosJSON     NVARCHAR(MAX)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @SKUNorm NVARCHAR(60) = UPPER(LTRIM(RTRIM(ISNULL(@SKU, N''))));

    IF LEN(@SKUNorm) < 3
        THROW 50001, N'El SKU de la variante debe tener al menos 3 caracteres.', 1;

    IF @Precio < 0.00
        THROW 50001, N'El precio de la variante no puede ser negativo.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE IDProducto = @IDProducto)
        THROW 50002, N'El producto padre no existe.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.Variantes
        WHERE UPPER(SKU) = @SKUNorm
          AND (@IDVariante IS NULL OR IDVariante <> @IDVariante)
    )
        THROW 50003, N'El código SKU especificado ya está asignado a otra variante.', 1;

    DECLARE @IDVarianteFinal INT = @IDVariante;
    DECLARE @PrecioAnterior DECIMAL(12, 2) = NULL;
    DECLARE @ValorAnterior NVARCHAR(MAX) = NULL;

    BEGIN TRAN;

        IF @IDVarianteFinal IS NULL
        BEGIN
            -- Creación de nueva variante (ExistenciaFisica inicia en 0 y se suma vía Kardex si @ExistenciaInicial > 0)
            INSERT INTO dbo.Variantes (IDProducto, SKU, NombreVariante, Precio, ExistenciaFisica, Activa)
            VALUES (@IDProducto, @SKUNorm, LTRIM(RTRIM(@NombreVariante)), @Precio, 0, @Activa);

            SET @IDVarianteFinal = SCOPE_IDENTITY();

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'PRODUCTOS',
                N'Variantes',
                CAST(@IDVarianteFinal AS NVARCHAR(60)),
                N'CREACION',
                NULL,
                (
                    SELECT IDVariante, IDProducto, SKU, NombreVariante, Precio, Activa
                    FROM dbo.Variantes
                    WHERE IDVariante = @IDVarianteFinal
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
            );

            IF ISNULL(@ExistenciaInicial, 0) > 0
            BEGIN
                UPDATE dbo.Variantes
                SET ExistenciaFisica  = @ExistenciaInicial,
                    FechaModificacion = SYSDATETIME()
                WHERE IDVariante = @IDVarianteFinal;

                INSERT INTO dbo.MovimientosKardex
                (
                    IDVariante,
                    IDUsuario,
                    TipoMovimiento,
                    Cantidad,
                    SaldoAnterior,
                    SaldoPosterior,
                    Motivo
                )
                VALUES
                (
                    @IDVarianteFinal,
                    @IDUsuario,
                    N'ENTRADA_COMPRA',
                    @ExistenciaInicial,
                    0,
                    @ExistenciaInicial,
                    N'Inventario inicial al dar de alta la variante'
                );

                INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
                VALUES (
                    @IDUsuario,
                    N'EXISTENCIAS',
                    N'Variantes',
                    CAST(@IDVarianteFinal AS NVARCHAR(60)),
                    N'MOVIMIENTO_INVENTARIO',
                    N'{"ExistenciaFisica":0}',
                    CONCAT(N'{"ExistenciaFisica":', @ExistenciaInicial, N',"Motivo":"Inventario inicial"}')
                );
            END
        END
        ELSE
        BEGIN
            SELECT @PrecioAnterior = Precio
            FROM dbo.Variantes WITH (UPDLOCK, HOLDLOCK)
            WHERE IDVariante = @IDVarianteFinal;

            IF @PrecioAnterior IS NULL
            BEGIN
                ROLLBACK TRAN;
                THROW 50002, N'La variante que intenta actualizar no existe.', 1;
            END

            SET @ValorAnterior = (
                SELECT IDVariante, SKU, NombreVariante, Precio, Activa
                FROM dbo.Variantes
                WHERE IDVariante = @IDVarianteFinal
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );

            UPDATE dbo.Variantes
            SET SKU               = @SKUNorm,
                NombreVariante    = LTRIM(RTRIM(@NombreVariante)),
                Precio            = @Precio,
                Activa            = @Activa,
                FechaModificacion = SYSDATETIME()
            WHERE IDVariante = @IDVarianteFinal;

            -- Si el precio fue modificado, registrar trazabilidad explícita en módulo PRECIOS (RF-09)
            IF @PrecioAnterior <> @Precio
            BEGIN
                INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
                VALUES (
                    @IDUsuario,
                    N'PRECIOS',
                    N'Variantes',
                    CAST(@IDVarianteFinal AS NVARCHAR(60)),
                    N'CAMBIO_PRECIO',
                    CONCAT(N'{"IDVariante":', @IDVarianteFinal, N',"SKU":"', @SKUNorm, N'","Precio":', FORMAT(@PrecioAnterior, N'0.00'), N'}'),
                    CONCAT(N'{"IDVariante":', @IDVarianteFinal, N',"SKU":"', @SKUNorm, N'","Precio":', FORMAT(@Precio, N'0.00'), N'}')
                );
            END

            INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
            VALUES (
                @IDUsuario,
                N'PRODUCTOS',
                N'Variantes',
                CAST(@IDVarianteFinal AS NVARCHAR(60)),
                CASE WHEN @Activa = 0 THEN N'DESACTIVACION' ELSE N'MODIFICACION' END,
                @ValorAnterior,
                (
                    SELECT IDVariante, SKU, NombreVariante, Precio, Activa
                    FROM dbo.Variantes
                    WHERE IDVariante = @IDVarianteFinal
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                )
            );
        END

        -- Sincronizar atributos de la variante si se envía JSON: [{"idAtributo":1,"idValorAtributo":2}]
        IF @AtributosJSON IS NOT NULL AND ISJSON(@AtributosJSON) = 1
        BEGIN
            DELETE FROM dbo.VarianteValoresAtributo
            WHERE IDVariante = @IDVarianteFinal;

            INSERT INTO dbo.VarianteValoresAtributo (IDVariante, IDAtributo, IDValorAtributo)
            SELECT
                @IDVarianteFinal,
                IDAtributo,
                IDValorAtributo
            FROM OPENJSON(@AtributosJSON)
            WITH (
                IDAtributo      INT N'$.idAtributo',
                IDValorAtributo INT N'$.idValorAtributo'
            );
        END

    COMMIT TRAN;

    SELECT *
    FROM dbo.VW_Inventario_ExistenciaDisponible
    WHERE IDVariante = @IDVarianteFinal;
END
GO

/* ============================================================================
   12. SP_Inventario_RegistrarMovimiento
       Registra entradas por compra o ajustes de inventario en el Kardex (RF-03).
       Criterios de Aceptación:
       - La existencia actual coincide siempre con la suma del Kardex.
       - Un ajuste manual exige motivo y jamás puede dejar la existencia < 0.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDUsuario      INT,
    @IDVariante     INT,
    @TipoMovimiento NVARCHAR(30),
    @Cantidad       INT,
    @Motivo         NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MotivoNorm NVARCHAR(300) = LTRIM(RTRIM(ISNULL(@Motivo, N'')));

    IF LEN(@MotivoNorm) < 3
        THROW 50020, N'El movimiento o ajuste de inventario exige un motivo descriptivo (mínimo 3 caracteres).', 1;

    IF @TipoMovimiento NOT IN (N'ENTRADA_COMPRA', N'AJUSTE_ENTRADA', N'AJUSTE_SALIDA')
        THROW 50001, N'Tipo de movimiento manual no válido (use ENTRADA_COMPRA, AJUSTE_ENTRADA o AJUSTE_SALIDA).', 1;

    IF @Cantidad <= 0
        THROW 50020, N'La cantidad del movimiento debe ser un número entero positivo mayor a cero.', 1;

    DECLARE @Delta INT = CASE
        WHEN @TipoMovimiento = N'AJUSTE_SALIDA' THEN -@Cantidad
        ELSE @Cantidad
    END;

    DECLARE @SaldoAnterior  INT;
    DECLARE @SaldoPosterior INT;
    DECLARE @SKU            NVARCHAR(60);
    DECLARE @IDMovimiento   INT;

    BEGIN TRAN;

        SELECT
            @SaldoAnterior = v.ExistenciaFisica,
            @SKU           = v.SKU
        FROM dbo.Variantes AS v WITH (UPDLOCK, HOLDLOCK)
        WHERE v.IDVariante = @IDVariante;

        IF @SaldoAnterior IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50002, N'La variante especificada no existe.', 1;
        END

        SET @SaldoPosterior = @SaldoAnterior + @Delta;

        IF @SaldoPosterior < 0
        BEGIN
            ROLLBACK TRAN;
            THROW 50020, N'Operación rechazada: El ajuste de inventario no puede dejar la existencia física en negativo.', 1;
        END

        UPDATE dbo.Variantes
        SET ExistenciaFisica  = @SaldoPosterior,
            FechaModificacion = SYSDATETIME()
        WHERE IDVariante = @IDVariante;

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
            Motivo
        )
        VALUES
        (
            @IDVariante,
            @IDUsuario,
            NULL,
            NULL,
            @TipoMovimiento,
            @Delta,
            @SaldoAnterior,
            @SaldoPosterior,
            @MotivoNorm
        );

        SET @IDMovimiento = SCOPE_IDENTITY();

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuario,
            N'EXISTENCIAS',
            N'Variantes',
            CAST(@IDVariante AS NVARCHAR(60)),
            N'MOVIMIENTO_INVENTARIO',
            CONCAT(N'{"IDVariante":', @IDVariante, N',"SKU":"', @SKU, N'","ExistenciaFisica":', @SaldoAnterior, N'}'),
            CONCAT(N'{"IDVariante":', @IDVariante, N',"SKU":"', @SKU, N'","ExistenciaFisica":', @SaldoPosterior, N',"TipoMovimiento":"', @TipoMovimiento, N'","Cantidad":', @Delta, N',"Motivo":"', STRING_ESCAPE(@MotivoNorm, N'json'), N'"}')
        );

    COMMIT TRAN;

    SELECT *
    FROM dbo.VW_Inventario_Kardex
    WHERE IDMovimientoKardex = @IDMovimiento;
END
GO

/* ============================================================================
   13. SP_Inventario_ConsultarKardex
       Consulta paginada del historial del Kardex con filtros del servidor.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ConsultarKardex
    @Pagina         INT           = 1,
    @TamanoPagina   INT           = 20,
    @IDVariante     INT           = NULL,
    @IDProducto     INT           = NULL,
    @TipoMovimiento NVARCHAR(30)  = NULL,
    @FechaInicio    DATETIME2(3)  = NULL,
    @FechaFin       DATETIME2(3)  = NULL,
    @Busqueda       NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 20;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH KardexFiltrado AS
    (
        SELECT
            k.*,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.VW_Inventario_Kardex AS k
        WHERE (@IDVariante IS NULL OR k.IDVariante = @IDVariante)
          AND (@IDProducto IS NULL OR k.IDProducto = @IDProducto)
          AND (@TipoMovimiento IS NULL OR k.TipoMovimiento = @TipoMovimiento)
          AND (@FechaInicio IS NULL OR k.FechaMovimiento >= @FechaInicio)
          AND (@FechaFin IS NULL OR k.FechaMovimiento <= @FechaFin)
          AND (
              @FiltroBusqueda IS NULL
              OR k.SKU LIKE N'%' + @FiltroBusqueda + N'%'
              OR k.NombreProducto LIKE N'%' + @FiltroBusqueda + N'%'
              OR k.Motivo LIKE N'%' + @FiltroBusqueda + N'%'
              OR k.NumeroPedido LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT *
    FROM KardexFiltrado
    ORDER BY FechaMovimiento DESC, IDMovimientoKardex DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   14. SP_Inventario_ObtenerExistencias
       Consulta paginada de existencias físicas, reservadas, disponibles y
       validación de cuadre contra el Kardex.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ObtenerExistencias
    @Pagina          INT           = 1,
    @TamanoPagina    INT           = 20,
    @IDCategoria     INT           = NULL,
    @IDProducto      INT           = NULL,
    @SoloBajoStock   BIT           = 0,
    @Busqueda        NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Limpiar reservas vencidas antes de reportar existencias al Operador/Admin
    UPDATE dbo.ReservasExistencia
    SET EstadoReserva   = N'EXPIRADA',
        FechaResolucion = SYSDATETIME()
    WHERE EstadoReserva = N'ACTIVA'
      AND FechaExpiracion <= SYSDATETIME();

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 20;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH ExistenciasFiltradas AS
    (
        SELECT
            e.*,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.VW_Inventario_ExistenciaDisponible AS e
        WHERE (@IDCategoria IS NULL OR e.IDCategoria = @IDCategoria)
          AND (@IDProducto IS NULL OR e.IDProducto = @IDProducto)
          AND (@SoloBajoStock = 0 OR e.ExistenciaDisponible <= 5)
          AND (
              @FiltroBusqueda IS NULL
              OR e.SKU LIKE N'%' + @FiltroBusqueda + N'%'
              OR e.NombreProducto LIKE N'%' + @FiltroBusqueda + N'%'
              OR e.NombreVariante LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT *
    FROM ExistenciasFiltradas
    ORDER BY ExistenciaDisponible ASC, IDVariante ASC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   15. SP_Inventario_LiberarReservasVencidas
       Marca como EXPIRADA toda reserva que haya superado sus 15 minutos sin
       intervención manual (RF-07).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReservasVencidas
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.ReservasExistencia
    SET EstadoReserva   = N'EXPIRADA',
        FechaResolucion = SYSDATETIME()
    WHERE EstadoReserva = N'ACTIVA'
      AND FechaExpiracion <= SYSDATETIME();

    SELECT @@ROWCOUNT AS ReservasExpiradasLiberadas;
END
GO

/* ============================================================================
   16. SP_Inventario_ReservarExistencia (Nombre exacto requerido en Página 10)
       Al iniciar el pago en el checkout (RF-06), aparta la existencia de cada
       variante del carrito durante 15 minutos usando bloqueo pesimista
       (UPDLOCK, HOLDLOCK) ordenado por IDVariante ASC para evitar sobreventa
       y deadlocks cuando varios clientes compiten por la última unidad.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDCarrito INT,
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @PropietarioCarrito INT;
    DECLARE @EstadoCarrito      NVARCHAR(20);
    DECLARE @MinutosReserva     INT = 15;
    DECLARE @Ahora              DATETIME2(3) = SYSDATETIME();
    DECLARE @FechaExpiracion    DATETIME2(3);
    DECLARE @TokenReserva       NVARCHAR(64) = LOWER(CONVERT(NVARCHAR(36), NEWID()));

    SELECT @MinutosReserva = ISNULL(TRY_CAST(Valor AS INT), 15)
    FROM dbo.ConfiguracionSistema
    WHERE Clave = N'MINUTOS_RESERVA_CHECKOUT';

    SET @FechaExpiracion = DATEADD(MINUTE, @MinutosReserva, @Ahora);

    SELECT
        @PropietarioCarrito = c.IDUsuario,
        @EstadoCarrito      = c.EstadoCarrito
    FROM dbo.Carritos AS c
    WHERE c.IDCarrito = @IDCarrito;

    IF @EstadoCarrito IS NULL
        THROW 50002, N'El carrito especificado no existe.', 1;

    IF @PropietarioCarrito IS NULL OR @PropietarioCarrito <> @IDUsuario
        THROW 50004, N'Acceso denegado: el carrito no pertenece al cliente autenticado.', 1;

    IF @EstadoCarrito <> N'ACTIVO'
        THROW 50021, N'El carrito ya fue procesado o no se encuentra activo.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.CarritoItems WHERE IDCarrito = @IDCarrito)
        THROW 50001, N'El carrito está vacío; agregue productos antes de iniciar el checkout.', 1;

    BEGIN TRAN;

        -- 1. Liberar cualquier reserva vencida en el sistema
        UPDATE dbo.ReservasExistencia
        SET EstadoReserva   = N'EXPIRADA',
            FechaResolucion = @Ahora
        WHERE EstadoReserva = N'ACTIVA'
          AND FechaExpiracion <= @Ahora;

        -- 2. Liberar reservas activas previas de este mismo carrito para renovarlas limpiamente
        UPDATE dbo.ReservasExistencia
        SET EstadoReserva   = N'LIBERADA',
            FechaResolucion = @Ahora
        WHERE IDCarrito = @IDCarrito
          AND EstadoReserva = N'ACTIVA';

        -- 3. Tomar bloqueo pesimista (UPDLOCK, HOLDLOCK) sobre las variantes del carrito en orden IDVariante ASC
        DECLARE @VariantesBloqueadas TABLE
        (
            IDVariante           INT            NOT NULL PRIMARY KEY,
            SKU                  NVARCHAR(60)  NOT NULL,
            NombreProducto       NVARCHAR(150) NOT NULL,
            NombreVariante       NVARCHAR(150) NOT NULL,
            CantidadSolicitada   INT           NOT NULL,
            ExistenciaFisica     INT           NOT NULL,
            ExistenciaReservada  INT           NOT NULL,
            ExistenciaDisponible INT           NOT NULL,
            Activa               BIT           NOT NULL
        );

        INSERT INTO @VariantesBloqueadas
        SELECT
            v.IDVariante,
            v.SKU,
            p.Nombre,
            v.NombreVariante,
            ci.Cantidad,
            v.ExistenciaFisica,
            ISNULL(res.UnidadesReservadas, 0) AS ExistenciaReservada,
            v.ExistenciaFisica - ISNULL(res.UnidadesReservadas, 0) AS ExistenciaDisponible,
            CASE WHEN v.Activa = 1 AND p.Activo = 1 THEN 1 ELSE 0 END
        FROM dbo.CarritoItems AS ci
        INNER JOIN dbo.Variantes AS v WITH (UPDLOCK, HOLDLOCK)
            ON v.IDVariante = ci.IDVariante
        INNER JOIN dbo.Productos AS p
            ON p.IDProducto = v.IDProducto
        OUTER APPLY
        (
            SELECT SUM(r.CantidadReservada) AS UnidadesReservadas
            FROM dbo.ReservasExistencia AS r WITH (UPDLOCK, HOLDLOCK)
            WHERE r.IDVariante = v.IDVariante
              AND r.EstadoReserva = N'ACTIVA'
              AND r.FechaExpiracion > @Ahora
        ) AS res
        WHERE ci.IDCarrito = @IDCarrito
        ORDER BY v.IDVariante ASC;

        -- 4. Verificar si alguna variante está inactiva o sin existencia disponible suficiente
        DECLARE @ProductoSinStock NVARCHAR(300) = NULL;

        SELECT TOP (1)
            @ProductoSinStock = CASE
                WHEN vb.Activa = 0
                    THEN CONCAT(N'El producto "', vb.NombreProducto, N' (', vb.NombreVariante, N')" ya no se encuentra disponible.')
                ELSE
                    CONCAT(
                        N'Existencia insuficiente para "', vb.NombreProducto, N' - ', vb.NombreVariante,
                        N'" (SKU: ', vb.SKU, N'). Solicitado: ', vb.CantidadSolicitada,
                        N', Disponible: ', CASE WHEN vb.ExistenciaDisponible > 0 THEN vb.ExistenciaDisponible ELSE 0 END, N'.'
                    )
            END
        FROM @VariantesBloqueadas AS vb
        WHERE vb.Activa = 0
           OR vb.CantidadSolicitada > vb.ExistenciaDisponible
        ORDER BY vb.IDVariante ASC;

        IF @ProductoSinStock IS NOT NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50021, @ProductoSinStock, 1;
        END

        -- 5. Insertar las reservas activas por 15 minutos
        INSERT INTO dbo.ReservasExistencia
        (
            TokenReserva,
            IDCarrito,
            IDUsuario,
            IDVariante,
            CantidadReservada,
            EstadoReserva,
            FechaCreacion,
            FechaExpiracion
        )
        SELECT
            @TokenReserva,
            @IDCarrito,
            @IDUsuario,
            vb.IDVariante,
            vb.CantidadSolicitada,
            N'ACTIVA',
            @Ahora,
            @FechaExpiracion
        FROM @VariantesBloqueadas AS vb
        ORDER BY vb.IDVariante ASC;

        UPDATE dbo.Carritos
        SET FechaUltimaActividad = @Ahora
        WHERE IDCarrito = @IDCarrito;

    COMMIT TRAN;

    SELECT
        @TokenReserva AS TokenReserva,
        @IDCarrito AS IDCarrito,
        @IDUsuario AS IDUsuario,
        @Ahora AS FechaInicioReserva,
        @FechaExpiracion AS FechaExpiracion,
        @MinutosReserva AS MinutosVigencia,
        (
            SELECT
                r.IDReservaExistencia,
                r.IDVariante,
                v.SKU,
                v.NombreVariante,
                r.CantidadReservada,
                r.EstadoReserva,
                r.FechaExpiracion
            FROM dbo.ReservasExistencia AS r
            INNER JOIN dbo.Variantes AS v
                ON v.IDVariante = r.IDVariante
            WHERE r.TokenReserva = @TokenReserva
            FOR JSON PATH
        ) AS DetalleReservaJSON;
END
GO

PRINT N'07_SP_Catalogo_Inventario.sql ejecutado correctamente.';
GO
