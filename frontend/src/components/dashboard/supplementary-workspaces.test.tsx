import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementReportsWorkspace, ParentRegistrationWorkspace, SettingsWorkspace } from "@/components/dashboard/supplementary-workspaces";

const { panelService, requestImpl } = vi.hoisted(() => ({
  panelService: {
    updateSettings: vi.fn(),
    reports: vi.fn(),
    exportReport: vi.fn(),
    parentRegistrations: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({ panelService }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

const settings = {
  school_name: "مجتمع بعثت",
  current_academic_year_id: null,
  default_unit_id: null,
  notify_new_registration: true,
  show_published_on_home: true,
  autosave_forms: false,
  internal_messages_enabled: true,
  units: [],
  academic_years: [],
};

beforeEach(() => {
  requestImpl.mockImplementation(() => ({ loading: false, error: null, data: settings, reload: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// FE-DASH-SETTINGS-DOUBLE-SUBMIT-001: save() guarded only with state-backed
// `saving`, so two same-tick form submits both reached updateSettings.
describe("SettingsWorkspace mutation duplicate boundary", () => {
  it("collapses two same-tick form submits to one request", async () => {
    panelService.updateSettings.mockReturnValue(new Promise<unknown>(() => {}));
    render(<SettingsWorkspace />);
    const form = screen.getByRole("button", { name: "ذخیره تنظیمات" }).closest("form");
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });
    expect(panelService.updateSettings).toHaveBeenCalledTimes(1);
  });
});

const report = {
  metrics: [
    { key: "students", title: "دانش‌آموزان", value: 2, detail: null, trend: null, tone: "blue", icon: "students" },
  ],
  units: [],
};

// FE-DASH-REPORT-EXPORT-DOUBLE-SUBMIT-001: download() had no in-flight
// guard and the export button had no busy/disabled state, so two clicks
// in the same turn (or before the first request settles) issued two
// separate exportReport() calls -- each a real, costly backend export.
describe("ManagementReportsWorkspace export mutation boundary", () => {
  it("collapses two same-turn export clicks to one download request", async () => {
    requestImpl.mockImplementation(() => ({ loading: false, error: null, data: report, reload: vi.fn() }));
    panelService.exportReport.mockReturnValue(new Promise<unknown>(() => undefined));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:qa"),
      revokeObjectURL: vi.fn(),
    });

    render(<ManagementReportsWorkspace />);
    const button = screen.getByRole("button", { name: /دریافت CSV/ });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(panelService.exportReport).toHaveBeenCalledTimes(1);
  });
});

// FE-PANEL-PARENT-REGISTRATION-CONTINUATION-001: `next_action_url` is
// hardcoded to null everywhere in the backend -- no continuation-form
// endpoint or field contract exists yet, so a "ادامه تکمیل پرونده" CTA
// promised a next step that led nowhere (activating it just re-rendered
// the identical card list). Removed rather than built against a
// nonexistent backend contract; this test guards against it silently
// reappearing even if a future fixture/backend response supplies a
// next_action_url again, unless a real continuation flow is deliberately
// (re)implemented alongside it.
describe("ParentRegistrationWorkspace non-functional continuation CTA", () => {
  it("never renders a continuation link, even when next_action_url is present", async () => {
    const registration = {
      id: 1,
      child: { id: 1, full_name: "فرزند آزمون" },
      academic_year: { id: 1, title: "1404-1405" },
      status: "در حال بررسی",
      progress_percent: 50,
      next_action_url: "/dashboard/parents/registration?step=2",
      steps: [{ id: 1, title: "بارگذاری مدارک", status: "current" as const }],
    };
    requestImpl.mockImplementation(() => ({ loading: false, error: null, data: [registration], reload: vi.fn() }));

    render(<ParentRegistrationWorkspace />);

    expect(await screen.findByText("ثبت‌نام فرزند آزمون")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ادامه تکمیل پرونده" })).not.toBeInTheDocument();
  });
});
