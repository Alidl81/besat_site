import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAchievementMock } = vi.hoisted(() => ({
  getAchievementMock: vi.fn(),
}));

vi.mock("@/services/public-content-service", () => ({
  getPublicAchievement: getAchievementMock,
}));

const achievement = {
  id: 1,
  slug: "achievement-a",
  title: "افتخار آزمایشی",
  description: "توضیح افتخار",
  summary: null,
  cover_image: null,
  image: null,
  achievement_date: null,
  related_unit: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

// FE-ACHIEVEMENT-DETAIL-RETRY-STALE-ERROR-001: a successful retry left the
// prior failure's `error` state set, and the error branch was checked before
// the item branch -- so a fully-loaded detail stayed hidden behind the old
// error message and retry button forever.
describe("AchievementDetail retry-clears-stale-error", () => {
  it("shows an alert with a retry button on failure, and renders the real detail after a successful retry", async () => {
    getAchievementMock.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(achievement);

    const { AchievementDetail } = await import("@/components/achievements/achievement-detail");
    render(<AchievementDetail slug="achievement-a" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("دریافت افتخار با خطا روبه‌رو شد.");

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: achievement.title })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the detail directly when the fetch succeeds on the first try", async () => {
    getAchievementMock.mockResolvedValue(achievement);

    const { AchievementDetail } = await import("@/components/achievements/achievement-detail");
    render(<AchievementDetail slug="achievement-a" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: achievement.title })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
