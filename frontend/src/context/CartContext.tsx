import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CartDetailRecord } from '../types/api.types';
import { cartApi } from '../api/cart.api';
import { useAuth } from './AuthContext';

interface CartContextValue {
  cart: CartDetailRecord | null;
  isLoadingCart: boolean;
  loadingCart: boolean;
  cartError: string | null;
  refreshCart: () => Promise<void>;
  addItem: (idVariante: number, cantidad: number) => Promise<CartDetailRecord>;
  updateQuantity: (idVariante: number, cantidad: number) => Promise<CartDetailRecord>;
  removeItem: (idVariante: number) => Promise<CartDetailRecord>;
  clearCart: () => Promise<CartDetailRecord>;
  applyCoupon: (codigoCupon: string) => Promise<CartDetailRecord>;
  removeCoupon: () => Promise<CartDetailRecord>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isInitializing } = useAuth();
  const [cart, setCart] = useState<CartDetailRecord | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState<boolean>(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    setIsLoadingCart(true);
    setCartError(null);
    try {
      const data = await cartApi.getCart();
      setCart(data);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Error al cargar el carrito.');
    } finally {
      setIsLoadingCart(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      void refreshCart();
    }
  }, [user?.idUsuario, isInitializing, refreshCart]);

  const addItem = useCallback(async (idVariante: number, cantidad: number) => {
    const updated = await cartApi.addItem(idVariante, cantidad);
    setCart(updated);
    return updated;
  }, []);

  const updateQuantity = useCallback(async (idVariante: number, cantidad: number) => {
    const updated = await cartApi.setItemQuantity(idVariante, cantidad);
    setCart(updated);
    return updated;
  }, []);

  const removeItem = useCallback(async (idVariante: number) => {
    const updated = await cartApi.removeItem(idVariante);
    setCart(updated);
    return updated;
  }, []);

  const clearCart = useCallback(async () => {
    const updated = await cartApi.clearCart();
    setCart(updated);
    return updated;
  }, []);

  const applyCoupon = useCallback(async (codigoCupon: string) => {
    const updated = await cartApi.applyCoupon(codigoCupon);
    setCart(updated);
    return updated;
  }, []);

  const removeCoupon = useCallback(async () => {
    const updated = await cartApi.removeCoupon();
    setCart(updated);
    return updated;
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoadingCart,
        loadingCart: isLoadingCart,
        cartError,
        refreshCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart debe utilizarse dentro de un CartProvider');
  }
  return ctx;
}
