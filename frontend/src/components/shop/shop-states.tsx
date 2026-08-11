import { PackageSearch, RefreshCw, TriangleAlert } from "lucide-react";

export function ShopEmptyState({
  title = "محصولی پیدا نشد",
  description = "فیلترها را تغییر دهید یا جست‌وجوی دیگری را امتحان کنید.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d8dbe0] bg-[#fbfaf7] px-6 py-16 text-center">
      <PackageSearch aria-hidden="true" className="size-10 text-[#0a2848]/30" />
      <p className="text-base font-black text-[#0a2848]">{title}</p>
      <p className="max-w-sm text-sm font-bold leading-7 text-[#0a2848]/60">{description}</p>
    </div>
  );
}

export function ShopErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-16 text-center"
    >
      <TriangleAlert aria-hidden="true" className="size-10 text-rose-500" />
      <p className="text-base font-black text-rose-700">مشکلی در بارگذاری اطلاعات پیش آمد</p>
      <p className="max-w-sm text-sm font-bold leading-7 text-rose-600/80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        تلاش دوباره
      </button>
    </div>
  );
}
