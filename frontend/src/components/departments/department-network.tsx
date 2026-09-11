import type { ReactNode } from "react";

export type DepartmentNetworkItem = {
  id: string;
  title: string;
  slug?: string;
};

type DepartmentNetworkProps = {
  items: DepartmentNetworkItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  centerLabel?: string;
  centerDescription?: string;
  className?: string;
};

const fiveNodeSlots = [
  "col-start-1 row-start-1",
  "col-start-2 row-start-1",
  "col-start-3 row-start-1",
  "col-start-1 row-start-2",
  "col-start-3 row-start-2",
];

const sixNodeSlots = [
  "col-start-1 row-start-1",
  "col-start-3 row-start-1",
  "col-start-1 row-start-2",
  "col-start-3 row-start-2",
  "col-start-1 row-start-3",
  "col-start-3 row-start-3",
];

function getDesktopSlots(itemCount: number) {
  if (itemCount === 6) return sixNodeSlots;
  if (itemCount >= 7) {
    return [...sixNodeSlots, "col-start-2 row-start-1", "col-start-2 row-start-3"];
  }
  return fiveNodeSlots;
}

function NodeSurface({
  children,
  active,
  interactive,
  onClick,
  ariaPressed,
  title,
}: {
  children: ReactNode;
  active: boolean;
  interactive: boolean;
  onClick?: () => void;
  ariaPressed?: boolean;
  title: string;
}) {
  const className = `group flex min-h-14 w-full min-w-0 items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-black leading-7 transition duration-300 motion-reduce:transition-none ${
    active
      ? "border-[#c88d3c] bg-[#fff8ed] text-[#774a12] shadow-[0_12px_28px_rgba(201,140,61,0.16)]"
      : "border-[#dbe3e9] bg-white text-[#0a2848] shadow-[0_8px_22px_rgba(8,30,55,0.06)] hover:-translate-y-0.5 hover:border-[#d9aa62] hover:bg-[#fffaf2]"
  }`;

  if (!interactive) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-pressed={ariaPressed}
      className={className}
    >
      {children}
    </button>
  );
}

export function DepartmentNetwork({
  items,
  activeId,
  onSelect,
  centerLabel = "مجموعه بعثت",
  centerDescription = "یک مسیر، چندین حوزه رشد",
  className = "",
}: DepartmentNetworkProps) {
  if (!items.length) return null;

  const interactive = Boolean(onSelect);
  const desktopSlots = getDesktopSlots(items.length);
  const desktopItems = items.slice(0, desktopSlots.length);
  const overflowItems = items.slice(desktopSlots.length);

  return (
    <div dir="rtl" className={`relative mx-auto w-full max-w-[56rem] ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[12%_7%] hidden rounded-[42%] border border-dashed border-[#d6a052]/35 lg:block"
      />

      <div className="relative hidden min-h-[25rem] grid-cols-3 grid-rows-3 gap-x-5 gap-y-5 lg:grid">
        {desktopItems.map((item, index) => (
          <div key={item.id} className={`flex items-center justify-center ${desktopSlots[index]}`}>
            <NodeSurface
              title={item.title}
              active={item.id === activeId}
              interactive={interactive}
              onClick={() => onSelect?.(item.id)}
              ariaPressed={item.id === activeId}
            >
              <span className="max-w-[12rem] break-words">{item.title}</span>
            </NodeSurface>
          </div>
        ))}

        <div className="col-start-3 row-start-2 flex items-center justify-center">
          <div className="flex min-h-24 w-36 flex-col items-center justify-center rounded-[1.5rem] border border-[#e2ae5b]/70 bg-[#0a2848] px-3 text-center text-white shadow-[0_18px_40px_rgba(8,30,55,0.2)]">
            <span className="text-sm font-black text-[#f1ca83]">{centerLabel}</span>
            <span className="mt-1 text-[0.68rem] font-bold leading-5 text-white/70">{centerDescription}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {items.map((item) => (
          <NodeSurface
            key={item.id}
            title={item.title}
            active={item.id === activeId}
            interactive={interactive}
            onClick={() => onSelect?.(item.id)}
            ariaPressed={item.id === activeId}
          >
            <span className="break-words">{item.title}</span>
          </NodeSurface>
        ))}
      </div>

      {overflowItems.length ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid">
          {overflowItems.map((item) => (
            <NodeSurface
              key={item.id}
              title={item.title}
              active={item.id === activeId}
              interactive={interactive}
              onClick={() => onSelect?.(item.id)}
              ariaPressed={item.id === activeId}
            >
              <span className="break-words">{item.title}</span>
            </NodeSurface>
          ))}
        </div>
      ) : null}
    </div>
  );
}
