// ── Admin API Service ─────────────────────────────────────────────
// Typed API functions for the Diilzo admin dashboard (mobile).
// All endpoints are under /api/v1/admin/ and require staff/superuser auth.

import { apiRequest } from './api';

const ADMIN_BASE = '/admin';

// ── Types ──────────────────────────────────────────────────────────

export interface AdminDashboard {
  total_gmv: string;
  total_commission: string;
  active_stores: number;
  pending_stores: number;
  pending_payouts: number;
  pending_payouts_amount: string;
  active_disputes: number;
  pending_kyc: number;
  total_users: number;
  total_orders: number;
  total_products: number;
  active_products: number;
  new_users_7d: number;
  new_orders_7d: number;
  sales_chart: { label: string; value: number }[];
  top_stores: { store__name: string; store__slug: string; total: number }[];
  top_products: { id: number; name: string; sold_count: number }[];
  recent_orders: { id: number; order_number: string; status: string; total: string; created_at: string }[];
}

export interface SidebarCounts {
  pending_kyc: number;
  pending_payouts: number;
  active_disputes: number;
  held_escrow: number;
  pending_shipments: number;
  pending_stores: number;
  pending_verification: number;
}

export interface AdminUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  order_count: number;
}

export interface AdminStore {
  id: number;
  name: string;
  slug: string;
  owner_email: string;
  status: string;
  is_featured: boolean;
  verification_status: string;
  business_type: string;
  is_wholesaler: boolean;
  prod_count: number;
  created_at: string;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  store_name: string;
  category_name: string;
  brand_name: string;
  price: string;
  is_active: boolean;
  stock_quantity: number;
  created_at: string;
}

export interface AdminOrder {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  total: string;
  currency: string;
  user_email: string;
  user_name: string;
  item_count: number;
  created_at: string;
}

export interface AdminPayout {
  id: number;
  store_name: string;
  amount: string;
  currency: string;
  method: string;
  destination: string;
  status: string;
  reference: string;
  created_at: string;
}

export interface AdminDispute {
  id: number;
  store_name: string;
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

export interface AdminKYC {
  id: number;
  store_name: string;
  store_id: number;
  owner_email: string;
  business_name: string;
  business_type: string;
  trading_license_number: string;
  tax_id: string;
  status: string;
  submitted_at: string | null;
}

export interface AdminKYCDetail extends AdminKYC {
  id_document: string;
  license_document: string;
  review_notes: string;
  reviewed_at: string | null;
  reviewed_by: string;
}

export interface AdminEscrow {
  id: number;
  order_number: string;
  amount_held: string;
  currency: string;
  status: string;
  held_at: string | null;
  released_at: string | null;
  auto_release_date: string | null;
}

export interface AdminEscrowList {
  results: AdminEscrow[];
  total_held: string;
  total_released: string;
  total_disputed: string;
}

export interface AdminShipment {
  id: number;
  order_number: string;
  carrier: string;
  tracking_number: string;
  status: string;
  shipping_method: string;
  fulfillment_type: string;
  store_name: string;
  shipped_at: string | null;
  estimated_delivery: string | null;
  created_at: string;
}

export interface AdminShipmentDetail extends AdminShipment {
  shipping_cost: string;
  weight_kg: string;
  delivered_at: string | null;
}

export interface AdminSupplier {
  id: number;
  name: string;
  slug: string;
  owner_email: string;
  business_type: string;
  verification_status: string;
  trade_assurance: boolean;
  is_wholesaler: boolean;
  product_count: number;
  created_at: string;
}

export interface AdminSupplierDetail extends AdminSupplier {
  company_name: string;
  year_established: number;
  website: string;
  phone: string;
  city: string;
  country: string;
  rating: string;
  review_count: number;
  transactions_count: number;
  response_rate: number;
  total_orders: number;
  total_sales: string;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  product_count: number;
}

export interface AdminTax {
  id: number;
  name: string;
  country: string;
  rate: string;
  is_active: boolean;
}

export interface AdminCommissionConfig {
  id: number;
  category_id: number;
  category_name: string;
  commission_rate: string;
  is_active: boolean;
}

export interface AdminSettings {
  site_name: string;
  default_commission_rate: string;
  default_currency: string;
  min_payout_amount: string;
  escrow_period_days: number;
  dispute_window_days: number;
}

export interface AdminAnnouncement {
  id: number;
  title: string;
  message: string;
  target_audience: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminSlide {
  id: number;
  title: string;
  headline: string;
  subheadline: string;
  background_color: string;
  cta_text: string;
  cta_link: string;
  is_active: boolean;
  sort_order: number;
  position: string;
  created_at: string;
}

export interface AdminSubscription {
  id: number;
  store_name: string;
  plan: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  auto_renew: boolean;
  created_at: string;
}

export interface AdminSubscriptionList {
  results: AdminSubscription[];
  active_count: number;
  past_due_count: number;
  revenue: string;
}

export interface AdminMembership {
  id: number;
  store_name: string;
  tier: string;
  status: string;
  annual_fee: string;
  current_period_end: string | null;
  auto_renew: boolean;
  created_at: string;
}

export interface AdminMembershipList {
  results: AdminMembership[];
  gold_count: number;
  verified_count: number;
  free_count: number;
  annual_revenue: string;
}

export interface AdminCurrency {
  id: number;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  rate_to_ugx: string;
  is_active: boolean;
}

export interface AdminHSCode {
  id: number;
  code: string;
  description: string;
  default_duty_rate: string;
  is_restricted: boolean;
  requires_export_license: boolean;
}

export interface AdminRestrictedGood {
  id: number;
  country: string;
  restriction_level: string;
  description: string;
  permit_required: boolean;
  permit_authority: string;
  duty_rate: string;
  is_active: boolean;
}

export interface AdminVerificationLog {
  id: number;
  store_name: string;
  action: string;
  notes: string;
  previous_status: string;
  new_status: string;
  reviewed_by: string;
  created_at: string;
}

export interface AdminWarehouse {
  id: number;
  name: string;
  code: string;
  country: string;
  city: string;
  capacity_cubic_meters: number;
  used_capacity: number;
  is_active: boolean;
}

export interface AdminWarehouseInventory {
  id: number;
  product_name: string;
  store_name: string;
  quantity: number;
  reserved_quantity: number;
  storage_fee_per_month: string;
  received_at: string | null;
}

// ── API Functions ─────────────────────────────────────────────────

// Dashboard
export const getAdminDashboard = () => apiRequest<AdminDashboard>({ method: 'GET', url: `${ADMIN_BASE}/dashboard/` });
export const getSidebarCounts = () => apiRequest<SidebarCounts>({ method: 'GET', url: `${ADMIN_BASE}/sidebar-counts/` });
export const getCommissionReport = () => apiRequest<any>({ method: 'GET', url: `${ADMIN_BASE}/commission-report/` });

// Users
export const getAdminUsers = (q?: string) => apiRequest<AdminUser[]>({ method: 'GET', url: `${ADMIN_BASE}/users/`, params: q ? { q } : undefined });
export const userAction = (userId: number, action: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/users/${userId}/${action}/` });

// Stores
export const getAdminStores = (params?: { q?: string; status?: string }) => apiRequest<AdminStore[]>({ method: 'GET', url: `${ADMIN_BASE}/stores/`, params });
export const storeAction = (storeId: number, action: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/stores/${storeId}/${action}/` });

// Products
export const getAdminProducts = (params?: { q?: string; status?: string }) => apiRequest<AdminProduct[]>({ method: 'GET', url: `${ADMIN_BASE}/products/`, params });
export const toggleProductActive = (productId: number) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/products/${productId}/toggle/` });

// Orders
export const getAdminOrders = (params?: { q?: string; status?: string }) => apiRequest<AdminOrder[]>({ method: 'GET', url: `${ADMIN_BASE}/orders/`, params });

// Payouts
export const getAdminPayouts = (status?: string) => apiRequest<AdminPayout[]>({ method: 'GET', url: `${ADMIN_BASE}/payouts/`, params: status ? { status } : undefined });
export const processPayout = (payoutId: number, reference?: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/payouts/${payoutId}/process/`, data: { reference } });

// Disputes
export const getAdminDisputes = (status?: string) => apiRequest<AdminDispute[]>({ method: 'GET', url: `${ADMIN_BASE}/disputes/`, params: status ? { status } : undefined });
export const processRefund = (disputeId: number) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/disputes/${disputeId}/refund/` });

// KYC
export const getAdminKYC = (status?: string) => apiRequest<AdminKYC[]>({ method: 'GET', url: `${ADMIN_BASE}/kyc/`, params: status ? { status } : undefined });
export const getAdminKYCDetail = (kycId: number) => apiRequest<AdminKYCDetail>({ method: 'GET', url: `${ADMIN_BASE}/kyc/${kycId}/` });
export const kycAction = (kycId: number, action: string, reviewNotes?: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/kyc/${kycId}/${action}/`, data: { review_notes: reviewNotes } });

// Escrow
export const getAdminEscrow = (status?: string) => apiRequest<AdminEscrowList>({ method: 'GET', url: `${ADMIN_BASE}/escrow/`, params: status ? { status } : undefined });
export const escrowAction = (escrowId: number, action: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/escrow/${escrowId}/${action}/` });

// Shipments
export const getAdminShipments = (params?: { status?: string; carrier?: string }) => apiRequest<AdminShipment[]>({ method: 'GET', url: `${ADMIN_BASE}/shipments/`, params });
export const getAdminShipmentDetail = (shipmentId: number) => apiRequest<AdminShipmentDetail>({ method: 'GET', url: `${ADMIN_BASE}/shipments/${shipmentId}/` });
export const updateShipmentStatus = (shipmentId: number, data: { status?: string; tracking_number?: string; carrier?: string }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/shipments/${shipmentId}/update/`, data });

// Suppliers
export const getAdminSuppliers = (params?: { q?: string; business_type?: string; verification?: string }) => apiRequest<AdminSupplier[]>({ method: 'GET', url: `${ADMIN_BASE}/suppliers/`, params });
export const getAdminSupplierDetail = (storeId: number) => apiRequest<AdminSupplierDetail>({ method: 'GET', url: `${ADMIN_BASE}/suppliers/${storeId}/` });
export const supplierAction = (storeId: number, action: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/suppliers/${storeId}/${action}/` });

// Categories
export const getAdminCategories = (q?: string) => apiRequest<AdminCategory[]>({ method: 'GET', url: `${ADMIN_BASE}/categories/`, params: q ? { q } : undefined });
export const createCategory = (data: { name: string; parent_id?: number; sort_order?: number; is_active?: boolean }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/categories/create/`, data });
export const updateCategory = (id: number, data: any) => apiRequest<any>({ method: 'PATCH', url: `${ADMIN_BASE}/categories/${id}/`, data });
export const deleteCategory = (id: number) => apiRequest<any>({ method: 'DELETE', url: `${ADMIN_BASE}/categories/${id}/` });

// Brands
export const getAdminBrands = (q?: string) => apiRequest<AdminBrand[]>({ method: 'GET', url: `${ADMIN_BASE}/brands/`, params: q ? { q } : undefined });
export const createBrand = (data: { name: string; description?: string; is_active?: boolean }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/brands/create/`, data });
export const updateBrand = (id: number, data: any) => apiRequest<any>({ method: 'PATCH', url: `${ADMIN_BASE}/brands/${id}/`, data });
export const deleteBrand = (id: number) => apiRequest<any>({ method: 'DELETE', url: `${ADMIN_BASE}/brands/${id}/` });

// Tax
export const getAdminTax = () => apiRequest<AdminTax[]>({ method: 'GET', url: `${ADMIN_BASE}/tax/` });
export const createTax = (data: { name: string; country: string; rate: number; is_active?: boolean }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/tax/create/`, data });
export const updateTax = (id: number, data: any) => apiRequest<any>({ method: 'PATCH', url: `${ADMIN_BASE}/tax/${id}/`, data });
export const deleteTax = (id: number) => apiRequest<any>({ method: 'DELETE', url: `${ADMIN_BASE}/tax/${id}/` });

// Commission Config
export const getCommissionConfig = () => apiRequest<AdminCommissionConfig[]>({ method: 'GET', url: `${ADMIN_BASE}/commission-config/` });
export const commissionConfigAction = (data: { action: string; category_id?: number; commission_rate?: number; id?: number }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/commission-config/`, data });

// Settings
export const getAdminSettings = () => apiRequest<AdminSettings>({ method: 'GET', url: `${ADMIN_BASE}/settings/` });
export const updateAdminSettings = (data: Partial<AdminSettings>) => apiRequest<any>({ method: 'PUT', url: `${ADMIN_BASE}/settings/`, data });

// Announcements
export const getAdminAnnouncements = () => apiRequest<AdminAnnouncement[]>({ method: 'GET', url: `${ADMIN_BASE}/announcements/` });
export const createAnnouncement = (data: { title: string; message: string; target_audience?: string; is_active?: boolean }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/announcements/`, data });
export const updateAnnouncement = (id: number, data: any) => apiRequest<any>({ method: 'PATCH', url: `${ADMIN_BASE}/announcements/${id}/`, data });
export const deleteAnnouncement = (id: number) => apiRequest<any>({ method: 'DELETE', url: `${ADMIN_BASE}/announcements/${id}/` });

// Slides
export const getAdminSlides = () => apiRequest<AdminSlide[]>({ method: 'GET', url: `${ADMIN_BASE}/slides/` });
export const createSlide = (data: any) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/slides/`, data });
export const updateSlide = (id: number, data: any) => apiRequest<any>({ method: 'PATCH', url: `${ADMIN_BASE}/slides/${id}/`, data });
export const deleteSlide = (id: number) => apiRequest<any>({ method: 'DELETE', url: `${ADMIN_BASE}/slides/${id}/` });

// Subscriptions
export const getAdminSubscriptions = (status?: string) => apiRequest<AdminSubscriptionList>({ method: 'GET', url: `${ADMIN_BASE}/subscriptions/`, params: status ? { status } : undefined });

// Memberships
export const getAdminMemberships = (tier?: string) => apiRequest<AdminMembershipList>({ method: 'GET', url: `${ADMIN_BASE}/memberships/`, params: tier ? { tier } : undefined });
export const assignMembership = (storeId: number, tier: string) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/memberships/${storeId}/assign/`, data: { tier } });

// Currencies
export const getAdminCurrencies = () => apiRequest<AdminCurrency[]>({ method: 'GET', url: `${ADMIN_BASE}/currencies/` });
export const createCurrency = (data: { currency_code: string; currency_name: string; currency_symbol: string; rate_to_ugx: number; is_active?: boolean }) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/currencies/`, data });
export const updateCurrencyRate = (id: number, rateToUgx: number) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/currencies/${id}/update/`, data: { rate_to_ugx: rateToUgx } });

// HS Codes
export const getAdminHSCodes = (q?: string) => apiRequest<AdminHSCode[]>({ method: 'GET', url: `${ADMIN_BASE}/hs-codes/`, params: q ? { q } : undefined });
export const createHSCode = (data: any) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/hs-codes/`, data });

// Restricted Goods
export const getAdminRestrictedGoods = (country?: string) => apiRequest<AdminRestrictedGood[]>({ method: 'GET', url: `${ADMIN_BASE}/restricted-goods/`, params: country ? { country } : undefined });
export const createRestrictedGood = (data: any) => apiRequest<any>({ method: 'POST', url: `${ADMIN_BASE}/restricted-goods/`, data });

// Verification Logs
export const getAdminVerificationLogs = (storeId?: number) => apiRequest<AdminVerificationLog[]>({ method: 'GET', url: `${ADMIN_BASE}/verification-logs/`, params: storeId ? { store_id: storeId } : undefined });

// Warehouses
export const getAdminWarehouses = () => apiRequest<AdminWarehouse[]>({ method: 'GET', url: `${ADMIN_BASE}/warehouses/` });
export const getWarehouseInventory = (warehouseId: number) => apiRequest<AdminWarehouseInventory[]>({ method: 'GET', url: `${ADMIN_BASE}/warehouses/${warehouseId}/inventory/` });

// Broadcast Notification
export const broadcastNotification = (data: {
  title: string;
  message: string;
  type?: string;
  target?: 'all' | 'buyers' | 'sellers';
}) => apiRequest<{ detail: string; recipients: number; title: string }>({
  method: 'POST',
  url: `${ADMIN_BASE}/broadcast/`,
  data,
});
