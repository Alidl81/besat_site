import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/components/auth/site-auth-actions", () => ({
  SiteAuthActions: () => <a href="/login">ورود</a>,
}));

vi.mock("@/components/shop/cart-drawer", () => ({
  CartWidget: () => <button type="button">سبد خرید</button>,
}));

vi.mock("@/lib/home/hero-visibility-context", () => ({
  useHeroVisibility: () => ({ hasVisibleHero: false }),
}));

import { SiteHeader } from "@/components/layout/site-header";

afterEach(() => cleanup());

describe("SiteHeader mobile navigation", () => {
  it("exposes Units and Departments in the first mobile menu view", async () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "باز کردن منو" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "منوی اصلی" });
    await waitFor(() => expect(dialog.parentElement).toHaveAttribute("aria-hidden", "false"));
    expect(within(dialog).getByRole("link", { name: "واحدهای آموزشی" })).toHaveAttribute("href", "/units");
    expect(within(dialog).getByRole("link", { name: "دپارتمان‌های تخصصی" })).toHaveAttribute("href", "/departments");
  });

  it("closes with Escape and returns focus to the hamburger trigger", async () => {
    render(<SiteHeader />);
    const trigger = screen.getByRole("button", { name: "باز کردن منو" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "منوی اصلی" });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "منوی اصلی" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "باز کردن منو" })).toHaveFocus();
  });
});
