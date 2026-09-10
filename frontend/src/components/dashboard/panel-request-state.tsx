import { useState } from "react";
import { PanelIcon } from "@/components/dashboard/panel-icons";

export function PanelLoading({ label = "در حال دریافت اطلاعات از بک‌اند..." }) {
  return (
    <div className="panel-card flex min-h-48 items-center justify-center" role="status">
      <span className="flex items-center gap-3 text-sm font-black text-slate-500">
        <i className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#d98a12]" />
        {label}
      </span>
    </div>
  );
}

export function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  // FE-PANEL-RETRY-DOUBLE-SUBMIT-001 (residual): usePanelRequest's own
  // reload() guard already collapses two same-tick calls, but a real
  // browser can dispatch a second, genuinely later click on this same
  // button before the parent's `loading` state has re-rendered this
  // component away -- disabling the button itself the instant it's
  // clicked closes that residual without requiring every ~20 PanelError
  // consumer to thread a loading flag through onRetry.
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="panel-card flex min-h-48 flex-col items-center justify-center text-center" role="alert">
      <PanelIcon name="warning" className="size-8 text-rose-500" />
      <p className="mt-3 max-w-xl text-sm font-black leading-7 text-rose-700">{message}</p>
      <button
        type="button"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          onRetry();
        }}
        className="panel-secondary-button mt-4"
      >
        تلاش دوباره
      </button>
    </div>
  );
}

export function PanelEmpty({
  title = "اطلاعاتی ثبت نشده است.",
  detail,
  compact = false,
}: {
  title?: string;
  detail?: string;
  /**
   * FE-PANEL-ADMIN-OVERVIEW-EMPTY-DENSITY-001: the default 192px
   * .panel-empty-state (sized for a standalone empty page/section) reads
   * fine alone, but a dashboard overview with 2-3 empty feed cards stacked
   * repeats that same tall blank canvas 2-3 times, dominating the no-data
   * overview and pushing populated content (e.g. unit cards) below the
   * fold. `compact` swaps to a shorter variant sized for that specific
   * feed-card context, without changing every other PanelEmpty consumer.
   */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "panel-empty-state-compact" : "panel-empty-state py-12"} role="status">
      <PanelIcon
        name="document"
        className={compact ? "mx-auto mb-2 size-6 text-slate-300" : "mx-auto mb-3 size-8 text-slate-300"}
      />
      <p className={compact ? "text-xs font-black text-slate-600" : "font-black text-slate-600"}>{title}</p>
      {detail ? <p className="mt-2 text-xs font-bold text-slate-500">{detail}</p> : null}
    </div>
  );
}
