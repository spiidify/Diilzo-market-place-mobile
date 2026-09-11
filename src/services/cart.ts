// ── Cart API Service ──────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';

import type { Cart, CartItem } from '../types';
import { apiRequest } from './api';

const GUEST_CART_ID_KEY = 'diilzo_guest_cart_id';

// In-memory fallback if SecureStore is unavailable
let _memoryGuestCartId: string | null = null;

/** Get or create a persistent guest cart ID for anonymous users. */
async function getGuestCartId(): Promise<string> {
  // Try SecureStore first (works in Expo Go and dev builds)
  try {
    let id = await SecureStore.getItemAsync(GUEST_CART_ID_KEY);
    if (id) return id;
    id = `gcart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(GUEST_CART_ID_KEY, id);
    return id;
  } catch {
    // Fallback to in-memory ID
    if (!_memoryGuestCartId) {
      _memoryGuestCartId = `gcart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return _memoryGuestCartId;
  }
}

/** Build headers with guest cart ID for anonymous requests. */
async function guestCartHeaders(): Promise<Record<string, string>> {
  const id = await getGuestCartId();
  return { 'X-Guest-Cart-Id': id };
}

/** GET /api/v1/cart/ — get current user's or guest cart */
export async function getCart(): Promise<Cart> {
  const headers = await guestCartHeaders();
  return apiRequest<Cart>({ method: 'GET', url: '/cart/', headers });
}

/** GET /api/v1/cart/count/ — get cart item count (lightweight) */
export async function getCartCount(): Promise<number> {
  const headers = await guestCartHeaders();
  const data = await apiRequest<{ total_items: number }>({
    method: 'GET',
    url: '/cart/count/',
    headers,
  });
  return data.total_items;
}

/** POST /api/v1/cart/items/ — add product to cart */
export async function addToCart(productId: number, quantity = 1, variantId?: number): Promise<CartItem> {
  const headers = await guestCartHeaders();
  return apiRequest<CartItem>({
    method: 'POST',
    url: '/cart/items/',
    data: { product_id: productId, quantity, ...(variantId ? { variant_id: variantId } : {}) },
    headers,
  });
}

/** PATCH /api/v1/cart/items/<id>/ — update quantity */
export async function updateCartItem(itemId: number, quantity: number): Promise<CartItem> {
  const headers = await guestCartHeaders();
  return apiRequest<CartItem>({
    method: 'PATCH',
    url: `/cart/items/${itemId}/`,
    data: { quantity },
    headers,
  });
}

/** DELETE /api/v1/cart/items/<id>/ — remove item from cart */
export async function removeCartItem(itemId: number): Promise<void> {
  const headers = await guestCartHeaders();
  await apiRequest({ method: 'DELETE', url: `/cart/items/${itemId}/`, headers });
}

/** POST /api/v1/cart/clear/ — empty the cart */
export async function clearCart(): Promise<void> {
  const headers = await guestCartHeaders();
  await apiRequest({ method: 'POST', url: '/cart/clear/', headers });
}

/** Clear the local guest cart ID (call after login when cart is merged server-side). */
export async function clearGuestCartId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_CART_ID_KEY);
  } catch {
    _memoryGuestCartId = null;
  }
}
