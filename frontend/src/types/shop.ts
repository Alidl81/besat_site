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
