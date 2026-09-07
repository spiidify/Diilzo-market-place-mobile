import { useCallback, createContext, useContext, useRef, useState, type ReactNode } from 'react';

import { clearCart as apiClearCart, getCartCount } from '@/services/cart';

interface CartContextValue {
  cartCount: number;
  refreshCartCount: () => Promise<void>;
  incrementCartCount: (by?: number) => void;
  setCartCount: (n: number) => void;
  clearCartCount: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCountState] = useState(0);
  const fetchingRef = useRef(false);

  const refreshCartCount = useCallback(async () => {
    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const count = await getCartCount();
      setCartCountState(count);
    } catch {
      // Keep previous count on error — better than showing 0
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const incrementCartCount = useCallback((by: number = 1) => {
    setCartCountState((prev) => Math.max(0, prev + by));
  }, []);

  const setCartCount = useCallback((n: number) => {
    setCartCountState(Math.max(0, n));
  }, []);

  const clearCartCount = useCallback(async () => {
    try {
      await apiClearCart();
    } catch {
      // ignore
    }
    setCartCountState(0);
  }, []);

  return (
    <CartContext.Provider
      value={{ cartCount, refreshCartCount, incrementCartCount, setCartCount, clearCartCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
