// ── Wishlist API Service ──────────────────────────────────────────

import { apiRequest } from './api';
import type { WishlistItem, PaginatedResponse } from '../types';

/** GET /api/v1/wishlist/ — list wishlist items */
export async function fetchWishlist(): Promise<WishlistItem[]> {
  const data = await apiRequest<PaginatedResponse<WishlistItem>>({ method: 'GET', url: '/wishlist/' });
  return data.results;
}

/** POST /api/v1/wishlist/ — add product to wishlist */
export async function addToWishlist(productId: number): Promise<WishlistItem> {
  return apiRequest<WishlistItem>({
    method: 'POST',
    url: '/wishlist/',
    data: { product_id: productId },
  });
}

/** DELETE /api/v1/wishlist/<id>/ — remove from wishlist */
export async function removeFromWishlist(itemId: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `/wishlist/${itemId}/` });
}

/** GET /api/v1/wishlist/check/<product_id>/ — check if product is in wishlist */
export async function checkWishlist(productId: number): Promise<boolean> {
  const data = await apiRequest<{ in_wishlist: boolean }>({
    method: 'GET',
    url: `/wishlist/check/${productId}/`,
  });
  return data.in_wishlist;
}
