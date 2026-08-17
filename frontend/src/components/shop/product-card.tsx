import Link from "next/link";
import { BookOpen, GraduationCap, MapPin, PackageX } from "lucide-react";
import { formatPrice } from "@/lib/shop/money";
import type { ProductListItem } from "@/types/shop";

function TypeBadge({ type }: { type: ProductListItem["product_type"] }) {
  const config = {
    physical: { label: "کتاب و کالا", icon: BookOpen, tone: "border-[#c98c3d] text-[#8a5c1f]" },
    online_course: { label: "دوره آنلاین", icon: GraduationCap, tone: "border-[#0a2848] text-[#0a2848]" },
    in_person_course: { label: "دوره حضوری", icon: MapPin, tone: "border-[#0a2848] text-[#0a2848]" },
  }[type];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex -rotate-1 items-center gap-1.5 rounded-full border-[1.5px] bg-white/95 px-3 py-1 text-[11px] font-black shadow-[0_1px_2px_rgba(15,37,58,.12)] ${config.tone}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {config.label}
    </span>
  );
}

function AvailabilityNote({ product }: { product: ProductListItem }) {
  if (product.product_type === "physical" && product.physical_detail) {
    const { availability } = product.physical_detail;
    if (availability === "out_of_stock" || availability === "discontinued") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
          <PackageX aria-hidden="true" className="size-3.5" />
          ناموجود
        </span>
      );
    }
    if (availability === "low_stock") {
      return <span className="text-xs font-bold text-amber-600">موجودی محدود</span>;
    }
    return null;
  }

  if (product.course_detail) {
    const { start_date, seats_left, enrollment_status } = product.course_detail;
    if (enrollment_status === "full") {
      return <span className="text-xs font-bold text-rose-600">ظرفیت تکمیل</span>;
    }
    if (seats_left !== null && seats_left <= 5) {
      return <span className="text-xs font-bold text-amber-600">{seats_left} صندلی باقی‌مانده</span>;
    }
    if (start_date) {
      return (
        <span className="text-xs font-bold text-[#0a2848]/70">
          شروع: {new Intl.DateTimeFormat("fa-IR").format(new Date(start_date))}
        </span>
      );
    }
  }

  return null;
}

export function ProductCard({ product }: { product: ProductListItem }) {
  const isUnavailable =
    (product.product_type === "physical" &&
      (product.physical_detail?.availability === "out_of_stock" ||
        product.physical_detail?.availability === "discontinued")) ||
    (product.course_detail?.enrollment_status === "full" && product.product_type !== "physical");

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="besat-shop-card group flex flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(15,37,58,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,37,58,.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30 motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4f1ea]">
        {product.featured_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.featured_image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[#0a2848]/25">
            <BookOpen aria-hidden="true" className="size-10" />
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-wrap gap-1.5">
          <TypeBadge type={product.product_type} />
          {product.is_on_sale ? (
            <span className="inline-flex items-center rounded-full bg-[#c98c3d] px-3 py-1 text-[11px] font-black text-white shadow-sm">
              تخفیف‌دار
            </span>
          ) : null}
        </div>
        {isUnavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a2848]/45">
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-black text-[#0a2848]">
              فعلاً موجود نیست
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-black leading-7 text-[#0a2848]">{product.title}</h3>
        {product.category ? (
          <span className="text-xs font-bold text-[#0a2848]/55">{product.category.title}</span>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            {product.is_on_sale ? (
              <span className="text-xs font-bold tabular-nums text-[#0a2848]/45 line-through">
                {formatPrice(product.price_amount)}
              </span>
            ) : null}
            <span className="text-base font-black tabular-nums text-[#0a2848]">
              {formatPrice(product.is_on_sale ? product.sale_price_amount : product.price_amount)}
            </span>
          </div>
          <AvailabilityNote product={product} />
        </div>
      </div>
    </Link>
  );
}
