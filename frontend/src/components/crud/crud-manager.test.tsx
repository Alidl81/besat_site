import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrudManager } from "@/components/crud/crud-manager";
import type { Repository } from "@/lib/data/repository";

type Row = { id: string; created_at: string; updated_at: string; title: string };

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

// FE-CMS-GENERIC-DUPLICATE-MUTATION-001: this is the shared generic CRUD
// screen for users/units/registrations/gallery/departments and more --
// `handleSubmit` only guarded with state-backed `submitting`, and
// `handleDelete` had no guard at all, so two same-tick form submits or
// confirm clicks both reached the actual repository call before React's
// next render disabled anything.
describe("CrudManager duplicate-mutation guard", () => {
  it("collapses two same-tick form submissions to one repository create call", async () => {
    const deferred = createDeferred<Row>();
    const create = vi.fn(() => deferred.promise);
    const repository: Repository<Row> = {
      list: vi.fn(async () => [{ id: "1", created_at: "now", updated_at: "now", title: "ردیف" }]),
      get: vi.fn(),
      create,
      update: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={({ onSubmit }) => (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit({ title: "تازه" });
            }}
          >
            <button type="submit">ذخیره</button>
          </form>
        )}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "افزودن" }));
    const dialog = screen.getByRole("dialog");
    const form = within(dialog).getByRole("button", { name: "ذخیره" }).closest("form");
    expect(form).not.toBeNull();

    await act(async () => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
      await Promise.resolve();
    });

    expect(create).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ id: "1", created_at: "now", updated_at: "now", title: "تازه" });
      await deferred.promise;
    });
  });

  it("collapses two same-tick destructive confirmations to one repository remove call", async () => {
    const deferred = createDeferred<void>();
    const remove = vi.fn(() => deferred.promise);
    const repository: Repository<Row> = {
      list: vi.fn(async () => [{ id: "1", created_at: "now", updated_at: "now", title: "ردیف" }]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove,
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={() => null}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("button", { name: "حذف" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "حذف" })[0]);
    const confirm = screen.getByRole("dialog");
    const confirmButton = within(confirm).getByRole("button", { name: "حذف" });

    await act(async () => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      await Promise.resolve();
    });

    expect(remove).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });
});

// FE-A11Y-ADMIN-USERS-ACTION-NAMES-001: every row's Edit/Delete buttons only
// ever rendered the identical generic "ویرایش"/"حذف" text with no
// aria-label, so a screen reader user tabbing through several rows heard
// the same name repeated with no way to tell which record each button
// targets. `rowLabel` lets a consumer supply a per-row distinguishing name.
describe("CrudManager row action accessible names", () => {
  it("gives each row's Edit/Delete buttons a distinct accessible name when rowLabel is provided", async () => {
    const repository: Repository<Row> = {
      list: vi.fn(async () => [
        { id: "1", created_at: "now", updated_at: "now", title: "ردیف اول" },
        { id: "2", created_at: "now", updated_at: "now", title: "ردیف دوم" },
      ]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={() => null}
        rowLabel={(item: Row) => item.title}
      />,
    );

    // Each data row renders twice (desktop table + mobile card layout), so
    // each distinct accessible name resolves to 2 buttons, not 1.
    expect(await screen.findAllByRole("button", { name: "ویرایش ردیف اول" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "حذف ردیف اول" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "ویرایش ردیف دوم" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "حذف ردیف دوم" })).toHaveLength(2);
  });

  it("falls back to the plain generic label when rowLabel is not provided", async () => {
    const repository: Repository<Row> = {
      list: vi.fn(async () => [{ id: "1", created_at: "now", updated_at: "now", title: "ردیف" }]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={() => null}
      />,
    );

    expect(await screen.findAllByRole("button", { name: "ویرایش" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "حذف" })).toHaveLength(2);
  });
});

// FE-PANEL-CRUD-ERROR-RETRY-A11Y-001: a failed initial collection load
// rendered a plain, non-live-region div with no retry action, even though
// useCollection already returns `reload` -- registration-workspace.tsx's
// own PanelError usage was the working reference implementation.
describe("CrudManager collection error retry", () => {
  it("exposes a live-region alert with a retry action that reloads the collection", async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const repository: Repository<Row> = {
      list,
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={() => null}
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("خطا در بارگذاری اطلاعات.");
    expect(list).toHaveBeenCalledTimes(1);

    list.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

// FE-PANEL-ADMIN-USERS-TABLE-ACTION-768-001: at 768px this shared table's
// operations column could sit entirely offscreen with no cue or affordance
// that scrolling reveals it. This table structure is the meaningful
// assertion here; jsdom doesn't apply this app's compiled Tailwind CSS, so
// the actual sticky computed-position behavior was verified directly in
// real Chromium (see FIXES.md), matching the same pattern already
// established for the shop admin managers' tables.
describe("CrudManager table action column stickiness", () => {
  it("marks the actions header and each row's actions cell as sticky", async () => {
    const repository: Repository<Row> = {
      list: vi.fn(async () => [{ id: "1", created_at: "now", updated_at: "now", title: "ردیف" }]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    render(
      <CrudManager
        title="مدیریت آزمون"
        addLabel="افزودن"
        emptyText="خالی"
        repository={repository}
        columns={[{ key: "title", header: "عنوان", render: (item: Row) => item.title }]}
        renderForm={() => null}
      />,
    );

    // The desktop table renders alongside a mobile card layout (each row
    // appears twice) -- find the button inside an actual <td>, not the card.
    const editButtons = await screen.findAllByRole("button", { name: "ویرایش" });
    const editButton = editButtons.find((button) => button.closest("td"));
    expect(editButton).not.toBeUndefined();
    const actionsCell = editButton!.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell).toHaveClass("panel-table-action-sticky");

    const headerRow = actionsCell!.closest("table")!.querySelector("thead tr")!;
    expect(headerRow.lastElementChild).toHaveClass("panel-table-action-sticky");
  });
});
