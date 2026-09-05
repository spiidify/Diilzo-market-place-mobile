// ── Input Validation & Sanitization ───────────────────────────────
// Security utilities for validating and sanitizing user input.

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const UGANDAN_PHONE_REGEX = /^(\+?256|0)?[7-9][0-9]{8}$/;
const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;
const URL_REGEX = /^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/;

// ── Max lengths to prevent buffer-style attacks ───────────────────
export const MAX_LENGTHS = {
  email: 254,
  password: 128,
  name: 60,
  phone: 20,
  searchQuery: 200,
  message: 5000,
  productName: 200,
  description: 5000,
  address: 300,
  city: 100,
  generic: 1000,
} as const;

/** Validate email format and length. */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_LENGTHS.email) return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/** Validate phone number (Uganda-focused but accepts international). */
export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // optional
  const cleaned = phone.replace(/[\s-()]/g, '');
  if (cleaned.length > MAX_LENGTHS.phone) return false;
  return UGANDAN_PHONE_REGEX.test(cleaned) || /^\+\d{6,15}$/.test(cleaned);
}

/** Validate URL — only HTTPS allowed. */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  if (url.length > 2048) return false;
  return URL_REGEX.test(url);
}

/** Validate slug format (for product/store slugs). */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length > 100) return false;
  return SLUG_REGEX.test(slug);
}

/**
 * Password strength checker.
 * Returns a score 0-4 and a label.
 */
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;
  else if (score >= 1) suggestions.push('Use 12+ characters for stronger security');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else suggestions.push('Add special characters (!@#$...)');

  // Clamp to 0-4
  const finalScore = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordStrength['label'][] = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return { score: finalScore, label: labels[finalScore], suggestions };
}

/** Check if password meets minimum requirements. */
export function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

/**
 * Sanitize a string input — trim, collapse whitespace, remove control chars.
 * Does NOT escape HTML (React Native Text doesn't render HTML).
 */
export function sanitizeString(input: string, maxLength: number = MAX_LENGTHS.generic): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // remove control chars
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim()
    .slice(0, maxLength);
}

/** Sanitize an email — lowercase + trim. */
export function sanitizeEmail(email: string): string {
  return sanitizeString(email, MAX_LENGTHS.email).toLowerCase();
}

/** Sanitize a numeric string (e.g. price, amount). */
export function sanitizeNumber(input: string): string {
  if (!input) return '';
  return input.replace(/[^0-9.]/g, '').slice(0, 20);
}

/** Sanitize a search query. */
export function sanitizeSearchQuery(query: string): string {
  return sanitizeString(query, MAX_LENGTHS.searchQuery);
}

/**
 * Validate a numeric amount (for payouts, cart quantities, etc).
 * Returns null if invalid.
 */
export function validateAmount(amount: string | number): number | null {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0 || num > 1_000_000_000) return null;
  return num;
}

/** Validate a quantity (positive integer, reasonable max). */
export function validateQuantity(qty: string | number): number | null {
  const num = typeof qty === 'string' ? parseInt(qty, 10) : qty;
  if (isNaN(num) || num < 1 || num > 99999) return null;
  return Math.floor(num);
}

/**
 * Check for common injection patterns in text input.
 * Returns true if the input looks suspicious.
 */
export function looksSuspicious(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,        // event handlers
    /data:text\/html/i,
    /\bv\b\s*drop\s*table/i,
    /--\s*$/i,            // SQL comment
    /;\s*drop/i,
    /\bunion\s+select/i,
  ];
  return patterns.some((p) => p.test(lower));
}
