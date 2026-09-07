// ── Product API Service ──────────────────────────────────────────

import type { PaginatedResponse, Product, ProductFeedResponse } from '../types';
import { apiRequest } from './api';

export interface ProductListParams {
  page?: number;
  search?: string;
  category?: string;       // category slug
  brand?: string;          // brand slug
  store?: string;          // store slug
  featured?: 'true' | 'false';
  on_sale?: 'true' | 'false';
  new_arrival?: 'true' | 'false';
  in_stock?: 'true' | 'false';
  flash_sale?: 'true' | 'false';
  followed?: 'true' | 'false';
  ordering?: string;       // price, -price, -created_at, rating
  min_price?: string;
  max_price?: string;
  /** Cloudinary image optimization dimensions (physical pixels) */
  width?: number;
  height?: number;
}

/**
 * Fetch a paginated list of products.
 * GET /api/v1/products/
 * Returns pinned, sponsored, and organic results sections.
 */
export async function fetchProducts(params: ProductListParams = {}): Promise<ProductFeedResponse & PaginatedResponse<Product>> {
  const data = await apiRequest<ProductFeedResponse & PaginatedResponse<Product>>({
    method: 'GET',
    url: '/products/',
    params,
  });
  // Ensure pinned/sponsored arrays exist (backward compat with older API)
  if (!data.pinned) data.pinned = [];
  if (!data.sponsored) data.sponsored = [];
  // Ensure results exists (fallback to data if flat array)
  if (!data.results && Array.isArray(data)) {
    data.results = data as any;
  }
  return data;
}

/**
 * Fetch a single product by slug.
 * GET /api/v1/products/<slug>/
 */
export async function fetchProductBySlug(
  slug: string,
  imageSize?: { width: number; height: number }
): Promise<Product> {
  return apiRequest<Product>({
    method: 'GET',
    url: `/products/${slug}/`,
    params: imageSize,
  });
}

/**
 * Search products by name or description.
 */
export async function searchProducts(query: string, page = 1, extraParams: ProductListParams = {}): Promise<ProductFeedResponse & PaginatedResponse<Product>> {
  return fetchProducts({ search: query, page, ...extraParams });
}
