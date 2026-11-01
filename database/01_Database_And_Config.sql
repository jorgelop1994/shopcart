/* ============================================================================
   Script: 01_Database_And_Config.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Creación idempotente de la base de datos ShopCartDB,
                configuración de aislamiento por versionamiento de filas
                (READ_COMMITTED_SNAPSHOT) y tabla de parámetros del sistema.
   Estándar: SQL Server 2019 / 2022
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_ID(N'ShopCartDB') IS NULL
BEGIN
    PRINT N'Creando base de datos [ShopCartDB]...';
    CREATE DATABASE [ShopCartDB];
END
GO

ALTER DATABASE [ShopCartDB] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

USE [ShopCartDB];
GO

/* ============================================================================
   Tabla: dbo.ConfiguracionSistema
   Propósito: Parámetros globales configurables (tiempo de reserva de checkout,
              umbral de carrito abandonado, tasa de IVA en Guatemala).
   ============================================================================ */
IF OBJECT_ID(N'dbo.ConfiguracionSistema', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConfiguracionSistema
    (
        IDConfiguracion   INT            IDENTITY(1,1) NOT NULL,
        Clave             NVARCHAR(60)   NOT NULL,
        Valor             NVARCHAR(200)  NOT NULL,
        Descripcion       NVARCHAR(300)  NOT NULL,
        FechaModificacion DATETIME2(3)   NOT NULL
            CONSTRAINT DF_ConfiguracionSistema_FechaMod DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_ConfiguracionSistema PRIMARY KEY CLUSTERED (IDConfiguracion ASC),
        CONSTRAINT UQ_ConfiguracionSistema_Clave UNIQUE (Clave),
        CONSTRAINT CK_ConfiguracionSistema_ClaveNoVacia CHECK (LEN(LTRIM(RTRIM(Clave))) > 0),
        CONSTRAINT CK_ConfiguracionSistema_ValorNoVacio CHECK (LEN(LTRIM(RTRIM(Valor))) > 0)
    );
END
GO

/* Inserción idempotente de parámetros base del negocio */
MERGE INTO dbo.ConfiguracionSistema AS Target
USING (
    VALUES
        (N'MINUTOS_RESERVA_CHECKOUT',   N'15',    N'Tiempo en minutos que dura la reserva temporal de existencia durante el checkout (RF-06).'),
        (N'MINUTOS_CARRITO_ABANDONADO', N'120',   N'Minutos de inactividad para considerar un carrito con productos como abandonado (Glosario / RF-08).'),
        (N'PORCENTAJE_IVA',             N'12.00', N'Porcentaje de IVA incluido en los precios publicados en Quetzales (12%).'),
        (N'MONEDA_CODIGO',              N'GTQ',   N'Código ISO de moneda oficial (Quetzales).'),
        (N'MONEDA_SIMBOLO',             N'Q',     N'Símbolo monetario mostrado en tienda y reportes.')
) AS Source (Clave, Valor, Descripcion)
ON Target.Clave = Source.Clave
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Clave, Valor, Descripcion)
    VALUES (Source.Clave, Source.Valor, Source.Descripcion);
GO

PRINT N'01_Database_And_Config.sql ejecutado correctamente.';
GO
