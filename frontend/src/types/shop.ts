import type { ContentSeoMetadata } from "@/types/panel-api";

export type ProductType = "physical" | "online_course" | "in_person_course";
export type ProductStatus =
  | "draft"
  | "waiting_review"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "discontinued";
export type EnrollmentStatus = "open" | "full" | "closed";
export type CartItemIssue =
  | "unavailable"
  | "insufficient_stock"
  | "max_quantity_exceeded"
  | "course_full"
  | "invalid_quantity"
  | null;

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "payment_processing"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "payment_failed"
  | "refunded"
  | "partially_refunded";

export type UnitBrief = { id: number; title: string; slug: string };

export type ShopCategoryBrief = { id: number; title: string; slug: string };

export type ShopCategory = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
};

export type PhysicalDetailPublic = {
  availability: Availability;
  weight_grams: number | null;
  requires_shipping: boolean;
  max_purchase_quantity: number | null;
};

export type CourseDetailPublic = {
  instructor_name: string | null;
  course_type: string | null;
  duration_minutes: number | null;
  capacity: number | null;
  seats_left: number | null;
  start_date: string | null;
  prerequisites: string | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  enrollment_status: EnrollmentStatus;
};

export type OnlineCourseDetailPublic = CourseDetailPublic & {
  access_duration_days: number | null;
};

export type InPersonCourseDetailPublic = CourseDetailPublic & {
  unit: UnitBrief | null;
  location_detail: string | null;
  schedule_text: string | null;
  end_date: string | null;
  registration_deadline: string | null;
};

export type ProductImage = {
  id: number;
  image: string | null;
  alt_text: string | null;
  caption: string | null;
  order: number;
};

export type ProductVariant = {
  id: number;
  sku: string;
  title: string;
  price_amount: number;
  price_display: string | null;
  attributes: Record<string, string>;
  in_stock: boolean;
};

export type ProductListItem = {
  id: number;
  product_type: ProductType;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image: string | null;
  category: ShopCategoryBrief | null;
  tags: string[];
  price_amount: number | null;
  sale_price_amount: number | null;
  price_display: string | null;
  sale_price_display: string | null;
  is_on_sale: boolean;
  is_featured: boolean;
  is_important: boolean;
  status: ProductStatus;
  is_published: boolean;
  physical_detail: PhysicalDetailPublic | null;
  course_detail: OnlineCourseDetailPublic | InPersonCourseDetailPublic | null;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
  gallery_images: ProductImage[];
  variants: ProductVariant[];
  seo: Record<string, unknown>;
};

export type CartItemProductBrief = {
  id: number;
  title: string;
  slug: string;
  product_type: ProductType;
  featured_image: string | null;
};

export type CartItem = {
  id: number;
  product: CartItemProductBrief;
  variant: number | null;
  variant_title: string | null;
  quantity: number;
  unit_price_amount: number;
  unit_price_display: string | null;
  line_total_amount: number;
  line_total_display: string | null;
  issue: CartItemIssue;
};

export type Cart = {
  id: number;
  items: CartItem[];
  item_count: number;
  subtotal_amount: number;
  subtotal_display: string | null;
  requires_shipping: boolean;
  has_blocking_issue: boolean;
};

export type CheckoutPreviewItem = {
  cart_item_id: number;
  product_id: number;
  title: string;
  quantity: number;
  unit_price_amount: number;
  line_total_amount: number;
  issue: CartItemIssue;
};

export type CheckoutPreview = {
  items: CheckoutPreviewItem[];
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  requires_shipping: boolean;
  can_checkout: boolean;
};

export type ShippingMethod = {
  id: number;
  title: string;
  description: string | null;
  price_amount: number;
  price_display: string | null;
  is_default: boolean;
};

export type Address = {
  id: number;
  recipient_full_name: string;
  phone: string;
  province: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  is_default: boolean;
  created_at: string;
};

export type OrderItem = {
  id: number;
  product: number | null;
  product_slug: string | null;
  product_type_snapshot: ProductType;
  title_snapshot: string;
  sku_snapshot: string | null;
  unit_price_amount_snapshot: number;
  unit_price_display: string | null;
  quantity: number;
  line_total_amount: number;
  line_total_display: string | null;
};

export type LatestPaymentAttempt = {
  id: number;
  provider: string;
  status: string;
  created_at: string;
};

export type OrderListItem = {
  order_number: string;
  status: OrderStatus;
  status_display: string;
  total_amount: number;
  total_display: string | null;
  requires_shipping: boolean;
  item_count: number;
  can_retry_payment: boolean;
  created_at: string;
  paid_at: string | null;
};

export type OrderDetail = OrderListItem & {
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  shipping_recipient_name: string | null;
  shipping_phone: string | null;
  shipping_province: string | null;
  shipping_city: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_postal_code: string | null;
  customer_note: string | null;
  items: OrderItem[];
  latest_payment_attempt: LatestPaymentAttempt | null;
};

export type MyCourseEnrollment = {
  id: number;
  product_title: string;
  product_slug: string;
  product_type: ProductType;
  status: "active" | "completed" | "cancelled" | "revoked";
  is_confirmed: boolean;
  access_url: string | null;
  access_notes: string | null;
  access_expires_at: string | null;
  granted_at: string;
};

export type PaymentStartResponse = {
  attempt_id: number;
  provider: string;
  redirect_url: string;
};

export type PaymentCallbackResponse = {
  outcome: "success" | "failed" | "amount_mismatch" | "duplicate" | "attempt_not_found";
  order_number: string | null;
  order_status: OrderStatus | null;
};

export type CustomerRegisterPayload = {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirm: string;
};

// --- CMS (admin / media manager) -------------------------------------

export type CMSPhysicalDetail = {
  sku: string;
  inventory_qty: number;
  low_stock_threshold: number;
  availability: Availability;
  weight_grams: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  requires_shipping: boolean;
  max_purchase_quantity: number | null;
};

export type CMSCourseDetail = {
  instructor_name: string | null;
  course_type: string | null;
  duration_minutes: number | null;
  capacity: number | null;
  start_date: string | null;
  prerequisites: string | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  enrollment_status: EnrollmentStatus;
  access_duration_days?: number | null;
  access_destination_type?: "external_link" | "hosted_page" | "download" | "other";
  access_destination_value?: string | null;
  unit?: number | null;
  location_detail?: string | null;
  schedule_text?: string | null;
  end_date?: string | null;
  registration_deadline?: string | null;
  requires_enrollment_confirmation?: boolean;
};

export type CMSProductListItem = {
  id: number;
  product_type: ProductType;
  title: string;
  slug: string;
  category: number | null;
  category_title: string | null;
  featured_image: string | null;
  price_amount: number | null;
  sale_price_amount: number | null;
  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;
  is_important: boolean;
  published_at: string | null;
  updated_at: string;
};

export type CMSProductDetail = CMSProductListItem & {
  short_description: string | null;
  description: string | null;
  tags: string[];
  gallery_images: ProductImage[];
  physical_detail: CMSPhysicalDetail | null;
  course_detail: CMSCourseDetail | null;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  seo: ContentSeoMetadata;
};

export type CMSProductWritePayload = {
  product_type?: ProductType;
  title?: string;
  slug?: string;
  category?: number | null;
  tags?: string[];
  short_description?: string | null;
  description?: string | null;
  featured_image_url?: string;
  is_featured?: boolean;
  is_important?: boolean;
  price_amount?: number | null;
  sale_price_amount?: number | null;
  physical_detail?: Partial<CMSPhysicalDetail>;
  course_detail?: Partial<CMSCourseDetail>;
  focus_keyphrase?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  is_indexable?: boolean;
  is_followable?: boolean;
  is_cornerstone?: boolean;
};

export type CMSShopCategory = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  order: number;
};

export type CMSOrderEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CMSOrderListItem = {
  id: number;
  order_number: string;
  user: number;
  user_display: string;
  status: OrderStatus;
  total_amount: number;
  total_display: string | null;
  requires_shipping: boolean;
  created_at: string;
  paid_at: string | null;
};

export type CMSOrderDetail = CMSOrderListItem & {
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  shipping_method: number | null;
  shipping_recipient_name: string | null;
  shipping_phone: string | null;
  shipping_province: string | null;
  shipping_city: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  customer_note: string | null;
  admin_note: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  items: OrderItem[];
};

export type CMSPaymentAttempt = {
  id: number;
  order: number;
  order_number: string;
  provider: string;
  status: string;
  amount_amount: number;
  amount_display: string | null;
  currency_code: string;
  provider_reference: string | null;
  created_at: string;
};

export type CMSCourseEnrollment = {
  id: number;
  user: number;
  user_display: string;
  product: number;
  product_title: string;
  status: "active" | "completed" | "cancelled" | "revoked";
  is_confirmed: boolean;
  access_url: string | null;
  access_notes: string | null;
  access_expires_at: string | null;
  granted_at: string;
  granted_by: number | null;
  revoked_at: string | null;
  revoked_by: number | null;
};

export type CMSShopSettings = {
  reservation_hold_minutes: number;
  low_stock_default_threshold: number;
  mock_payment_enabled: boolean;
  default_shipping_method: number | null;
  terms_url: string | null;
  refund_policy_url: string | null;
};
