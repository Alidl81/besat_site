import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/layout/site-footer";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicSiteSettings: vi.fn().mockResolvedValue({
    school_name: "مجتمع آموزشی بعثت",
    slogan: null,
    intro_text: null,
    phone_primary: "05138688881",
    email: "info@besat.org",
    address: "مشهد",
    telegram_url: "https://t.me/besat",
    eitaa_url: "https://eitaa.com/besat",
    instagram_url: null,
  }),
  getContactInfo: vi.fn().mockResolvedValue(null),
}));

afterEach(cleanup);

describe("SiteFooter public links", () => {
  it("keeps official social links with recognizable local icons and no legacy sites", async () => {
    render(<SiteFooter />);

    await waitFor(() => expect(screen.getByRole("link", { name: /ایتا رسمی/ })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /تلگرام رسمی/ })).toHaveAttribute("href", "https://t.me/besat");
    expect(screen.getByRole("link", { name: /ایتا رسمی/ })).toHaveAttribute("href", "https://eitaa.com/besat");
    expect(screen.getByRole("link", { name: /ایتا رسمی/ }).querySelector("img")).toHaveAttribute("src", "/icons/social/eitaa.svg");
    expect(screen.getByRole("link", { name: /تلگرام رسمی/ }).querySelector("img")).toHaveAttribute("src", "/icons/social/telegram.svg");
    expect(document.body.textContent).not.toContain("besat-r.com");
    expect(document.body.textContent).not.toContain("besat-hs.ir");
    expect(document.body.textContent).not.toContain("besatkids.com");
  });
});
