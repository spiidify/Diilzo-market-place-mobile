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

const EMAIL_ADDRESS_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_NUMBER_PATTERN = /(?:^|[^\w])\+?\d[\d\s().-]{5,}\d(?=$|[^\w])/g;
const DATE_PATTERN = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g;
const MONEY_AMOUNT_PATTERN = /(?:[$€£¥₹₦₱₩₽₫₪₴₵₲₡₭₮₸₼₾₺฿₨]\s*|\b(?:USD|EUR|GBP|NGN|KES|UGX|TZS|RWF|GHS|ZAR|CAD|AUD|INR|JPY|CNY|AED|SAR)\s*)\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|NGN|KES|UGX|TZS|RWF|GHS|ZAR|CAD|AUD|INR|JPY|CNY|AED|SAR|dollars?|euros?|pounds?|naira|shillings?|rupees?|yen)\b|\b(?:amount|cost|price|paid|payment|fee|budget|salary)\s*(?:is|of|:|=)?\s*\d[\d,]*(?:\.\d{1,2})?/gi;
const MESSAGE_CONTACT_WARNING = 'For your safety and to help prevent off-platform scams, keep all payments and conversations within Diilzo. Email addresses and phone numbers cannot be shared in chat.';

export function getMessageContactWarning(message: string): string | null {
  if (EMAIL_ADDRESS_PATTERN.test(message)) {
    return MESSAGE_CONTACT_WARNING;
  }

  const textWithoutAmounts = message.replace(DATE_PATTERN, ' ').replace(MONEY_AMOUNT_PATTERN, ' ');
  const candidates = textWithoutAmounts.match(PHONE_NUMBER_PATTERN) || [];
  if (candidates.some((candidate) => {
    const digitCount = candidate.replace(/\D/g, '').length;
    return digitCount >= 7 && digitCount <= 15;
  })) {
    return MESSAGE_CONTACT_WARNING;
  }

  return null;
}

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
