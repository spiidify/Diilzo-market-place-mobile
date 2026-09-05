// ── Diilzo Mobile API Types ──────────────────────────────────────
// Mirrors the Django DRF serializers in apps/api/serializers.py

// ── Store ────────────────────────────────────────────────────────
export interface Store {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string;
  country: string;
  is_wholesaler: boolean;
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
  display_image: string;
  product_count: number;
  sort_order: number;
  children?: Category[];
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
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
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
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
  is_read: boolean;
  created_at: string;
}

export interface ChatThread {
  id: number;
  store: number;
  store_name: string;
  store_logo: string | null;
  store_slug: string;
  buyer: number;
  buyer_name: string;
  product: number | null;
  product_name: string | null;
  product_slug: string | null;
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

// ── Generic ──────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
