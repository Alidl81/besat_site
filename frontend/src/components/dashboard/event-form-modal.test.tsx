import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createEventMock } = vi.hoisted(() => ({
  createEventMock: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: {
    createCalendarEvent: createEventMock,
    updateCalendarEvent: vi.fn(),
  },
}));

import { EventFormModal } from "@/components/dashboard/event-form-modal";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// FE-DASH-EVENT-DOUBLE-SUBMIT-001: same guard/rationale as
// login-card.tsx's AUTH-UI-DOUBLE-SUBMIT-001.
describe("EventFormModal duplicate-submit guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should collapse same-turn create submits while the request is pending", async () => {
    const pending = deferred<unknown>();
    createEventMock.mockReturnValue(pending.promise);

    render(
      <EventFormModal
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        event={null}
        isGeneralManager
        fixedUnitId={null}
        units={[]}
      />,
    );

    const form = screen.getByRole("button", { name: "ثبت رویداد" }).closest("form");
    expect(form).not.toBeNull();
    const title = document.querySelector<HTMLInputElement>('input[name="title"]');
    const start = document.querySelector<HTMLInputElement>('input[name="event_start_at"]');
    expect(title).not.toBeNull();
    expect(start).not.toBeNull();
    fireEvent.change(title!, { target: { value: "رویداد تست" } });
    fireEvent.change(start!, { target: { value: "2026-09-01T09:00" } });

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
    });

    expect(createEventMock).toHaveBeenCalledTimes(1);
    pending.resolve({ id: 1 });
    await act(async () => {
      await pending.promise;
    });
  });
});
