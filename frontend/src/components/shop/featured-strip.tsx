import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/types/shop";

export function FeaturedStrip({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-base font-black text-[#0a2848]">محصولات ویژه</h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="w-[210px] shrink-0 snap-start sm:w-auto">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
