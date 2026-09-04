// ── Product API Service ──────────────────────────────────────────

import api, { apiRequest } from './api';
import type { Product, PaginatedResponse } from '../types';

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
}

/**
 * Fetch a paginated list of products.
 * GET /api/v1/products/
 */
export async function fetchProducts(params: ProductListParams = {}): Promise<PaginatedResponse<Product>> {
  return apiRequest<PaginatedResponse<Product>>({
    method: 'GET',
    url: '/products/',
    params,
  });
}

/**
 * Fetch a single product by slug.
 * GET /api/v1/products/<slug>/
 */
export async function fetchProductBySlug(slug: string): Promise<Product> {
  return apiRequest<Product>({
    method: 'GET',
    url: `/products/${slug}/`,
  });
}

/**
 * Search products by name or description.
 */
export async function searchProducts(query: string, page = 1): Promise<PaginatedResponse<Product>> {
  return fetchProducts({ search: query, page });
}
