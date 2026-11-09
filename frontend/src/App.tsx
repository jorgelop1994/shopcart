import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Vistas públicas y de autenticación
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForbiddenPage } from './pages/auth/ForbiddenPage';

// Vistas de tienda y cliente
import { CatalogPage } from './pages/store/CatalogPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';
import { CartPage } from './pages/store/CartPage';
import { CheckoutPage } from './pages/store/CheckoutPage';
import { MyOrdersPage } from './pages/store/MyOrdersPage';
import { ProfileAddressesPage } from './pages/store/ProfileAddressesPage';

// Vistas operativas y administrativas
import { OrdersManagementPage } from './pages/admin/OrdersManagementPage';
import { InventoryKardexPage } from './pages/admin/InventoryKardexPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { CatalogManagementPage } from './pages/admin/CatalogManagementPage';
import { CouponsManagementPage } from './pages/admin/CouponsManagementPage';
import { UsersManagementPage } from './pages/admin/UsersManagementPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route element={<AppLayout />}>
                {/* Rutas Públicas */}
                <Route path="/" element={<CatalogPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/producto/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/carrito" element={<CartPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/registro" element={<RegisterPage />} />
                <Route path="/403" element={<ForbiddenPage />} />
                <Route path="/acceso-denegado" element={<ForbiddenPage />} />

                {/* Rutas Protegidas para cualquier usuario autenticado */}
                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['Cliente', 'Operador', 'Administrador']}
                    />
                  }
                >
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/my-orders" element={<MyOrdersPage />} />
                  <Route path="/mis-pedidos" element={<MyOrdersPage />} />
                  <Route path="/profile" element={<ProfileAddressesPage />} />
                  <Route path="/perfil" element={<ProfileAddressesPage />} />
                </Route>

                {/* Rutas Protegidas Operativas (Operador y Administrador) */}
                <Route
                  element={<ProtectedRoute allowedRoles={['Operador', 'Administrador']} />}
                >
                  <Route path="/admin/dashboard" element={<DashboardPage />} />
                  <Route path="/admin/orders" element={<OrdersManagementPage />} />
                  <Route path="/operaciones/pedidos" element={<OrdersManagementPage />} />
                  <Route path="/admin/inventory" element={<InventoryKardexPage />} />
                  <Route path="/operaciones/inventario" element={<InventoryKardexPage />} />
                </Route>

                {/* Rutas Protegidas Exclusivas de Administración */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador']} />}>
                  <Route path="/admin/catalog" element={<CatalogManagementPage />} />
                  <Route path="/admin/catalogo" element={<CatalogManagementPage />} />
                  <Route path="/admin/coupons" element={<CouponsManagementPage />} />
                  <Route path="/admin/cupones" element={<CouponsManagementPage />} />
                  <Route path="/admin/users" element={<UsersManagementPage />} />
                  <Route path="/admin/usuarios" element={<UsersManagementPage />} />
                  <Route path="/admin/audit" element={<AuditLogPage />} />
                  <Route path="/admin/bitacora" element={<AuditLogPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
