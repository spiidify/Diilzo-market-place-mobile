// ── Orders API Service ────────────────────────────────────────────

import { apiRequest } from './api';
import type { Order, PaginatedResponse } from '../types';

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
