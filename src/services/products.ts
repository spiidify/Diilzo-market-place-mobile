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
 * Uses the standard product list endpoint with `search` param (ORM icontains).
 */
export async function searchProducts(query: string, page = 1, extraParams: ProductListParams = {}): Promise<ProductFeedResponse & PaginatedResponse<Product>> {
  return fetchProducts({ search: query, page, ...extraParams });
}

// ── Elasticsearch Search ──────────────────────────────────────────
// High-performance search powered by Elasticsearch/OpenSearch.
// Falls back to ORM (icontains) on the backend if ES is unavailable.

export interface ESSearchParams {
  q?: string;            // search keyword
  category?: string;     // category slug for faceted filtering
  page?: number;
  page_size?: number;
  ordering?: string;     // -created_at, price, -price, rating
}

export interface ESSearchResult {
  results: Product[];
  count: number;
  page: number;
  page_size: number;
  has_next: boolean;
  es_used: boolean;      // true if Elasticsearch was used, false if ORM fallback
}

/**
 * Search products using Elasticsearch (multi_match with title^3 boost).
 * GET /api/v1/search/?q=<keyword>&category=<slug>&page=1&page_size=20
 *
 * Falls back to ORM on the backend if Elasticsearch is unavailable.
 */
export async function esSearchProducts(params: ESSearchParams = {}): Promise<ESSearchResult> {
  return apiRequest<ESSearchResult>({
    method: 'GET',
    url: '/search/',
    params,
  });
}

/**
 * Lightweight live search for autocomplete suggestions.
 * GET /api/v1/search/live/?q=<keyword>
 * Returns up to 10 product results. Minimum 2 characters required.
 */
export async function esLiveSearch(q: string, limit = 10): Promise<Product[]> {
  if (q.trim().length < 2) return [];
  const data = await apiRequest<{ results: Product[] }>({
    method: 'GET',
    url: '/search/live/',
    params: { q, limit },
  });
  return data.results || [];
}
