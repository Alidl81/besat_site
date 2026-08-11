export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white motion-reduce:animate-none">
      <div className="aspect-[4/3] w-full bg-[#f0ede5]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 rounded-full bg-[#f0ede5]" />
        <div className="h-3 w-1/3 rounded-full bg-[#f0ede5]" />
        <div className="h-5 w-1/2 rounded-full bg-[#f0ede5]" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-label="در حال بارگذاری محصولات"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
