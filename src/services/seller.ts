// ── Seller API Service ────────────────────────────────────────────

import { apiRequest } from './api';

const SELLER_BASE = '/sellers/api/seller';

export interface SellerStats {
  total_products: number;
  live_products: number;
  pending_orders: number;
  total_orders: number;
  lifetime_sales: string;
  available_balance: string;
  pending_balance: string;
  rating: string;
  review_count: number;
}

export interface SellerDashboard {
  store: any;
  stats: SellerStats;
}

export interface SellerOrder {
  id: number;
  order_id: number;
  order_number: string;
  subtotal: string;
  commission_amount: string;
  seller_amount: string;
  status: string;
  created_at: string;
}

export interface SellerEarnings {
  available_balance: string;
  pending_balance: string;
  commission_rate: string;
  ledger: any[];
  payouts: any[];
}

/** GET /sellers/api/seller/my_store/ — store info + dashboard stats */
export async function getMyStore(): Promise<SellerDashboard> {
  return apiRequest<SellerDashboard>({ method: 'GET', url: `${SELLER_BASE}/my_store/` });
}

/** GET /sellers/api/seller/my_products/ — seller's products */
export async function getMyProducts(): Promise<any[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/my_products/` });
  return Array.isArray(data) ? data : data.results || [];
}

/** GET /sellers/api/seller/my_orders/ — seller's sub-orders */
export async function getMyOrders(): Promise<SellerOrder[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/my_orders/` });
  return Array.isArray(data) ? data : data.results || [];
}

/** GET /sellers/api/seller/my_earnings/ — wallet + payouts */
export async function getMyEarnings(): Promise<SellerEarnings> {
  return apiRequest<SellerEarnings>({ method: 'GET', url: `${SELLER_BASE}/my_earnings/` });
}

/** POST /sellers/api/seller/request_payout/ — request payout */
export async function requestPayout(amount: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/request_payout/`,
    data: { amount },
  });
}
