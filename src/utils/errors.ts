// ── Error Sanitization ────────────────────────────────────────────
// Prevents leaking sensitive backend info to the UI.

import type { AxiosError } from 'axios';

/** User-friendly error messages — never expose internals. */
const SAFE_ERRORS: Record<number, string> = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item was not found.',
  408: 'The request timed out. Please check your connection and try again.',
  409: 'This item already exists or conflicts with existing data.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Our team has been notified.',
  502: 'The service is temporarily unavailable. Please try again shortly.',
  503: 'The service is under maintenance. Please try again later.',
  504: 'The server took too long to respond. Please try again.',
};

/** Known safe field-level error messages from DRF. */
const SAFE_FIELD_ERRORS = new Set([
  'This field is required.',
  'This field may not be blank.',
  'Enter a valid email address.',
  'This password is too short.',
  'This password is too common.',
  'This password is entirely numeric.',
  'A user with this email already exists.',
  'No active account found with the given credentials.',
]);

/**
 * Extract a safe, user-friendly error message from an Axios error.
 * Never exposes stack traces, internal paths, or SQL errors.
 */
export function getSafeErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  const axiosError = error as AxiosError<any>;

  // Network errors (no response)
  if (!axiosError.response) {
    if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
      return 'The request timed out. Please check your connection and try again.';
    }
    if (axiosError.message?.includes('Network Error')) {
      return 'No internet connection. Please check your network and try again.';
    }
    return 'Unable to connect to the server. Please try again later.';
  }

  const { status, data } = axiosError.response;

  // Use safe status-based message as default
  const safeMsg = SAFE_ERRORS[status] || fallback;

  // Try to extract a safe field-level message
  if (data) {
    // DRF detail string
    if (typeof data.detail === 'string') {
      // Only return if it's a known safe message, otherwise use status-based
      if (SAFE_FIELD_ERRORS.has(data.detail)) return data.detail;
      // For 401, the detail is usually safe ("No active account found...")
      if (status === 401) return data.detail;
      return safeMsg;
    }

    // DRF field errors — only return known safe ones
    if (typeof data === 'object' && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        const fieldErrors = data[key];
        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
          const firstError = fieldErrors[0];
          if (typeof firstError === 'string' && SAFE_FIELD_ERRORS.has(firstError)) {
            return firstError;
          }
        }
      }
    }
  }

  return safeMsg;
}

/**
 * Log errors securely — strips sensitive data before logging.
 * In production, this should send to a monitoring service (Sentry, etc.)
 */
export function logSecureError(error: unknown, context?: string): void {
  if (__DEV__) {
    // In dev, log full error for debugging
    console.error(`[${context || 'Error'}]:`, error);
  } else {
    // In production, log only safe info
    const axiosError = error as AxiosError<any>;
    const safeInfo = {
      context,
      status: axiosError.response?.status,
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      timestamp: new Date().toISOString(),
    };
    console.warn('API Error:', JSON.stringify(safeInfo));
    // TODO: Send to Sentry / monitoring service
  }
}
