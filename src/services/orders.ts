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
