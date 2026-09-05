// ── Currency formatting utility ───────────────────────────────────

export const SUPPORTED_CURRENCIES = [
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', rate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.00027 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', rate: 0.035 },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', rate: 0.63 },
  { code: 'RWF', symbol: 'RFr', name: 'Rwandan Franc', rate: 0.36 },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

let activeCurrency: CurrencyCode = 'UGX';

export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code;
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

export function formatPrice(amount: string | number, fromCurrency: string = 'UGX'): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0';

  const target = SUPPORTED_CURRENCIES.find((c) => c.code === activeCurrency);
  const source = SUPPORTED_CURRENCIES.find((c) => c.code === fromCurrency) || SUPPORTED_CURRENCIES[0];

  if (!target || target.code === fromCurrency) {
    return `${target?.symbol || source.symbol} ${value.toLocaleString()}`;
  }

  // Convert via UGX as base
  const inUGX = value / source.rate;
  const converted = inUGX * target.rate;
  return `${target.symbol} ${Math.round(converted).toLocaleString()}`;
}
