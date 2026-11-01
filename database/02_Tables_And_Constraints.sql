/* ============================================================================
   Script: 02_Tables_And_Constraints.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Creación del modelo relacional normalizado (3FN) con llaves
                primarias (ID<Nombre>), llaves foráneas, restricciones UNIQUE,
                NOT NULL, DEFAULT y CHECK.
                Prohibido el uso de FLOAT o REAL; todos los montos usan
                DECIMAL(12,2), porcentajes DECIMAL(5,2) y volúmenes INT.
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ============================================================================
   DOMINIO 1: AUTENTICACIÓN, USUARIOS Y CONTROL DE ACCESO (RF-01)
   ============================================================================ */

-- 1. Tabla: dbo.Roles
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles
    (
        IDRol         INT           IDENTITY(1,1) NOT NULL,
        NombreRol     NVARCHAR(30)  NOT NULL,
        Descripcion   NVARCHAR(200) NOT NULL,
        FechaCreacion DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Roles_FechaCreacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (IDRol ASC),
        CONSTRAINT UQ_Roles_NombreRol UNIQUE (NombreRol),
        CONSTRAINT CK_Roles_NombreValido CHECK (NombreRol IN (N'Cliente', N'Operador', N'Administrador'))
    );
END
GO

-- 2. Tabla: dbo.Usuarios
IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios
    (
        IDUsuario         INT           IDENTITY(1,1) NOT NULL,
        IDRol             INT           NOT NULL,
        NombreCompleto    NVARCHAR(150) NOT NULL,
        Correo            NVARCHAR(150) NOT NULL,
        PasswordHash      NVARCHAR(255) NOT NULL,
        Telefono          NVARCHAR(30)  NULL,
        Activo            BIT           NOT NULL
            CONSTRAINT DF_Usuarios_Activo DEFAULT (1),
        FechaCreacion     DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Usuarios_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Usuarios PRIMARY KEY CLUSTERED (IDUsuario ASC),
        CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (IDRol) REFERENCES dbo.Roles (IDRol),
        CONSTRAINT UQ_Usuarios_Correo UNIQUE (Correo),
        CONSTRAINT CK_Usuarios_NombreNoVacio CHECK (LEN(LTRIM(RTRIM(NombreCompleto))) >= 2),
        CONSTRAINT CK_Usuarios_CorreoFormato CHECK (Correo LIKE N'%_@_%.__%'),
        CONSTRAINT CK_Usuarios_PasswordHashNoVacio CHECK (LEN(LTRIM(RTRIM(PasswordHash))) >= 20)
    );
END
GO

-- 3. Tabla: dbo.TokensRefresh
IF OBJECT_ID(N'dbo.TokensRefresh', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TokensRefresh
    (
        IDTokenRefresh    INT           IDENTITY(1,1) NOT NULL,
        IDUsuario         INT           NOT NULL,
        TokenHash         NVARCHAR(128) NOT NULL,
        FamiliaToken      NVARCHAR(64)  NOT NULL,
        FechaExpiracion   DATETIME2(3)  NOT NULL,
        Revocado          BIT           NOT NULL
            CONSTRAINT DF_TokensRefresh_Revocado DEFAULT (0),
        MotivoRevocacion  NVARCHAR(100) NULL,
        ReemplazadoPorHash NVARCHAR(128) NULL,
        FechaCreacion     DATETIME2(3)  NOT NULL
            CONSTRAINT DF_TokensRefresh_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaRevocacion   DATETIME2(3)  NULL,

        CONSTRAINT PK_TokensRefresh PRIMARY KEY CLUSTERED (IDTokenRefresh ASC),
        CONSTRAINT FK_TokensRefresh_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT UQ_TokensRefresh_TokenHash UNIQUE (TokenHash),
        CONSTRAINT CK_TokensRefresh_Vigencia CHECK (FechaExpiracion > FechaCreacion)
    );
END
GO

-- 4. Tabla: dbo.Direcciones
IF OBJECT_ID(N'dbo.Direcciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Direcciones
    (
        IDDireccion      INT           IDENTITY(1,1) NOT NULL,
        IDUsuario        INT           NOT NULL,
        Alias            NVARCHAR(50)  NOT NULL,
        NombreReceptor   NVARCHAR(150) NOT NULL,
        TelefonoContacto NVARCHAR(30)  NOT NULL,
        Departamento     NVARCHAR(80)  NOT NULL,
        Municipio        NVARCHAR(80)  NOT NULL,
        DireccionExacta  NVARCHAR(300) NOT NULL,
        Referencias      NVARCHAR(250) NULL,
        EsPredeterminada BIT           NOT NULL
            CONSTRAINT DF_Direcciones_EsPredeterminada DEFAULT (0),
        Activa           BIT           NOT NULL
            CONSTRAINT DF_Direcciones_Activa DEFAULT (1),
        FechaCreacion    DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Direcciones_FechaCreacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Direcciones PRIMARY KEY CLUSTERED (IDDireccion ASC),
        CONSTRAINT FK_Direcciones_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT CK_Direcciones_AliasNoVacio CHECK (LEN(LTRIM(RTRIM(Alias))) >= 2),
        CONSTRAINT CK_Direcciones_ReceptorNoVacio CHECK (LEN(LTRIM(RTRIM(NombreReceptor))) >= 2),
        CONSTRAINT CK_Direcciones_DireccionNoVacia CHECK (LEN(LTRIM(RTRIM(DireccionExacta))) >= 5)
    );
END
GO

/* ============================================================================
   DOMINIO 2: CATÁLOGO DE PRODUCTOS, VARIANTES Y ATRIBUTOS (RF-02)
   ============================================================================ */

-- 5. Tabla: dbo.Categorias
IF OBJECT_ID(N'dbo.Categorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categorias
    (
        IDCategoria       INT           IDENTITY(1,1) NOT NULL,
        Nombre            NVARCHAR(100) NOT NULL,
        Descripcion       NVARCHAR(300) NULL,
        Activa            BIT           NOT NULL
            CONSTRAINT DF_Categorias_Activa DEFAULT (1),
        FechaCreacion     DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Categorias_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Categorias_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Categorias PRIMARY KEY CLUSTERED (IDCategoria ASC),
        CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre),
        CONSTRAINT CK_Categorias_NombreNoVacio CHECK (LEN(LTRIM(RTRIM(Nombre))) >= 2)
    );
END
GO

-- 6. Tabla: dbo.Productos
IF OBJECT_ID(N'dbo.Productos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Productos
    (
        IDProducto        INT           IDENTITY(1,1) NOT NULL,
        IDCategoria       INT           NOT NULL,
        Nombre            NVARCHAR(150) NOT NULL,
        Descripcion       NVARCHAR(MAX) NULL,
        Marca             NVARCHAR(80)  NULL,
        Activo            BIT           NOT NULL
            CONSTRAINT DF_Productos_Activo DEFAULT (1),
        FechaCreacion     DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Productos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Productos_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Productos PRIMARY KEY CLUSTERED (IDProducto ASC),
        CONSTRAINT FK_Productos_Categorias FOREIGN KEY (IDCategoria) REFERENCES dbo.Categorias (IDCategoria),
        CONSTRAINT CK_Productos_NombreNoVacio CHECK (LEN(LTRIM(RTRIM(Nombre))) >= 2)
    );
END
GO

-- 7. Tabla: dbo.ProductoImagenes
IF OBJECT_ID(N'dbo.ProductoImagenes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductoImagenes
    (
        IDProductoImagen INT           IDENTITY(1,1) NOT NULL,
        IDProducto       INT           NOT NULL,
        UrlImagen        NVARCHAR(500) NOT NULL,
        TextoAlternativo NVARCHAR(150) NULL,
        Orden            INT           NOT NULL
            CONSTRAINT DF_ProductoImagenes_Orden DEFAULT (1),
        EsPrincipal      BIT           NOT NULL
            CONSTRAINT DF_ProductoImagenes_EsPrincipal DEFAULT (0),

        CONSTRAINT PK_ProductoImagenes PRIMARY KEY CLUSTERED (IDProductoImagen ASC),
        CONSTRAINT FK_ProductoImagenes_Productos FOREIGN KEY (IDProducto) REFERENCES dbo.Productos (IDProducto),
        CONSTRAINT CK_ProductoImagenes_UrlNoVacia CHECK (LEN(LTRIM(RTRIM(UrlImagen))) >= 5),
        CONSTRAINT CK_ProductoImagenes_OrdenPositivo CHECK (Orden >= 1)
    );
END
GO

-- 8. Tabla: dbo.Variantes
IF OBJECT_ID(N'dbo.Variantes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Variantes
    (
        IDVariante        INT            IDENTITY(1,1) NOT NULL,
        IDProducto        INT            NOT NULL,
        SKU               NVARCHAR(60)   NOT NULL,
        NombreVariante    NVARCHAR(150)  NOT NULL,
        Precio            DECIMAL(12, 2) NOT NULL,
        ExistenciaFisica  INT            NOT NULL
            CONSTRAINT DF_Variantes_ExistenciaFisica DEFAULT (0),
        Activa            BIT            NOT NULL
            CONSTRAINT DF_Variantes_Activa DEFAULT (1),
        FechaCreacion     DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Variantes_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Variantes_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Variantes PRIMARY KEY CLUSTERED (IDVariante ASC),
        CONSTRAINT FK_Variantes_Productos FOREIGN KEY (IDProducto) REFERENCES dbo.Productos (IDProducto),
        CONSTRAINT UQ_Variantes_SKU UNIQUE (SKU),
        CONSTRAINT CK_Variantes_SKUNoVacio CHECK (LEN(LTRIM(RTRIM(SKU))) >= 3),
        CONSTRAINT CK_Variantes_PrecioNoNegativo CHECK (Precio >= 0.00),
        CONSTRAINT CK_Variantes_ExistenciaNoNegativa CHECK (ExistenciaFisica >= 0)
    );
END
GO

-- 9. Tabla: dbo.Atributos
IF OBJECT_ID(N'dbo.Atributos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Atributos
    (
        IDAtributo INT          IDENTITY(1,1) NOT NULL,
        Nombre     NVARCHAR(60) NOT NULL,
        Activo     BIT          NOT NULL
            CONSTRAINT DF_Atributos_Activo DEFAULT (1),

        CONSTRAINT PK_Atributos PRIMARY KEY CLUSTERED (IDAtributo ASC),
        CONSTRAINT UQ_Atributos_Nombre UNIQUE (Nombre),
        CONSTRAINT CK_Atributos_NombreNoVacio CHECK (LEN(LTRIM(RTRIM(Nombre))) >= 2)
    );
END
GO

-- 10. Tabla: dbo.ValoresAtributo
IF OBJECT_ID(N'dbo.ValoresAtributo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValoresAtributo
    (
        IDValorAtributo INT          IDENTITY(1,1) NOT NULL,
        IDAtributo      INT          NOT NULL,
        Valor           NVARCHAR(80) NOT NULL,

        CONSTRAINT PK_ValoresAtributo PRIMARY KEY CLUSTERED (IDValorAtributo ASC),
        CONSTRAINT FK_ValoresAtributo_Atributos FOREIGN KEY (IDAtributo) REFERENCES dbo.Atributos (IDAtributo),
        CONSTRAINT UQ_ValoresAtributo_AtributoValor UNIQUE (IDAtributo, Valor),
        CONSTRAINT CK_ValoresAtributo_ValorNoVacio CHECK (LEN(LTRIM(RTRIM(Valor))) >= 1)
    );
END
GO

-- 11. Tabla: dbo.VarianteValoresAtributo
IF OBJECT_ID(N'dbo.VarianteValoresAtributo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VarianteValoresAtributo
    (
        IDVarianteValorAtributo INT IDENTITY(1,1) NOT NULL,
        IDVariante              INT NOT NULL,
        IDAtributo              INT NOT NULL,
        IDValorAtributo         INT NOT NULL,

        CONSTRAINT PK_VarianteValoresAtributo PRIMARY KEY CLUSTERED (IDVarianteValorAtributo ASC),
        CONSTRAINT FK_VarianteValores_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT FK_VarianteValores_Atributos FOREIGN KEY (IDAtributo) REFERENCES dbo.Atributos (IDAtributo),
        CONSTRAINT FK_VarianteValores_ValoresAtributo FOREIGN KEY (IDValorAtributo) REFERENCES dbo.ValoresAtributo (IDValorAtributo),
        CONSTRAINT UQ_VarianteValores_UnValorPorAtributo UNIQUE (IDVariante, IDAtributo)
    );
END
GO

/* ============================================================================
   DOMINIO 3 Y 4: CUPONES, CARRITO DE COMPRAS Y RESERVAS DE EXISTENCIA (RF-04, RF-05, RF-06)
   ============================================================================ */

-- 12. Tabla: dbo.Cupones
IF OBJECT_ID(N'dbo.Cupones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Cupones
    (
        IDCupon             INT            IDENTITY(1,1) NOT NULL,
        Codigo              NVARCHAR(40)   NOT NULL,
        Descripcion         NVARCHAR(200)  NOT NULL,
        TipoDescuento       NVARCHAR(20)   NOT NULL,
        ValorDescuento      DECIMAL(12, 2) NOT NULL,
        IDCategoria         INT            NULL,
        MontoMinimoCompra   DECIMAL(12, 2) NOT NULL
            CONSTRAINT DF_Cupones_MontoMinimoCompra DEFAULT (0.00),
        LimiteUsoTotal      INT            NOT NULL,
        LimiteUsoPorCliente INT            NOT NULL
            CONSTRAINT DF_Cupones_LimiteUsoPorCliente DEFAULT (1),
        UsosActuales        INT            NOT NULL
            CONSTRAINT DF_Cupones_UsosActuales DEFAULT (0),
        FechaInicio         DATETIME2(3)   NOT NULL,
        FechaFin            DATETIME2(3)   NOT NULL,
        Activo              BIT            NOT NULL
            CONSTRAINT DF_Cupones_Activo DEFAULT (1),
        FechaCreacion       DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Cupones_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion   DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Cupones_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Cupones PRIMARY KEY CLUSTERED (IDCupon ASC),
        CONSTRAINT FK_Cupones_Categorias FOREIGN KEY (IDCategoria) REFERENCES dbo.Categorias (IDCategoria),
        CONSTRAINT UQ_Cupones_Codigo UNIQUE (Codigo),
        CONSTRAINT CK_Cupones_CodigoNoVacio CHECK (LEN(LTRIM(RTRIM(Codigo))) >= 3),
        CONSTRAINT CK_Cupones_TipoDescuento CHECK (TipoDescuento IN (N'PORCENTAJE', N'MONTO_FIJO')),
        CONSTRAINT CK_Cupones_ValorDescuento CHECK (
            ValorDescuento > 0.00
            AND (TipoDescuento = N'MONTO_FIJO' OR ValorDescuento <= 100.00)
        ),
        CONSTRAINT CK_Cupones_MontoMinimoNoNegativo CHECK (MontoMinimoCompra >= 0.00),
        CONSTRAINT CK_Cupones_LimiteTotalPositivo CHECK (LimiteUsoTotal > 0),
        CONSTRAINT CK_Cupones_LimiteClientePositivo CHECK (LimiteUsoPorCliente > 0),
        CONSTRAINT CK_Cupones_UsosActualesRango CHECK (UsosActuales >= 0 AND UsosActuales <= LimiteUsoTotal),
        CONSTRAINT CK_Cupones_FechasVigencia CHECK (FechaFin > FechaInicio)
    );
END
GO

-- 13. Tabla: dbo.Carritos
IF OBJECT_ID(N'dbo.Carritos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Carritos
    (
        IDCarrito            INT           IDENTITY(1,1) NOT NULL,
        IDUsuario            INT           NULL,
        TokenInvitado        NVARCHAR(100) NULL,
        IDCupon              INT           NULL,
        EstadoCarrito        NVARCHAR(20)  NOT NULL
            CONSTRAINT DF_Carritos_EstadoCarrito DEFAULT (N'ACTIVO'),
        FechaCreacion        DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Carritos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaUltimaActividad DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Carritos_FechaUltimaActividad DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Carritos PRIMARY KEY CLUSTERED (IDCarrito ASC),
        CONSTRAINT FK_Carritos_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT FK_Carritos_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
        CONSTRAINT CK_Carritos_EstadoValido CHECK (EstadoCarrito IN (N'ACTIVO', N'CONVERTIDO', N'FUSIONADO')),
        CONSTRAINT CK_Carritos_PropietarioRequerido CHECK (IDUsuario IS NOT NULL OR TokenInvitado IS NOT NULL)
    );
END
GO

-- 14. Tabla: dbo.CarritoItems
IF OBJECT_ID(N'dbo.CarritoItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CarritoItems
    (
        IDCarritoItem INT          IDENTITY(1,1) NOT NULL,
        IDCarrito     INT          NOT NULL,
        IDVariante    INT          NOT NULL,
        Cantidad      INT          NOT NULL,
        FechaAgregado DATETIME2(3) NOT NULL
            CONSTRAINT DF_CarritoItems_FechaAgregado DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_CarritoItems PRIMARY KEY CLUSTERED (IDCarritoItem ASC),
        CONSTRAINT FK_CarritoItems_Carritos FOREIGN KEY (IDCarrito) REFERENCES dbo.Carritos (IDCarrito),
        CONSTRAINT FK_CarritoItems_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT UQ_CarritoItems_CarritoVariante UNIQUE (IDCarrito, IDVariante),
        CONSTRAINT CK_CarritoItems_CantidadPositiva CHECK (Cantidad > 0)
    );
END
GO

-- 15. Tabla: dbo.ReservasExistencia
IF OBJECT_ID(N'dbo.ReservasExistencia', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReservasExistencia
    (
        IDReservaExistencia INT          IDENTITY(1,1) NOT NULL,
        TokenReserva        NVARCHAR(64) NOT NULL,
        IDCarrito           INT          NOT NULL,
        IDUsuario           INT          NOT NULL,
        IDVariante          INT          NOT NULL,
        CantidadReservada   INT          NOT NULL,
        EstadoReserva       NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ReservasExistencia_Estado DEFAULT (N'ACTIVA'),
        FechaCreacion       DATETIME2(3) NOT NULL
            CONSTRAINT DF_ReservasExistencia_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaExpiracion     DATETIME2(3) NOT NULL,
        FechaResolucion     DATETIME2(3) NULL,

        CONSTRAINT PK_ReservasExistencia PRIMARY KEY CLUSTERED (IDReservaExistencia ASC),
        CONSTRAINT FK_ReservasExistencia_Carritos FOREIGN KEY (IDCarrito) REFERENCES dbo.Carritos (IDCarrito),
        CONSTRAINT FK_ReservasExistencia_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT FK_ReservasExistencia_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT CK_ReservasExistencia_CantidadPositiva CHECK (CantidadReservada > 0),
        CONSTRAINT CK_ReservasExistencia_EstadoValido CHECK (EstadoReserva IN (N'ACTIVA', N'CONSUMIDA', N'LIBERADA', N'EXPIRADA')),
        CONSTRAINT CK_ReservasExistencia_VigenciaValida CHECK (FechaExpiracion > FechaCreacion)
    );
END
GO

/* ============================================================================
   DOMINIO 5: PEDIDOS, DETALLE CONGELADO, ESTADOS Y DEVOLUCIONES (RF-06 y RF-07)
   ============================================================================ */

-- 16. Tabla: dbo.Pedidos
IF OBJECT_ID(N'dbo.Pedidos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pedidos
    (
        IDPedido                 INT            IDENTITY(1,1) NOT NULL,
        NumeroPedido             NVARCHAR(30)   NOT NULL,
        IDUsuario                INT            NOT NULL,
        IDDireccionEntrega       INT            NOT NULL,
        IDCarritoOrigen          INT            NOT NULL,
        IDCupon                  INT            NULL,
        CodigoCuponSnapshot      NVARCHAR(40)   NULL,
        ClaveIdempotencia        NVARCHAR(100)  NOT NULL,
        TokenReservaUtilizado    NVARCHAR(64)   NOT NULL,
        EstadoPedido             NVARCHAR(30)   NOT NULL
            CONSTRAINT DF_Pedidos_EstadoPedido DEFAULT (N'Pagado'),
        Subtotal                 DECIMAL(12, 2) NOT NULL,
        MontoDescuento           DECIMAL(12, 2) NOT NULL
            CONSTRAINT DF_Pedidos_MontoDescuento DEFAULT (0.00),
        PorcentajeIVA            DECIMAL(5, 2)  NOT NULL
            CONSTRAINT DF_Pedidos_PorcentajeIVA DEFAULT (12.00),
        MontoIVAIncluido         DECIMAL(12, 2) NOT NULL,
        Total                    DECIMAL(12, 2) NOT NULL,
        MontoReintegradoAcumulado DECIMAL(12, 2) NOT NULL
            CONSTRAINT DF_Pedidos_MontoReintegrado DEFAULT (0.00),
        DireccionEntregaSnapshot NVARCHAR(MAX)  NOT NULL,
        MetodoPago               NVARCHAR(40)   NOT NULL,
        ReferenciaPago           NVARCHAR(100)  NOT NULL,
        FechaCreacion            DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Pedidos_FechaCreacion DEFAULT (SYSDATETIME()),
        FechaModificacion        DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Pedidos_FechaModificacion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Pedidos PRIMARY KEY CLUSTERED (IDPedido ASC),
        CONSTRAINT FK_Pedidos_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT FK_Pedidos_Direcciones FOREIGN KEY (IDDireccionEntrega) REFERENCES dbo.Direcciones (IDDireccion),
        CONSTRAINT FK_Pedidos_Carritos FOREIGN KEY (IDCarritoOrigen) REFERENCES dbo.Carritos (IDCarrito),
        CONSTRAINT FK_Pedidos_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
        CONSTRAINT UQ_Pedidos_NumeroPedido UNIQUE (NumeroPedido),
        CONSTRAINT UQ_Pedidos_ClaveIdempotencia UNIQUE (ClaveIdempotencia),
        CONSTRAINT CK_Pedidos_EstadoValido CHECK (
            EstadoPedido IN (
                N'Pagado',
                N'EnPreparacion',
                N'Despachado',
                N'Entregado',
                N'Cancelado',
                N'DevueltoParcial',
                N'DevueltoTotal'
            )
        ),
        CONSTRAINT CK_Pedidos_MontosNoNegativos CHECK (
            Subtotal >= 0.00
            AND MontoDescuento >= 0.00
            AND PorcentajeIVA >= 0.00
            AND MontoIVAIncluido >= 0.00
            AND Total >= 0.00
        ),
        CONSTRAINT CK_Pedidos_ReintegroRango CHECK (
            MontoReintegradoAcumulado >= 0.00
            AND MontoReintegradoAcumulado <= Total
        )
    );
END
GO

-- 17. Tabla: dbo.DetallePedidos
IF OBJECT_ID(N'dbo.DetallePedidos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DetallePedidos
    (
        IDDetallePedido            INT            IDENTITY(1,1) NOT NULL,
        IDPedido                   INT            NOT NULL,
        IDVariante                 INT            NOT NULL,
        SKUSnapshot                NVARCHAR(60)   NOT NULL,
        NombreProductoSnapshot     NVARCHAR(200)  NOT NULL,
        CantidadComprada           INT            NOT NULL,
        CantidadDevuelta           INT            NOT NULL
            CONSTRAINT DF_DetallePedidos_CantidadDevuelta DEFAULT (0),
        PrecioUnitarioCongelado    DECIMAL(12, 2) NOT NULL,
        SubtotalLinea              DECIMAL(12, 2) NOT NULL,
        DescuentoProporcionalLinea DECIMAL(12, 2) NOT NULL
            CONSTRAINT DF_DetallePedidos_DescuentoLinea DEFAULT (0.00),
        TotalLineaNeto             DECIMAL(12, 2) NOT NULL,

        CONSTRAINT PK_DetallePedidos PRIMARY KEY CLUSTERED (IDDetallePedido ASC),
        CONSTRAINT FK_DetallePedidos_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
        CONSTRAINT FK_DetallePedidos_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT UQ_DetallePedidos_PedidoVariante UNIQUE (IDPedido, IDVariante),
        CONSTRAINT CK_DetallePedidos_CantidadCompradaPositiva CHECK (CantidadComprada > 0),
        CONSTRAINT CK_DetallePedidos_LimiteDevolucion CHECK (
            CantidadDevuelta >= 0
            AND CantidadDevuelta <= CantidadComprada
        ),
        CONSTRAINT CK_DetallePedidos_PrecioNoNegativo CHECK (PrecioUnitarioCongelado >= 0.00),
        CONSTRAINT CK_DetallePedidos_SubtotalExacto CHECK (SubtotalLinea = CantidadComprada * PrecioUnitarioCongelado),
        CONSTRAINT CK_DetallePedidos_DescuentoRango CHECK (
            DescuentoProporcionalLinea >= 0.00
            AND DescuentoProporcionalLinea <= SubtotalLinea
        ),
        CONSTRAINT CK_DetallePedidos_TotalNetoExacto CHECK (TotalLineaNeto = SubtotalLinea - DescuentoProporcionalLinea)
    );
END
GO

-- 18. Tabla: dbo.UsosCupon
IF OBJECT_ID(N'dbo.UsosCupon', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsosCupon
    (
        IDUsoCupon             INT            IDENTITY(1,1) NOT NULL,
        IDCupon                INT            NOT NULL,
        IDUsuario              INT            NOT NULL,
        IDPedido               INT            NOT NULL,
        MontoDescuentoAplicado DECIMAL(12, 2) NOT NULL,
        Activo                 BIT            NOT NULL
            CONSTRAINT DF_UsosCupon_Activo DEFAULT (1),
        FechaUso               DATETIME2(3)   NOT NULL
            CONSTRAINT DF_UsosCupon_FechaUso DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_UsosCupon PRIMARY KEY CLUSTERED (IDUsoCupon ASC),
        CONSTRAINT FK_UsosCupon_Cupones FOREIGN KEY (IDCupon) REFERENCES dbo.Cupones (IDCupon),
        CONSTRAINT FK_UsosCupon_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT FK_UsosCupon_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
        CONSTRAINT UQ_UsosCupon_UnCuponPorPedido UNIQUE (IDPedido),
        CONSTRAINT CK_UsosCupon_MontoNoNegativo CHECK (MontoDescuentoAplicado >= 0.00)
    );
END
GO

-- 19. Tabla: dbo.TransicionesEstadoPedido
IF OBJECT_ID(N'dbo.TransicionesEstadoPedido', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TransicionesEstadoPedido
    (
        IDTransicionEstado   INT           IDENTITY(1,1) NOT NULL,
        EstadoOrigen         NVARCHAR(30)  NOT NULL,
        EstadoDestino        NVARCHAR(30)  NOT NULL,
        PermiteCliente       BIT           NOT NULL
            CONSTRAINT DF_Transiciones_PermiteCliente DEFAULT (0),
        PermiteOperador      BIT           NOT NULL
            CONSTRAINT DF_Transiciones_PermiteOperador DEFAULT (1),
        PermiteAdministrador BIT           NOT NULL
            CONSTRAINT DF_Transiciones_PermiteAdmin DEFAULT (1),
        DescripcionRegla     NVARCHAR(200) NOT NULL,

        CONSTRAINT PK_TransicionesEstadoPedido PRIMARY KEY CLUSTERED (IDTransicionEstado ASC),
        CONSTRAINT UQ_TransicionesEstadoPedido_OrigenDestino UNIQUE (EstadoOrigen, EstadoDestino)
    );
END
GO

/* Semilla base de la Máquina de Estados de Pedidos (RF-07) */
MERGE INTO dbo.TransicionesEstadoPedido AS Target
USING (
    VALUES
        (N'Pagado',          N'EnPreparacion',   0, 1, 1, N'El Operador o Administrador inicia la preparación del pedido en bodega.'),
        (N'Pagado',          N'Cancelado',       1, 1, 1, N'Cancelación permitida antes de despacho; reintegra existencias al Kardex.'),
        (N'EnPreparacion',   N'Despachado',      0, 1, 1, N'El Operador o Administrador despacha el pedido hacia la dirección de entrega.'),
        (N'EnPreparacion',   N'Cancelado',       1, 1, 1, N'Cancelación permitida mientras no haya sido despachado; reintegra existencias al Kardex.'),
        (N'Despachado',      N'Entregado',       0, 1, 1, N'Confirmación de entrega final al cliente.'),
        (N'Entregado',       N'DevueltoParcial', 0, 1, 1, N'Devolución parcial de líneas o unidades entregadas.'),
        (N'Entregado',       N'DevueltoTotal',   0, 1, 1, N'Devolución del 100% de las unidades del pedido.'),
        (N'DevueltoParcial', N'DevueltoParcial', 0, 1, 1, N'Devolución parcial adicional sobre líneas restantes.'),
        (N'DevueltoParcial', N'DevueltoTotal',   0, 1, 1, N'Devolución que completa el 100% de las unidades compradas.')
) AS Source (EstadoOrigen, EstadoDestino, PermiteCliente, PermiteOperador, PermiteAdministrador, DescripcionRegla)
ON Target.EstadoOrigen = Source.EstadoOrigen AND Target.EstadoDestino = Source.EstadoDestino
WHEN NOT MATCHED BY TARGET THEN
    INSERT (EstadoOrigen, EstadoDestino, PermiteCliente, PermiteOperador, PermiteAdministrador, DescripcionRegla)
    VALUES (Source.EstadoOrigen, Source.EstadoDestino, Source.PermiteCliente, Source.PermiteOperador, Source.PermiteAdministrador, Source.DescripcionRegla);
GO

-- 20. Tabla: dbo.HistorialEstadosPedido
IF OBJECT_ID(N'dbo.HistorialEstadosPedido', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialEstadosPedido
    (
        IDHistorialEstadoPedido INT           IDENTITY(1,1) NOT NULL,
        IDPedido                INT           NOT NULL,
        IDUsuario               INT           NOT NULL,
        EstadoAnterior          NVARCHAR(30)  NULL,
        EstadoNuevo             NVARCHAR(30)  NOT NULL,
        MotivoComentario        NVARCHAR(300) NULL,
        FechaCambio             DATETIME2(3)  NOT NULL
            CONSTRAINT DF_HistorialEstadosPedido_FechaCambio DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_HistorialEstadosPedido PRIMARY KEY CLUSTERED (IDHistorialEstadoPedido ASC),
        CONSTRAINT FK_HistorialEstadosPedido_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
        CONSTRAINT FK_HistorialEstadosPedido_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario)
    );
END
GO

-- 21. Tabla: dbo.Devoluciones
IF OBJECT_ID(N'dbo.Devoluciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Devoluciones
    (
        IDDevolucion          INT            IDENTITY(1,1) NOT NULL,
        IDPedido              INT            NOT NULL,
        IDUsuarioRegistra     INT            NOT NULL,
        TipoDevolucion        NVARCHAR(20)   NOT NULL,
        MotivoDevolucion      NVARCHAR(300)  NOT NULL,
        MontoTotalReintegrado DECIMAL(12, 2) NOT NULL,
        FechaDevolucion       DATETIME2(3)   NOT NULL
            CONSTRAINT DF_Devoluciones_FechaDevolucion DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Devoluciones PRIMARY KEY CLUSTERED (IDDevolucion ASC),
        CONSTRAINT FK_Devoluciones_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
        CONSTRAINT FK_Devoluciones_Usuarios FOREIGN KEY (IDUsuarioRegistra) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT CK_Devoluciones_TipoValido CHECK (TipoDevolucion IN (N'PARCIAL', N'TOTAL')),
        CONSTRAINT CK_Devoluciones_MotivoNoVacio CHECK (LEN(LTRIM(RTRIM(MotivoDevolucion))) >= 3),
        CONSTRAINT CK_Devoluciones_MontoNoNegativo CHECK (MontoTotalReintegrado >= 0.00)
    );
END
GO

-- 22. Tabla: dbo.DetalleDevoluciones
IF OBJECT_ID(N'dbo.DetalleDevoluciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DetalleDevoluciones
    (
        IDDetalleDevolucion  INT            IDENTITY(1,1) NOT NULL,
        IDDevolucion         INT            NOT NULL,
        IDDetallePedido      INT            NOT NULL,
        IDVariante           INT            NOT NULL,
        CantidadDevuelta     INT            NOT NULL,
        MontoReintegradoLinea DECIMAL(12, 2) NOT NULL,

        CONSTRAINT PK_DetalleDevoluciones PRIMARY KEY CLUSTERED (IDDetalleDevolucion ASC),
        CONSTRAINT FK_DetalleDevoluciones_Devoluciones FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devoluciones (IDDevolucion),
        CONSTRAINT FK_DetalleDevoluciones_DetallePedidos FOREIGN KEY (IDDetallePedido) REFERENCES dbo.DetallePedidos (IDDetallePedido),
        CONSTRAINT FK_DetalleDevoluciones_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT CK_DetalleDevoluciones_CantidadPositiva CHECK (CantidadDevuelta > 0),
        CONSTRAINT CK_DetalleDevoluciones_MontoNoNegativo CHECK (MontoReintegradoLinea >= 0.00)
    );
END
GO

/* ============================================================================
   DOMINIO 3 Y 6: KARDEX DE INVENTARIO (RF-03) Y BITÁCORA INMUTABLE (RF-09)
   ============================================================================ */

-- 23. Tabla: dbo.MovimientosKardex
IF OBJECT_ID(N'dbo.MovimientosKardex', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MovimientosKardex
    (
        IDMovimientoKardex INT           IDENTITY(1,1) NOT NULL,
        IDVariante         INT           NOT NULL,
        IDUsuario          INT           NOT NULL,
        IDPedido           INT           NULL,
        IDDevolucion       INT           NULL,
        TipoMovimiento     NVARCHAR(30)  NOT NULL,
        Cantidad           INT           NOT NULL,
        SaldoAnterior      INT           NOT NULL,
        SaldoPosterior     INT           NOT NULL,
        Motivo             NVARCHAR(300) NOT NULL,
        FechaMovimiento    DATETIME2(3)  NOT NULL
            CONSTRAINT DF_MovimientosKardex_Fecha DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_MovimientosKardex PRIMARY KEY CLUSTERED (IDMovimientoKardex ASC),
        CONSTRAINT FK_MovimientosKardex_Variantes FOREIGN KEY (IDVariante) REFERENCES dbo.Variantes (IDVariante),
        CONSTRAINT FK_MovimientosKardex_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT FK_MovimientosKardex_Pedidos FOREIGN KEY (IDPedido) REFERENCES dbo.Pedidos (IDPedido),
        CONSTRAINT FK_MovimientosKardex_Devoluciones FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devoluciones (IDDevolucion),
        CONSTRAINT CK_MovimientosKardex_TipoValido CHECK (
            TipoMovimiento IN (
                N'ENTRADA_COMPRA',
                N'SALIDA_VENTA',
                N'AJUSTE_ENTRADA',
                N'AJUSTE_SALIDA',
                N'DEVOLUCION_CLIENTE',
                N'REINGRESO_CANCELACION'
            )
        ),
        CONSTRAINT CK_MovimientosKardex_SignoCantidad CHECK (
            (TipoMovimiento IN (N'ENTRADA_COMPRA', N'AJUSTE_ENTRADA', N'DEVOLUCION_CLIENTE', N'REINGRESO_CANCELACION') AND Cantidad > 0)
            OR
            (TipoMovimiento IN (N'SALIDA_VENTA', N'AJUSTE_SALIDA') AND Cantidad < 0)
        ),
        CONSTRAINT CK_MovimientosKardex_SaldoAnteriorNoNeg CHECK (SaldoAnterior >= 0),
        CONSTRAINT CK_MovimientosKardex_SaldoPosteriorExacto CHECK (
            SaldoPosterior >= 0
            AND SaldoPosterior = SaldoAnterior + Cantidad
        ),
        CONSTRAINT CK_MovimientosKardex_MotivoObligatorio CHECK (LEN(LTRIM(RTRIM(Motivo))) >= 3)
    );
END
GO

-- 24. Tabla: dbo.Bitacora
IF OBJECT_ID(N'dbo.Bitacora', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Bitacora
    (
        IDBitacora    INT           IDENTITY(1,1) NOT NULL,
        IDUsuario     INT           NULL,
        Modulo        NVARCHAR(40)  NOT NULL,
        Entidad       NVARCHAR(60)  NOT NULL,
        IDEntidad     NVARCHAR(60)  NOT NULL,
        Accion        NVARCHAR(40)  NOT NULL,
        ValorAnterior NVARCHAR(MAX) NULL,
        ValorNuevo    NVARCHAR(MAX) NULL,
        FechaHora     DATETIME2(3)  NOT NULL
            CONSTRAINT DF_Bitacora_FechaHora DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_Bitacora PRIMARY KEY CLUSTERED (IDBitacora ASC),
        CONSTRAINT FK_Bitacora_Usuarios FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuarios (IDUsuario),
        CONSTRAINT CK_Bitacora_ModuloValido CHECK (
            Modulo IN (
                N'PRODUCTOS',
                N'PRECIOS',
                N'EXISTENCIAS',
                N'CUPONES',
                N'PEDIDOS',
                N'CATEGORIAS',
                N'USUARIOS'
            )
        ),
        CONSTRAINT CK_Bitacora_AccionValida CHECK (
            Accion IN (
                N'CREACION',
                N'MODIFICACION',
                N'DESACTIVACION',
                N'REACTIVACION',
                N'CAMBIO_PRECIO',
                N'MOVIMIENTO_INVENTARIO',
                N'CAMBIO_ESTADO_PEDIDO'
            )
        )
    );
END
GO

PRINT N'02_Tables_And_Constraints.sql ejecutado correctamente.';
GO
