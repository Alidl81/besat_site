import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreregistrationCard } from "@/components/auth/preregistration-card";

const { getPublicUnits, getRegistrationInfo } = vi.hoisted(() => ({
  getPublicUnits: vi.fn(),
  getRegistrationInfo: vi.fn(),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicUnits,
  getRegistrationInfo,
}));

beforeEach(() => {
  getPublicUnits.mockRejectedValue(new Error("سرویس پاسخ نداد"));
  getRegistrationInfo.mockRejectedValue(new Error("سرویس پاسخ نداد"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("registration upstream error landmark contract", () => {
  it("keeps the error branch inside the public layout's single-main contract", async () => {
    render(<PreregistrationCard />);

    expect(await screen.findByRole("heading", { name: "دریافت اطلاعات پیش‌ثبت‌نام انجام نشد" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("سرویس پاسخ نداد");
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تماس برای پیگیری زمان ثبت‌نام" })).toHaveAttribute("href", expect.stringContaining("/contact"));
    expect(screen.queryAllByRole("main")).toHaveLength(0);
  });
});
