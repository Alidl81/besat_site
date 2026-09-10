import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingPanel } from "@/components/crud/messaging-panel";

const { panelService, requestImpl } = vi.hoisted(() => ({
  panelService: {
    messages: vi.fn(),
    messageRecipients: vi.fn(),
    sendMessage: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({ panelService }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));
vi.mock("@/lib/auth/auth-session", () => ({
  readBesatSession: () => ({ username: "qa", role: "general_manager" }),
}));

const messages = { results: [], count: 0, next: null, previous: null };
const recipients = [{ id: "user-2", full_name: "کاربر دوم", role_display: "مدیر واحد" }];

beforeEach(() => {
  requestImpl.mockImplementation((loader: () => unknown) => {
    const isRecipients = loader === panelService.messageRecipients || loader.toString().includes("messageRecipients");
    return {
      loading: false,
      error: null,
      data: isRecipients ? recipients : messages,
      reload: vi.fn(),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-DASH-MESSAGE-DOUBLE-SUBMIT-001: send() guarded only with state-backed
// `saving`, so two same-tick compose submits both reached sendMessage.
describe("MessagingPanel mutation duplicate boundary", () => {
  it("collapses two same-tick compose submits to one request", async () => {
    panelService.sendMessage.mockReturnValue(new Promise<unknown>(() => {}));
    render(<MessagingPanel />);
    fireEvent.click(screen.getByRole("button", { name: "پیام جدید" }));
    const dialog = screen.getByRole("dialog", { name: "ارسال پیام" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "گیرنده" }), { target: { value: "user-2" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "موضوع" }), { target: { value: "موضوع آزمون" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "متن پیام" }), { target: { value: "متن پیام کافی برای آزمون" } });
    const form = within(dialog).getByRole("button", { name: "ارسال پیام" }).closest("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });
    expect(panelService.sendMessage).toHaveBeenCalledTimes(1);
  });
});

// FE-PANEL-MESSAGES-PAGINATION-001: the backend's StandardResultsSetPagination
// returns 10 items per page (count/next/previous), but this never sent a
// page param and never rendered any next/previous control -- any folder
// exceeding one page made every older message permanently unreachable.
describe("MessagingPanel pagination", () => {
  it("renders a next/previous control when a next page exists, and requests page 2 on click", async () => {
    const message = {
      id: 1,
      sender: { id: 1, full_name: "فرستنده", role_display: "مدیر" },
      recipient: { id: 2, full_name: "گیرنده", role_display: "مدیر" },
      subject: "موضوع",
      body: "متن",
      is_read: true,
      created_at: "2026-01-01T00:00:00Z",
    };
    const paginatedMessages = { results: [message], count: 12, next: "…?page=2", previous: null };
    let lastMessagesDeps: unknown[] = [];

    requestImpl.mockImplementation((loader: () => unknown, deps: unknown[]) => {
      const isRecipients = loader === panelService.messageRecipients || loader.toString().includes("messageRecipients");
      if (!isRecipients) lastMessagesDeps = deps;
      return {
        loading: false,
        error: null,
        data: isRecipients ? recipients : paginatedMessages,
        reload: vi.fn(),
      };
    });

    render(<MessagingPanel />);

    expect(lastMessagesDeps).toEqual(["inbox", 1]);
    const nav = screen.getByRole("navigation", { name: "صفحه‌بندی پیام‌ها" });
    expect(within(nav).getByRole("button", { name: "صفحه قبل" })).toBeDisabled();
    const nextButton = within(nav).getByRole("button", { name: "صفحه بعد" });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    expect(lastMessagesDeps).toEqual(["inbox", 2]);
  });
});
