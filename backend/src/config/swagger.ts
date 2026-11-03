export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ShopCart REST API — Tech Challenge 360',
    version: '1.0.0',
    description: `
**Plataforma Web de Ventas ShopCart (Grupo Pentandra / Don Arturo)**
Backend en capas con Node.js 24 LTS + TypeScript en modo estricto (\`strict: true\`) y Express.
Acceso a datos **100% exclusivo mediante Stored Procedures** (\`dbo.SP_*\`) en Microsoft SQL Server 2022.

* **Moneda e Impuestos**: Montos en Quetzales (\`GTQ\`), precios publicados incluyen IVA del 12%.
* **Autenticación**: JWT Access Token (Bearer) + Refresh Token rotativo en HTTP-Only cookie / body.
* **Integridad y Concurrencia**: Control de inventario pesimista (\`UPDLOCK, HOLDLOCK\`), checkout atómico e idempotente con \`Idempotency-Key\`.
    `,
    contact: {
      name: 'Jorge López (jorgelop1994)',
      url: 'https://github.com/jorgelop1994/shopcart',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Servidor API Local',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el Access Token JWT obtenido en /api/auth/login o /api/auth/register',
      },
      GuestTokenAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Guest-Token',
        description: 'Token UUID para carrito de compras de invitado sin sesión',
      },
      IdempotencyKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Idempotency-Key',
        description: 'Clave única para garantizar idempotencia en confirmación de pago (checkout)',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Los datos proporcionados son inválidos.' },
              details: { type: 'object' },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['correo', 'contrasena'],
        properties: {
          correo: { type: 'string', format: 'email', example: 'admin@shopcart.gt' },
          contrasena: { type: 'string', example: 'Admin#2026' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['nombreCompleto', 'correo', 'contrasena'],
        properties: {
          nombreCompleto: { type: 'string', example: 'Juan Pérez' },
          correo: { type: 'string', format: 'email', example: 'juan.perez@example.com' },
          contrasena: { type: 'string', minLength: 8, example: 'Segura*1234' },
          telefono: { type: 'string', example: '+502 5555-1234' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              usuario: {
                type: 'object',
                properties: {
                  idUsuario: { type: 'integer', example: 1 },
                  nombreCompleto: { type: 'string', example: 'Administrador Principal' },
                  correo: { type: 'string', example: 'admin@shopcart.gt' },
                  rol: { type: 'string', enum: ['Cliente', 'Operador', 'Administrador'], example: 'Administrador' },
                },
              },
              tokens: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
                  refreshToken: { type: 'string', example: '4a2c5b7e-...' },
                  tokenType: { type: 'string', example: 'Bearer' },
                  expiresIn: { type: 'string', example: '15m' },
                },
              },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          IDProducto: { type: 'integer', example: 1 },
          Nombre: { type: 'string', example: 'Camisa Oxford Manga Larga' },
          Slug: { type: 'string', example: 'camisa-oxford-manga-larga' },
          Descripcion: { type: 'string', example: 'Camisa formal 100% algodón' },
          IDCategoria: { type: 'integer', example: 4 },
          CategoriaNombre: { type: 'string', example: 'Camisas' },
          Activo: { type: 'boolean', example: true },
          TotalVariantes: { type: 'integer', example: 3 },
          PrecioMinimo: { type: 'number', example: 250.0 },
          PrecioMaximo: { type: 'number', example: 280.0 },
          ExistenciaFisicaTotal: { type: 'integer', example: 45 },
          ExistenciaDisponibleTotal: { type: 'integer', example: 42 },
        },
      },
      CartResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              IDCarrito: { type: 'integer', example: 10 },
              TotalItems: { type: 'integer', example: 2 },
              SubtotalGTQ: { type: 'number', example: 500.0 },
              DescuentoGTQ: { type: 'number', example: 50.0 },
              TotalGTQ: { type: 'number', example: 450.0 },
              CuponAplicado: { type: 'string', nullable: true, example: 'BIENVENIDA10' },
              Items: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Order: {
        type: 'object',
        properties: {
          IDPedido: { type: 'integer', example: 1 },
          NumeroPedido: { type: 'string', example: 'PED-2026-000001' },
          FechaCreacion: { type: 'string', format: 'date-time' },
          EstadoPedido: {
            type: 'string',
            enum: ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado', 'Cancelado', 'DevueltoParcial', 'DevueltoTotal'],
            example: 'Pagado',
          },
          Total: { type: 'number', example: 535.0 },
          DireccionEntrega: { type: 'string', example: '12 Calle 4-55 Zona 10, Edificio Dubai, Apto 801, Guatemala' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Verificar estado de salud de la API y base de datos',
        tags: ['Infraestructura'],
        responses: {
          200: { description: 'API saludable y conectada a SQL Server' },
          503: { description: 'Fallo de conexión a la base de datos' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Registro de nuevo cliente (RF-01)',
        tags: ['RF-01 Autenticación'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'Cliente registrado exitosamente', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          409: { description: 'El correo electrónico ya está registrado' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Inicio de sesión de usuarios (Cliente, Operador, Admin) (RF-01)',
        tags: ['RF-01 Autenticación'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Autenticación exitosa', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Credenciales inválidas o usuario desactivado' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotación segura de Refresh Token (RF-01)',
        tags: ['RF-01 Autenticación'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { refreshToken: { type: 'string', example: '4a2c5b7e-...' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Tokens renovados con rotación estricta' },
          401: { description: 'Token inválido, expirado o intento de reúso detectado' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Cierre de sesión y revocación del refresh token (RF-01)',
        tags: ['RF-01 Autenticación'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Sesión revocada exitosamente' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Obtener datos del usuario actualmente autenticado (RF-01)',
        tags: ['RF-01 Autenticación'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Perfil del usuario' } },
      },
    },
    '/users': {
      get: {
        summary: 'Listar usuarios del sistema con paginación y filtros (Admin) (RF-01)',
        tags: ['RF-01 Usuarios'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Lista paginada de usuarios' } },
      },
      post: {
        summary: 'Crear usuario interno Operador o Administrador (Admin) (RF-01)',
        tags: ['RF-01 Usuarios'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Usuario interno creado' } },
      },
    },
    '/addresses': {
      get: {
        summary: 'Listar direcciones del cliente autenticado (RF-01)',
        tags: ['RF-01 Direcciones'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Direcciones registradas del cliente' } },
      },
      post: {
        summary: 'Registrar nueva dirección de entrega (RF-01)',
        tags: ['RF-01 Direcciones'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Dirección guardada' } },
      },
    },
    '/categories': {
      get: {
        summary: 'Listar categorías con jerarquía de árbol (RF-02)',
        tags: ['RF-02 Catálogo'],
        responses: { 200: { description: 'Árbol de categorías activas' } },
      },
      post: {
        summary: 'Crear nueva categoría (Admin) (RF-02)',
        tags: ['RF-02 Catálogo'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Categoría creada' } },
      },
    },
    '/products': {
      get: {
        summary: 'Buscar y filtrar productos con variantes, precios y disponibilidad (RF-02)',
        tags: ['RF-02 Catálogo'],
        parameters: [
          { name: 'buscar', in: 'query', schema: { type: 'string' }, description: 'Texto a buscar en nombre/SKU' },
          { name: 'idCategoria', in: 'query', schema: { type: 'integer' } },
          { name: 'precioMin', in: 'query', schema: { type: 'number' } },
          { name: 'precioMax', in: 'query', schema: { type: 'number' } },
          { name: 'disponible', in: 'query', schema: { type: 'boolean' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 12 } },
        ],
        responses: {
          200: {
            description: 'Listado paginado de productos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Crear producto en el catálogo (Admin) (RF-02)',
        tags: ['RF-02 Catálogo'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Producto creado' } },
      },
    },
    '/products/{id}': {
      get: {
        summary: 'Obtener detalle completo de un producto con sus variantes e imágenes (RF-02)',
        tags: ['RF-02 Catálogo'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Detalle del producto y sus variantes' } },
      },
      delete: {
        summary: 'Eliminar producto o desactivarlo lógicamente si ya tiene ventas (Admin) (RF-02)',
        tags: ['RF-02 Catálogo'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Producto eliminado o desactivado' } },
      },
    },
    '/inventory/stock': {
      get: {
        summary: 'Consultar existencia física, reservada y disponible por variante (Operador, Admin) (RF-03)',
        tags: ['RF-03 Inventario'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Estado actual del inventario' } },
      },
    },
    '/inventory/kardex': {
      get: {
        summary: 'Consultar historial inmutable de movimientos del Kardex (Operador, Admin) (RF-03)',
        tags: ['RF-03 Inventario'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'idVariante', in: 'query', schema: { type: 'integer' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { 200: { description: 'Movimientos del Kardex' } },
      },
    },
    '/inventory/movements': {
      post: {
        summary: 'Registrar movimiento manual o ajuste de inventario (Operador, Admin) (RF-03)',
        tags: ['RF-03 Inventario'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Movimiento asentado en Kardex' },
          422: { description: 'Ajuste inválido o dejaría la existencia en negativo' },
        },
      },
    },
    '/cart': {
      get: {
        summary: 'Consultar carrito de compras con desglose de IVA 12%, descuentos y cupones (RF-04)',
        tags: ['RF-04 Carrito'],
        security: [{ BearerAuth: [] }, { GuestTokenAuth: [] }],
        responses: {
          200: {
            description: 'Contenido y totales del carrito',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CartResponse' } } },
          },
        },
      },
      delete: {
        summary: 'Vaciar todos los artículos del carrito (RF-04)',
        tags: ['RF-04 Carrito'],
        security: [{ BearerAuth: [] }, { GuestTokenAuth: [] }],
        responses: { 200: { description: 'Carrito vaciado' } },
      },
    },
    '/cart/items': {
      post: {
        summary: 'Agregar o modificar cantidad de una variante en el carrito (RF-04)',
        tags: ['RF-04 Carrito'],
        security: [{ BearerAuth: [] }, { GuestTokenAuth: [] }],
        responses: {
          200: { description: 'Item actualizado en el carrito' },
          409: { description: 'La cantidad solicitada supera la existencia disponible' },
        },
      },
    },
    '/cart/coupon': {
      post: {
        summary: 'Aplicar cupón de descuento al carrito (RF-05)',
        tags: ['RF-05 Cupones'],
        security: [{ BearerAuth: [] }, { GuestTokenAuth: [] }],
        responses: {
          200: { description: 'Cupón aplicado exitosamente' },
          422: { description: 'Cupón vencido, agotado o no cumple monto mínimo' },
        },
      },
      delete: {
        summary: 'Remover cupón aplicado al carrito (RF-05)',
        tags: ['RF-05 Cupones'],
        security: [{ BearerAuth: [] }, { GuestTokenAuth: [] }],
        responses: { 200: { description: 'Cupón removido' } },
      },
    },
    '/cart/merge': {
      post: {
        summary: 'Fusionar carrito de invitado anónimo al iniciar sesión (RF-04)',
        tags: ['RF-04 Carrito'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Carrito fusionado exitosamente' } },
      },
    },
    '/coupons': {
      get: {
        summary: 'Listar cupones promocionales con estadísticas de uso (Admin) (RF-05)',
        tags: ['RF-05 Cupones'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Listado de cupones' } },
      },
      post: {
        summary: 'Crear nuevo cupón promocional (Admin) (RF-05)',
        tags: ['RF-05 Cupones'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Cupón creado' } },
      },
    },
    '/checkout/reserve': {
      post: {
        summary: 'Apartar temporalmente existencia durante 15 minutos al iniciar pago (RF-06)',
        tags: ['RF-06 Checkout y Pagos'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Existencia reservada por 15 minutos' },
          409: { description: 'No hay existencia suficiente para una o más variantes' },
        },
      },
    },
    '/checkout/confirm': {
      post: {
        summary: 'Crear pedido atómico con clave de idempotencia obligatoria (RF-06)',
        tags: ['RF-06 Checkout y Pagos'],
        security: [{ BearerAuth: [] }, { IdempotencyKey: [] }],
        responses: {
          201: { description: 'Pedido creado exitosamente con precios congelados' },
          200: { description: 'Reintento idempotente: pedido previamente confirmado retornado sin duplicidad' },
          409: { description: 'Conflicto de concurrencia o reserva vencida' },
        },
      },
    },
    '/orders': {
      get: {
        summary: 'Listar pedidos con filtros por estado, cliente y fechas (RF-07)',
        tags: ['RF-07 Pedidos y Devoluciones'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Historial de pedidos filtrado' } },
      },
    },
    '/orders/{id}': {
      get: {
        summary: 'Obtener detalle completo de un pedido, con precios congelados e IVA (RF-07)',
        tags: ['RF-07 Pedidos y Devoluciones'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Detalle del pedido' },
          403: { description: 'Protección anti-IDOR: cliente no puede ver pedidos ajenos' },
        },
      },
    },
    '/orders/{id}/state': {
      patch: {
        summary: 'Avanzar o cancelar pedido según la Máquina de Estados (RF-07)',
        tags: ['RF-07 Pedidos y Devoluciones'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Estado actualizado y registrado en historial inmutable' },
          422: { description: 'Transición de estado no permitida rechazada en backend o BD' },
        },
      },
    },
    '/orders/{id}/returns': {
      post: {
        summary: 'Procesar devolución total o parcial por línea con reintegro al Kardex (Operador, Admin) (RF-07)',
        tags: ['RF-07 Pedidos y Devoluciones'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          201: { description: 'Devolución registrada con prorrateo de descuentos' },
          422: { description: 'Intento de devolver más unidades de las compradas' },
        },
      },
    },
    '/dashboard/metrics': {
      get: {
        summary: 'Métricas de ventas, KPIs, ticket promedio y top productos (< 1s) (Operador, Admin) (RF-08)',
        tags: ['RF-08 Dashboard y Reportes'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Métricas agregadas del negocio' } },
      },
    },
    '/dashboard/export': {
      get: {
        summary: 'Exportar métricas de ventas a formato CSV / Excel (Operador, Admin) (RF-08 Extra)',
        tags: ['RF-08 Dashboard y Reportes'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Archivo CSV descargable' } },
      },
    },
    '/dashboard/stream': {
      get: {
        summary: 'Canal Server-Sent Events (SSE) para actualización en tiempo real del Dashboard (RF-08 Extra)',
        tags: ['RF-08 Dashboard y Reportes'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Stream de eventos en tiempo real' } },
      },
    },
    '/dashboard/abandoned-carts': {
      get: {
        summary: 'Listado de carritos abandonados sin actividad por más de 48 horas (Operador, Admin) (RF-08)',
        tags: ['RF-08 Dashboard y Reportes'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Carritos abandonados' } },
      },
    },
    '/audit-logs': {
      get: {
        summary: 'Consultar bitácora inmutable de auditoría del sistema (Admin) (RF-09)',
        tags: ['RF-09 Bitácora Inmutable'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Registros inmutables de auditoría' } },
      },
    },
  },
};
