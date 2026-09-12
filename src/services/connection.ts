// ── Buyer-Seller Connection Service ──────────────────────────────
// APIs for My Sellers, Buy Again, Seller Customers (CRM)

import type { FollowedStore, Product, StoreCustomer } from '../types';
import { apiRequest } from './api';

// ── My Sellers (followed stores) ────────────────────────────────

/** GET /api/v1/account/my-sellers/ — list stores the buyer follows */
export async function fetchMySellers(): Promise<FollowedStore[]> {
  const data = await apiRequest<{ stores: FollowedStore[]; count: number }>({
    method: 'GET',
    url: '/account/my-sellers/',
  });
  return data.stores;
}

// ── Buy Again (previously purchased products) ────────────────────

/** GET /api/v1/account/buy-again/ — products the buyer has previously ordered */
export async function fetchBuyAgain(): Promise<Product[]> {
  const data = await apiRequest<{ products: Product[]; count: number }>({
    method: 'GET',
    url: '/account/buy-again/',
  });
  return data.products;
}

// ── Seller Customers (CRM) ───────────────────────────────────────

/** GET /api/v1/seller/customers/ — list customers for the seller's store */
export async function fetchSellerCustomers(): Promise<StoreCustomer[]> {
  const data = await apiRequest<{ customers: StoreCustomer[]; count: number }>({
    method: 'GET',
    url: '/seller/customers/',
  });
  return data.customers;
}

/** GET /api/v1/seller/customers/<id>/ — customer detail with order history */
export async function fetchSellerCustomerDetail(customerId: number): Promise<StoreCustomer> {
  return apiRequest<StoreCustomer>({
    method: 'GET',
    url: `/seller/customers/${customerId}/`,
  });
}

/** PATCH /api/v1/seller/customers/<id>/ — update customer notes/tags */
export async function updateSellerCustomer(
  customerId: number,
  updates: { notes?: string; tags?: string }
): Promise<StoreCustomer> {
  return apiRequest<StoreCustomer>({
    method: 'PATCH',
    url: `/seller/customers/${customerId}/`,
    data: updates,
  });
}

// ── Message Risk Scan ────────────────────────────────────────────

/** POST /api/v1/chat/scan/ — scan a message for off-platform risk */
export async function scanMessageRisk(
  message: string
): Promise<{ risk_level: 'low' | 'medium' | 'high'; signals: string[]; warning: string }> {
  return apiRequest({
    method: 'POST',
    url: '/chat/scan/',
    data: { message },
  });
}
