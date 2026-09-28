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

/** GET /api/v1/payments/methods/ — available payment methods */
export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  return apiRequest<PaymentMethod[]>({ method: 'GET', url: '/payments/methods/' });
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

  return apiRequest<PaymentInitResult>({
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
}

/** GET /api/v1/payments/<id>/status/ — check payment status */
export async function checkPaymentStatus(paymentId: number): Promise<PaymentStatusResult> {
  return apiRequest<PaymentStatusResult>({
    method: 'GET',
    url: `/payments/${paymentId}/status/`,
  });
}
