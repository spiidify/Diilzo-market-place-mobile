// ── Seller API Service ────────────────────────────────────────────
//
// All seller endpoints are mounted under /api/v1/seller/ via the
// SellerViewSet in the Django backend. The apiRequest helper prepends
// BASE_URL (/api/v1), so we use /seller/... as the relative path.

import { apiRequest } from './api';

const SELLER_BASE = '/seller';

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

export interface SellerRecentOrder {
  id: number;
  order_number: string;
  seller_amount: string;
  status: string;
  created_at: string;
}

export interface SellerLowStockProduct {
  id: number;
  name: string;
  stock_quantity: number;
}

export interface SellerDashboard {
  store: any;
  stats: SellerStats;
  recent_orders?: SellerRecentOrder[];
  low_stock_products?: SellerLowStockProduct[];
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
  customer_name?: string;
  item_count?: number;
}

export interface SellerOrderDetail {
  id: number;
  order_id: number;
  order_number: string;
  status: string;
  subtotal: string;
  commission_amount: string;
  seller_amount: string;
  created_at: string;
  accepted_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_name: string;
  customer_email: string;
  shipping_address: Record<string, any>;
  notes: string;
  items: SellerOrderItem[];
}

export interface SellerOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  product_image_url: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface SellerEarnings {
  available_balance: string;
  pending_balance: string;
  commission_rate: string;
  total_earned?: string;
  total_payouts?: string;
  ledger: any[];
  payouts: any[];
}

export interface AnalyticsData {
  revenue: number;
  orders_count: number;
  total_views: number;
  conversion_rate: number;
  revenue_series: { label: string; value: number }[];
  top_products: { id: number; name: string; sold: number; revenue: number }[];
  sales_by_category: { name: string; revenue: number }[];
}

// ── Dashboard ──────────────────────────────────────────────────────

/** GET /seller/my_store/ — store info + dashboard stats */
export async function getMyStore(): Promise<SellerDashboard> {
  return apiRequest<SellerDashboard>({ method: 'GET', url: `${SELLER_BASE}/my_store/` });
}

// ── Products ───────────────────────────────────────────────────────

/** GET /seller/my_products/ — seller's products list */
export async function getMyProducts(params?: { search?: string; active?: string }): Promise<any[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/my_products/`, params });
  return Array.isArray(data) ? data : data.results || [];
}

/** GET /seller/<id>/product_detail/ — single product detail */
export async function getProductDetail(productId: number): Promise<any> {
  return apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/${productId}/product_detail/` });
}

/** POST /seller/create_product/ — create a new product */
export async function createProduct(formData: FormData): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/create_product/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** PATCH /seller/<id>/product_detail/ — update a product */
export async function updateProduct(productId: number, formData: FormData): Promise<any> {
  return apiRequest<any>({
    method: 'PATCH',
    url: `${SELLER_BASE}/${productId}/product_detail/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** DELETE /seller/<id>/product_detail/ — delete a product */
export async function deleteProduct(productId: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${productId}/product_detail/` });
}

/** DELETE /seller/<id>/delete_product_image/ — delete a product image */
export async function deleteProductImage(imageId: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${imageId}/delete_product_image/` });
}

// ── Orders ─────────────────────────────────────────────────────────

/** GET /seller/my_orders/ — seller's sub-orders list */
export async function getMyOrders(params?: { status?: string }): Promise<SellerOrder[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/my_orders/`, params });
  return Array.isArray(data) ? data : data.results || [];
}

/** GET /seller/<id>/order_detail/ — sub-order detail with items */
export async function getOrderDetail(orderId: number): Promise<SellerOrderDetail> {
  return apiRequest<SellerOrderDetail>({ method: 'GET', url: `${SELLER_BASE}/${orderId}/order_detail/` });
}

/** POST /seller/<id>/accept_order/ — accept a pending order */
export async function acceptOrder(orderId: number): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/${orderId}/accept_order/` });
}

/** POST /seller/<id>/ship_order/ — mark order as shipped */
export async function shipOrder(orderId: number, trackingNumber?: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/${orderId}/ship_order/`,
    data: trackingNumber ? { tracking_number: trackingNumber } : undefined,
  });
}

/** POST /seller/<id>/deliver_order/ — mark order as delivered */
export async function deliverOrder(orderId: number): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/${orderId}/deliver_order/` });
}

/** POST /seller/<id>/cancel_order/ — cancel an order */
export async function cancelOrder(orderId: number, reason?: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/${orderId}/cancel_order/`,
    data: reason ? { reason } : undefined,
  });
}

// ── Earnings ───────────────────────────────────────────────────────

/** GET /seller/my_earnings/ — wallet + payouts */
export async function getMyEarnings(): Promise<SellerEarnings> {
  return apiRequest<SellerEarnings>({ method: 'GET', url: `${SELLER_BASE}/my_earnings/` });
}

/** POST /seller/request_payout/ — request payout */
export async function requestPayout(amount: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/request_payout/`,
    data: { amount },
  });
}

// ── Analytics ──────────────────────────────────────────────────────

/** GET /seller/analytics/?period=7d|30d|90d — sales analytics */
export async function getAnalytics(period: string = '30d'): Promise<AnalyticsData> {
  return apiRequest<AnalyticsData>({
    method: 'GET',
    url: `${SELLER_BASE}/analytics/`,
    params: { period },
  });
}

// ── Store Settings ─────────────────────────────────────────────────

/** GET /seller/store_settings/ — get store settings */
export async function getStoreSettings(): Promise<any> {
  return apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/store_settings/` });
}

/** PATCH /seller/store_settings/ — update store settings */
export async function updateStoreSettings(formData: FormData): Promise<any> {
  return apiRequest<any>({
    method: 'PATCH',
    url: `${SELLER_BASE}/store_settings/`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ── Become a Seller ────────────────────────────────────────────────

/** POST /seller/register/ — register as a seller */
export async function registerStore(data: {
  name: string;
  description?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  business_type?: string;
  is_wholesaler?: boolean;
}): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/register/`,
    data,
  });
}
