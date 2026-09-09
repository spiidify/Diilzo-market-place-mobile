// ── FleetLogix Mobile API Adapter ─────────────────────────────────
// Network adapter for FleetLogix Portal endpoints used by logistics
// staff on mobile devices. Reuses the authenticated API client from
// the main api.ts module for JWT token handling.

import { apiRequest, BASE_URL } from './api';

// ── Types ──────────────────────────────────────────────────────────
export interface ReleasePackageResponse {
  detail: string;
  order_id: number;
  order_number: string;
  pickup_status: string;
  collected_at: string | null;
}

export interface FleetApiError {
  detail: string;
  order_id?: number;
}

// ── POST /api/v1/fleet/release-package/ ────────────────────────────
// Validates an order_id and 6-digit collection PIN against the
// database, updates the order's pickup_status to 'COLLECTED', and
// returns a success JSON confirmation.
export async function releasePackage(
  orderId: number,
  collectionPin: string
): Promise<ReleasePackageResponse> {
  return apiRequest<ReleasePackageResponse>({
    method: 'POST',
    url: '/fleet/release-package/',
    data: {
      order_id: orderId,
      collection_pin: collectionPin,
    },
  });
}

// ── Helper: validate 6-digit PIN format ────────────────────────────
export function isValidCollectionPin(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}

// ── Helper: validate order ID ──────────────────────────────────────
export function isValidOrderId(id: string): boolean {
  const num = parseInt(id, 10);
  return !isNaN(num) && num > 0 && id.trim() === String(num);
}

export { BASE_URL };
