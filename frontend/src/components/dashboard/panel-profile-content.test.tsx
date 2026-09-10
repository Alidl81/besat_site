import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelProfileContent } from "@/components/dashboard/panel-profile-content";

const { profileService } = vi.hoisted(() => ({
  profileService: {
    loadProfile: vi.fn(),
    saveProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("@/lib/profile/profile-service", () => profileService);

const profile = {
  id: "u-1",
  username: "qa-parent",
  full_name: "کاربر آزمون",
  email: "qa@example.test",
  phone: "09120000000",
  description: "",
  avatar: null,
  role: "parent",
  role_display: "والد",
};

beforeEach(() => {
  profileService.loadProfile.mockResolvedValue(profile);
  profileService.saveProfile.mockReturnValue(new Promise<never>(() => undefined));
  profileService.changePassword.mockReturnValue(new Promise<never>(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-AUTH-PROFILE-UPDATE-DOUBLE-SUBMIT-001 + AUTH-UI-PASSWORD-CHANGE-DOUBLE-SUBMIT-001:
// both submit handlers were guarded only with state-backed `isSaving`/
// `isChangingPassword`, so two same-tick submits both reached the mutation.
describe("profile mutation duplicate boundary", () => {
  it("collapses two same-tick profile saves to one request", async () => {
    render(<PanelProfileContent roleTitle="والد" />);
    const form = screen.getByRole("button", { name: "ذخیره تغییرات" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(profileService.saveProfile).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick password changes to one request", async () => {
    render(<PanelProfileContent roleTitle="والد" />);
    const passwordForm = screen.getByRole("button", { name: "به‌روزرسانی رمز عبور" }).closest("form");
    expect(passwordForm).not.toBeNull();
    const inputs = passwordForm!.querySelectorAll("input[type=password]");
    expect(inputs).toHaveLength(3);
    fireEvent.change(inputs[0], { target: { value: "old-password" } });
    fireEvent.change(inputs[1], { target: { value: "new-password" } });
    fireEvent.change(inputs[2], { target: { value: "new-password" } });

    await act(async () => {
      fireEvent.submit(passwordForm!);
      fireEvent.submit(passwordForm!);
      await Promise.resolve();
    });

    expect(profileService.changePassword).toHaveBeenCalledTimes(1);
  });
});

// FE-A11Y-PROFILE-SAVE-FEEDBACK-001: the profile-save feedback paragraph had
// no role/live-region semantics (unlike the sibling password-change message,
// which already used role="status"/"alert"), so assistive technology never
// announced an async save's outcome.
describe("profile save feedback live region", () => {
  it("announces a successful save as a polite status region", async () => {
    profileService.saveProfile.mockResolvedValue({ ok: true, message: "تغییرات ذخیره شد." });
    render(<PanelProfileContent roleTitle="والد" />);
    const form = screen.getByRole("button", { name: "ذخیره تغییرات" }).closest("form");

    await act(async () => {
      fireEvent.submit(form!);
    });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("تغییرات ذخیره شد.");
  });

  it("announces a failed save as an assertive alert region", async () => {
    profileService.saveProfile.mockResolvedValue({ ok: false, message: "ذخیره تغییرات ناموفق بود." });
    render(<PanelProfileContent roleTitle="والد" />);
    const form = screen.getByRole("button", { name: "ذخیره تغییرات" }).closest("form");

    await act(async () => {
      fireEvent.submit(form!);
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ذخیره تغییرات ناموفق بود.");
  });
});

// FE-PUBLIC-MEDIA-ORIGIN-001 (dashboard sink): profile.avatar is a backend-
// served media URL, subject to the same possibly wrong-host origin issue
// already fixed for every other media sink -- rendering it raw tripped
// CSP's img-src allowlist (this app's own origin only).
describe("profile avatar media-origin normalization", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("normalizes a wrong-host avatar URL to this app's own origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    // FE-PUBLIC-MEDIA-ORIGIN-001 (reopened): safe-url.ts's effectiveSiteUrl()
    // now prefers window.location.origin over NEXT_PUBLIC_SITE_URL whenever
    // a window exists -- jsdom always provides one, so this test's
    // simulated "viewing from besat.example.com" needs it stubbed to match.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, origin: "https://besat.example.com" },
    });
    profileService.loadProfile.mockResolvedValue({
      ...profile,
      avatar: "http://localhost:3000/media/avatars/qa-parent.jpg",
    });

    render(<PanelProfileContent roleTitle="والد" />);

    const avatar = await waitFor(() => screen.getByAltText("تصویر پروفایل") as HTMLImageElement);
    expect(avatar.src).toBe("https://besat.example.com/media/avatars/qa-parent.jpg");
  });
});
