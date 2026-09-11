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

// ── Disputes ───────────────────────────────────────────────────────

export interface SellerDispute {
  id: number;
  order_number: string;
  reason: string;
  description: string;
  status: string;
  resolution: string;
  refund_amount: string;
  opened_by: string;
  created_at: string;
  resolved_at: string | null;
}

export interface SellerDisputeDetail extends SellerDispute {
  admin_notes: string;
}

export async function getDisputes(): Promise<SellerDispute[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/disputes/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function getDisputeDetail(id: number): Promise<SellerDisputeDetail> {
  return apiRequest<SellerDisputeDetail>({ method: 'GET', url: `${SELLER_BASE}/${id}/dispute_detail/` });
}

export async function updateDisputeNotes(id: number, sellerNotes: string): Promise<any> {
  return apiRequest<any>({
    method: 'PATCH',
    url: `${SELLER_BASE}/${id}/dispute_detail/`,
    data: { seller_notes: sellerNotes },
  });
}

// ── Coupons ────────────────────────────────────────────────────────

export interface SellerCoupon {
  id: number;
  code: string;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_uses: number;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  is_claimable: boolean;
  created_at: string;
}

export async function getCoupons(): Promise<SellerCoupon[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/coupons/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createCoupon(payload: {
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount?: number;
  max_uses?: number;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean;
  is_claimable?: boolean;
}): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/coupons/`, data: payload });
}

export async function deleteCoupon(id: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${id}/coupon_delete/` });
}

// ── RFQs ───────────────────────────────────────────────────────────

export interface SellerRFQ {
  id: number;
  product_name: string;
  quantity: number;
  target_price: string | null;
  quoted_price: string | null;
  status: string;
  buyer_email: string;
  notes: string;
  seller_notes: string;
  created_at: string;
}

export interface SellerRFQDetail extends SellerRFQ {
  quoted_total: string | null;
}

export async function getRFQs(): Promise<SellerRFQ[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/rfqs/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function getRFQDetail(id: number): Promise<SellerRFQDetail> {
  return apiRequest<SellerRFQDetail>({ method: 'GET', url: `${SELLER_BASE}/${id}/rfq_detail/` });
}

export async function quoteRFQ(id: number, quotedPrice: number, sellerNotes: string): Promise<any> {
  return apiRequest<any>({
    method: 'PATCH',
    url: `${SELLER_BASE}/${id}/rfq_detail/`,
    data: { quoted_price: quotedPrice, seller_notes: sellerNotes },
  });
}

// ── Shipping Methods ──────────────────────────────────────────────

export interface ShippingMethod {
  id: number;
  name: string;
  cost: string;
  estimated_days: number;
  is_active: boolean;
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/shipping_methods/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createShippingMethod(payload: {
  name: string;
  cost: number;
  estimated_days: number;
  is_active?: boolean;
}): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/shipping_methods/`, data: payload });
}

export async function deleteShippingMethod(id: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${id}/shipping_method_delete/` });
}

// ── Shipments ──────────────────────────────────────────────────────

export interface SellerShipment {
  id: number;
  order_number: string;
  carrier: string;
  tracking_number: string;
  status: string;
  shipping_method: string;
  fulfillment_type: string;
  shipped_at: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface SellerShipmentDetail extends SellerShipment {
  shipping_cost: string;
  weight_kg: string;
}

export async function getShipments(): Promise<SellerShipment[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/shipments/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function getShipmentDetail(id: number): Promise<SellerShipmentDetail> {
  return apiRequest<SellerShipmentDetail>({ method: 'GET', url: `${SELLER_BASE}/${id}/shipment_detail/` });
}

// ── KYC / Verification ─────────────────────────────────────────────

export interface SellerKYC {
  id?: number;
  business_name: string;
  business_type: string;
  trading_license_number: string;
  tax_id: string;
  status: string;
  review_notes: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface VerificationLog {
  id: number;
  action: string;
  notes: string;
  previous_status: string;
  new_status: string;
  reviewed_by: string;
  created_at: string;
}

export async function getKYC(): Promise<SellerKYC | null> {
  try {
    return await apiRequest<SellerKYC>({ method: 'GET', url: `${SELLER_BASE}/kyc/` });
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export async function submitKYC(payload: {
  business_name: string;
  business_type: string;
  trading_license_number: string;
  tax_id: string;
}): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/kyc/`, data: payload });
}

export async function getVerificationLogs(): Promise<VerificationLog[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/verification_logs/` });
  return Array.isArray(data) ? data : data.results || [];
}

// ── Seller Messages / Chat ────────────────────────────────────────

export interface SellerThread {
  id: number;
  buyer_name: string;
  buyer_email: string;
  product_name: string | null;
  product_slug: string | null;
  is_support: boolean;
  unread_count: number;
  last_message: string;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerMessage {
  id: number;
  message: string;
  is_me: boolean;
  sender_name: string;
  created_at: string;
}

export interface SellerThreadDetail {
  thread_id: number;
  buyer_name: string;
  product_name: string | null;
  messages: SellerMessage[];
}

export async function getSellerThreads(): Promise<SellerThread[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/messages/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function getSellerThreadDetail(id: number): Promise<SellerThreadDetail> {
  return apiRequest<SellerThreadDetail>({ method: 'GET', url: `${SELLER_BASE}/${id}/message_thread/` });
}

export async function sendSellerMessage(threadId: number, message: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${SELLER_BASE}/${threadId}/message_thread/`,
    data: { message },
  });
}

// ── Staff Management ───────────────────────────────────────────────

export interface SellerStaffMember {
  id: number;
  store: number;
  user: number;
  user_email: string;
  user_name: string;
  role: number | null;
  role_name: string;
  is_owner: boolean;
  is_active: boolean;
  has_full_access: boolean;
  invited_by: number | null;
  invited_at: string;
  accepted_at: string | null;
}

export interface SellerStaffRole {
  id: number;
  store: number;
  name: string;
  role_type: string;
  can_view_orders: boolean;
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_manage_products: boolean;
  can_manage_inventory: boolean;
  can_view_finances: boolean;
  can_manage_staff: boolean;
  can_handle_disputes: boolean;
  can_view_analytics: boolean;
  can_manage_shipping: boolean;
  can_manage_promotions: boolean;
  created_at: string;
  updated_at: string;
}

export async function getStaff(): Promise<SellerStaffMember[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/staff/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function inviteStaff(payload: {
  user: number;
  role?: number;
  is_active?: boolean;
}): Promise<SellerStaffMember> {
  return apiRequest<SellerStaffMember>({ method: 'POST', url: `${SELLER_BASE}/staff/`, data: payload });
}

export async function updateStaff(id: number, data: Partial<SellerStaffMember>): Promise<SellerStaffMember> {
  return apiRequest<SellerStaffMember>({ method: 'PATCH', url: `${SELLER_BASE}/${id}/staff_detail/`, data });
}

export async function removeStaff(id: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${id}/staff_detail/` });
}

export async function getStaffRoles(): Promise<SellerStaffRole[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/staff_roles/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createStaffRole(payload: {
  name: string;
  role_type?: string;
  can_view_orders?: boolean;
  can_create_orders?: boolean;
  can_edit_orders?: boolean;
  can_manage_products?: boolean;
  can_manage_inventory?: boolean;
  can_view_finances?: boolean;
  can_manage_staff?: boolean;
  can_handle_disputes?: boolean;
  can_view_analytics?: boolean;
  can_manage_shipping?: boolean;
  can_manage_promotions?: boolean;
}): Promise<SellerStaffRole> {
  return apiRequest<SellerStaffRole>({ method: 'POST', url: `${SELLER_BASE}/staff_roles/`, data: payload });
}

export async function getPermissions(): Promise<{
  permissions: string[];
  is_owner: boolean;
  is_staff: boolean;
}> {
  return apiRequest<{ permissions: string[]; is_owner: boolean; is_staff: boolean }>({
    method: 'GET',
    url: `${SELLER_BASE}/permissions/`,
  });
}

// ── Inventory ──────────────────────────────────────────────────────

export interface InventoryItem {
  id: number;
  name: string;
  slug: string;
  sku: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  price: number;
  final_price: number;
  is_active: boolean;
  is_on_sale: boolean;
  category_name: string;
  brand_name: string;
  primary_image_url: string;
}

export interface InventoryResponse {
  results: InventoryItem[];
  count: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export async function getInventory(params?: {
  q?: string;
  low_stock?: string;
  out_of_stock?: string;
  threshold?: number;
  page?: number;
  page_size?: number;
}): Promise<InventoryResponse> {
  return apiRequest<InventoryResponse>({ method: 'GET', url: `${SELLER_BASE}/inventory/`, params });
}

export async function updateStock(productId: number, stockQuantity: number): Promise<{
  id: number;
  name: string;
  old_stock_quantity: number;
  new_stock_quantity: number;
}> {
  return apiRequest<any>({
    method: 'PATCH',
    url: `${SELLER_BASE}/${productId}/update_stock/`,
    data: { stock_quantity: stockQuantity },
  });
}

// ── Delivery Areas & Service Areas ─────────────────────────────────

export async function getDeliveryAreas(): Promise<any[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/delivery_areas/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createDeliveryArea(payload: any): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/delivery_areas/`, data: payload });
}

export async function deleteDeliveryArea(id: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${id}/delivery_area_detail/` });
}

export async function getServiceAreas(): Promise<any[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/service_areas/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createServiceArea(payload: any): Promise<any> {
  return apiRequest<any>({ method: 'POST', url: `${SELLER_BASE}/service_areas/`, data: payload });
}

export async function deleteServiceArea(id: number): Promise<void> {
  await apiRequest({ method: 'DELETE', url: `${SELLER_BASE}/${id}/service_area_detail/` });
}

// ── Product Variants ───────────────────────────────────────────────

export interface ProductVariantData {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock_quantity: number;
  is_active: boolean;
  is_in_stock?: boolean;
}

export async function getProductVariants(productId: number): Promise<ProductVariantData[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/${productId}/variants/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createProductVariant(productId: number, payload: {
  name: string;
  sku?: string;
  price: number;
  stock_quantity?: number;
  is_active?: boolean;
}): Promise<ProductVariantData> {
  return apiRequest<ProductVariantData>({ method: 'POST', url: `${SELLER_BASE}/${productId}/variants/`, data: payload });
}

export async function updateProductVariant(productId: number, variantId: number, data: Partial<ProductVariantData>): Promise<ProductVariantData> {
  return apiRequest<ProductVariantData>({
    method: 'PATCH',
    url: `${SELLER_BASE}/${productId}/variant_detail/`,
    params: { variant_id: variantId },
    data: { ...data, variant_id: variantId },
  });
}

export async function deleteProductVariant(productId: number, variantId: number): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    url: `${SELLER_BASE}/${productId}/variant_detail/`,
    params: { variant_id: variantId },
  });
}

// ── Wholesale Tiers ────────────────────────────────────────────────

export interface WholesaleTierData {
  id: number;
  min_quantity: number;
  price: string;
}

export async function getWholesaleTiers(productId: number): Promise<WholesaleTierData[]> {
  const data = await apiRequest<any>({ method: 'GET', url: `${SELLER_BASE}/${productId}/wholesale_tiers/` });
  return Array.isArray(data) ? data : data.results || [];
}

export async function createWholesaleTier(productId: number, payload: {
  min_quantity: number;
  price: number;
}): Promise<WholesaleTierData> {
  return apiRequest<WholesaleTierData>({ method: 'POST', url: `${SELLER_BASE}/${productId}/wholesale_tiers/`, data: payload });
}

export async function deleteWholesaleTier(productId: number, tierId: number): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    url: `${SELLER_BASE}/${productId}/wholesale_tier_delete/`,
    params: { tier_id: tierId },
  });
}
