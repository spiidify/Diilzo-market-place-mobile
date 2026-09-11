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
  /** Optional AbortSignal to cancel the underlying axios request. */
  signal?: AbortSignal;
}

/**
 * Fetch a paginated list of products.
 * GET /api/v1/products/
 * Returns pinned, sponsored, and organic results sections.
 */
export async function fetchProducts(params: ProductListParams = {}): Promise<ProductFeedResponse & PaginatedResponse<Product>> {
  const { signal, ...queryParams } = params;
  const data = await apiRequest<ProductFeedResponse & PaginatedResponse<Product>>({
    method: 'GET',
    url: '/products/',
    params: queryParams,
    signal,
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

// ── PostgreSQL Full Text Search ────────────────────────────────────
// Powered by PostgreSQL FTS + pg_trgm (fuzzy matching) + GIN indexes.
// No external search provider (Algolia/Elasticsearch) required.

export interface SearchParams {
  q?: string;              // search keyword
  category?: string;       // category slug for faceted filtering
  brand?: string;          // brand slug
  store?: string;          // store slug
  min_price?: string;      // minimum price
  max_price?: string;      // maximum price
  min_rating?: string;     // minimum rating (1-5)
  in_stock?: string;       // "true" to filter in-stock only
  on_sale?: string;        // "true" to filter sale products only
  is_featured?: string;    // "true" to filter featured only
  seller_country?: string; // filter by seller country
  seller_city?: string;    // filter by seller city
  verified?: string;       // "true" for verified sellers only
  wholesale?: string;      // "true" for wholesale products only
  local?: string;          // "true" for local sellers (requires buyer_country)
  international?: string;  // "true" for international sellers
  buyer_country?: string;  // buyer's country for local ranking
  buyer_city?: string;     // buyer's city for local ranking
  buyer_lat?: number;      // buyer's latitude for distance calculation
  buyer_lng?: number;      // buyer's longitude for distance calculation
  page?: number;
  page_size?: number;
  ordering?: string;       // -created_at, price, -price, rating, popularity, best_selling, relevance
  /** Optional AbortSignal to cancel the underlying axios request. */
  signal?: AbortSignal;
}

export interface SearchResult {
  results: Product[];
  count: number;
  page: number;
  page_size: number;
  has_next: boolean;
  es_used: boolean;        // maintained for backward compat (always false now)
  query?: string;          // the original query
  suggestion?: string | null;  // "Did you mean..." spelling correction
}

/**
 * Search products using PostgreSQL Full Text Search.
 * GET /api/v1/search/?q=<keyword>&category=<slug>&page=1&page_size=20
 *
 * Uses SearchVector + SearchRank (weighted) + pg_trgm (fuzzy) + composite
 * ranking (popularity, sales, rating, availability, seller quality, freshness,
 * location bonus).
 */
export async function esSearchProducts(params: SearchParams = {}): Promise<SearchResult> {
  const { signal, ...queryParams } = params;
  return apiRequest<SearchResult>({
    method: 'GET',
    url: '/search/',
    params: queryParams,
    signal,
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

/**
 * Autocomplete suggestions (product names, brand names, category names).
 * GET /api/v1/search/autocomplete/?q=<prefix>&limit=8
 * Returns suggestion strings for search input dropdowns.
 */
export async function getAutocomplete(q: string, limit = 8): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const data = await apiRequest<{ suggestions: string[] }>({
    method: 'GET',
    url: '/search/autocomplete/',
    params: { q, limit },
  });
  return data.suggestions || [];
}

/**
 * Get trending search terms from search analytics.
 * GET /api/v1/search/trending/?limit=10
 * Cached on the backend for 10 minutes.
 */
export async function getTrendingSearches(limit = 10): Promise<string[]> {
  const data = await apiRequest<{ trending: string[] }>({
    method: 'GET',
    url: '/search/trending/',
    params: { limit },
  });
  return data.trending || [];
}

/**
 * Get mixed suggestions (products, brands, categories) for a query.
 * GET /api/v1/search/suggestions/?q=<prefix>&limit=5
 */
export async function getSearchSuggestions(q: string, limit = 5): Promise<{
  products: string[];
  brands: string[];
  categories: string[];
}> {
  if (q.trim().length < 2) return { products: [], brands: [], categories: [] };
  return apiRequest<{
    products: string[];
    brands: string[];
    categories: string[];
  }>({
    method: 'GET',
    url: '/search/suggestions/',
    params: { q, limit },
  });
}

/**
 * Log a search result click for analytics.
 * POST /api/v1/search/click/
 * This connects the clicked product to the original search query for
 * click-through rate and conversion tracking.
 */
export async function logSearchClick(query: string, productId?: number, storeId?: number): Promise<void> {
  try {
    await apiRequest<{ logged: boolean }>({
      method: 'POST',
      url: '/search/click/',
      data: { query, product_id: productId, store_id: storeId },
    });
  } catch {
    // Silently fail — analytics should never break the UX
  }
}

// ── Seller Search ──────────────────────────────────────────────────

export interface SellerSearchResult {
  id: number;
  name: string;
  slug: string;
  description: string;
  country: string;
  city: string;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_wholesaler: boolean;
  logo_url: string;
  product_count: number;
}

export interface SellerSearchResponse {
  results: SellerSearchResult[];
  count: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

/**
 * Search sellers/stores by name, description, country, or city.
 * GET /api/v1/search/sellers/?q=<keyword>&page=1&page_size=20
 */
export async function searchSellers(
  q: string,
  page = 1,
  extraParams?: { country?: string; city?: string; verified?: string; page_size?: number }
): Promise<SellerSearchResponse> {
  return apiRequest<SellerSearchResponse>({
    method: 'GET',
    url: '/search/sellers/',
    params: { q, page, ...extraParams },
  });
}
