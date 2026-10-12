// ── Wholesale tier pricing (mirrors Product.price_for_quantity) ──────
// Keep this logic in sync with the Django model so the client can show
// live unit/total prices as the quantity changes without extra requests.

export interface PriceTier {
  id?: number;
  min_quantity: number;
  price: string | number;
}

/**
 * Return the unit price for a quantity, applying the best matching
 * volume tier. Tiers are expected sorted by min_quantity ascending.
 * When no tier matches, falls back to basePrice.
 */
export function priceForQuantity(
  quantity: number,
  basePrice: number,
  tiers: PriceTier[] | null | undefined,
): number {
  if (!tiers || tiers.length === 0 || quantity < 1) {
    return basePrice;
  }
  let best = basePrice;
  for (const tier of tiers) {
    const minQty = Number(tier.min_quantity);
    const price = Number(tier.price);
    if (quantity >= minQty && !Number.isNaN(price) && price < best) {
      best = price;
    }
  }
  return best;
}

/** Total line price for a quantity using tier-aware unit pricing. */
export function totalForQuantity(
  quantity: number,
  basePrice: number,
  tiers: PriceTier[] | null | undefined,
): number {
  return priceForQuantity(quantity, basePrice, tiers) * quantity;
}