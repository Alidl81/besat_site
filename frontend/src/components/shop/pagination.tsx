import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 1,
  );

  return (
    <nav aria-label="صفحه‌بندی محصولات" className="mt-8 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="صفحه قبل"
        className="flex size-10 items-center justify-center rounded-xl border border-[#e5e7eb] text-[#0a2848] transition hover:bg-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30"
      >
        {/* RTL: "previous" moves right visually */}
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>

      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        const showEllipsis = previous !== undefined && candidate - previous > 1;
        return (
          <span key={candidate} className="flex items-center gap-1.5">
            {showEllipsis ? <span className="px-1 text-sm font-bold text-[#0a2848]/40">…</span> : null}
            <button
              type="button"
              onClick={() => onPageChange(candidate)}
              aria-current={candidate === page ? "page" : undefined}
              className={`flex size-10 items-center justify-center rounded-xl text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30 ${
                candidate === page
                  ? "bg-[#0a2848] text-white"
                  : "border border-[#e5e7eb] text-[#0a2848] hover:bg-[#f4f1ea]"
              }`}
            >
              {new Intl.NumberFormat("fa-IR").format(candidate)}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="صفحه بعد"
        className="flex size-10 items-center justify-center rounded-xl border border-[#e5e7eb] text-[#0a2848] transition hover:bg-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c98c3d]/30"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
    </nav>
  );
}
