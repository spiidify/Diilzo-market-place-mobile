// ── Orders API Service ────────────────────────────────────────────

import type { Order, PaginatedResponse } from '../types';
import { apiRequest } from './api';

/** GET /api/v1/orders/ — list user's orders */
export async function fetchOrders(): Promise<Order[]> {
  const data = await apiRequest<PaginatedResponse<Order>>({ method: 'GET', url: '/orders/' });
  return data.results;
}

/** GET /api/v1/orders/<id>/ — order detail */
export async function fetchOrderById(id: number): Promise<Order> {
  return apiRequest<Order>({ method: 'GET', url: `/orders/${id}/` });
}

/** POST /api/v1/orders/<id>/cancel/ — cancel order */
export async function cancelOrder(id: number): Promise<{ message: string; status: string }> {
  return apiRequest({ method: 'POST', url: `/orders/${id}/cancel/` });
}

/** POST /api/v1/orders/create/ — create order from cart */
export async function createOrder(params: {
  shipping_address?: Record<string, any>;
  notes?: string;
}): Promise<Order> {
  return apiRequest<Order>({ method: 'POST', url: '/orders/create/', data: params });
}

/** GET /api/v1/orders/<id>/track/ — shipment tracking */
export async function fetchOrderTracking(id: number): Promise<{
  order_id: number;
  order_status: string;
  shipments: Array<{
    id: number;
    carrier: string;
    tracking_number: string;
    status: string;
    shipped_at: string | null;
    delivered_at: string | null;
    estimated_delivery: string | null;
  }>;
}> {
  return apiRequest({ method: 'GET', url: `/orders/${id}/track/` });
}

/** POST /api/v1/orders/<id>/return/ — request a return */
export async function requestReturn(id: number, reason: string, description?: string, suborderId?: number): Promise<{
  id: number;
  status: string;
  detail: string;
}> {
  return apiRequest({
    method: 'POST',
    url: `/orders/${id}/return/`,
    data: { reason, description: description || '', suborder_id: suborderId },
  });
}

/** POST /api/v1/orders/<id>/confirm-receipt/ — buyer confirms receipt */
export async function confirmReceipt(id: number): Promise<{
  detail: string;
  order_id: number;
  status: string;
}> {
  return apiRequest({ method: 'POST', url: `/orders/${id}/confirm-receipt/` });
}

/** POST /api/v1/orders/<id>/reorder/ — add all items to cart */
export async function reorder(id: number): Promise<{ detail: string; added: number }> {
  return apiRequest({ method: 'POST', url: `/orders/${id}/reorder/` });
}

// ── Shipping Calculator ───────────────────────────────────────────

/** POST /api/v1/shipping/calculate/ — estimate shipping cost */
export async function calculateShipping(params: {
  items: Array<{ product_id: number; quantity: number }>;
  address: { city: string; country?: string };
}): Promise<{
  shipping_cost: string;
  estimated_days: number;
  method_name: string;
  available: boolean;
  currency: string;
}> {
  return apiRequest({ method: 'POST', url: '/shipping/calculate/', data: params });
}

// ── Reviews ───────────────────────────────────────────────────────

/** PATCH /api/v1/reviews/<id>/ — update own review */
export async function updateReview(reviewId: number, data: {
  rating?: number;
  comment?: string;
}): Promise<{ id: number; rating: number; comment: string; updated_at: string }> {
  return apiRequest({ method: 'PATCH', url: `/reviews/${reviewId}/`, data });
}

/** DELETE /api/v1/reviews/<id>/ — delete own review */
export async function deleteReview(reviewId: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `/reviews/${reviewId}/` });
}

// ── Address Set Default ───────────────────────────────────────────

/** POST /api/v1/auth/addresses/<id>/set-default/ — set address as default */
export async function setDefaultAddress(id: number): Promise<{
  detail: string;
  id: number;
  is_default: boolean;
}> {
  return apiRequest({ method: 'POST', url: `/auth/addresses/${id}/set-default/` });
}
