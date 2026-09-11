// ── Diilzo Mobile API Types ──────────────────────────────────────
// Mirrors the Django DRF serializers in apps/api/serializers.py

// ── Homepage Slide ───────────────────────────────────────────────
export type SlidePosition = 'hero' | 'tile_a' | 'tile_b' | 'sidebar';

export interface Slide {
  id: number;
  title: string;
  headline: string;
  subheadline: string;
  display_image: string;
  background_color: string;
  cta_text: string;
  cta_link: string;
  link_url: string;
  category_slug: string | null;
  category_name: string | null;
  brand_slug: string | null;
  brand_name: string | null;
  button_style: string;
  text_position: string;
  sort_order: number;
  position?: SlidePosition | null;
}

// ── Store ────────────────────────────────────────────────────────
export interface Store {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string;
  country: string;
  is_wholesaler: boolean;
  phone?: string;
  tagline?: string;
  is_featured?: boolean;
  product_count?: number;
  business_type?: string;
  verification_status?: string;
  rating?: string;
  review_count?: number;
  banner_url?: string | null;
}

export interface StoreDetail extends Store {
  tagline: string;
  description: string;
  phone: string;
  email: string;
  is_featured: boolean;
  status: string;
  product_count: number;
  created_at: string;
  banner_url?: string | null;
}

// ── Category & Brand ─────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  image_url?: string | null;
  display_image?: string;
  product_count?: number;
  sort_order: number;
  is_active?: boolean;
  parent?: number | null;
  children?: Category[];
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string;
  product_count: number;
}

// ── Product ──────────────────────────────────────────────────────
export interface ProductImage {
  id: number;
  image_url: string | null;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string | null;
  price: string;
  stock_quantity: number;
  is_in_stock: boolean;
  is_active: boolean;
}

export interface WholesaleTier {
  id: number;
  min_quantity: number;
  price: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  store: Store | null;
  category: Category | null;
  brand: Brand | null;
  price: string;
  sale_price: string | null;
  final_price: string;
  currency: string;
  discount_percentage: number;
  stock_quantity: number;
  is_in_stock: boolean;
  sku: string | null;
  min_order_quantity: number;
  is_wholesale: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_on_sale: boolean;
  rating: string;
  review_count: number;
  primary_image_url: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  wholesale_tiers: WholesaleTier[];
  country_of_origin: string;
  // Extended search result fields (returned by /api/v1/search/)
  store_country?: string;
  store_city?: string;
  store_is_verified?: boolean;
  distance_km?: number | null;
  store_latitude?: number | null;
  store_longitude?: number | null;
  delivery_radius_km?: number;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  video_url: string | null;
  is_sponsored?: boolean;
  promotion_type?: string | null;
  promotion_id?: number | null;
  flash_sale_ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Voucher / Claimable Coupon ───────────────────────────────────
export interface ClaimableCoupon {
  code: string;
  discount_type: string; // 'percentage' | 'fixed'
  discount_value: string;
  min_order_amount: string;
  store_name: string | null;
  valid_to: string | null;
}

// ── RFQ (Request for Quotation) ──────────────────────────────────
export interface RFQPayload {
  name: string;
  email?: string;
  phone?: string;
  product_name: string;
  quantity?: number;
  target_price?: number | null;
  message?: string;
}

export interface RFQResponse {
  detail: string;
  id: number;
}

// ── Promotion & Discovery Engine Types ───────────────────────────

export type PackageType = 'top_ad' | 'sponsored' | 'homepage_featured' | 'category_pinned';

export interface PromotionPackage {
  id: number;
  name: string;
  package_type: PackageType;
  duration_days: number;
  price: string;
  currency: string;
  max_impressions: number;
  max_clicks: number;
  is_active: boolean;
  sort_order: number;
}

export type PromotionStatus = 'pending' | 'active' | 'paused' | 'expired' | 'cancelled';

export interface KeywordBid {
  id: number;
  keyword: string;
  bid_amount: string;
  is_active: boolean;
  created_at: string;
  product_name: string | null;
}

export interface ProductPromotion {
  id: number;
  product: number;
  product_name: string;
  product_slug: string;
  package: number | null;
  package_name: string | null;
  package_type: PackageType | null;
  status: PromotionStatus;
  starts_at: string | null;
  ends_at: string | null;
  target_keywords: string;
  target_category: number | null;
  impressions: number;
  clicks: number;
  add_to_carts: number;
  purchases: number;
  bid_per_click: string;
  ad_spend: string;
  ad_spend_budget: string;
  is_currently_active: boolean;
  ctr: number;
  conversion_rate: number;
  keyword_bids: KeywordBid[];
  created_at: string;
}

export interface PromotionAnalytics {
  total_promotions: number;
  active_promotions: number;
  pending_promotions: number;
  expired_promotions: number;
  total_impressions: number;
  total_clicks: number;
  total_add_to_carts: number;
  total_purchases: number;
  total_ad_spend: number;
  overall_ctr: number;
  overall_conversion_rate: number;
}

export interface ProductFeedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  pinned: Product[];
  sponsored: Product[];
  results: Product[];
}

// ── User & Auth ──────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  has_store: boolean;
  date_joined: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RegisterResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface RefreshResponse {
  access: string;
  refresh?: string;
}

// ── Address ──────────────────────────────────────────────────────
export interface Address {
  id: number;
  label: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ── Cart ─────────────────────────────────────────────────────────
export interface CartItem {
  id: number;
  product: Product;
  quantity: number;
  unit_price: string;
  total_price: string;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total_items: number;
  total_price: string;
  created_at: string;
  updated_at: string;
}

// ── Orders ───────────────────────────────────────────────────────
export interface OrderItem {
  id: number;
  product_name: string;
  product_slug: string;
  product_image_url: string;
  product_image: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface SubOrder {
  id: number;
  store_name: string;
  status: string;
  subtotal: string;
  commission_amount: string;
  seller_amount: string;
  items: OrderItem[];
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  tax_amount: string;
  shipping_cost: string;
  discount_amount: string;
  total: string;
  currency: string;
  shipping_address: Record<string, any>;
  tracking_number: string;
  notes: string;
  suborders: SubOrder[];
  total_items: number;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

// ── Wishlist ─────────────────────────────────────────────────────
export interface WishlistItem {
  id: number;
  product: Product;
  created_at: string;
}

// ── Chat ─────────────────────────────────────────────────────────
export interface ChatMessage {
  id: number;
  thread: number;
  sender: number;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  message_type: 'text' | 'audio';
  audio_url: string | null;
  audio_duration: number;
  is_read: boolean;
  created_at: string;
}

export interface ChatThread {
  id: number;
  store: number | null;
  store_name: string | null;
  store_logo: string | null;
  store_slug: string | null;
  buyer: number;
  buyer_name: string;
  product: number | null;
  product_name: string | null;
  product_slug: string | null;
  is_support?: boolean;
  created_at: string;
  updated_at: string;
  last_message: {
    message: string;
    sender: string;
    created_at: string;
  } | null;
  unread_count: number;
}

// ── Reviews ──────────────────────────────────────────────────────
export interface Review {
  id: number;
  user_name: string;
  rating: number;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface StoreReview {
  id: number;
  rating: number;
  comment: string;
  user_name: string;
  created_at: string;
}

export interface Shipment {
  id: number;
  carrier: string;
  tracking_number: string;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
}

// ── Generic ──────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
