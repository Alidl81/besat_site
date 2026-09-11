import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getContactInfo, getPublicUnits, submitContactMessage } = vi.hoisted(() => ({
  getContactInfo: vi.fn(),
  getPublicUnits: vi.fn(),
  submitContactMessage: vi.fn(),
}));

vi.mock("@/services/public-content-service", () => ({
  getContactInfo,
  getPublicUnits,
  submitContactMessage,
}));

import { ContactPageContent } from "@/components/contact/contact-page-content";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ContactPageContent", () => {
  it("shows one central contact record and the compact unit contact selector", async () => {
    getContactInfo.mockResolvedValueOnce({
      title: "تماس",
      description: null,
      address: "مشهد، نشانی رسمی بعثت",
      phone: "05138688881",
      phone_secondary: "05138681999 (داخلی 400)",
      email: "info@besat.org",
      working_hours: "مقدار ثبت‌شده نباید نمایش داده شود",
      map_url: "https://example.com/map",
      latitude: null,
      longitude: null,
    });
    getPublicUnits.mockResolvedValueOnce([
      {
        id: 1,
        title: "واحد ۱ و ۲",
        slug: "boys-preschool-elementary-1-2",
        kind: "elementary",
        gender: "boys",
        subtitle: null,
        description: null,
        cover_image: null,
        icon: null,
        age_range: null,
        grade_range: null,
        address: "مشهد، نبش آزادی ۷",
        phone: "36012090",
        phone_secondary: null,
        email: null,
        office_hours: null,
        map_url: null,
        latitude: null,
        longitude: null,
        accepts_registration: true,
      },
    ]);

    render(<ContactPageContent />);

    await waitFor(() => expect(screen.getByText("05138688881")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "05138681999 (داخلی 400)" })).toHaveAttribute("href", "tel:05138681999");
    expect(screen.getByText("info@besat.org")).toBeInTheDocument();
    expect(screen.getByText("مشهد، نشانی رسمی بعثت")).toBeInTheDocument();
    expect(screen.queryByLabelText("واحد مرتبط")).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "انتخاب واحد آموزشی برای تماس مستقیم" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /واحد ۱ و ۲/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /تماس با واحد ۱ و ۲/ })).toHaveAttribute("href", "tel:36012090");
    expect(screen.queryByText("مقدار ثبت‌شده نباید نمایش داده شود")).not.toBeInTheDocument();
    expect(screen.queryByText("مشاهده موقعیت روی نقشه")).not.toBeInTheDocument();
    expect(getPublicUnits).toHaveBeenCalledTimes(1);
    expect(submitContactMessage).not.toHaveBeenCalled();
  });
});
