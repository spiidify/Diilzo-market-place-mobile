// ── Cart API Service ──────────────────────────────────────────────

import { apiRequest } from './api';
import type { Cart, CartItem } from '../types';

/** GET /api/v1/cart/ — get current user's cart */
export async function getCart(): Promise<Cart> {
  return apiRequest<Cart>({ method: 'GET', url: '/cart/' });
}

/** POST /api/v1/cart/items/ — add product to cart */
export async function addToCart(productId: number, quantity = 1): Promise<CartItem> {
  return apiRequest<CartItem>({
    method: 'POST',
    url: '/cart/items/',
    data: { product_id: productId, quantity },
  });
}

/** PATCH /api/v1/cart/items/<id>/ — update quantity */
export async function updateCartItem(itemId: number, quantity: number): Promise<CartItem> {
  return apiRequest<CartItem>({
    method: 'PATCH',
    url: `/cart/items/${itemId}/`,
    data: { quantity },
  });
}

/** DELETE /api/v1/cart/items/<id>/ — remove item from cart */
export async function removeCartItem(itemId: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `/cart/items/${itemId}/` });
}

/** POST /api/v1/cart/clear/ — empty the cart */
export async function clearCart(): Promise<void> {
  await apiRequest({ method: 'POST', url: '/cart/clear/' });
}
