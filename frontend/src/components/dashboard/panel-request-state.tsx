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
  return (
    <div className="panel-card flex min-h-48 flex-col items-center justify-center text-center" role="alert">
      <PanelIcon name="warning" className="size-8 text-rose-500" />
      <p className="mt-3 max-w-xl text-sm font-black leading-7 text-rose-700">{message}</p>
      <button type="button" onClick={onRetry} className="panel-secondary-button mt-4">
        تلاش دوباره
      </button>
    </div>
  );
}

export function PanelEmpty({
  title = "اطلاعاتی ثبت نشده است.",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="panel-empty-state py-12" role="status">
      <PanelIcon name="document" className="mx-auto mb-3 size-8 text-slate-300" />
      <p className="font-black text-slate-600">{title}</p>
      {detail ? <p className="mt-2 text-xs font-bold text-slate-400">{detail}</p> : null}
    </div>
  );
}
