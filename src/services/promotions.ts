// ── Promotion & Discovery Engine Service ──────────────────────────
// Handles all mobile-side interactions with the backend promotion API.

import type {
  PromotionPackage,
  ProductPromotion,
  PromotionAnalytics,
  KeywordBid,
  ProductFeedResponse,
} from '../types';
import { apiRequest } from './api';

/** GET /api/v1/promotions/packages/ — list available promotion packages */
export async function fetchPromotionPackages(): Promise<PromotionPackage[]> {
  const data = await apiRequest<{ results: PromotionPackage[] } | PromotionPackage[]>({
    method: 'GET',
    url: '/promotions/packages/',
  });
  return Array.isArray(data) ? data : data.results || [];
}

/** GET /api/v1/promotions/ — list the seller's own promotions */
export async function fetchMyPromotions(): Promise<ProductPromotion[]> {
  const data = await apiRequest<{ results: ProductPromotion[] } | ProductPromotion[]>({
    method: 'GET',
    url: '/promotions/',
  });
  return Array.isArray(data) ? data : data.results || [];
}

/** POST /api/v1/promotions/purchase/ — purchase a promotion for a product */
export async function purchasePromotion(params: {
  product_id: number;
  package_id: number;
  ad_spend_budget?: number;
  bid_per_click?: number;
  target_keywords?: string;
  target_category_id?: number;
}): Promise<ProductPromotion> {
  return apiRequest<ProductPromotion>({
    method: 'POST',
    url: '/promotions/purchase/',
    data: params,
  });
}

/** POST /api/v1/promotions/<id>/activate/ — activate a pending promotion */
export async function activatePromotion(id: number): Promise<ProductPromotion> {
  return apiRequest<ProductPromotion>({
    method: 'POST',
    url: `/promotions/${id}/activate/`,
  });
}

/** POST /api/v1/promotions/<id>/pause/ — pause an active promotion */
export async function pausePromotion(id: number): Promise<ProductPromotion> {
  return apiRequest<ProductPromotion>({
    method: 'POST',
    url: `/promotions/${id}/pause/`,
  });
}

/** POST /api/v1/promotions/<id>/resume/ — resume a paused promotion */
export async function resumePromotion(id: number): Promise<ProductPromotion> {
  return apiRequest<ProductPromotion>({
    method: 'POST',
    url: `/promotions/${id}/resume/`,
  });
}

/** GET /api/v1/promotions/sponsored/ — get sponsored products for feed injection */
export async function fetchSponsoredProducts(params?: {
  search?: string;
  category?: string;
  limit?: number;
}): Promise<{ results: import('../types').Product[] }> {
  return apiRequest<{ results: import('../types').Product[] }>({
    method: 'GET',
    url: '/promotions/sponsored/',
    params,
  });
}

/** GET /api/v1/promotions/analytics/ — seller promotion analytics summary */
export async function fetchPromotionAnalytics(): Promise<PromotionAnalytics> {
  return apiRequest<PromotionAnalytics>({
    method: 'GET',
    url: '/promotions/analytics/',
  });
}

// ── Keyword Bidding (CPC) ─────────────────────────────────────────

/** GET /api/v1/promotions/keyword-bids/ — list seller's keyword bids */
export async function fetchKeywordBids(): Promise<KeywordBid[]> {
  const data = await apiRequest<{ results: KeywordBid[] } | KeywordBid[]>({
    method: 'GET',
    url: '/promotions/keyword-bids/',
  });
  return Array.isArray(data) ? data : data.results || [];
}

/** POST /api/v1/promotions/keyword-bids/ — create or update a keyword bid */
export async function createKeywordBid(params: {
  keyword: string;
  bid_amount: number;
  promotion_id?: number;
  is_active?: boolean;
}): Promise<KeywordBid> {
  return apiRequest<KeywordBid>({
    method: 'POST',
    url: '/promotions/keyword-bids/',
    data: params,
  });
}

// ── Interaction Tracking (Recommendation Engine Signals) ──────────

/** POST /api/v1/promotions/track/impression/ — record a product impression */
export async function trackImpression(productId: number, searchQuery?: string): Promise<void> {
  try {
    await apiRequest({
      method: 'POST',
      url: '/promotions/track/impression/',
      data: { product_id: productId, search_query: searchQuery || '' },
    });
  } catch {
    // Silent fail — tracking should never block UX
  }
}

/** POST /api/v1/promotions/track/click/ — record a product click (charges CPC) */
export async function trackClick(productId: number, searchQuery?: string): Promise<void> {
  try {
    await apiRequest({
      method: 'POST',
      url: '/promotions/track/click/',
      data: { product_id: productId, search_query: searchQuery || '' },
    });
  } catch {
    // Silent fail
  }
}

/** POST /api/v1/promotions/track/add-to-cart/ — record an add-to-cart */
export async function trackAddToCart(productId: number): Promise<void> {
  try {
    await apiRequest({
      method: 'POST',
      url: '/promotions/track/add-to-cart/',
      data: { product_id: productId },
    });
  } catch {
    // Silent fail
  }
}

/** POST /api/v1/promotions/track/purchase/ — record a purchase */
export async function trackPurchase(productId: number): Promise<void> {
  try {
    await apiRequest({
      method: 'POST',
      url: '/promotions/track/purchase/',
      data: { product_id: productId },
    });
  } catch {
    // Silent fail
  }
}
