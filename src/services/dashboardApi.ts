// ── Dashboard API Service ─────────────────────────────────────────
// Centralized API adapter for AdminOps Central, Merchant Studio,
// and AdPulse Studio mobile screens. Reuses the authenticated
// apiRequest helper from api.ts for JWT token handling.

import { apiRequest } from './api';

// ── AdminOps Central Types ──────────────────────────────────────────
export interface DashboardMetrics {
  total_orders: number;
  pending_pickups: number;
  ready_for_collection: number;
  collected: number;
  dispatched_fleet_items: number;
  active_pickup_stations: number;
  in_transit_shipments: number;
}

// ── Merchant Studio Types ─────────────────────────────────────────
export interface MerchantProduct {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  price: string;
  sale_price: string | null;
  final_price: string;
  primary_image: string | null;
  is_in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  stock_quantity?: number;
  currency: string;
  min_order_quantity: number;
  category_name: string | null;
  brand_name: string | null;
  created_at: string;
}

export interface MerchantOrder {
  id: number;
  order: number;
  order_number: string;
  store: number;
  status: string;
  customer_email: string;
  customer_name: string;
  total: string;
  commission_amount: string;
  seller_amount: string;
  items_count: number;
  created_at: string;
  accepted_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

export interface ConfirmPackagedResponse {
  detail: string;
  suborder_id: number;
  order_number: string;
  status: string;
  accepted_at: string | null;
}

// ── AdPulse Studio Types ──────────────────────────────────────────
export interface AdCampaign {
  id: number;
  vendor: number;
  vendor_name: string;
  name: string;
  target_product: number | null;
  target_product_name: string;
  target_keywords: string;
  daily_budget: string;
  bid_per_click: string;
  total_clicks: number;
  total_impressions: number;
  total_spend: string;
  remaining_budget: string;
  click_through_rate: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdPulseAnalytics {
  total_campaigns: number;
  active_campaigns: number;
  paused_campaigns: number;
  completed_campaigns: number;
  total_spend: string;
  total_impressions: number;
  total_clicks: number;
  total_budget: string;
  avg_ctr: number;
}

export interface CreateCampaignPayload {
  name: string;
  target_product_id?: number;
  target_keywords?: string;
  daily_budget: number;
  bid_per_click?: number;
}

// ── AdminOps Central Endpoints ─────────────────────────────────────
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiRequest<DashboardMetrics>({
    method: 'GET',
    url: '/fleet/dashboard-metrics/',
  });
}

// ── Merchant Studio Endpoints ─────────────────────────────────────
export async function getMerchantProducts(): Promise<MerchantProduct[]> {
  const data = await apiRequest<any>({
    method: 'GET',
    url: '/merchant/products/',
  });
  return data.results || data || [];
}

export async function getMerchantOrders(): Promise<MerchantOrder[]> {
  const data = await apiRequest<any>({
    method: 'GET',
    url: '/merchant/orders/',
  });
  return data.results || data || [];
}

export async function confirmPackagedItem(
  suborderId: number
): Promise<ConfirmPackagedResponse> {
  return apiRequest<ConfirmPackagedResponse>({
    method: 'PATCH',
    url: `/merchant/orders/${suborderId}/confirm-packaged/`,
    data: {},
  });
}

// ── AdPulse Studio Endpoints ──────────────────────────────────────
export async function getAdCampaigns(): Promise<AdCampaign[]> {
  const data = await apiRequest<any>({
    method: 'GET',
    url: '/adpulse/campaigns/',
  });
  return data.results || data || [];
}

export async function getAdPulseAnalytics(): Promise<AdPulseAnalytics> {
  return apiRequest<AdPulseAnalytics>({
    method: 'GET',
    url: '/adpulse/analytics/',
  });
}

export async function createAdCampaign(
  payload: CreateCampaignPayload
): Promise<AdCampaign> {
  return apiRequest<AdCampaign>({
    method: 'POST',
    url: '/adpulse/campaigns/create/',
    data: payload,
  });
}
