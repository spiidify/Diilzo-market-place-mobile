// ── Catalog API Service (Categories, Brands, Stores, Reviews) ─────

import type { Brand, Category, PaginatedResponse, Product, Review, Slide, Store, StoreDetail, StoreReview } from '../types';
import { apiRequest } from './api';

/** GET /api/v1/slides/ — active homepage carousel slides */
export async function fetchSlides(): Promise<Slide[]> {
  const data = await apiRequest<PaginatedResponse<Slide>>({ method: 'GET', url: '/slides/' });
  return data.results || (data as any);
}

/** GET /api/v1/categories/ — fetch ALL categories (auto-paginates) */
export async function fetchCategories(): Promise<Category[]> {
  let page = 1;
  let all: Category[] = [];
  let next: string | null = null;
  do {
    const data = await apiRequest<PaginatedResponse<Category>>({
      method: 'GET',
      url: '/categories/',
      params: { page },
    });
    all = [...all, ...data.results];
    next = data.next;
    page += 1;
  } while (next);
  return all;
}

/** GET /api/v1/categories/ — single page (for lazy loading) */
export async function fetchCategoriesPage(page = 1): Promise<PaginatedResponse<Category>> {
  return apiRequest<PaginatedResponse<Category>>({
    method: 'GET',
    url: '/categories/',
    params: { page },
  });
}

/** GET /api/v1/brands/ — list all brands */
export async function fetchBrands(): Promise<Brand[]> {
  const data = await apiRequest<PaginatedResponse<Brand>>({ method: 'GET', url: '/brands/' });
  return data.results;
}

/** GET /api/v1/stores/ — list approved stores */
export async function fetchStores(params?: { search?: string; country?: string; wholesaler?: string }): Promise<Store[]> {
  const data = await apiRequest<PaginatedResponse<Store>>({
    method: 'GET',
    url: '/stores/',
    params,
  });
  return data.results;
}

/** GET /api/v1/stores/ — paginated stores (for directory with infinite scroll) */
export async function fetchStoresPage(params?: {
  search?: string;
  country?: string;
  wholesaler?: string;
  page?: number;
}): Promise<PaginatedResponse<Store>> {
  return apiRequest<PaginatedResponse<Store>>({
    method: 'GET',
    url: '/stores/',
    params,
  });
}

/** GET /api/v1/stores/?wholesaler=true — fetch suppliers (manufacturers, wholesalers, distributors) */
export async function fetchSuppliers(page = 1): Promise<PaginatedResponse<Store>> {
  return apiRequest<PaginatedResponse<Store>>({
    method: 'GET',
    url: '/stores/',
    params: { wholesaler: 'true', page },
  });
}

/** GET /api/v1/stores/?is_featured=true — fetch top/featured stores */
export async function fetchTopStores(): Promise<Store[]> {
  const data = await apiRequest<PaginatedResponse<Store>>({
    method: 'GET',
    url: '/stores/',
  });
  // Sort by featured first, then by product count
  const stores = data.results.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (b.product_count || 0) - (a.product_count || 0);
  });
  return stores;
}

/** GET /api/v1/stores/<slug>/ — store detail */
export async function fetchStoreBySlug(slug: string): Promise<StoreDetail> {
  return apiRequest<StoreDetail>({ method: 'GET', url: `/stores/${slug}/` });
}

/** GET /api/v1/stores/<slug>/products/ — products from a store */
export async function fetchStoreProducts(slug: string, page = 1): Promise<PaginatedResponse<Product>> {
  return apiRequest<PaginatedResponse<Product>>({
    method: 'GET',
    url: `/stores/${slug}/products/`,
    params: { page },
  });
}

/** GET /api/v1/products/<slug>/reviews/ — product reviews */
export async function fetchProductReviews(slug: string): Promise<Review[]> {
  const data = await apiRequest<PaginatedResponse<Review>>({
    method: 'GET',
    url: `/products/${slug}/reviews/`,
  });
  return data.results;
}

/** POST /api/v1/products/<slug>/reviews/ — create a review */
export async function createReview(slug: string, rating: number, comment: string): Promise<Review> {
  return apiRequest<Review>({
    method: 'POST',
    url: `/products/${slug}/reviews/`,
    data: { rating, comment },
  });
}

/** POST /api/v1/stores/<slug>/follow/ — follow a store */
export async function followStore(slug: string): Promise<{ following: boolean; created: boolean }> {
  return apiRequest({ method: 'POST', url: `/stores/${slug}/follow/` });
}

/** DELETE /api/v1/stores/<slug>/follow/ — unfollow a store */
export async function unfollowStore(slug: string): Promise<{ following: boolean }> {
  return apiRequest({ method: 'DELETE', url: `/stores/${slug}/follow/` });
}

/** GET /api/v1/stores/<slug>/reviews/ — store reviews */
export async function fetchStoreReviews(slug: string): Promise<StoreReview[]> {
  return apiRequest<StoreReview[]>({ method: 'GET', url: `/stores/${slug}/reviews/` });
}

/** POST /api/v1/stores/<slug>/reviews/ — create store review */
export async function createStoreReview(slug: string, rating: number, comment: string): Promise<StoreReview> {
  return apiRequest<StoreReview>({
    method: 'POST',
    url: `/stores/${slug}/reviews/`,
    data: { rating, comment },
  });
}

/** POST /api/v1/coupons/validate/ — validate a coupon */
export async function validateCoupon(code: string): Promise<{
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
}> {
  return apiRequest({ method: 'POST', url: '/coupons/validate/', data: { code } });
}

/** POST /api/v1/products/<slug>/view/ — track product view */
export async function trackProductView(slug: string): Promise<void> {
  await apiRequest({ method: 'POST', url: `/products/${slug}/view/` });
}
