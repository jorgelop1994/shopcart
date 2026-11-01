/* ============================================================================
   Script: 06_SP_Auth_Usuarios_Direcciones.sql
   Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
   Descripción: Procedimientos almacenados del módulo RF-01:
                - Registro y autenticación de usuarios
                - Gestión y rotación de Refresh Tokens con detección de reúso
                - Administración de usuarios y desactivación lógica
                - CRUD de direcciones con validación anti-IDOR por IDUsuario
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
   1. SP_Auth_RegistrarCliente
      Registra un nuevo cliente con correo único y hash seguro de contraseña.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarCliente
    @NombreCompleto NVARCHAR(150),
    @Correo         NVARCHAR(150),
    @PasswordHash   NVARCHAR(255),
    @Telefono       NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CorreoNorm NVARCHAR(150) = LOWER(LTRIM(RTRIM(ISNULL(@Correo, N''))));
    DECLARE @NombreNorm NVARCHAR(150) = LTRIM(RTRIM(ISNULL(@NombreCompleto, N'')));
    DECLARE @IDRolCliente INT;
    DECLARE @IDUsuarioNuevo INT;

    IF LEN(@NombreNorm) < 2 OR LEN(@CorreoNorm) < 5 OR LEN(ISNULL(@PasswordHash, N'')) < 20
        THROW 50001, N'Datos de registro incompletos o inválidos.', 1;

    SELECT @IDRolCliente = IDRol
    FROM dbo.Roles
    WHERE NombreRol = N'Cliente';

    IF @IDRolCliente IS NULL
        THROW 50002, N'El rol Cliente no está configurado en el sistema.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = @CorreoNorm)
        THROW 50003, N'Ya existe una cuenta registrada con este correo electrónico.', 1;

    BEGIN TRAN;

        INSERT INTO dbo.Usuarios (IDRol, NombreCompleto, Correo, PasswordHash, Telefono, Activo)
        VALUES (@IDRolCliente, @NombreNorm, @CorreoNorm, @PasswordHash, NULLIF(LTRIM(RTRIM(@Telefono)), N''), 1);

        SET @IDUsuarioNuevo = SCOPE_IDENTITY();

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuarioNuevo,
            N'USUARIOS',
            N'Usuarios',
            CAST(@IDUsuarioNuevo AS NVARCHAR(60)),
            N'CREACION',
            NULL,
            (
                SELECT
                    u.IDUsuario,
                    u.NombreCompleto,
                    u.Correo,
                    N'Cliente' AS Rol,
                    u.Activo
                FROM dbo.Usuarios AS u
                WHERE u.IDUsuario = @IDUsuarioNuevo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    SELECT
        u.IDUsuario,
        u.IDRol,
        r.NombreRol,
        u.NombreCompleto,
        u.Correo,
        u.Telefono,
        u.Activo,
        u.FechaCreacion
    FROM dbo.Usuarios AS u
    INNER JOIN dbo.Roles AS r
        ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuarioNuevo;
END
GO

/* ============================================================================
   2. SP_Auth_ObtenerUsuarioPorCorreo
      Recupera la información del usuario y su hash de contraseña para login.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerUsuarioPorCorreo
    @Correo NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CorreoNorm NVARCHAR(150) = LOWER(LTRIM(RTRIM(ISNULL(@Correo, N''))));

    SELECT
        u.IDUsuario,
        u.IDRol,
        r.NombreRol,
        u.NombreCompleto,
        u.Correo,
        u.PasswordHash,
        u.Telefono,
        u.Activo,
        u.FechaCreacion
    FROM dbo.Usuarios AS u
    INNER JOIN dbo.Roles AS r
        ON r.IDRol = u.IDRol
    WHERE u.Correo = @CorreoNorm;
END
GO

/* ============================================================================
   3. SP_Auth_GuardarRefreshToken
      Persiste un nuevo Refresh Token tras iniciar sesión.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_GuardarRefreshToken
    @IDUsuario       INT,
    @TokenHash       NVARCHAR(128),
    @FamiliaToken    NVARCHAR(64),
    @FechaExpiracion DATETIME2(3)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario AND Activo = 1)
        THROW 50010, N'El usuario no existe o se encuentra desactivado.', 1;

    INSERT INTO dbo.TokensRefresh (IDUsuario, TokenHash, FamiliaToken, FechaExpiracion, Revocado)
    VALUES (@IDUsuario, @TokenHash, @FamiliaToken, @FechaExpiracion, 0);

    SELECT
        SCOPE_IDENTITY() AS IDTokenRefresh,
        @IDUsuario AS IDUsuario,
        @FamiliaToken AS FamiliaToken,
        @FechaExpiracion AS FechaExpiracion;
END
GO

/* ============================================================================
   4. SP_Auth_RotarRefreshToken
      Ejecuta la rotación atómica del Refresh Token (RF-01):
      - Si el token entrante ya fue revocado previamente, invalida toda la
        familia de tokens de esa sesión por posible robo de credenciales.
      - Si está vigente, lo marca como revocado por rotación y registra el nuevo.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RotarRefreshToken
    @TokenHashActual    NVARCHAR(128),
    @TokenHashNuevo     NVARCHAR(128),
    @FechaExpiracionNueva DATETIME2(3)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDTokenRefresh  INT;
    DECLARE @IDUsuario       INT;
    DECLARE @FamiliaToken    NVARCHAR(64);
    DECLARE @FechaExpiracion DATETIME2(3);
    DECLARE @Revocado        BIT;
    DECLARE @UsuarioActivo   BIT;
    DECLARE @NombreRol       NVARCHAR(30);
    DECLARE @NombreCompleto  NVARCHAR(150);
    DECLARE @Correo          NVARCHAR(150);

    BEGIN TRAN;

        SELECT
            @IDTokenRefresh  = tr.IDTokenRefresh,
            @IDUsuario       = tr.IDUsuario,
            @FamiliaToken    = tr.FamiliaToken,
            @FechaExpiracion = tr.FechaExpiracion,
            @Revocado        = tr.Revocado,
            @UsuarioActivo   = u.Activo,
            @NombreRol       = r.NombreRol,
            @NombreCompleto  = u.NombreCompleto,
            @Correo          = u.Correo
        FROM dbo.TokensRefresh AS tr WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Usuarios AS u
            ON u.IDUsuario = tr.IDUsuario
        INNER JOIN dbo.Roles AS r
            ON r.IDRol = u.IDRol
        WHERE tr.TokenHash = @TokenHashActual;

        IF @IDTokenRefresh IS NULL
        BEGIN
            ROLLBACK TRAN;
            THROW 50010, N'Refresh token inválido o no reconocido.', 1;
        END

        -- Detección de reúso de token ya rotado (compromiso de seguridad)
        IF @Revocado = 1
        BEGIN
            UPDATE dbo.TokensRefresh
            SET Revocado = 1,
                MotivoRevocacion = N'ROBO_DETECTADO_REUSO_TOKEN',
                FechaRevocacion = SYSDATETIME()
            WHERE FamiliaToken = @FamiliaToken
              AND Revocado = 0;

            COMMIT TRAN;
            THROW 50011, N'El refresh token ya fue utilizado previamente. Por seguridad se revocó la sesión.', 1;
        END

        IF @UsuarioActivo = 0
        BEGIN
            UPDATE dbo.TokensRefresh
            SET Revocado = 1,
                MotivoRevocacion = N'USUARIO_DESACTIVADO',
                FechaRevocacion = SYSDATETIME()
            WHERE IDUsuario = @IDUsuario
              AND Revocado = 0;

            COMMIT TRAN;
            THROW 50010, N'La cuenta del usuario se encuentra desactivada.', 1;
        END

        IF @FechaExpiracion <= SYSDATETIME()
        BEGIN
            UPDATE dbo.TokensRefresh
            SET Revocado = 1,
                MotivoRevocacion = N'EXPIRADO',
                FechaRevocacion = SYSDATETIME()
            WHERE IDTokenRefresh = @IDTokenRefresh;

            COMMIT TRAN;
            THROW 50010, N'El refresh token ha expirado. Inicie sesión nuevamente.', 1;
        END

        -- Rotar: revocar el token actual y registrar el nuevo en la misma familia
        UPDATE dbo.TokensRefresh
        SET Revocado = 1,
            MotivoRevocacion = N'ROTACION',
            ReemplazadoPorHash = @TokenHashNuevo,
            FechaRevocacion = SYSDATETIME()
        WHERE IDTokenRefresh = @IDTokenRefresh;

        INSERT INTO dbo.TokensRefresh (IDUsuario, TokenHash, FamiliaToken, FechaExpiracion, Revocado)
        VALUES (@IDUsuario, @TokenHashNuevo, @FamiliaToken, @FechaExpiracionNueva, 0);

    COMMIT TRAN;

    SELECT
        @IDUsuario AS IDUsuario,
        @NombreRol AS NombreRol,
        @NombreCompleto AS NombreCompleto,
        @Correo AS Correo,
        @FamiliaToken AS FamiliaToken,
        @FechaExpiracionNueva AS FechaExpiracion;
END
GO

/* ============================================================================
   5. SP_Auth_RevocarRefreshToken
      Revoca un Refresh Token específico (Logout) o todas las sesiones del usuario.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarRefreshToken
    @TokenHash        NVARCHAR(128) = NULL,
    @IDUsuario        INT           = NULL,
    @RevocarTodas     BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @RevocarTodas = 1 AND @IDUsuario IS NOT NULL
    BEGIN
        UPDATE dbo.TokensRefresh
        SET Revocado = 1,
            MotivoRevocacion = N'LOGOUT_GLOBAL',
            FechaRevocacion = SYSDATETIME()
        WHERE IDUsuario = @IDUsuario
          AND Revocado = 0;
    END
    ELSE IF @TokenHash IS NOT NULL
    BEGIN
        UPDATE dbo.TokensRefresh
        SET Revocado = 1,
            MotivoRevocacion = N'LOGOUT',
            FechaRevocacion = SYSDATETIME()
        WHERE TokenHash = @TokenHash
          AND Revocado = 0;
    END

    SELECT @@ROWCOUNT AS TokensRevocados;
END
GO

/* ============================================================================
   6. SP_Usuarios_Listar
      Listado paginado de usuarios con filtros del lado del servidor (Admin).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Pagina        INT           = 1,
    @TamanoPagina  INT           = 10,
    @NombreRol     NVARCHAR(30)  = NULL,
    @Activo        BIT           = NULL,
    @Busqueda      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina < 1 OR @TamanoPagina > 100 SET @TamanoPagina = 10;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @FiltroBusqueda NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Busqueda)), N'');

    ;WITH UsuariosFiltrados AS
    (
        SELECT
            u.IDUsuario,
            u.IDRol,
            r.NombreRol,
            u.NombreCompleto,
            u.Correo,
            u.Telefono,
            u.Activo,
            u.FechaCreacion,
            u.FechaModificacion,
            COUNT(1) OVER() AS TotalRegistros
        FROM dbo.Usuarios AS u
        INNER JOIN dbo.Roles AS r
            ON r.IDRol = u.IDRol
        WHERE (@NombreRol IS NULL OR r.NombreRol = @NombreRol)
          AND (@Activo IS NULL OR u.Activo = @Activo)
          AND (
              @FiltroBusqueda IS NULL
              OR u.NombreCompleto LIKE N'%' + @FiltroBusqueda + N'%'
              OR u.Correo LIKE N'%' + @FiltroBusqueda + N'%'
          )
    )
    SELECT
        IDUsuario,
        IDRol,
        NombreRol,
        NombreCompleto,
        Correo,
        Telefono,
        Activo,
        FechaCreacion,
        FechaModificacion,
        TotalRegistros
    FROM UsuariosFiltrados
    ORDER BY FechaCreacion DESC, IDUsuario DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END
GO

/* ============================================================================
   7. SP_Usuarios_ObtenerPorID
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ObtenerPorID
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuario)
        THROW 50002, N'El usuario solicitado no existe.', 1;

    SELECT
        u.IDUsuario,
        u.IDRol,
        r.NombreRol,
        u.NombreCompleto,
        u.Correo,
        u.Telefono,
        u.Activo,
        u.FechaCreacion,
        u.FechaModificacion
    FROM dbo.Usuarios AS u
    INNER JOIN dbo.Roles AS r
        ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ============================================================================
   8. SP_Usuarios_CrearInterno
      Permite a un Administrador crear usuarios con rol Cliente, Operador o Admin.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CrearInterno
    @IDUsuarioAdmin INT,
    @NombreRol      NVARCHAR(30),
    @NombreCompleto NVARCHAR(150),
    @Correo         NVARCHAR(150),
    @PasswordHash   NVARCHAR(255),
    @Telefono       NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDRol INT;
    DECLARE @CorreoNorm NVARCHAR(150) = LOWER(LTRIM(RTRIM(ISNULL(@Correo, N''))));
    DECLARE @NombreNorm NVARCHAR(150) = LTRIM(RTRIM(ISNULL(@NombreCompleto, N'')));
    DECLARE @IDUsuarioCreado INT;

    SELECT @IDRol = IDRol
    FROM dbo.Roles
    WHERE NombreRol = @NombreRol;

    IF @IDRol IS NULL
        THROW 50001, N'El rol especificado no es válido (use Cliente, Operador o Administrador).', 1;

    IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = @CorreoNorm)
        THROW 50003, N'Ya existe un usuario con ese correo electrónico.', 1;

    BEGIN TRAN;

        INSERT INTO dbo.Usuarios (IDRol, NombreCompleto, Correo, PasswordHash, Telefono, Activo)
        VALUES (@IDRol, @NombreNorm, @CorreoNorm, @PasswordHash, NULLIF(LTRIM(RTRIM(@Telefono)), N''), 1);

        SET @IDUsuarioCreado = SCOPE_IDENTITY();

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuarioAdmin,
            N'USUARIOS',
            N'Usuarios',
            CAST(@IDUsuarioCreado AS NVARCHAR(60)),
            N'CREACION',
            NULL,
            (
                SELECT
                    u.IDUsuario,
                    u.NombreCompleto,
                    u.Correo,
                    @NombreRol AS Rol,
                    u.Activo
                FROM dbo.Usuarios AS u
                WHERE u.IDUsuario = @IDUsuarioCreado
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    EXEC dbo.SP_Usuarios_ObtenerPorID @IDUsuario = @IDUsuarioCreado;
END
GO

/* ============================================================================
   9. SP_Usuarios_Actualizar
      Actualiza perfil y/o rol de un usuario registrando el cambio en Bitácora.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuarioEjecutor INT,
    @IDUsuarioObjetivo INT,
    @NombreCompleto    NVARCHAR(150),
    @Telefono          NVARCHAR(30) = NULL,
    @NombreRol         NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuarioObjetivo)
        THROW 50002, N'El usuario a actualizar no existe.', 1;

    DECLARE @IDRolNuevo INT = NULL;
    IF @NombreRol IS NOT NULL
    BEGIN
        SELECT @IDRolNuevo = IDRol FROM dbo.Roles WHERE NombreRol = @NombreRol;
        IF @IDRolNuevo IS NULL
            THROW 50001, N'El rol especificado no es válido.', 1;
    END

    DECLARE @ValorAnterior NVARCHAR(MAX) = (
        SELECT u.IDUsuario, u.NombreCompleto, u.Telefono, r.NombreRol, u.Activo
        FROM dbo.Usuarios AS u
        INNER JOIN dbo.Roles AS r ON r.IDRol = u.IDRol
        WHERE u.IDUsuario = @IDUsuarioObjetivo
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRAN;

        UPDATE dbo.Usuarios
        SET NombreCompleto    = LTRIM(RTRIM(@NombreCompleto)),
            Telefono          = NULLIF(LTRIM(RTRIM(@Telefono)), N''),
            IDRol             = ISNULL(@IDRolNuevo, IDRol),
            FechaModificacion = SYSDATETIME()
        WHERE IDUsuario = @IDUsuarioObjetivo;

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuarioEjecutor,
            N'USUARIOS',
            N'Usuarios',
            CAST(@IDUsuarioObjetivo AS NVARCHAR(60)),
            N'MODIFICACION',
            @ValorAnterior,
            (
                SELECT u.IDUsuario, u.NombreCompleto, u.Telefono, r.NombreRol, u.Activo
                FROM dbo.Usuarios AS u
                INNER JOIN dbo.Roles AS r ON r.IDRol = u.IDRol
                WHERE u.IDUsuario = @IDUsuarioObjetivo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    EXEC dbo.SP_Usuarios_ObtenerPorID @IDUsuario = @IDUsuarioObjetivo;
END
GO

/* ============================================================================
   10. SP_Usuarios_CambiarEstadoActivo
       Regla RF-01: "Un usuario puede desactivarse sin borrarse."
       Si se desactiva, revoca inmediatamente todos sus Refresh Tokens activos.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarEstadoActivo
    @IDUsuarioEjecutor INT,
    @IDUsuarioObjetivo INT,
    @Activo            BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE IDUsuario = @IDUsuarioObjetivo)
        THROW 50002, N'El usuario especificado no existe.', 1;

    DECLARE @ValorAnterior NVARCHAR(MAX) = (
        SELECT IDUsuario, NombreCompleto, Correo, Activo
        FROM dbo.Usuarios
        WHERE IDUsuario = @IDUsuarioObjetivo
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    BEGIN TRAN;

        UPDATE dbo.Usuarios
        SET Activo            = @Activo,
            FechaModificacion = SYSDATETIME()
        WHERE IDUsuario = @IDUsuarioObjetivo;

        IF @Activo = 0
        BEGIN
            UPDATE dbo.TokensRefresh
            SET Revocado         = 1,
                MotivoRevocacion = N'USUARIO_DESACTIVADO',
                FechaRevocacion  = SYSDATETIME()
            WHERE IDUsuario = @IDUsuarioObjetivo
              AND Revocado = 0;
        END

        INSERT INTO dbo.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo)
        VALUES (
            @IDUsuarioEjecutor,
            N'USUARIOS',
            N'Usuarios',
            CAST(@IDUsuarioObjetivo AS NVARCHAR(60)),
            CASE WHEN @Activo = 0 THEN N'DESACTIVACION' ELSE N'REACTIVACION' END,
            @ValorAnterior,
            (
                SELECT IDUsuario, NombreCompleto, Correo, Activo
                FROM dbo.Usuarios
                WHERE IDUsuario = @IDUsuarioObjetivo
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            )
        );

    COMMIT TRAN;

    EXEC dbo.SP_Usuarios_ObtenerPorID @IDUsuario = @IDUsuarioObjetivo;
END
GO

/* ============================================================================
   11. SP_Direcciones_ListarPorCliente
       Lista únicamente las direcciones activas que pertenecen a @IDUsuario.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_ListarPorCliente
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.IDDireccion,
        d.IDUsuario,
        d.Alias,
        d.NombreReceptor,
        d.TelefonoContacto,
        d.Departamento,
        d.Municipio,
        d.DireccionExacta,
        d.Referencias,
        d.EsPredeterminada,
        d.Activa,
        d.FechaCreacion
    FROM dbo.Direcciones AS d
    WHERE d.IDUsuario = @IDUsuario
      AND d.Activa = 1
    ORDER BY
        d.EsPredeterminada DESC,
        d.IDDireccion DESC;
END
GO

/* ============================================================================
   12. SP_Direcciones_ObtenerPorID
       Obtiene una dirección verificando estrictamente la propiedad del cliente
       (Criterio de Aceptación RF-01: cambiar el ID no debe exponer datos de
       otro cliente -> Lanza 50004 = 403 Forbidden).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_ObtenerPorID
    @IDDireccion INT,
    @IDUsuario   INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDPropietario INT;
    DECLARE @Activa BIT;

    SELECT
        @IDPropietario = d.IDUsuario,
        @Activa        = d.Activa
    FROM dbo.Direcciones AS d
    WHERE d.IDDireccion = @IDDireccion;

    IF @IDPropietario IS NULL OR @Activa = 0
        THROW 50002, N'La dirección solicitada no existe.', 1;

    IF @IDPropietario <> @IDUsuario
        THROW 50004, N'Acceso denegado: no tiene permiso para consultar o utilizar una dirección de otro cliente.', 1;

    SELECT
        d.IDDireccion,
        d.IDUsuario,
        d.Alias,
        d.NombreReceptor,
        d.TelefonoContacto,
        d.Departamento,
        d.Municipio,
        d.DireccionExacta,
        d.Referencias,
        d.EsPredeterminada,
        d.Activa,
        d.FechaCreacion
    FROM dbo.Direcciones AS d
    WHERE d.IDDireccion = @IDDireccion
      AND d.IDUsuario = @IDUsuario;
END
GO

/* ============================================================================
   13. SP_Direcciones_Crear
       Registra una nueva dirección para @IDUsuario.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
    @IDUsuario        INT,
    @Alias            NVARCHAR(50),
    @NombreReceptor   NVARCHAR(150),
    @TelefonoContacto NVARCHAR(30),
    @Departamento     NVARCHAR(80),
    @Municipio        NVARCHAR(80),
    @DireccionExacta  NVARCHAR(300),
    @Referencias      NVARCHAR(250) = NULL,
    @EsPredeterminada BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDDireccionNueva INT;
    DECLARE @TieneDirecciones BIT = 0;

    IF EXISTS (SELECT 1 FROM dbo.Direcciones WHERE IDUsuario = @IDUsuario AND Activa = 1)
        SET @TieneDirecciones = 1;

    IF @TieneDirecciones = 0
        SET @EsPredeterminada = 1;

    BEGIN TRAN;

        IF @EsPredeterminada = 1
        BEGIN
            UPDATE dbo.Direcciones
            SET EsPredeterminada = 0
            WHERE IDUsuario = @IDUsuario
              AND Activa = 1;
        END

        INSERT INTO dbo.Direcciones
        (
            IDUsuario,
            Alias,
            NombreReceptor,
            TelefonoContacto,
            Departamento,
            Municipio,
            DireccionExacta,
            Referencias,
            EsPredeterminada,
            Activa
        )
        VALUES
        (
            @IDUsuario,
            LTRIM(RTRIM(@Alias)),
            LTRIM(RTRIM(@NombreReceptor)),
            LTRIM(RTRIM(@TelefonoContacto)),
            LTRIM(RTRIM(@Departamento)),
            LTRIM(RTRIM(@Municipio)),
            LTRIM(RTRIM(@DireccionExacta)),
            NULLIF(LTRIM(RTRIM(@Referencias)), N''),
            @EsPredeterminada,
            1
        );

        SET @IDDireccionNueva = SCOPE_IDENTITY();

    COMMIT TRAN;

    EXEC dbo.SP_Direcciones_ObtenerPorID
        @IDDireccion = @IDDireccionNueva,
        @IDUsuario   = @IDUsuario;
END
GO

/* ============================================================================
   14. SP_Direcciones_Actualizar
       Modifica una dirección validando propiedad anti-IDOR (@IDUsuario).
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDDireccion      INT,
    @IDUsuario        INT,
    @Alias            NVARCHAR(50),
    @NombreReceptor   NVARCHAR(150),
    @TelefonoContacto NVARCHAR(30),
    @Departamento     NVARCHAR(80),
    @Municipio        NVARCHAR(80),
    @DireccionExacta  NVARCHAR(300),
    @Referencias      NVARCHAR(250) = NULL,
    @EsPredeterminada BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDPropietario INT;
    DECLARE @Activa BIT;

    SELECT
        @IDPropietario = IDUsuario,
        @Activa        = Activa
    FROM dbo.Direcciones
    WHERE IDDireccion = @IDDireccion;

    IF @IDPropietario IS NULL OR @Activa = 0
        THROW 50002, N'La dirección solicitada no existe.', 1;

    IF @IDPropietario <> @IDUsuario
        THROW 50004, N'Acceso denegado: no puede modificar una dirección que pertenece a otro cliente.', 1;

    BEGIN TRAN;

        IF @EsPredeterminada = 1
        BEGIN
            UPDATE dbo.Direcciones
            SET EsPredeterminada = 0
            WHERE IDUsuario = @IDUsuario
              AND Activa = 1
              AND IDDireccion <> @IDDireccion;
        END

        UPDATE dbo.Direcciones
        SET Alias            = LTRIM(RTRIM(@Alias)),
            NombreReceptor   = LTRIM(RTRIM(@NombreReceptor)),
            TelefonoContacto = LTRIM(RTRIM(@TelefonoContacto)),
            Departamento     = LTRIM(RTRIM(@Departamento)),
            Municipio        = LTRIM(RTRIM(@Municipio)),
            DireccionExacta  = LTRIM(RTRIM(@DireccionExacta)),
            Referencias      = NULLIF(LTRIM(RTRIM(@Referencias)), N''),
            EsPredeterminada = @EsPredeterminada
        WHERE IDDireccion = @IDDireccion
          AND IDUsuario = @IDUsuario;

    COMMIT TRAN;

    EXEC dbo.SP_Direcciones_ObtenerPorID
        @IDDireccion = @IDDireccion,
        @IDUsuario   = @IDUsuario;
END
GO

/* ============================================================================
   15. SP_Direcciones_Eliminar
       Desactiva lógicamente una dirección validando propiedad anti-IDOR.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Eliminar
    @IDDireccion INT,
    @IDUsuario   INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @IDPropietario INT;
    DECLARE @Activa BIT;

    SELECT
        @IDPropietario = IDUsuario,
        @Activa        = Activa
    FROM dbo.Direcciones
    WHERE IDDireccion = @IDDireccion;

    IF @IDPropietario IS NULL OR @Activa = 0
        THROW 50002, N'La dirección solicitada no existe.', 1;

    IF @IDPropietario <> @IDUsuario
        THROW 50004, N'Acceso denegado: no puede eliminar una dirección que pertenece a otro cliente.', 1;

    UPDATE dbo.Direcciones
    SET Activa           = 0,
        EsPredeterminada = 0
    WHERE IDDireccion = @IDDireccion
      AND IDUsuario = @IDUsuario;

    SELECT @IDDireccion AS IDDireccionEliminada, CAST(1 AS BIT) AS Eliminada;
END
GO

PRINT N'06_SP_Auth_Usuarios_Direcciones.sql ejecutado correctamente.';
GO
