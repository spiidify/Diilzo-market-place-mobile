// ── Payment API Service ───────────────────────────────────────────

import { apiRequest } from './api';

export interface PaymentMethod {
  method: string;
}

export interface PaymentInitResult {
  payment_id: number;
  status: string;
  redirect_url?: string;
  provider_txn_id?: string;
  client_secret?: string;
  publishable_key?: string;
  payment_intent_id?: string;
  idempotent?: boolean;
}

export interface PaymentStatusResult {
  payment_id: number;
  status: string;
  method: string;
  amount: number;
}

/** GET /api/v1/payments/methods/ — available payment methods
 *
 * Backend returns { methods: [{ value, label }] } (apps/payments/views.py).
 * Normalized to [{ method }] here; 'cash' maps to the app's 'cod' option.
 */
export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const data = await apiRequest<any>({ method: 'GET', url: '/payments/methods/' });
  const list: any[] = Array.isArray(data) ? data : data?.methods || data?.results || [];
  return list
    .map((m: any) => {
      const raw = typeof m === 'string' ? m : m?.method || m?.value;
      return { method: raw === 'cash' ? 'cod' : raw };
    })
    .filter((m) => Boolean(m.method));
}

/** POST /api/v1/payments/init/ — initiate payment with client idempotency key */
export async function initiatePayment(params: {
  order_id: number;
  method: string;
  phone?: string;
  return_url?: string;
  cancel_url?: string;
  idempotency_key?: string;
}): Promise<PaymentInitResult> {
  const idempotencyKey =
    params.idempotency_key ||
    `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const paymentMethod = params.method === 'cod' ? 'cash' : params.method;

  const res = await apiRequest<any>({
    method: 'POST',
    url: '/payments/init/',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    data: {
      order_id: params.order_id,
      payment_method: paymentMethod,
      phone_number: params.phone,
      return_url: params.return_url,
      cancel_url: params.cancel_url,
    },
  });

  // Backend wraps the record as { payment: {...}, status, message, ... }.
  // /payments/<id>/status/ looks up the integer pk — expose it as payment_id.
  const payment = res?.payment || {};
  return {
    payment_id: res?.payment_id ?? payment.id ?? payment.payment_id,
    status: res?.status || payment.status || 'pending',
    redirect_url: res?.redirect_url,
    provider_txn_id: res?.provider_txn_id,
    client_secret: res?.client_secret,
    publishable_key: res?.publishable_key,
    payment_intent_id: res?.payment_intent_id,
    idempotent: res?.idempotent,
  };
}

/** GET /api/v1/payments/<id>/status/ — check payment status */
export async function checkPaymentStatus(paymentId: number): Promise<PaymentStatusResult> {
  return apiRequest<PaymentStatusResult>({
    method: 'GET',
    url: `/payments/${paymentId}/status/`,
  });
}
