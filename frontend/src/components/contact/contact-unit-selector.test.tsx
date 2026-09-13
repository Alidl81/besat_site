import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactUnitSelector } from "@/components/contact/contact-unit-selector";
import type { PublicSchoolUnit } from "@/types/public-content";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
});

function makeUnit(overrides: Partial<PublicSchoolUnit>): PublicSchoolUnit {
  return {
    id: 1,
    title: "واحد ۱ و ۲",
    slug: "unit-1-2",
    kind: "elementary",
    gender: "boys",
    subtitle: null,
    description: null,
    cover_image: null,
    icon: null,
    age_range: null,
    grade_range: null,
    address: null,
    phone: null,
    phone_secondary: null,
    email: null,
    office_hours: null,
    map_url: null,
    latitude: null,
    longitude: null,
    accepts_registration: true,
    ...overrides,
  };
}

const units = [
  makeUnit({
    address: "مشهد، نبش آزادی ۷",
    phone: "36012090",
  }),
  makeUnit({
    id: 3,
    title: "واحد ۳",
    slug: "unit-3",
    description: "شماره تماس قدیمی ۰۵۱۳۸۶۸۱۹۹۹ نباید به‌عنوان داده تماس نمایش داده شود.",
    gender: "girls",
  }),
  makeUnit({
    id: 6,
    title: "واحد ۶",
    slug: "unit-6",
    address: "مشهد، معلم ۶۹",
    phone: "38681999",
  }),
  makeUnit({
    id: 13,
    title: "واحد ۱۳",
    slug: "unit-13",
    address: "مشهد، خیابان صدف",
    phone: "35019059",
  }),
  {
    ...makeUnit({ id: 999, title: "واحد توسعه داخلی", slug: "dev-accounts-unit" }),
    is_internal: true,
  },
] as PublicSchoolUnit[];

describe("ContactUnitSelector", () => {
  it("shows one selected public unit and truthful missing structured contact data", async () => {
    render(<ContactUnitSelector units={units} />);

    expect(screen.getByRole("tab", { name: /واحد ۱ و ۲/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("مشهد، نبش آزادی ۷")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تماس با واحد ۱ و ۲" })).toHaveAttribute("href", "tel:36012090");
    expect(screen.queryByText("واحد توسعه داخلی")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /واحد ۳/ }));
    await waitFor(() => expect(screen.getByText("اطلاعات تماس این واحد هنوز ثبت نشده است.")).toBeInTheDocument());
    expect(screen.queryByText(/شماره تماس قدیمی/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "تماس با واحد ۳" })).not.toBeInTheDocument();
  });

  it("supports arrows and unit detail links without duplicating records", async () => {
    render(<ContactUnitSelector units={units} />);
    const tablist = screen.getByRole("tablist", { name: "انتخاب واحد آموزشی برای تماس مستقیم" });

    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /واحد ۳/ })).toHaveAttribute("aria-selected", "true"));

    fireEvent.click(screen.getByRole("button", { name: "واحد بعدی" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /واحد ۶/ })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("link", { name: "مشاهده واحد" })).toHaveAttribute("href", "/units?unit=unit-6");

    fireEvent.click(screen.getByRole("button", { name: "واحد قبلی" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /واحد ۳/ })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("uses the Home slider swipe threshold without swallowing a real Unit link click", async () => {
    render(<ContactUnitSelector units={units} />);
    const tablist = screen.getByRole("tablist", { name: "انتخاب واحد آموزشی برای تماس مستقیم" });

    fireEvent.pointerDown(tablist, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 220 });
    fireEvent.pointerMove(tablist, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(tablist, { pointerId: 1, clientX: 150 });
    await waitFor(() => expect(screen.getByRole("tab", { name: /واحد ۳/ })).toHaveAttribute("aria-selected", "true"));

    fireEvent.click(screen.getByRole("link", { name: "مشاهده واحد" }));
    expect(screen.getByRole("link", { name: "مشاهده واحد" })).toHaveAttribute("href", "/units?unit=unit-3");
  });

  it("keeps negligible pointer movement as a click for keyboard and pointer users", () => {
    render(<ContactUnitSelector units={units} />);
    const tablist = screen.getByRole("tablist", { name: "انتخاب واحد آموزشی برای تماس مستقیم" });
    const neighbor = screen.getByRole("tab", { name: /واحد ۳/ });

    fireEvent.pointerDown(tablist, { pointerId: 2, pointerType: "mouse", button: 0, clientX: 220 });
    fireEvent.pointerMove(tablist, { pointerId: 2, clientX: 225 });
    fireEvent.pointerUp(tablist, { pointerId: 2, clientX: 225 });
    fireEvent.click(neighbor);

    return waitFor(() => expect(screen.getByRole("tab", { name: /واحد ۳/ })).toHaveAttribute("aria-selected", "true"));
  });
});
