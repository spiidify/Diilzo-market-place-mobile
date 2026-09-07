// ── Catalog API Service (Categories, Brands, Stores, Reviews) ─────

import type {
  Brand,
  Category,
  ClaimableCoupon,
  PaginatedResponse,
  Product,
  RFQPayload,
  RFQResponse,
  Review,
  Slide,
  SlidePosition,
  Store,
  StoreDetail,
  StoreReview
} from '../types';
import { apiRequest } from './api';

/** GET /api/v1/slides/ — active homepage carousel slides (optionally by position). */
export async function fetchSlides(position?: SlidePosition): Promise<Slide[]> {
  const data = await apiRequest<PaginatedResponse<Slide>>({
    method: 'GET',
    url: '/slides/',
    params: position ? { position } : undefined,
  });
  return data.results || (data as any);
}

/** GET /api/v1/categories/ — fetch ALL categories in one request and build tree */
export async function fetchCategories(): Promise<Category[]> {
  // Fetch all categories in a single request (page_size=500) to avoid
  // making 15+ paginated calls that trigger rate limiting (429 errors)
  const data = await apiRequest<PaginatedResponse<Category>>({
    method: 'GET',
    url: '/categories/',
    params: { page_size: 500 },
  });
  const all = data.results;

  // Build tree: group children under their parent
  const parents = all.filter((c) => !c.parent);
  const childrenByParent = new Map<number, Category[]>();
  for (const c of all) {
    if (c.parent) {
      const siblings = childrenByParent.get(c.parent) || [];
      siblings.push(c);
      childrenByParent.set(c.parent, siblings);
    }
  }
  return parents
    .map((p) => ({ ...p, children: childrenByParent.get(p.id) || [] }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
}

/** GET /api/v1/categories/ — single page (for lazy loading) */
export async function fetchCategoriesPage(page = 1): Promise<PaginatedResponse<Category>> {
  return apiRequest<PaginatedResponse<Category>>({
    method: 'GET',
    url: '/categories/',
    params: { page },
  });
}

/** GET /api/v1/brands/ — list all brands in one request */
export async function fetchBrands(): Promise<Brand[]> {
  const data = await apiRequest<PaginatedResponse<Brand>>({
    method: 'GET',
    url: '/brands/',
    params: { page_size: 500 },
  });
  return data.results.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
}

/** GET /api/v1/brands/ — top brands (with products) for homepage showcase */
export async function fetchTopBrands(): Promise<Brand[]> {
  const all = await fetchBrands();
  return all
    .filter((b) => (b.product_count || 0) > 0)
    .slice(0, 12);
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

// ── Discovery / Personalization / B2B ─────────────────────────────

/** GET /api/v1/products/recently-viewed/ — server-backed browsing history. */
export async function fetchRecentlyViewed(): Promise<Product[]> {
  const data = await apiRequest<{ results: Product[] }>({ method: 'GET', url: '/products/recently-viewed/' });
  return data.results || [];
}

/** GET /api/v1/products/because-you-viewed/ — personalized recommendations. */
export async function fetchBecauseYouViewed(): Promise<Product[]> {
  const data = await apiRequest<{ results: Product[] }>({ method: 'GET', url: '/products/because-you-viewed/' });
  return data.results || [];
}

/** GET /api/v1/products/?flash_sale=true — active flash sale products. */
export async function fetchFlashSaleProducts(page = 1): Promise<PaginatedResponse<Product>> {
  return apiRequest<PaginatedResponse<Product>>({
    method: 'GET',
    url: '/products/',
    params: { flash_sale: 'true', page },
  });
}

/** GET /api/v1/coupons/claimable/ — claimable vouchers for the home banner. */
export async function fetchClaimableCoupons(): Promise<ClaimableCoupon[]> {
  const data = await apiRequest<{ results: ClaimableCoupon[] }>({ method: 'GET', url: '/coupons/claimable/' });
  return data.results || [];
}

/** GET /api/v1/notifications/unread-count/ — bell badge count. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const data = await apiRequest<{ count: number }>({ method: 'GET', url: '/notifications/unread-count/' });
    return data.count || 0;
  } catch {
    return 0;
  }
}

/** POST /api/v1/rfq/ — submit a Request for Quotation (Alibaba-style sourcing). */
export async function submitRFQ(payload: RFQPayload): Promise<RFQResponse> {
  return apiRequest<RFQResponse>({ method: 'POST', url: '/rfq/', data: payload });
}
