// ── Financial API Service ─────────────────────────────────────────
//
// Connects to the new financial system endpoints under /api/v1/financial/.
// All endpoints require JWT authentication (except plans listing).
//
// Seller endpoints:
//   GET  /financial/seller/dashboard/         — Financial dashboard
//   GET  /financial/seller/payouts/           — Payout summary + list
//   POST /financial/seller/payouts/           — Request payout
//   GET  /financial/seller/payout-holds/      — List payout holds
//   GET  /financial/seller/commissions/       — Commission history
//   GET  /financial/plans/                    — Available subscription plans
//   GET  /financial/seller/subscription/       — Current subscription
//   POST /financial/seller/subscription/      — Subscribe/upgrade
//   DELETE /financial/seller/subscription/    — Cancel subscription
//   GET  /financial/seller/subscription/history/ — Billing history
//   GET  /financial/seller/ad-wallet/         — Ad wallet balance
//   POST /financial/seller/ad-wallet/top-up/  — Top up ad wallet
//   GET  /financial/seller/ad-transactions/   — Ad transaction history
//
// Admin endpoints:
//   GET  /financial/admin/dashboard/          — Revenue dashboard
//   GET  /financial/admin/reconciliation/     — Run reconciliation
//   GET  /financial/admin/revenue-report/     — Revenue report
//   GET  /financial/admin/accounting-export/ — Export ledger
//   GET  /financial/admin/ledger/            — View ledger
//   GET  /financial/admin/audit-log/         — Audit log

import { apiRequest } from './api';

const FINANCIAL_BASE = '/financial';

// ── Types (matching actual API response shapes) ──────────────────

export interface FinancialDashboard {
  gross_sales_30d: string;
  commission_30d: string;
  refunds_30d: string;
  platform_fees_30d: string;
  ad_spend_30d: string;
  net_earnings_30d: string;
  available_balance: string;
  pending_balance: string;
  total_paid_out: string;
  active_holds: number;
  hold_amount: string;
  eligible_for_payout: string;
  min_payout_amount: string;
  can_request_payout: boolean;
  commission_rate: string;
  commission_transactions_30d: number;
  recent_ledger: Array<{
    type: string;
    amount: string;
    is_credit: boolean;
    reference: string;
    notes: string;
    date: string;
  }>;
}

export interface CommissionTransaction {
  id: number;
  order_number: string;
  gross_amount: string;
  commission_percentage: string;
  commission_amount: string;
  seller_amount: string;
  status: string;
  reversed_amount: string;
  is_reversal: boolean;
  rule_name: string | null;
  created_at: string;
}

export interface CommissionHistoryResponse {
  summary_30d: any;
  transactions: CommissionTransaction[];
}

export interface PayoutItem {
  id: number;
  amount: string;
  currency: string;
  method: string;
  status: string;
  destination: string;
  reference: string;
  processed_at: string | null;
  created_at: string;
}

export interface PayoutsResponse {
  summary: any;
  payouts: PayoutItem[];
}

export interface PayoutHold {
  id: number;
  reason: string;
  amount: string;
  status: string;
  description: string;
  started_at: string;
  expected_release_date: string | null;
  released_at: string | null;
}

export interface PayoutHoldsResponse {
  holds: PayoutHold[];
}

export interface SellerPlan {
  id: number;
  code: string;
  name: string;
  description: string;
  plan_type: string;
  monthly_price: string;
  yearly_price: string;
  currency: string;
  product_limit: number | null;
  staff_limit: number | null;
  location_limit: number | null;
  commission_discount: string;
  advertising_credit: string;
  features: {
    international_selling: boolean;
    advanced_analytics: boolean;
    api_access: boolean;
    custom_domain: boolean;
    priority_support: boolean;
    b2b_tools: boolean;
    storefront_customization: boolean;
  };
  is_featured: boolean;
  is_free: boolean;
}

export interface PlansResponse {
  plans: SellerPlan[];
}

export interface SubscriptionSummary {
  current_plan: {
    code: string;
    name: string;
    monthly_price: string;
    yearly_price: string;
  } | null;
  status: string;
  days_remaining: number;
  period_end: string | null;
  transactions?: any[];
}

export interface SubscriptionTransaction {
  id: number;
  plan: string;
  plan_code: string | null;
  transaction_type: string;
  amount: string;
  currency: string;
  status: string;
  billing_period: string;
  payment_provider: string;
  transaction_reference: string;
  period_start: string;
  period_end: string;
  failure_reason: string;
  created_at: string;
}

export interface SubscriptionHistoryResponse {
  transactions: SubscriptionTransaction[];
}

export interface AdWalletResponse {
  wallet_balance: string;
  spend_30d: {
    total_spend: string;
    click_charges_amount: string;
    click_count: number;
    impression_charges_amount: string;
    impression_count: number;
    top_ups: string;
    wallet_balance: string;
  };
}

export interface AdTransaction {
  id: number;
  transaction_type: string;
  amount: string;
  currency: string;
  status: string;
  description: string;
  transaction_reference: string;
  created_at: string;
}

export interface AdTransactionsResponse {
  transactions: AdTransaction[];
}

export interface AdminRevenueDashboard {
  gmv: { '30d': string; '7d': string };
  revenue: {
    commission: string;
    subscription: string;
    platform_fees: string;
    shipping_margin: string;
    advertising: string;
    total: string;
  };
  costs: {
    refunds: string;
    payment_processing: string;
    delivery_partners: string;
    total: string;
  };
  net_revenue: string;
  metrics: {
    active_sellers: number;
    active_buyers_30d: number;
    orders_30d: number;
    aov: string;
    take_rate: string;
  };
  payouts: {
    pending_count: number;
    pending_amount: string;
  };
  holds: {
    active_count: number;
    active_amount: string;
  };
  revenue_by_source: Record<string, string>;
}

export interface ReconciliationResult {
  store_balances: any[];
  commissions: any[];
  payments_vs_ledger: any[];
  payouts: any[];
  total_issues: number;
  timestamp: string;
}

export interface RevenueReport {
  period_days: number;
  gmv: string;
  revenue: {
    commission: string;
    commission_reversals: string;
    net_commission: string;
    platform_fees: string;
    shipping_margin: string;
    total: string;
  };
  costs: {
    refunds: string;
    delivery_partners: string;
    total: string;
  };
  net_revenue: string;
  take_rate: string;
}

export interface AccountingExport {
  start_date: string;
  end_date: string;
  accounts: Record<string, any>;
  total_entries: number;
  total_debits: string;
  total_credits: string;
  is_balanced: boolean;
}

export interface LedgerAccount {
  code: string;
  name: string;
  account_type: string;
  balance: string;
  currency: string;
  recent_entries: Array<{
    id: number;
    entry_type: string;
    amount: string;
    reference_type: string;
    reference_id: string;
    description: string;
    is_reversed: boolean;
    timestamp: string;
  }>;
}

export interface LedgerResponse {
  accounts: LedgerAccount[];
  revenue_summary_30d: any;
}

export interface AuditLog {
  id: number;
  action: string;
  performed_by: string | null;
  reference_type: string;
  reference_id: string;
  previous_values: any;
  new_values: any;
  reason: string;
  timestamp: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
}

// ── Seller Financial Endpoints ────────────────────────────────────

/** GET /financial/seller/dashboard/ — comprehensive financial dashboard */
export async function getFinancialDashboard(): Promise<FinancialDashboard> {
  return apiRequest<FinancialDashboard>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/dashboard/`,
  });
}

/** GET /financial/seller/payouts/ — payout summary + list */
export async function getPayouts(): Promise<PayoutsResponse> {
  return apiRequest<PayoutsResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/payouts/`,
  });
}

/** POST /financial/seller/payouts/ — request a payout */
export async function requestFinancialPayout(amount: string, method?: string): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${FINANCIAL_BASE}/seller/payouts/`,
    data: { amount, method },
  });
}

/** GET /financial/seller/payout-holds/ — list payout holds */
export async function getPayoutHolds(): Promise<PayoutHoldsResponse> {
  return apiRequest<PayoutHoldsResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/payout-holds/`,
  });
}

/** GET /financial/seller/commissions/ — commission history */
export async function getCommissionHistory(): Promise<CommissionHistoryResponse> {
  return apiRequest<CommissionHistoryResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/commissions/`,
  });
}

/** GET /financial/plans/ — available subscription plans */
export async function getSellerPlans(): Promise<PlansResponse> {
  return apiRequest<PlansResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/plans/`,
  });
}

/** GET /financial/seller/subscription/ — current subscription */
export async function getSubscription(): Promise<SubscriptionSummary> {
  return apiRequest<SubscriptionSummary>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/subscription/`,
  });
}

/** POST /financial/seller/subscription/ — subscribe/upgrade to a plan */
export async function subscribeToPlan(data: {
  plan_code: string;
  billing_period?: string;
  payment_method?: string;
  transaction_reference?: string;
  auto_renew?: boolean;
}): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${FINANCIAL_BASE}/seller/subscription/`,
    data,
  });
}

/** DELETE /financial/seller/subscription/ — cancel subscription */
export async function cancelSubscription(reason?: string): Promise<any> {
  return apiRequest<any>({
    method: 'DELETE',
    url: `${FINANCIAL_BASE}/seller/subscription/`,
    data: { reason: reason || 'User cancelled' },
  });
}

/** GET /financial/seller/subscription/history/ — billing history */
export async function getSubscriptionHistory(): Promise<SubscriptionHistoryResponse> {
  return apiRequest<SubscriptionHistoryResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/subscription/history/`,
  });
}

/** GET /financial/seller/ad-wallet/ — ad wallet balance and summary */
export async function getAdWallet(): Promise<AdWalletResponse> {
  return apiRequest<AdWalletResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/ad-wallet/`,
  });
}

/** POST /financial/seller/ad-wallet/top-up/ — top up ad wallet */
export async function topUpAdWallet(data: {
  amount: string;
  payment_reference: string;
  payment_method?: string;
}): Promise<any> {
  return apiRequest<any>({
    method: 'POST',
    url: `${FINANCIAL_BASE}/seller/ad-wallet/top-up/`,
    data,
  });
}

/** GET /financial/seller/ad-transactions/ — ad transaction history */
export async function getAdTransactions(): Promise<AdTransactionsResponse> {
  return apiRequest<AdTransactionsResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/seller/ad-transactions/`,
  });
}

// ── Admin Financial Endpoints ─────────────────────────────────────

/** GET /financial/admin/dashboard/ — admin revenue dashboard */
export async function getAdminRevenueDashboard(): Promise<AdminRevenueDashboard> {
  return apiRequest<AdminRevenueDashboard>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/dashboard/`,
  });
}

/** GET /financial/admin/reconciliation/ — run reconciliation */
export async function runReconciliation(): Promise<ReconciliationResult> {
  return apiRequest<ReconciliationResult>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/reconciliation/`,
  });
}

/** GET /financial/admin/revenue-report/?days=30 — revenue report */
export async function getRevenueReport(days: number = 30): Promise<RevenueReport> {
  return apiRequest<RevenueReport>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/revenue-report/`,
    params: { days },
  });
}

/** GET /financial/admin/accounting-export/ — export ledger entries */
export async function getAccountingExport(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<AccountingExport> {
  return apiRequest<AccountingExport>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/accounting-export/`,
    params,
  });
}

/** GET /financial/admin/ledger/ — view ledger entries */
export async function getLedger(): Promise<LedgerResponse> {
  return apiRequest<LedgerResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/ledger/`,
  });
}

/** GET /financial/admin/audit-log/ — view audit logs */
export async function getAuditLog(action?: string): Promise<AuditLogResponse> {
  return apiRequest<AuditLogResponse>({
    method: 'GET',
    url: `${FINANCIAL_BASE}/admin/audit-log/`,
    params: action ? { action } : undefined,
  });
}
