import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const usePanelRequestMock = vi.fn();
const registrationMock = vi.fn();
const registrationActionMock = vi.fn();

vi.mock("@/hooks/use-panel-request", () => ({ usePanelRequest: usePanelRequestMock }));
vi.mock("@/services/panel-service", () => ({
  panelService: {
    registration: registrationMock,
    registrationAction: registrationActionMock,
  },
}));
vi.mock("@/components/dashboard/panel-icons", () => ({
  PanelIcon: () => React.createElement("span", { "aria-hidden": true }),
}));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => React.createElement("p", null, title),
  PanelError: ({ message }: { message: string }) => React.createElement("p", null, message),
  PanelLoading: ({ label }: { label: string }) => React.createElement("p", null, label),
}));

const row = {
  id: 17,
  student_full_name: "دانش‌آموز آزمایشی",
  full_name: "دانش‌آموز آزمایشی",
  parent_full_name: "ولی آزمایشی",
  parent_phone: "09120000000",
  parent_email: null,
  requested_unit: { id: 7, title: "واحد آزمایشی", slug: "unit" },
  requested_grade: "پایه اول",
  description: null,
  status: "new" as const,
  admin_note: null,
  created_at: "2026-08-28T00:00:00Z",
  updated_at: "2026-08-28T00:00:00Z",
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

async function renderWorkspace() {
  usePanelRequestMock.mockReturnValue({
    data: {
      page: { results: [row], count: 1, next: null, previous: null },
      summary: { total: 1, reviewing: 0, accepted: 0, rejected: 0, needs_documents: 0 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  });
  registrationMock.mockResolvedValue(row);
  const { RegistrationWorkspace } = await import("@/components/dashboard/registration-workspace");
  render(React.createElement(RegistrationWorkspace));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole("button", { name: /رد درخواست/ }));
}

// FE-REGISTRATION-NOTE-MODAL-A11Y-001: the rejection-note dialog rendered
// role="dialog" but had no focus trap, body scroll lock, Escape handling,
// or opener-focus restoration -- only a backdrop click and Cancel button
// could close it, and the page behind it could still scroll.
describe("RegistrationWorkspace note dialog", () => {
  it("locks background scrolling while the rejection-note dialog is open", async () => {
    await renderWorkspace();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes the rejection-note dialog on Escape", async () => {
    await renderWorkspace();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  // FE-REGISTRATION-NOTE-PENDING-ESCAPE-001: useFocusTrap's onClose
  // callback used to freeze at whatever closure was passed on the render
  // that activated the trap (the effect only re-runs on `active` changes),
  // so the inline `() => { if (!working) setNoteAction(null); }` closure
  // kept reading a stale `working === false` from before the request
  // started -- Escape could dismiss the dialog mid-submission even though
  // the Cancel button and backdrop-click handler correctly blocked it.
  it("does not close the note dialog via Escape while its action request is pending", async () => {
    const pending = createDeferred<typeof row>();
    registrationActionMock.mockReturnValue(pending.promise);
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "دلیل آزمایشی" } });

    await act(async () => {
      fireEvent.submit(dialog);
      await Promise.resolve();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(registrationActionMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      pending.resolve(row);
      await pending.promise;
    });
  });

  // FE-REGISTRATION-NOTE-DOUBLE-SUBMIT-001: runAction only guarded
  // duplicate submission with the state-backed `working` flag, which
  // doesn't take effect until React re-renders -- two same-tick submits of
  // the note form both reached the actual registrationAction call.
  it("collapses two same-tick note-form submissions to one action request", async () => {
    const pending = createDeferred<typeof row>();
    registrationActionMock.mockReturnValue(pending.promise);
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "دلیل آزمایشی" } });

    await act(async () => {
      fireEvent.submit(dialog);
      fireEvent.submit(dialog);
      await Promise.resolve();
    });

    expect(registrationActionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(row);
      await pending.promise;
    });
  });
});

// FE-PANEL-REGISTRATION-NOTE-VALIDATION-I18N-001: the note form had no
// `noValidate`, so the browser's own native constraint validation (an
// English "Please fill out this field." tooltip) intercepted a blank
// submit before this component's own Persian validation logic ever ran --
// and even once reached, that message had nowhere to render inside the
// dialog (a fixed full-viewport overlay hid the exterior banner behind
// it).
describe("RegistrationWorkspace note validation", () => {
  it("shows a localized Persian error and keeps the dialog open when the note is left blank", async () => {
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");

    expect(dialog).toHaveAttribute("novalidate");

    await act(async () => {
      fireEvent.submit(dialog);
    });

    expect(registrationActionMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("ثبت دلیل رد درخواست الزامی است.");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", alert.id);
  });

  it("clears the note validation error once the field is edited", async () => {
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");

    await act(async () => {
      fireEvent.submit(dialog);
    });
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "دلیل آزمایشی" } });

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(textarea).toHaveAttribute("aria-invalid", "false");
  });
});

// FE-PANEL-REGISTRATION-ACTION-ERROR-RETRY-001: a failed reject/request-
// documents mutation only ever set the exterior `actionError` banner, which
// renders behind the dialog's own `fixed inset-0 z-[90]` overlay -- visually
// hidden -- and left focus on <body>, so a manager had no visible feedback
// and had to guess that resubmitting the still-open form would retry.
describe("RegistrationWorkspace note action error/retry", () => {
  it("shows the failure inside the still-open dialog (not only the hidden exterior banner) and focuses the field", async () => {
    registrationActionMock.mockRejectedValueOnce(new Error("سرویس موقتاً در دسترس نیست."));
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "دلیل آزمایشی" } });

    await act(async () => {
      fireEvent.submit(dialog);
    });

    expect(screen.queryByRole("dialog")).toBeInTheDocument();
    // Exactly one alert exists at all -- the in-dialog one -- not a second,
    // visually-hidden duplicate from the exterior banner.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("سرویس موقتاً در دسترس نیست.");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", alert.id);
    expect(textarea).toHaveFocus();
  });

  // FE-PANEL-REGISTRATION-ACTION-ERROR-RETRY-001 (P2 residual, after the
  // in-dialog alert/focus fix): Codex's follow-up replay found the visible
  // alert and focus sufficient, but flagged that resubmitting the same
  // generic "ثبت" button was not itself an explicit, named retry
  // affordance -- a manager had to infer that submitting again was "retry".
  it("relabels the submit button as an explicit retry affordance after a mutation failure", async () => {
    registrationActionMock.mockRejectedValueOnce(new Error("سرویس موقتاً در دسترس نیست."));
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "دلیل آزمایشی" } });

    expect(within(dialog).getByRole("button", { name: "ثبت" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(dialog);
    });

    expect(within(dialog).queryByRole("button", { name: "ثبت" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
  });

  it("relabels the submit button back to its original label once the note is edited after a failure", async () => {
    registrationActionMock.mockRejectedValueOnce(new Error("سرویس موقتاً در دسترس نیست."));
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "دلیل آزمایشی" } });

    await act(async () => {
      fireEvent.submit(dialog);
    });
    expect(within(dialog).getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "دلیل ویرایش‌شده" } });

    expect(within(dialog).getByRole("button", { name: "ثبت" })).toBeInTheDocument();
  });

  it("retries with a single request when resubmitting after a failure, and clears the error", async () => {
    registrationActionMock.mockRejectedValueOnce(new Error("سرویس موقتاً در دسترس نیست."));
    registrationActionMock.mockResolvedValueOnce({ ...row, status: "rejected" as const });
    await renderWorkspace();
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "دلیل آزمایشی" } });

    await act(async () => {
      fireEvent.submit(dialog);
    });
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();

    await act(async () => {
      fireEvent.submit(dialog);
    });

    expect(registrationActionMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
