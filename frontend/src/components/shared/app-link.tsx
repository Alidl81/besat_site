import Link from "next/link";
import type { ReactNode } from "react";

type AppLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function AppLink({
  href,
  children,
  variant = "primary",
  className = "",
}: AppLinkProps) {
  const variantClass =
    variant === "primary"
      ? "besat-navy-button"
      : "border border-slate-200 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black transition duration-300 ${variantClass} ${className}`}
    >
      {children}
    </Link>
  );
}
