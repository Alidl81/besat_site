import Link from "next/link";
import type { ReactNode } from "react";

type AppLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function AppLink({ href, children, variant = "primary" }: AppLinkProps) {
  const baseClass =
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition";

  const variantClass =
    variant === "primary"
      ? "bg-[#0f2f4a] text-white hover:bg-[#143d5f]"
      : "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50";

  return (
    <Link href={href} className={`${baseClass} ${variantClass}`}>
      {children}
    </Link>
  );
}
