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
  fulfillment_method?: 'home_delivery' | 'pickup_station';
  pickup_station_id?: number;
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

// ── Buyer Dashboard Stats ─────────────────────────────────────────

export interface OrderStats {
  to_pay: number;
  to_ship: number;
  to_receive: number;
  to_review: number;
  unreviewed_items: number;
  open_disputes: number;
  active_escrow: number;
  total_orders: number;
  by_status: Record<string, number>;
}

/** GET /api/v1/orders/stats/ — dashboard order-status counts */
export async function fetchOrderStats(): Promise<OrderStats> {
  return apiRequest<OrderStats>({ method: 'GET', url: '/orders/stats/' });
}

// ── Buyer Escrow ──────────────────────────────────────────────────

export interface EscrowHoldItem {
  id: number;
  order_id: number;
  order_number: string;
  amount_held: string;
  refunded_amount: string;
  remaining_amount: string;
  currency: string;
  status: string;
  release_reason: string;
  buyer_confirmed_receipt: boolean;
  days_until_auto_release: number | null;
  tracking_number: string;
  held_at: string;
  released_at: string | null;
  auto_release_date: string | null;
}

/** GET /api/v1/orders/escrow/ — buyer's escrow-protected payments */
export async function fetchMyEscrow(): Promise<EscrowHoldItem[]> {
  return apiRequest<EscrowHoldItem[]>({ method: 'GET', url: '/orders/escrow/' });
}

// ── Buyer Disputes ────────────────────────────────────────────────

export interface BuyerDispute {
  id: number;
  order_id: number;
  order_number: string;
  store_name: string;
  reason: string;
  description: string;
  status: string;
  resolution: string;
  created_at: string;
}

/** GET /api/v1/orders/disputes/ — list buyer's disputes */
export async function fetchMyDisputes(): Promise<BuyerDispute[]> {
  return apiRequest<BuyerDispute[]>({ method: 'GET', url: '/orders/disputes/' });
}

/** POST /api/v1/orders/<id>/dispute/ — open a dispute */
export async function openDispute(orderId: number, params: {
  reason: string;
  description: string;
  suborder_id?: number;
}): Promise<{ id: number; status: string; detail: string }> {
  return apiRequest({ method: 'POST', url: `/orders/${orderId}/dispute/`, data: params });
}

// ── Buyer RFQs ────────────────────────────────────────────────────

export interface BuyerRFQ {
  id: number;
  store_id: number;
  store_name: string;
  product_id: number | null;
  product_name: string;
  product_slug: string;
  quantity: number;
  target_price: string | null;
  notes: string;
  quoted_price: string | null;
  quoted_total: string | null;
  seller_notes: string;
  quoted_at: string | null;
  status: string;
  created_at: string;
}

/** GET /api/v1/my-rfqs/ — buyer's quotation requests */
export async function fetchMyRFQs(): Promise<BuyerRFQ[]> {
  return apiRequest<BuyerRFQ[]>({ method: 'GET', url: '/my-rfqs/' });
}

/** POST /api/v1/my-rfqs/<id>/<action>/ — accept or reject a quote */
export async function respondToRFQ(rfqId: number, action: 'accept' | 'reject'): Promise<{ id: number; status: string }> {
  return apiRequest({ method: 'POST', url: `/my-rfqs/${rfqId}/${action}/` });
}

// ── Referral ──────────────────────────────────────────────────────

/** GET /api/v1/me/referral/ — referral code + invite count */
export async function fetchMyReferral(): Promise<{ code: string; referred_count: number }> {
  return apiRequest({ method: 'GET', url: '/me/referral/' });
}

// ── Shipping Calculator (dual-engine) ─────────────────────────────

export interface ShippingFeePart {
  label: string;
  fee: string;
  kind: string;
  mode?: string;
  billing_units?: string;
  unit_label?: string;
}

export interface ShippingQuote {
  shipping_cost: string;
  estimated_days: number;
  method_name: string;
  available: boolean;
  currency: string;
  base_freight: string;
  customs_and_handling: string;
  last_mile_fee: string;
  total_shipping_fee: string;
  mode: string;
  parts: ShippingFeePart[];
}

/** POST /api/v1/shipping/calculate/ — dual-engine shipping estimate */
export async function calculateShipping(params: {
  items: Array<{ product_id: number; quantity: number }>;
  address: { city: string; country?: string; region?: string };
  delivery_type?: 'HOME_DELIVERY' | 'PICKUP_STATION';
  shipping_mode?: 'AIR' | 'SEA';
}): Promise<ShippingQuote> {
  return apiRequest<ShippingQuote>({ method: 'POST', url: '/shipping/calculate/', data: params });
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

// ── Wallet (store credit) ─────────────────────────────────────────

export interface WalletTransaction {
  id: number;
  amount: string;
  is_credit: boolean;
  tx_type: 'refund' | 'promo' | 'reward' | 'purchase' | 'adjustment';
  note: string;
  reference: string;
  order_number: string | null;
  balance_after: string;
  created_at: string;
}

export interface Wallet {
  balance: string;
  currency: string;
  transactions: WalletTransaction[];
}

/** GET /api/v1/wallet/ — wallet balance + history */
export async function fetchWallet(): Promise<Wallet> {
  return apiRequest<Wallet>({ method: 'GET', url: '/wallet/' });
}

// ── Loyalty Points ────────────────────────────────────────────────

export interface LoyaltyInfo {
  points: number;
  tier: string;
  next_tier: string | null;
  points_to_next: number;
  earn_rate: string;
  transactions: {
    id: number;
    points: number;
    tx_type: 'earn' | 'redeem' | 'bonus' | 'adjustment';
    note: string;
    order_number: string | null;
    created_at: string;
  }[];
}

/** GET /api/v1/loyalty/ — points balance + history */
export async function fetchLoyalty(): Promise<LoyaltyInfo> {
  return apiRequest<LoyaltyInfo>({ method: 'GET', url: '/loyalty/' });
}

// ── Product Watch (price-drop / restock) ──────────────────────────

/** GET /api/v1/products/<slug>/watch/ — is the user watching? */
export async function getWatchStatus(slug: string): Promise<boolean> {
  const res = await apiRequest<{ watching: boolean }>({ method: 'GET', url: `/products/${slug}/watch/` });
  return res.watching;
}

/** POST = watch · DELETE = unwatch */
export async function setWatch(slug: string, watch: boolean): Promise<boolean> {
  const res = await apiRequest<{ watching: boolean }>({
    method: watch ? 'POST' : 'DELETE',
    url: `/products/${slug}/watch/`,
  });
  return res.watching;
}

// ── Support Tickets ───────────────────────────────────────────────

export interface SupportTicket {
  id: number;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: string;
  order_number: string | null;
  admin_reply: string;
  replied_at: string | null;
  created_at: string;
}

/** GET /api/v1/support/tickets/ — my tickets */
export async function fetchMyTickets(): Promise<SupportTicket[]> {
  return apiRequest<SupportTicket[]>({ method: 'GET', url: '/support/tickets/' });
}

/** POST /api/v1/support/tickets/ — open a ticket */
export async function createTicket(params: {
  subject: string;
  message: string;
  category?: string;
  order_id?: number;
}): Promise<{ id: number; status: string; detail: string }> {
  return apiRequest({ method: 'POST', url: '/support/tickets/', data: params });
}

// ── Order Invoice ─────────────────────────────────────────────────

export interface OrderInvoice {
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  created_at: string;
  paid_at: string | null;
  customer: { name: string; email: string; phone: string };
  ship_to: { name: string; street: string; city: string; country: string; phone: string };
  suborders: {
    store_name: string;
    store_country: string;
    items: { name: string; variant: string; quantity: number; unit_price: string; total: string }[];
  }[];
  totals: {
    subtotal: string; shipping: string; tax: string;
    discount: string; platform_fees: string; total: string;
  };
}

/** GET /api/v1/orders/<id>/invoice/ — structured invoice data */
export async function fetchOrderInvoice(id: number): Promise<OrderInvoice> {
  return apiRequest<OrderInvoice>({ method: 'GET', url: `/orders/${id}/invoice/` });
}
