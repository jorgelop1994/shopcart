/* ============================================================================
   Script: 04_Triggers_Inmutabilidad.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Triggers de defensa en profundidad en base de datos para
                garantizar que la Bitácora (RF-09), el Kardex (RF-03) y el
                Historial de Estados de Pedido (RF-07) sean estrictamente
                inmutables (Append-Only: prohibido UPDATE y DELETE).
   ============================================================================ */

USE [ShopCartDB];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

/* ============================================================================
   1. Trigger de Inmutabilidad sobre dbo.Bitacora (Criterio de Aceptación RF-09)
      "La bitácora no puede modificarse ni eliminarse."
   ============================================================================ */
CREATE OR ALTER TRIGGER dbo.TR_Bitacora_BloquearModificacionYEliminacion
ON dbo.Bitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50099, N'Operación rechazada: La bitácora de auditoría es inmutable y no puede modificarse ni eliminarse (RF-09).', 1;
END
GO

/* ============================================================================
   2. Trigger de Inmutabilidad sobre dbo.MovimientosKardex (Integridad RF-03)
      Todo ajuste o corrección debe hacerse mediante un nuevo movimiento en el
      Kardex; nunca alterando ni borrando movimientos históricos.
   ============================================================================ */
CREATE OR ALTER TRIGGER dbo.TR_MovimientosKardex_BloquearModificacionYEliminacion
ON dbo.MovimientosKardex
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50099, N'Operación rechazada: El historial de movimientos del Kardex es inmutable y no puede modificarse ni eliminarse (RF-03).', 1;
END
GO

/* ============================================================================
   3. Trigger de Inmutabilidad sobre dbo.HistorialEstadosPedido (RF-07)
   ============================================================================ */
CREATE OR ALTER TRIGGER dbo.TR_HistorialEstadosPedido_BloquearModificacionYEliminacion
ON dbo.HistorialEstadosPedido
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50099, N'Operación rechazada: El historial de estados de pedidos es inmutable y no puede modificarse ni eliminarse (RF-07).', 1;
END
GO

PRINT N'04_Triggers_Inmutabilidad.sql ejecutado correctamente.';
GO
