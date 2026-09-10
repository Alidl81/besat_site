import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventsCalendar } from "@/components/dashboard/events-calendar";

const { calendarEventAction, removeCalendarEvent, requestImpl } = vi.hoisted(() => ({
  calendarEventAction: vi.fn(),
  removeCalendarEvent: vi.fn(),
  requestImpl: vi.fn(),
}));

vi.mock("@/lib/auth/auth-session", () => ({
  readBesatSession: () => ({ role: "general_manager", unitId: null, username: "qa" }),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: {
    calendarEventAction,
    removeCalendarEvent,
    context: vi.fn(),
    calendarEvents: vi.fn(),
  },
}));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown) => requestImpl(loader),
}));

const event = {
  id: 41,
  title: "رویداد آزمون",
  slug: "qa-event",
  summary: "خلاصه",
  description: "توضیحات",
  cover_image: null,
  alt_text: null,
  location: "سالن",
  event_start_at: new Date().toISOString(),
  event_end_at: null,
  registration_url: null,
  published_at: null,
  scope: "school" as const,
  unit_id: null,
  unit: null,
  is_featured: false,
  is_active: true,
  order: 0,
  status: "draft" as const,
  review_note: null,
};

const requestData = Object.assign([event], { units: [] });

beforeEach(() => {
  requestImpl.mockImplementation(() => ({
    loading: false,
    error: null,
    data: requestData,
    reload: vi.fn(),
    setData: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-DASH-EVENT-ACTION-DOUBLE-SUBMIT-001 + FE-DASH-EVENT-DELETE-DOUBLE-SUBMIT-001:
// handleAction/handleDelete had no synchronous in-flight guard, so two
// same-tick clicks both reached the mutation call.
describe("EventsCalendar mutation duplicate boundary", () => {
  it("collapses two same-tick workflow action clicks to one request", async () => {
    const pending = new Promise<unknown>(() => {});
    calendarEventAction.mockReturnValue(pending);
    render(<EventsCalendar />);
    const action = screen.getByRole("button", { name: "ارسال برای بررسی" });
    await act(async () => {
      fireEvent.click(action);
      fireEvent.click(action);
      await Promise.resolve();
    });
    expect(calendarEventAction).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick destructive delete confirmations to one request", async () => {
    const pending = new Promise<unknown>(() => {});
    removeCalendarEvent.mockReturnValue(pending);
    render(<EventsCalendar />);
    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    const confirm = screen.getByRole("dialog");
    const button = within(confirm).getByRole("button", { name: "حذف" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(removeCalendarEvent).toHaveBeenCalledTimes(1);
  });
});
