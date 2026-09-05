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

/** POST /api/v1/payments/init/ — initiate payment */
export async function initiatePayment(params: {
  order_id: number;
  method: string;
  phone?: string;
  return_url?: string;
}): Promise<PaymentInitResult> {
  return apiRequest<PaymentInitResult>({
    method: 'POST',
    url: '/payments/init/',
    data: params,
  });
}

/** GET /api/v1/payments/<id>/status/ — check payment status */
export async function checkPaymentStatus(paymentId: number): Promise<PaymentStatusResult> {
  return apiRequest<PaymentStatusResult>({
    method: 'GET',
    url: `/payments/${paymentId}/status/`,
  });
}
