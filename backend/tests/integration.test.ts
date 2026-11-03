import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { getDbPool, closeDbPool } from '../src/config/database';

interface ApiResponse<T = any> {
  status: number;
  body: {
    ok: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
  headers: Headers;
  rawText?: string;
}

let baseUrl = '';

async function request<T = any>(
  method: string,
  path: string,
  options: {
    token?: string;
    guestToken?: string;
    body?: unknown;
    rawResponse?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.guestToken) {
    headers['x-guest-token'] = options.guestToken;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (options.rawResponse) {
    const rawText = await res.text();
    return {
      status: res.status,
      body: { ok: res.ok },
      headers: res.headers,
      rawText,
    };
  }

  const json = (await res.json()) as ApiResponse<T>['body'];
  return {
    status: res.status,
    body: json,
    headers: res.headers,
  };
}

async function runTests(): Promise<void> {
  console.log('============================================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DE INTEGRACIÓN Y CRITERIOS DE ACEPTACIÓN');
  console.log('============================================================================');

  await getDbPool();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // 1. RF-01: Autenticación, Rotación de Refresh Token, 401/403 y Anti-IDOR
    // -------------------------------------------------------------------------
    console.log('\n[RF-01] Probando Autenticación, Rotación de Tokens, Roles (401/403) y Anti-IDOR...');

    const adminLogin = await request('POST', '/api/auth/login', {
      body: { correo: 'admin@shopcart.com.gt', password: 'Admin123!' },
    });
    assert.equal(adminLogin.status, 200, 'Login Admin debe devolver 200');
    const adminToken = adminLogin.body.data.accessToken as string;

    const opLogin = await request('POST', '/api/auth/login', {
      body: { correo: 'operador@shopcart.com.gt', password: 'Operador123!' },
    });
    assert.equal(opLogin.status, 200, 'Login Operador debe devolver 200');
    const opToken = opLogin.body.data.accessToken as string;

    const jorgeLogin = await request('POST', '/api/auth/login', {
      body: { correo: 'cliente@shopcart.com.gt', password: 'Cliente123!' },
    });
    assert.equal(jorgeLogin.status, 200, 'Login Cliente Jorge debe devolver 200');
    let jorgeToken = jorgeLogin.body.data.accessToken as string;
    const jorgeRefresh1 = jorgeLogin.body.data.refreshToken as string;

    const mariaLogin = await request('POST', '/api/auth/login', {
      body: { correo: 'maria.garcia@correo.gt', password: 'Cliente123!' },
    });
    assert.equal(mariaLogin.status, 200, 'Login Cliente María debe devolver 200');
    const mariaToken = mariaLogin.body.data.accessToken as string;

    // Usuario desactivado no puede iniciar sesión
    const inactiveLogin = await request('POST', '/api/auth/login', {
      body: { correo: 'inactivo@correo.gt', password: 'Cliente123!' },
    });
    assert.equal(inactiveLogin.status, 401, 'Usuario desactivado debe recibir 401');

    // Rotación de Refresh Token y detección de reúso
    const refreshRes = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: jorgeRefresh1 },
    });
    assert.equal(refreshRes.status, 200, 'Rotación de Refresh Token debe devolver 200');
    jorgeToken = refreshRes.body.data.accessToken as string;

    // Intentar reusar el refresh token anterior ya rotado -> debe devolver 401 y revocar familia
    const reuseRes = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: jorgeRefresh1 },
    });
    assert.equal(reuseRes.status, 401, 'Reúso de Refresh Token ya rotado debe devolver 401');
    assert.equal(reuseRes.body.error?.code, 'REFRESH_TOKEN_REUSE_DETECTED');

    // Token expirado -> debe devolver 401 (Criterio RF-01)
    const expiredToken = jwt.sign(
      { idUsuario: 3, rol: 'Cliente', correo: 'cliente@shopcart.com.gt', nombreCompleto: 'Jorge' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -10 }
    );
    const expiredRes = await request('GET', '/api/auth/me', { token: expiredToken });
    assert.equal(expiredRes.status, 401, 'Token expirado debe devolver 401');

    // Acceso a recurso no permitido por rol -> debe devolver 403 (Criterio RF-01)
    const forbiddenRoleRes = await request('GET', '/api/audit-logs', { token: jorgeToken });
    assert.equal(forbiddenRoleRes.status, 403, 'Cliente accediendo a bitácora de Admin debe recibir 403');

    // Anti-IDOR: Jorge (IDUsuario=3) intenta leer la dirección #3 (que pertenece a María, IDUsuario=4)
    const idorAddressRes = await request('GET', '/api/addresses/3', { token: jorgeToken });
    assert.equal(idorAddressRes.status, 403, 'IDOR en dirección ajena debe devolver 403');

    // Anti-IDOR: Jorge intenta leer el Pedido #2 (que pertenece a María)
    const idorOrderRes = await request('GET', '/api/orders/2', { token: jorgeToken });
    assert.equal(idorOrderRes.status, 403, 'IDOR en pedido ajeno debe devolver 403');

    console.log('  ✅ RF-01 superado con éxito.');

    // -------------------------------------------------------------------------
    // 2. RF-02: Catálogo de Productos, Inmutabilidad de Precios en Pedidos y Desactivación
    // -------------------------------------------------------------------------
    console.log('\n[RF-02] Probando Catálogo, Congelamiento de Precios en Pedidos y Desactivación...');

    const orderBeforePriceChange = await request('GET', '/api/orders/1', { token: jorgeToken });
    assert.equal(orderBeforePriceChange.status, 200);
    const totalOriginalPedido1 = orderBeforePriceChange.body.data.Total;

    // Admin modifica el precio de la variante #1 (Camisa Oxford M) de Q280.00 a Q315.00
    const updateVariantPrice = await request('PUT', '/api/products/1/variants/1', {
      token: adminToken,
      body: {
        sku: 'ROP-OXF-M-AZU',
        nombreVariante: 'Talla M - Azul Marino',
        precio: 315.0,
        activa: true,
      },
    });
    assert.equal(updateVariantPrice.status, 200);

    // Verificar que el Pedido #1 conserva exactamente su monto congelado
    const orderAfterPriceChange = await request('GET', '/api/orders/1', { token: jorgeToken });
    assert.equal(
      orderAfterPriceChange.body.data.Total,
      totalOriginalPedido1,
      'Un cambio de precio NO debe alterar el monto de pedidos ya realizados'
    );

    // Restaurar precio a Q280.00
    await request('PUT', '/api/products/1/variants/1', {
      token: adminToken,
      body: {
        sku: 'ROP-OXF-M-AZU',
        nombreVariante: 'Talla M - Azul Marino',
        precio: 280.0,
        activa: true,
      },
    });

    // Intentar eliminar producto con ventas asociadas -> se desactiva, no se borra físicamente
    const deleteProductWithSales = await request('DELETE', '/api/products/1', {
      token: adminToken,
    });
    assert.equal(deleteProductWithSales.status, 200);
    assert.equal(
      deleteProductWithSales.body.data.ResultadoOperacion,
      'DESACTIVADO_POR_VENTAS_ASOCIADAS'
    );

    // Reactivar el producto 1 y sus variantes para no afectar el catálogo
    await request('PUT', '/api/products/1', {
      token: adminToken,
      body: {
        idCategoria: 1,
        nombre: 'Camisa Oxford Algodón Pima',
        descripcion: 'Camisa de corte moderno confeccionada en 100% algodón Pima transpirable.',
        marca: 'Don Arturo Collection',
        activo: true,
      },
    });
    await request('PUT', '/api/products/1/variants/1', {
      token: adminToken,
      body: {
        sku: 'ROP-OXF-M-AZU',
        nombreVariante: 'Talla M - Azul Marino',
        precio: 280.0,
        activa: true,
      },
    });
    await request('PUT', '/api/products/1/variants/2', {
      token: adminToken,
      body: {
        sku: 'ROP-OXF-L-BLA',
        nombreVariante: 'Talla L - Blanco',
        precio: 280.0,
        activa: true,
      },
    });

    console.log('  ✅ RF-02 superado con éxito.');

    // -------------------------------------------------------------------------
    // 3. RF-03: Inventario y Kardex
    // -------------------------------------------------------------------------
    console.log('\n[RF-03] Probando Inventario, Kardex y bloqueo de existencia negativa...');

    // Intentar un ajuste de salida que deje la existencia en negativo
    const negativeAdjustment = await request('POST', '/api/inventory/movements', {
      token: opToken,
      body: {
        idVariante: 1,
        tipoMovimiento: 'AJUSTE_SALIDA',
        cantidad: 99999,
        motivo: 'Prueba de intento de dejar stock en negativo',
      },
    });
    assert.equal(negativeAdjustment.status, 422, 'Ajuste que deja stock en negativo debe rechazarse con 422');

    // Verificar que todas las variantes siguen cuadrando con la suma del Kardex
    const stockRes = await request('GET', '/api/inventory/stock?tamanoPagina=50', {
      token: opToken,
    });
    assert.equal(stockRes.status, 200);
    const allMatchKardex = (stockRes.body.data.items as Array<{ CuadraConKardex: boolean }>).every(
      (item) => item.CuadraConKardex === true
    );
    assert.equal(allMatchKardex, true, 'Toda variante debe cuadrar con la suma de movimientos del Kardex');

    console.log('  ✅ RF-03 superado con éxito.');

    // -------------------------------------------------------------------------
    // 4. RF-04 y RF-05: Carrito, Fusión de Invitado y Cupones
    // -------------------------------------------------------------------------
    console.log('\n[RF-04 y RF-05] Probando Carrito, tope de stock disponible y validación de Cupones...');

    // Intentar agregar al carrito más unidades que la existencia disponible
    const exceedStockCart = await request('POST', '/api/cart/items', {
      token: jorgeToken,
      body: { idVariante: 1, cantidad: 5000 },
    });
    assert.equal(exceedStockCart.status, 409, 'Superar existencia disponible en carrito debe devolver 409');

    // Vaciar carritos de Jorge y María y agregar 1 unidad de la variante #8 (Audífonos ANC Pro Negro - ExistenciaFisica = 1)
    await request('DELETE', '/api/cart', { token: jorgeToken });
    await request('DELETE', '/api/cart', { token: mariaToken });

    // Probar rechazo específico de cupón vencido (VENCIDO2025)
    await request('POST', '/api/cart/items', {
      token: jorgeToken,
      body: { idVariante: 2, cantidad: 1 }, // Q280.00
    });

    const expiredCouponRes = await request('POST', '/api/cart/coupon', {
      token: jorgeToken,
      body: { codigoCupon: 'VENCIDO2025' },
    });
    assert.equal(expiredCouponRes.status, 422, 'Cupón vencido debe devolver 422');
    assert.match(expiredCouponRes.body.error?.message ?? '', /vencido/i);

    // Probar rechazo específico de cupón que no alcanza el mínimo (QUETZAL50 requiere Q300.00 y el carrito tiene Q280.00)
    const minAmountCouponRes = await request('POST', '/api/cart/coupon', {
      token: jorgeToken,
      body: { codigoCupon: 'QUETZAL50' },
    });
    assert.equal(minAmountCouponRes.status, 422, 'Cupón sin mínimo alcanzado debe devolver 422');
    assert.match(minAmountCouponRes.body.error?.message ?? '', /mínimo/i);

    console.log('  ✅ RF-04 y RF-05 superados con éxito.');

    // -------------------------------------------------------------------------
    // 5. RF-06: Concurrencia en Última Unidad (Cero Sobreventa) e Idempotencia
    // -------------------------------------------------------------------------
    console.log('\n[RF-06] Probando Concurrencia Real por la Última Unidad e Idempotencia de Pago...');

    await request('DELETE', '/api/cart', { token: jorgeToken });
    await request('DELETE', '/api/cart', { token: mariaToken });

    // Variante #8 (TEC-AUD-PRO-BLK) tiene exactamente 1 unidad disponible en existencia
    const jorgeCartAdd = await request('POST', '/api/cart/items', {
      token: jorgeToken,
      body: { idVariante: 8, cantidad: 1 },
    });
    assert.equal(jorgeCartAdd.status, 200);
    const idCarritoJorge = jorgeCartAdd.body.data.IDCarrito as number;

    const mariaCartAdd = await request('POST', '/api/cart/items', {
      token: mariaToken,
      body: { idVariante: 8, cantidad: 1 },
    });
    assert.equal(mariaCartAdd.status, 200);
    const idCarritoMaria = mariaCartAdd.body.data.IDCarrito as number;

    // Dos clientes inician el pago al mismo tiempo por la última unidad (Promise.all simultáneo)
    const [resReserveJorge, resReserveMaria] = await Promise.all([
      request('POST', '/api/checkout/reserve', {
        token: jorgeToken,
        body: { idCarrito: idCarritoJorge },
      }),
      request('POST', '/api/checkout/reserve', {
        token: mariaToken,
        body: { idCarrito: idCarritoMaria },
      }),
    ]);

    const statuses = [resReserveJorge.status, resReserveMaria.status].sort();
    assert.deepEqual(
      statuses,
      [200, 409],
      'Exactamente un cliente debe lograr reservar la última unidad (200) y el otro recibir 409 sin sobreventa'
    );

    const winnerIsJorge = resReserveJorge.status === 200;
    const winnerToken = winnerIsJorge ? jorgeToken : mariaToken;
    const winnerCartId = winnerIsJorge ? idCarritoJorge : idCarritoMaria;
    const winnerAddressId = winnerIsJorge ? 1 : 3;
    const winnerReservationToken = (
      winnerIsJorge ? resReserveJorge.body.data : resReserveMaria.body.data
    ).TokenReserva as string;

    // Limpiar el carrito del cliente que no alcanzó la última unidad
    await request('DELETE', '/api/cart', {
      token: winnerIsJorge ? mariaToken : jorgeToken,
    });

    // Confirmar el pago con una ClaveIdempotencia y simular doble clic / reintento de red
    const idempotencyKey = `TEST-IDEMP-${Date.now()}`;
    const [confirm1, confirm2] = await Promise.all([
      request('POST', '/api/checkout/confirm', {
        token: winnerToken,
        body: {
          idCarrito: winnerCartId,
          idDireccionEntrega: winnerAddressId,
          tokenReserva: winnerReservationToken,
          claveIdempotencia: idempotencyKey,
          metodoPago: 'TARJETA_CREDITO',
        },
      }),
      request('POST', '/api/checkout/confirm', {
        token: winnerToken,
        body: {
          idCarrito: winnerCartId,
          idDireccionEntrega: winnerAddressId,
          tokenReserva: winnerReservationToken,
          claveIdempotencia: idempotencyKey,
          metodoPago: 'TARJETA_CREDITO',
        },
      }),
    ]);

    assert.equal(confirm1.status, 201);
    assert.equal(confirm2.status, 201);
    assert.equal(
      confirm1.body.data.IDPedido,
      confirm2.body.data.IDPedido,
      'Doble solicitud de pago con la misma ClaveIdempotencia debe retornar el mismo IDPedido sin duplicar cobro'
    );

    const idPedidoConcurrencia = confirm1.body.data.IDPedido as number;

    // Cancelar ese pedido de prueba antes de despacho para reintegrar esa unidad al Kardex (RF-07)
    const cancelNewOrder = await request('PATCH', `/api/orders/${idPedidoConcurrencia}/state`, {
      token: winnerToken,
      body: {
        estadoNuevo: 'Cancelado',
        motivoComentario: 'Cancelación de prueba automatizada para reintegrar unidad al Kardex',
      },
    });
    assert.equal(cancelNewOrder.status, 200);
    assert.equal(cancelNewOrder.body.data.EstadoPedido, 'Cancelado');

    // Transición no permitida: un pedido Cancelado es estado terminal -> 422 (backend)
    const invalidTransition = await request('PATCH', `/api/orders/${idPedidoConcurrencia}/state`, {
      token: opToken,
      body: { estadoNuevo: 'Despachado', motivoComentario: 'Intento de transición inválida' },
    });
    assert.equal(invalidTransition.status, 422, 'Cancelado -> Despachado debe rechazarse con 422');
    assert.equal(invalidTransition.body.error?.code, 'INVALID_ORDER_STATE_TRANSITION');

    // Saltar estados (Entregado -> Pagado) también debe rechazarse
    const backwardsTransition = await request('PATCH', '/api/orders/1/state', {
      token: opToken,
      body: { estadoNuevo: 'Pagado', motivoComentario: 'Intento de regresar estado' },
    });
    assert.equal(backwardsTransition.status, 422, 'Retroceder estado debe rechazarse con 422');

    console.log('  ✅ RF-06 y RF-07 (Concurrencia, Idempotencia y Reintegro a Kardex) superados con éxito.');

    // -------------------------------------------------------------------------
    // 6. RF-07: Validación de límite de devolución por línea
    // -------------------------------------------------------------------------
    console.log('\n[RF-07] Probando rechazo al intentar devolver más unidades de las compradas...');

    // En el Pedido #1 (Entregado), la línea #1 compró 2 unidades. Intentar devolver 5 unidades -> 422
    const excessReturn = await request('POST', '/api/orders/1/returns', {
      token: opToken,
      body: {
        motivoDevolucion: 'Intento de devolver más de lo vendido',
        lineas: [{ idDetallePedido: 1, cantidadADevolver: 5 }],
      },
    });
    assert.equal(excessReturn.status, 422, 'Devolver más unidades de las compradas debe devolver 422');

    console.log('  ✅ RF-07 (Devoluciones por línea) superado con éxito.');

    // -------------------------------------------------------------------------
    // 7. RF-08 y RF-09: Dashboard (< 1 segundo), Exportación CSV y Bitácora
    // -------------------------------------------------------------------------
    console.log('\n[RF-08 y RF-09] Probando rendimiento del Dashboard (< 1s), Exportación y Bitácora...');

    const startDashboard = performance.now();
    const dashboardRes = await request('GET', '/api/dashboard/metrics', { token: adminToken });
    const elapsedMs = performance.now() - startDashboard;

    assert.equal(dashboardRes.status, 200);
    assert.ok(elapsedMs < 1000, `El Dashboard debe responder en < 1000ms (Respondió en ${elapsedMs.toFixed(1)}ms)`);

    const csvExport = await request('GET', '/api/dashboard/export', {
      token: adminToken,
      rawResponse: true,
    });
    assert.equal(csvExport.status, 200);
    assert.match(csvExport.rawText ?? '', /REPORTE EJECUTIVO DE VENTAS/);

    const auditLogsRes = await request('GET', '/api/audit-logs?modulo=PRECIOS', {
      token: adminToken,
    });
    assert.equal(auditLogsRes.status, 200);
    assert.ok(
      (auditLogsRes.body.data.items as unknown[]).length >= 1,
      'La bitácora debe contener los eventos auditados del módulo PRECIOS'
    );

    console.log(`  ✅ RF-08 y RF-09 superados con éxito (Dashboard respondió en ${elapsedMs.toFixed(1)} ms).`);

    console.log('\n============================================================================');
    console.log('🎉 TODAS LAS PRUEBAS DE INTEGRACIÓN Y CRITERIOS DE ACEPTACIÓN PASARON AL 100%');
    console.log('============================================================================');
  } finally {
    server.close();
    await closeDbPool();
  }
}

runTests().catch((err) => {
  console.error('❌ Falló la suite de pruebas de integración:', err);
  process.exit(1);
});
