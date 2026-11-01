/* ============================================================================
   Script: 11_Seed_Data.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Datos semilla reproducibles e idempotentes.
                Incluye roles, credenciales de prueba, direcciones, categorías,
                atributos, 12 productos con sus variantes e inventario inicial
                cuadrado en el Kardex, cupones (vigentes, por categoría, límite 1
                y vencido), pedidos históricos en distintos estados, devolución
                parcial y carritos abandonados para el Dashboard.
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- Si ya existen datos semilla en Productos, omitir para mantener idempotencia
IF EXISTS (SELECT 1 FROM dbo.Productos)
BEGIN
    PRINT N'Los datos semilla ya se encuentran cargados en [ShopCartDB]. Omitiendo reinserción.';
    RETURN;
END
GO

PRINT N'Insertando datos semilla en [ShopCartDB]...';
GO

/* ============================================================================
   1. ROLES DEL SISTEMA (RF-01)
   ============================================================================ */
INSERT INTO dbo.Roles (NombreRol, Descripcion)
VALUES
    (N'Administrador', N'Acceso total: catálogo, precios, inventario, pedidos, cupones, usuarios, dashboard y bitácora.'),
    (N'Operador',      N'Gestión operativa de pedidos (preparación, despacho, entrega, devoluciones) e inventario/kardex.'),
    (N'Cliente',       N'Navegación de catálogo, carrito de compras, uso de cupones, checkout y seguimiento de sus propios pedidos.');
GO

/* ============================================================================
   2. USUARIOS DE PRUEBA (Credenciales documentadas en el README)
      - admin@shopcart.com.gt    -> Admin123!
      - operador@shopcart.com.gt -> Operador123!
      - cliente@shopcart.com.gt  -> Cliente123!
      - maria.garcia@correo.gt   -> Cliente123!
      - carlos.mendez@correo.gt  -> Cliente123!
   ============================================================================ */
DECLARE @IDRolAdmin    INT = (SELECT IDRol FROM dbo.Roles WHERE NombreRol = N'Administrador');
DECLARE @IDRolOperador INT = (SELECT IDRol FROM dbo.Roles WHERE NombreRol = N'Operador');
DECLARE @IDRolCliente  INT = (SELECT IDRol FROM dbo.Roles WHERE NombreRol = N'Cliente');

INSERT INTO dbo.Usuarios (IDRol, NombreCompleto, Correo, PasswordHash, Telefono, Activo)
VALUES
    (@IDRolAdmin,    N'Arturo Castillo (Admin)',     N'admin@shopcart.com.gt',    N'$2a$10$amxaLjI4rC3TcrfNwL3MhuRKjEZwLQgZKkKE4v2fXo4M7dUcRWBca', N'5510-1001', 1),
    (@IDRolOperador, N'Sofía Morales (Operador)',    N'operador@shopcart.com.gt', N'$2a$10$LPNt225hqPWeBDf6gl978OBUwJCyYgYgWdNjV3Vy0ae8glOu1ZX7uPS', N'5510-2002', 1),
    (@IDRolCliente,  N'Jorge López',                 N'cliente@shopcart.com.gt',  N'$2a$10$UxUG4Tn1jsSoTeyfQT.63uyWVcabywh5sulu6JIZ5QpFw93g.7FdK', N'5520-3003', 1),
    (@IDRolCliente,  N'María Fernanda García',       N'maria.garcia@correo.gt',   N'$2a$10$UxUG4Tn1jsSoTeyfQT.63uyWVcabywh5sulu6JIZ5QpFw93g.7FdK', N'5530-4004', 1),
    (@IDRolCliente,  N'Carlos Eduardo Méndez',       N'carlos.mendez@correo.gt',  N'$2a$10$UxUG4Tn1jsSoTeyfQT.63uyWVcabywh5sulu6JIZ5QpFw93g.7FdK', N'5540-5005', 1),
    (@IDRolCliente,  N'Roberto Pérez (Desactivado)', N'inactivo@correo.gt',       N'$2a$10$UxUG4Tn1jsSoTeyfQT.63uyWVcabywh5sulu6JIZ5QpFw93g.7FdK', N'5550-6006', 0);

-- Corregir exactamente el hash de operador@shopcart.com.gt (60 caracteres bcrypt)
UPDATE dbo.Usuarios
SET PasswordHash = N'$2a$10$LPNt225hqPWeBDf6gl978OBUwJCyYgWdNjV3Vy0ae8glOu1ZX7uPS'
WHERE Correo = N'operador@shopcart.com.gt';
GO

/* ============================================================================
   3. DIRECCIONES DE CLIENTES
   ============================================================================ */
DECLARE @IDClienteJorge  INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'cliente@shopcart.com.gt');
DECLARE @IDClienteMaria  INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'maria.garcia@correo.gt');
DECLARE @IDClienteCarlos INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'carlos.mendez@correo.gt');

EXEC dbo.SP_Direcciones_Crear
    @IDUsuario        = @IDClienteJorge,
    @Alias            = N'Casa Zona 14',
    @NombreReceptor   = N'Jorge López',
    @TelefonoContacto = N'5520-3003',
    @Departamento     = N'Guatemala',
    @Municipio        = N'Guatemala',
    @DireccionExacta  = N'5a Avenida 12-45 Zona 14, Edificio Europlaza Apto 8B',
    @Referencias      = N'Frente a parqueo de visitas, garita color gris',
    @EsPredeterminada = 1;

EXEC dbo.SP_Direcciones_Crear
    @IDUsuario        = @IDClienteJorge,
    @Alias            = N'Oficina Zona 10',
    @NombreReceptor   = N'Jorge López',
    @TelefonoContacto = N'5520-3003',
    @Departamento     = N'Guatemala',
    @Municipio        = N'Guatemala',
    @DireccionExacta  = N'Diagonal 6 10-01 Zona 10, Centro Gerencial Las Margaritas Torre II Nivel 11',
    @Referencias      = N'Recepción principal nivel 1',
    @EsPredeterminada = 0;

EXEC dbo.SP_Direcciones_Crear
    @IDUsuario        = @IDClienteMaria,
    @Alias            = N'Casa Antigua',
    @NombreReceptor   = N'María Fernanda García',
    @TelefonoContacto = N'5530-4004',
    @Departamento     = N'Sacatepéquez',
    @Municipio        = N'Antigua Guatemala',
    @DireccionExacta  = N'4a Calle Oriente No. 28, Condominio Jardines de Santiago',
    @Referencias      = N'Portón de madera junto a fuente colonial',
    @EsPredeterminada = 1;

EXEC dbo.SP_Direcciones_Crear
    @IDUsuario        = @IDClienteCarlos,
    @Alias            = N'Residencia San Cristóbal',
    @NombreReceptor   = N'Carlos Eduardo Méndez',
    @TelefonoContacto = N'5540-5005',
    @Departamento     = N'Guatemala',
    @Municipio        = N'Mixco',
    @DireccionExacta  = N'Bulevar Principal Ciudad San Cristóbal Zona 8 de Mixco, Sector A-3 Casa 19',
    @Referencias      = N'Dos cuadras después del centro comercial',
    @EsPredeterminada = 1;
GO

/* ============================================================================
   4. CATEGORÍAS Y ATRIBUTOS DE VARIANTES (RF-02)
   ============================================================================ */
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.com.gt');

EXEC dbo.SP_Catalogo_CrearCategoria @IDUsuario = @IDAdmin, @Nombre = N'Ropa y Moda',             @Descripcion = N'Prendas casuales, camisas, chumpas y básicos de alta calidad.';
EXEC dbo.SP_Catalogo_CrearCategoria @IDUsuario = @IDAdmin, @Nombre = N'Calzado y Deportivos',    @Descripcion = N'Tenis deportivos, botas urbanas y calzado de alto confort.';
EXEC dbo.SP_Catalogo_CrearCategoria @IDUsuario = @IDAdmin, @Nombre = N'Tecnología y Accesorios', @Descripcion = N'Audífonos, teclados mecánicos, cargadores y gadgets.';
EXEC dbo.SP_Catalogo_CrearCategoria @IDUsuario = @IDAdmin, @Nombre = N'Hogar y Cafetería',       @Descripcion = N'Termos térmicos, prensas francesas y artículos para el hogar.';
EXEC dbo.SP_Catalogo_CrearCategoria @IDUsuario = @IDAdmin, @Nombre = N'Mochilas y Viaje',        @Descripcion = N'Mochilas porta-laptop impermeables y bolsos de viaje.';

-- Atributos: Talla, Color, Capacidad
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'S';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'M';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'L';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'XL';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'40';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'41';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Talla',     @Valor = N'42';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Color',     @Valor = N'Negro';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Color',     @Valor = N'Blanco';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Color',     @Valor = N'Azul Marino';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Color',     @Valor = N'Verde Olivo';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Color',     @Valor = N'Gris Espacial';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Capacidad', @Valor = N'500ml';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Capacidad', @Valor = N'750ml';
EXEC dbo.SP_Catalogo_GuardarAtributoYValor @NombreAtributo = N'Capacidad', @Valor = N'15.6 Pulgadas';
GO

/* ============================================================================
   5. PRODUCTOS, IMÁGENES Y VARIANTES CON INVENTARIO INICIAL EN KARDEX
      Todos los precios están en Quetzales e incluyen el 12% de IVA.
   ============================================================================ */
DECLARE @IDAdmin   INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.com.gt');
DECLARE @CatRopa   INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Ropa y Moda');
DECLARE @CatCalz   INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Calzado y Deportivos');
DECLARE @CatTec    INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Tecnología y Accesorios');
DECLARE @CatHogar  INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Hogar y Cafetería');
DECLARE @CatMochi  INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Mochilas y Viaje');

DECLARE @AttrTalla INT = (SELECT IDAtributo FROM dbo.Atributos WHERE Nombre = N'Talla');
DECLARE @AttrColor INT = (SELECT IDAtributo FROM dbo.Atributos WHERE Nombre = N'Color');
DECLARE @AttrCap   INT = (SELECT IDAtributo FROM dbo.Atributos WHERE Nombre = N'Capacidad');

DECLARE @ValM      INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrTalla AND Valor = N'M');
DECLARE @ValL      INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrTalla AND Valor = N'L');
DECLARE @Val40     INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrTalla AND Valor = N'40');
DECLARE @Val42     INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrTalla AND Valor = N'42');
DECLARE @ValNegro  INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrColor AND Valor = N'Negro');
DECLARE @ValBlanco INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrColor AND Valor = N'Blanco');
DECLARE @ValAzul   INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrColor AND Valor = N'Azul Marino');
DECLARE @ValVerde  INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrColor AND Valor = N'Verde Olivo');
DECLARE @ValGris   INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrColor AND Valor = N'Gris Espacial');
DECLARE @Val500    INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrCap   AND Valor = N'500ml');
DECLARE @Val750    INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrCap   AND Valor = N'750ml');
DECLARE @Val15P    INT = (SELECT IDValorAtributo FROM dbo.ValoresAtributo WHERE IDAtributo = @AttrCap   AND Valor = N'15.6 Pulgadas');

-- Producto 1: Camisa Oxford Premium
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatRopa,
    @Nombre       = N'Camisa Oxford Algodón Pima',
    @Descripcion  = N'Camisa de corte moderno confeccionada en 100% algodón Pima transpirable.',
    @Marca        = N'Don Arturo Collection',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Camisa Oxford","orden":1,"esPrincipal":1}]';

DECLARE @P1 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Camisa Oxford Algodón Pima');
DECLARE @AttrJSON1 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @ValM, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValAzul, N'}]');
DECLARE @AttrJSON2 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @ValL, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValBlanco, N'}]');

EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P1, @SKU = N'ROP-OXF-M-AZU', @NombreVariante = N'Talla M - Azul Marino', @Precio = 280.00, @ExistenciaInicial = 25, @AtributosJSON = @AttrJSON1;
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P1, @SKU = N'ROP-OXF-L-BLA', @NombreVariante = N'Talla L - Blanco',      @Precio = 280.00, @ExistenciaInicial = 20, @AtributosJSON = @AttrJSON2;

-- Producto 2: Chumpa Impermeable Rompevientos
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatRopa,
    @Nombre       = N'Chumpa Impermeable Rompevientos Sierra',
    @Descripcion  = N'Chumpa térmica ligera con costuras selladas y capucha ajustable para clima frío y lluvia.',
    @Marca        = N'Pentandra Outdoor',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Chumpa Impermeable","orden":1,"esPrincipal":1}]';

DECLARE @P2 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Chumpa Impermeable Rompevientos Sierra');
DECLARE @AttrJSON3 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @ValM, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValVerde, N'}]');
DECLARE @AttrJSON4 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @ValL, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValNegro, N'}]');

EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P2, @SKU = N'ROP-CHU-M-VER', @NombreVariante = N'Talla M - Verde Olivo', @Precio = 450.00, @ExistenciaInicial = 15, @AtributosJSON = @AttrJSON3;
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P2, @SKU = N'ROP-CHU-L-NEG', @NombreVariante = N'Talla L - Negro',       @Precio = 450.00, @ExistenciaInicial = 12, @AtributosJSON = @AttrJSON4;

-- Producto 3: Tenis Running CloudStep
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatCalz,
    @Nombre       = N'Tenis Running CloudStep Pro',
    @Descripcion  = N'Calzado deportivo con suela de amortiguación reactiva y malla respirable.',
    @Marca        = N'CloudStep',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Tenis Running","orden":1,"esPrincipal":1}]';

DECLARE @P3 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Tenis Running CloudStep Pro');
DECLARE @AttrJSON5 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @Val40, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValNegro, N'}]');
DECLARE @AttrJSON6 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrTalla, N',"idValorAtributo":', @Val42, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValBlanco, N'}]');

EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P3, @SKU = N'CAL-RUN-40-NEG', @NombreVariante = N'Talla 40 - Negro',  @Precio = 620.00, @ExistenciaInicial = 18, @AtributosJSON = @AttrJSON5;
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P3, @SKU = N'CAL-RUN-42-BLA', @NombreVariante = N'Talla 42 - Blanco', @Precio = 620.00, @ExistenciaInicial = 14, @AtributosJSON = @AttrJSON6;

-- Producto 4: Botines Urbanos de Cuero
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatCalz,
    @Nombre       = N'Botines Urbanos de Cuero Artesanal',
    @Descripcion  = N'Botines de cuero genuino cosidos a mano con plantilla ortopédica de larga duración.',
    @Marca        = N'Don Arturo Footwear',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Botines de Cuero","orden":1,"esPrincipal":1}]';

DECLARE @P4 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Botines Urbanos de Cuero Artesanal');
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P4, @SKU = N'CAL-BOT-42-NEG', @NombreVariante = N'Talla 42 - Negro Clásico', @Precio = 790.00, @ExistenciaInicial = 10, @AtributosJSON = @AttrJSON5;

-- Producto 5: Audífonos Inalámbricos ANC Pro (Edición con 1 última unidad para prueba de concurrencia RF-06)
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatTec,
    @Nombre       = N'Audífonos Inalámbricos Studio ANC Pro',
    @Descripcion  = N'Cancelación activa de ruido híbrida, 40 horas de batería y audio de alta fidelidad.',
    @Marca        = N'SonicPulse',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Audífonos ANC","orden":1,"esPrincipal":1}]';

DECLARE @P5 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Audífonos Inalámbricos Studio ANC Pro');
DECLARE @AttrJSON7 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValNegro, N'}]');
DECLARE @AttrJSON8 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValGris, N'}]');

EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P5, @SKU = N'TEC-AUD-PRO-BLK', @NombreVariante = N'Negro Mate (Edición Limitada)', @Precio = 896.00, @ExistenciaInicial = 1,  @AtributosJSON = @AttrJSON7;
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P5, @SKU = N'TEC-AUD-PRO-GRY', @NombreVariante = N'Gris Espacial',                 @Precio = 896.00, @ExistenciaInicial = 20, @AtributosJSON = @AttrJSON8;

-- Producto 6: Teclado Mecánico Inalámbrico RGB
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatTec,
    @Nombre       = N'Teclado Mecánico Compacto 75% Hot-Swap',
    @Descripcion  = N'Switches táctiles lubricados de fábrica, conexión triple (Bluetooth, 2.4GHz y USB-C).',
    @Marca        = N'KeyCraft',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Teclado Mecánico","orden":1,"esPrincipal":1}]';

DECLARE @P6 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Teclado Mecánico Compacto 75% Hot-Swap');
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P6, @SKU = N'TEC-KB75-GRY', @NombreVariante = N'Layout Español - Gris Espacial', @Precio = 560.00, @ExistenciaInicial = 16, @AtributosJSON = @AttrJSON8;

-- Producto 7: Termo Térmico de Acero Inoxidable
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatHogar,
    @Nombre       = N'Termo Insulado Acero Inoxidable Volcán',
    @Descripcion  = N'Doble pared al vacío que conserva bebidas calientes por 12 horas y frías por 24 horas.',
    @Marca        = N'Pentandra Home',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Termo Acero","orden":1,"esPrincipal":1}]';

DECLARE @P7 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Termo Insulado Acero Inoxidable Volcán');
DECLARE @AttrJSON9  NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrCap, N',"idValorAtributo":', @Val500, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValNegro, N'}]');
DECLARE @AttrJSON10 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrCap, N',"idValorAtributo":', @Val750, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValVerde, N'}]');

EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P7, @SKU = N'HOG-TER-500-NEG', @NombreVariante = N'500ml - Negro',       @Precio = 168.00, @ExistenciaInicial = 35, @AtributosJSON = @AttrJSON9;
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P7, @SKU = N'HOG-TER-750-VER', @NombreVariante = N'750ml - Verde Olivo', @Precio = 210.00, @ExistenciaInicial = 30, @AtributosJSON = @AttrJSON10;

-- Producto 8: Prensa Francesa Barista + Café de Antigua
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatHogar,
    @Nombre       = N'Set Prensa Francesa Borosilicato + Café Reserva Antigua',
    @Descripcion  = N'Prensa francesa de vidrio de borosilicato con filtro triple e infusión de café de altura.',
    @Marca        = N'Don Arturo Café',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Prensa Francesa","orden":1,"esPrincipal":1}]';

DECLARE @P8 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Set Prensa Francesa Borosilicato + Café Reserva Antigua');
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P8, @SKU = N'HOG-PRE-750-STD', @NombreVariante = N'750ml + 400g Café Grano', @Precio = 336.00, @ExistenciaInicial = 22, @AtributosJSON = NULL;

-- Producto 9: Mochila Ejecutiva Antirrobo Impermeable
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatMochi,
    @Nombre       = N'Mochila Ejecutiva Impermeable Nomad Pro',
    @Descripcion  = N'Compartimento acolchado para laptop de 15.6 pulgadas, puerto USB y tela repelente al agua.',
    @Marca        = N'NomadGear',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Mochila Ejecutiva","orden":1,"esPrincipal":1}]';

DECLARE @P9 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Mochila Ejecutiva Impermeable Nomad Pro');
DECLARE @AttrJSON11 NVARCHAR(MAX) = CONCAT(N'[{"idAtributo":', @AttrCap, N',"idValorAtributo":', @Val15P, N'},{"idAtributo":', @AttrColor, N',"idValorAtributo":', @ValNegro, N'}]');
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P9, @SKU = N'MOC-NOM-15-NEG', @NombreVariante = N'15.6 Pulgadas - Negro Carbón', @Precio = 504.00, @ExistenciaInicial = 20, @AtributosJSON = @AttrJSON11;

-- Producto 10: Bolso Duffle de Viaje Fin de Semana
EXEC dbo.SP_Catalogo_CrearProducto
    @IDUsuario    = @IDAdmin,
    @IDCategoria  = @CatMochi,
    @Nombre       = N'Bolso Weekender Lona Encerada y Cuero',
    @Descripcion  = N'Bolso de mano para viajes cortos con compartimento independiente para calzado.',
    @Marca        = N'NomadGear',
    @ImagenesJSON = N'[{"urlImagen":"https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=800&q=80","textoAlternativo":"Bolso Weekender","orden":1,"esPrincipal":1}]';

DECLARE @P10 INT = (SELECT IDProducto FROM dbo.Productos WHERE Nombre = N'Bolso Weekender Lona Encerada y Cuero');
EXEC dbo.SP_Catalogo_GuardarVariante @IDUsuario = @IDAdmin, @IDProducto = @P10, @SKU = N'MOC-WKD-VER', @NombreVariante = N'Capacidad 45L - Verde Olivo', @Precio = 672.00, @ExistenciaInicial = 12, @AtributosJSON = NULL;
GO

/* ============================================================================
   6. CUPONES DE DESCUENTO (RF-05)
   ============================================================================ */
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'admin@shopcart.com.gt');
DECLARE @CatRopa INT = (SELECT IDCategoria FROM dbo.Categorias WHERE Nombre = N'Ropa y Moda');
DECLARE @Ahora   DATETIME2(3) = SYSDATETIME();
DECLARE @InicioVigente DATETIME2(3) = DATEADD(DAY, -30, @Ahora);
DECLARE @FinVigencia   DATETIME2(3) = DATEADD(DAY,  60, @Ahora);
DECLARE @InicioVencido DATETIME2(3) = DATEADD(DAY, -90, @Ahora);
DECLARE @FinVencido    DATETIME2(3) = DATEADD(DAY, -10, @Ahora);

-- 1. Cupón de 10% en todo el carrito
EXEC dbo.SP_Cupones_Guardar
    @IDUsuario           = @IDAdmin,
    @Codigo              = N'BIENVENIDA10',
    @Descripcion         = N'10% de descuento en toda la tienda en compras desde Q150.00',
    @TipoDescuento       = N'PORCENTAJE',
    @ValorDescuento      = 10.00,
    @IDCategoria         = NULL,
    @MontoMinimoCompra   = 150.00,
    @LimiteUsoTotal      = 100,
    @LimiteUsoPorCliente = 2,
    @FechaInicio         = @InicioVigente,
    @FechaFin            = @FinVigencia,
    @Activo              = 1;

-- 2. Cupón de Q50.00 monto fijo en todo el carrito
EXEC dbo.SP_Cupones_Guardar
    @IDUsuario           = @IDAdmin,
    @Codigo              = N'QUETZAL50',
    @Descripcion         = N'Q50.00 de descuento directo en compras mayores o iguales a Q300.00',
    @TipoDescuento       = N'MONTO_FIJO',
    @ValorDescuento      = 50.00,
    @IDCategoria         = NULL,
    @MontoMinimoCompra   = 300.00,
    @LimiteUsoTotal      = 50,
    @LimiteUsoPorCliente = 1,
    @FechaInicio         = @InicioVigente,
    @FechaFin            = @FinVigencia,
    @Activo              = 1;

-- 3. Cupón de 20% exclusivo para la categoría "Ropa y Moda"
EXEC dbo.SP_Cupones_Guardar
    @IDUsuario           = @IDAdmin,
    @Codigo              = N'MODA20',
    @Descripcion         = N'20% de descuento exclusivo en la categoría Ropa y Moda (mínimo Q200.00)',
    @TipoDescuento       = N'PORCENTAJE',
    @ValorDescuento      = 20.00,
    @IDCategoria         = @CatRopa,
    @MontoMinimoCompra   = 200.00,
    @LimiteUsoTotal      = 30,
    @LimiteUsoPorCliente = 2,
    @FechaInicio         = @InicioVigente,
    @FechaFin            = @FinVigencia,
    @Activo              = 1;

-- 4. Cupón con límite total = 1 uso (para demostrar concurrencia en uso de cupón RF-05)
EXEC dbo.SP_Cupones_Guardar
    @IDUsuario           = @IDAdmin,
    @Codigo              = N'ULTIMO1',
    @Descripcion         = N'Cupón relámpago de Q25.00 limitado a 1 único uso global en el sistema',
    @TipoDescuento       = N'MONTO_FIJO',
    @ValorDescuento      = 25.00,
    @IDCategoria         = NULL,
    @MontoMinimoCompra   = 100.00,
    @LimiteUsoTotal      = 1,
    @LimiteUsoPorCliente = 1,
    @FechaInicio         = @InicioVigente,
    @FechaFin            = @FinVigencia,
    @Activo              = 1;

-- 5. Cupón vencido (para probar mensaje específico de rechazo RF-05)
EXEC dbo.SP_Cupones_Guardar
    @IDUsuario           = @IDAdmin,
    @Codigo              = N'VENCIDO2025',
    @Descripcion         = N'Promoción de temporada anterior (vencida)',
    @TipoDescuento       = N'PORCENTAJE',
    @ValorDescuento      = 15.00,
    @IDCategoria         = NULL,
    @MontoMinimoCompra   = 100.00,
    @LimiteUsoTotal      = 20,
    @LimiteUsoPorCliente = 1,
    @FechaInicio         = @InicioVencido,
    @FechaFin            = @FinVencido,
    @Activo              = 1;
GO

/* ============================================================================
   7. PEDIDOS DEMOSTRATIVOS EJECUTANDO EL FLUJO REAL DE CHECKOUT, MÁQUINA DE
      ESTADOS, DEVOLUCIÓN PARCIAL Y CARRITOS ABANDONADOS
   ============================================================================ */
DECLARE @IDOperador      INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'operador@shopcart.com.gt');
DECLARE @IDClienteJorge  INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'cliente@shopcart.com.gt');
DECLARE @IDClienteMaria  INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'maria.garcia@correo.gt');
DECLARE @IDClienteCarlos INT = (SELECT IDUsuario FROM dbo.Usuarios WHERE Correo = N'carlos.mendez@correo.gt');

DECLARE @DirJorge  INT = (SELECT TOP 1 IDDireccion FROM dbo.Direcciones WHERE IDUsuario = @IDClienteJorge AND EsPredeterminada = 1);
DECLARE @DirMaria  INT = (SELECT TOP 1 IDDireccion FROM dbo.Direcciones WHERE IDUsuario = @IDClienteMaria AND EsPredeterminada = 1);
DECLARE @DirCarlos INT = (SELECT TOP 1 IDDireccion FROM dbo.Direcciones WHERE IDUsuario = @IDClienteCarlos AND EsPredeterminada = 1);

DECLARE @VarCamisaM INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'ROP-OXF-M-AZU');
DECLARE @VarChumpaM INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'ROP-CHU-M-VER');
DECLARE @VarTenis40 INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'CAL-RUN-40-NEG');
DECLARE @VarAudGris INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'TEC-AUD-PRO-GRY');
DECLARE @VarTeclado INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'TEC-KB75-GRY');
DECLARE @VarTermo   INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'HOG-TER-500-NEG');
DECLARE @VarPrensa  INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'HOG-PRE-750-STD');
DECLARE @VarMochila INT = (SELECT IDVariante FROM dbo.Variantes WHERE SKU = N'MOC-NOM-15-NEG');

-- ----------------------------------------------------------------------------
-- PEDIDO 1 (Cliente Jorge): Compra con cupón BIENVENIDA10 -> Avanza hasta Entregado
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteJorge, @IDVariante = @VarCamisaM, @Cantidad = 2;
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteJorge, @IDVariante = @VarTermo,   @Cantidad = 1;
EXEC dbo.SP_Carrito_AplicarCupon          @IDUsuario = @IDClienteJorge, @CodigoCupon = N'BIENVENIDA10';

DECLARE @IDCar1 INT = (SELECT IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDClienteJorge AND EstadoCarrito = N'ACTIVO');
EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCar1, @IDUsuario = @IDClienteJorge;
DECLARE @Tok1 NVARCHAR(64) = (SELECT TOP 1 TokenReserva FROM dbo.ReservasExistencia WHERE IDCarrito = @IDCar1 AND EstadoReserva = N'ACTIVA');

EXEC dbo.SP_Pedidos_CrearPedido
    @IDUsuario          = @IDClienteJorge,
    @IDCarrito          = @IDCar1,
    @IDDireccionEntrega = @DirJorge,
    @TokenReserva       = @Tok1,
    @ClaveIdempotencia  = N'SEED-IDEMP-ORD-0001',
    @MetodoPago         = N'TARJETA_CREDITO',
    @ReferenciaPago     = N'AUTH-GT-10001';

DECLARE @IDPed1 INT = (SELECT IDPedido FROM dbo.Pedidos WHERE ClaveIdempotencia = N'SEED-IDEMP-ORD-0001');
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed1, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'EnPreparacion', @MotivoComentario = N'Pedido empacado en bodega central.';
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed1, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'Despachado',    @MotivoComentario = N'Enviado con guía de mensajería #GT-9001.';
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed1, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'Entregado',     @MotivoComentario = N'Recibido conforme en Zona 14.';

-- Fechar Pedido 1 hace 12 días para enriquecer las gráficas por día/semana del Dashboard
UPDATE dbo.Pedidos SET FechaCreacion = DATEADD(DAY, -12, SYSDATETIME()) WHERE IDPedido = @IDPed1;

-- ----------------------------------------------------------------------------
-- PEDIDO 2 (Cliente María): Compra de Tenis (2 pares) y Mochila -> Entregado -> Devolución Parcial de 1 par de Tenis
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteMaria, @IDVariante = @VarTenis40, @Cantidad = 2;
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteMaria, @IDVariante = @VarMochila, @Cantidad = 1;
EXEC dbo.SP_Carrito_AplicarCupon          @IDUsuario = @IDClienteMaria, @CodigoCupon = N'QUETZAL50';

DECLARE @IDCar2 INT = (SELECT IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDClienteMaria AND EstadoCarrito = N'ACTIVO');
EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCar2, @IDUsuario = @IDClienteMaria;
DECLARE @Tok2 NVARCHAR(64) = (SELECT TOP 1 TokenReserva FROM dbo.ReservasExistencia WHERE IDCarrito = @IDCar2 AND EstadoReserva = N'ACTIVA');

EXEC dbo.SP_Pedidos_CrearPedido
    @IDUsuario          = @IDClienteMaria,
    @IDCarrito          = @IDCar2,
    @IDDireccionEntrega = @DirMaria,
    @TokenReserva       = @Tok2,
    @ClaveIdempotencia  = N'SEED-IDEMP-ORD-0002',
    @MetodoPago         = N'TARJETA_CREDITO',
    @ReferenciaPago     = N'AUTH-GT-10002';

DECLARE @IDPed2 INT = (SELECT IDPedido FROM dbo.Pedidos WHERE ClaveIdempotencia = N'SEED-IDEMP-ORD-0002');
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed2, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'EnPreparacion';
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed2, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'Despachado';
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed2, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'Entregado';

DECLARE @IDDetTenis INT = (SELECT IDDetallePedido FROM dbo.DetallePedidos WHERE IDPedido = @IDPed2 AND IDVariante = @VarTenis40);
DECLARE @JsonDev NVARCHAR(MAX) = CONCAT(N'[{"idDetallePedido":', @IDDetTenis, N',"cantidadADevolver":1}]');

EXEC dbo.SP_Pedidos_RegistrarDevolucion
    @IDPedido             = @IDPed2,
    @IDUsuarioEjecutor    = @IDOperador,
    @MotivoDevolucion     = N'Devolución parcial de 1 par de tenis por cambio de talla.',
    @LineasDevolucionJSON = @JsonDev;

UPDATE dbo.Pedidos SET FechaCreacion = DATEADD(DAY, -5, SYSDATETIME()) WHERE IDPedido = @IDPed2;

-- ----------------------------------------------------------------------------
-- PEDIDO 3 (Cliente Carlos): Compra de Audífonos y Teclado -> Estado EnPreparacion
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteCarlos, @IDVariante = @VarAudGris, @Cantidad = 1;
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteCarlos, @IDVariante = @VarTeclado, @Cantidad = 1;

DECLARE @IDCar3 INT = (SELECT IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDClienteCarlos AND EstadoCarrito = N'ACTIVO');
EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCar3, @IDUsuario = @IDClienteCarlos;
DECLARE @Tok3 NVARCHAR(64) = (SELECT TOP 1 TokenReserva FROM dbo.ReservasExistencia WHERE IDCarrito = @IDCar3 AND EstadoReserva = N'ACTIVA');

EXEC dbo.SP_Pedidos_CrearPedido
    @IDUsuario          = @IDClienteCarlos,
    @IDCarrito          = @IDCar3,
    @IDDireccionEntrega = @DirCarlos,
    @TokenReserva       = @Tok3,
    @ClaveIdempotencia  = N'SEED-IDEMP-ORD-0003',
    @MetodoPago         = N'TARJETA_DEBITO',
    @ReferenciaPago     = N'AUTH-GT-10003';

DECLARE @IDPed3 INT = (SELECT IDPedido FROM dbo.Pedidos WHERE ClaveIdempotencia = N'SEED-IDEMP-ORD-0003');
EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPed3, @IDUsuarioEjecutor = @IDOperador, @RolEjecutor = N'Operador', @EstadoNuevo = N'EnPreparacion', @MotivoComentario = N'En revisión de control de calidad.';

UPDATE dbo.Pedidos SET FechaCreacion = DATEADD(DAY, -2, SYSDATETIME()) WHERE IDPedido = @IDPed3;

-- ----------------------------------------------------------------------------
-- PEDIDO 4 (Cliente Jorge): Compra de Prensa Francesa -> Cancelado antes de despacho (Reintegra stock al Kardex)
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteJorge, @IDVariante = @VarPrensa, @Cantidad = 1;

DECLARE @IDCar4 INT = (SELECT IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDClienteJorge AND EstadoCarrito = N'ACTIVO');
EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCar4, @IDUsuario = @IDClienteJorge;
DECLARE @Tok4 NVARCHAR(64) = (SELECT TOP 1 TokenReserva FROM dbo.ReservasExistencia WHERE IDCarrito = @IDCar4 AND EstadoReserva = N'ACTIVA');

EXEC dbo.SP_Pedidos_CrearPedido
    @IDUsuario          = @IDClienteJorge,
    @IDCarrito          = @IDCar4,
    @IDDireccionEntrega = @DirJorge,
    @TokenReserva       = @Tok4,
    @ClaveIdempotencia  = N'SEED-IDEMP-ORD-0004',
    @MetodoPago         = N'TARJETA_CREDITO',
    @ReferenciaPago     = N'AUTH-GT-10004';

DECLARE @IDPed4 INT = (SELECT IDPedido FROM dbo.Pedidos WHERE ClaveIdempotencia = N'SEED-IDEMP-ORD-0004');
EXEC dbo.SP_Pedidos_CambiarEstado
    @IDPedido          = @IDPed4,
    @IDUsuarioEjecutor = @IDClienteJorge,
    @RolEjecutor       = N'Cliente',
    @EstadoNuevo       = N'Cancelado',
    @MotivoComentario  = N'Cancelado por el cliente antes de ser despachado.';

-- ----------------------------------------------------------------------------
-- PEDIDO 5 (Cliente María - Hoy): Compra con cupón MODA20 -> Estado Pagado
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteMaria, @IDVariante = @VarChumpaM, @Cantidad = 1;
EXEC dbo.SP_Carrito_AplicarCupon          @IDUsuario = @IDClienteMaria, @CodigoCupon = N'MODA20';

DECLARE @IDCar5 INT = (SELECT IDCarrito FROM dbo.Carritos WHERE IDUsuario = @IDClienteMaria AND EstadoCarrito = N'ACTIVO');
EXEC dbo.SP_Inventario_ReservarExistencia @IDCarrito = @IDCar5, @IDUsuario = @IDClienteMaria;
DECLARE @Tok5 NVARCHAR(64) = (SELECT TOP 1 TokenReserva FROM dbo.ReservasExistencia WHERE IDCarrito = @IDCar5 AND EstadoReserva = N'ACTIVA');

EXEC dbo.SP_Pedidos_CrearPedido
    @IDUsuario          = @IDClienteMaria,
    @IDCarrito          = @IDCar5,
    @IDDireccionEntrega = @DirMaria,
    @TokenReserva       = @Tok5,
    @ClaveIdempotencia  = N'SEED-IDEMP-ORD-0005',
    @MetodoPago         = N'TARJETA_CREDITO',
    @ReferenciaPago     = N'AUTH-GT-10005';

-- ----------------------------------------------------------------------------
-- CARRITOS ABANDONADOS DEMOSTRATIVOS (Más de 120 minutos sin actividad)
-- ----------------------------------------------------------------------------
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteCarlos, @IDVariante = @VarChumpaM, @Cantidad = 1;
EXEC dbo.SP_Carrito_AgregarOModificarItem @IDUsuario = @IDClienteCarlos, @IDVariante = @VarTermo,   @Cantidad = 2;

UPDATE dbo.Carritos
SET FechaUltimaActividad = DATEADD(HOUR, -6, SYSDATETIME())
WHERE IDUsuario = @IDClienteCarlos
  AND EstadoCarrito = N'ACTIVO';

EXEC dbo.SP_Carrito_AgregarOModificarItem @TokenInvitado = N'guest-seed-token-998877', @IDVariante = @VarMochila, @Cantidad = 1;

UPDATE dbo.Carritos
SET FechaUltimaActividad = DATEADD(HOUR, -14, SYSDATETIME())
WHERE TokenInvitado = N'guest-seed-token-998877'
  AND EstadoCarrito = N'ACTIVO';
GO

PRINT N'11_Seed_Data.sql ejecutado correctamente.';
GO
