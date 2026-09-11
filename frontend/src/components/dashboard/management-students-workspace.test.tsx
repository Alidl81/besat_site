/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- image is a lightweight test double for the child avatar component. */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementStudentsWorkspace } from "@/components/dashboard/management-students-workspace";

const { panelService, requestImpl } = vi.hoisted(() => ({
  panelService: {
    students: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    importStudents: vi.fn(),
    exportStudents: vi.fn(),
  },
  requestImpl: vi.fn(),
}));

vi.mock("@/services/panel-service", () => ({ panelService }));
vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));
vi.mock("@/components/dashboard/panel-icons", () => ({ PanelIcon: () => <span aria-hidden="true" /> }));
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => <img {...props} /> }));
vi.mock("@/components/dashboard/panel-request-state", () => ({
  PanelEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  PanelError: ({ message }: { message: string }) => <p role="alert">{message}</p>,
  PanelLoading: ({ label }: { label: string }) => <p>{label}</p>,
}));
vi.mock("@/components/crud/crud-ui", async () => {
  const React = await import("react");
  return {
    Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
  };
});

const student = {
  id: 31,
  full_name: "دانش‌آموز نمونه",
  student_code: "S31",
  national_code: null,
  grade: null,
  class_room: null,
  major: null,
  profile_status: "complete",
  education_status: "active",
  enrolled_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  unit: { id: 1, title: "واحد نمونه" },
  guardian: null,
  avatar_url: null,
};

const response = {
  page: { count: 1, next: null, previous: null, results: [student] },
  summary: { total: 1, completed_profiles: 1, new_this_year: 1, incomplete_profiles: 0 },
};

beforeEach(() => {
  requestImpl.mockReturnValue({ loading: false, error: null, data: response, reload: vi.fn() });
  panelService.createStudent.mockReturnValue(new Promise<never>(() => undefined));
  panelService.updateStudent.mockReturnValue(new Promise<never>(() => undefined));
  panelService.importStudents.mockReturnValue(new Promise<never>(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-DASH-STUDENTS-CREATE-DOUBLE-SUBMIT-001 + FE-DASH-STUDENTS-IMPORT-DOUBLE-SUBMIT-001:
// saveStudent had a state-only `saving` guard and importExcel had no guard
// at all, so two same-tick submits/file-input changes both reached the
// mutation.
describe("management student mutation duplicate boundary", () => {
  it("collapses two same-tick student creates to one request", async () => {
    render(<ManagementStudentsWorkspace unitId="1" />);
    fireEvent.click(screen.getByRole("button", { name: /دانش‌آموز جدید/ }));
    const dialog = screen.getByRole("dialog", { name: "ثبت دانش‌آموز جدید" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "نام و نام خانوادگی" }), { target: { value: "دانش‌آموز تازه" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "کد دانش‌آموزی" }), { target: { value: "S32" } });
    const form = within(dialog).getByRole("button", { name: "ثبت دانش‌آموز" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(panelService.createStudent).toHaveBeenCalledTimes(1);
  });

  it("collapses two same-tick hidden Excel input changes to one import", async () => {
    render(<ManagementStudentsWorkspace unitId="1" />);
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["dummy"], "students.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    await act(async () => {
      fireEvent.change(input!, { target: { files: [file] } });
      fireEvent.change(input!, { target: { files: [file] } });
      await Promise.resolve();
    });

    expect(panelService.importStudents).toHaveBeenCalledTimes(1);
  });
});
