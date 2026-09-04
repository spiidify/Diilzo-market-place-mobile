// ── Catalog API Service (Categories, Brands, Stores, Reviews) ─────

import { apiRequest } from './api';
import type { Category, Brand, Store, StoreDetail, Review, PaginatedResponse, Product } from '../types';

/** GET /api/v1/categories/ — list all categories */
export async function fetchCategories(): Promise<Category[]> {
  const data = await apiRequest<PaginatedResponse<Category>>({ method: 'GET', url: '/categories/' });
  return data.results;
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
