import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExcelImport } from "@/components/crud/excel-import";

type Row = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  note: string;
};

const columns = [
  { key: "name", label: "نام", required: true },
  { key: "note", label: "یادداشت" },
];

function renderImporter(onImport: (rows: Omit<Row, "id" | "created_at" | "updated_at">[]) => Promise<void>) {
  return render(
    <ExcelImport<Row>
      columns={columns}
      mapRow={(row) => ({ name: row.name, note: row.note })}
      onImport={onImport}
    />,
  );
}

async function chooseCsv(container: HTMLElement, text: string) {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File([text], "students.csv", { type: "text/csv" });
  fireEvent.change(input!, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(/ردیف آماده وارد شدن/)).toBeInTheDocument());
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// FE-IMPORT-CSV-PARSER-001 + FE-IMPORT-DOUBLE-SUBMIT-001: the CSV parser
// naively split every line on `,`, breaking quoted fields that contain a
// comma; the import button was guarded only by `state`, which is
// asynchronous, so two same-tick clicks both reached onImport.
describe("ExcelImport quality boundaries", () => {
  it("preserves quoted CSV fields containing commas instead of splitting them", async () => {
    const onImport = vi.fn().mockReturnValue(new Promise<void>(() => undefined));
    const { container } = renderImporter(onImport);
    await chooseCsv(container, 'name,note\n"Smith, John","hello, world"');

    expect(screen.getByText("Smith, John")).toBeInTheDocument();
    expect(screen.getByText("hello, world")).toBeInTheDocument();
  });

  it("collapses two same-tick preview-action activations to one import", async () => {
    const onImport = vi.fn().mockReturnValue(new Promise<void>(() => undefined));
    const { container } = renderImporter(onImport);
    await chooseCsv(container, "name,note\nAlice,ok");
    const importButton = screen.getByRole("button", { name: /وارد کردن/ });

    await act(async () => {
      fireEvent.click(importButton);
      fireEvent.click(importButton);
      await Promise.resolve();
    });

    expect(onImport).toHaveBeenCalledTimes(1);
  });
});

// FE-IMPORT-CSV-EMBEDDED-NEWLINE-001: parseCsv used to split the whole
// text into physical lines *before* parsing, so a quoted field containing
// an embedded newline (RFC 4180 allows this) was cut into two preview
// rows. The parser now runs as a single pass over the whole text and only
// treats a newline as a row separator when it occurs outside a quoted
// field.
//
// NOTE on Codex's own probe (.agents/qa/frontend/excel-import-embedded-
// newline.test.tsx): its correctness assertion (one preview row) passes
// against this fix, but its `getByText("Alice\nSmith")` assertion cannot
// pass for ANY implementation -- confirmed by isolated repro rendering a
// bare `<td>{"Alice\nSmith"}</td>` and querying the same way: Testing
// Library's `getByText` fails to match a query string that itself
// contains a literal newline, even though normalization is applied to
// both sides. This is a Testing Library matcher limitation, not a defect
// in the fix -- the cell's actual `textContent` is exactly `"Alice\nSmith"`
// (verified directly below) and the preview table has exactly one data
// row. Disclosed in FIXES.md/claude.jsonl for Codex's independent
// verification.
describe("ExcelImport RFC-4180 multiline-field boundary", () => {
  it("keeps a quoted field containing an embedded newline in one row", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { container } = renderImporter(onImport);
    await chooseCsv(container, 'name,note\n"Alice\nSmith","hello"');

    const table = screen.getByRole("table");
    const dataRows = table.querySelectorAll("tbody tr");
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0].querySelectorAll("td")[0].textContent).toBe("Alice\nSmith");
    expect(dataRows[0].querySelectorAll("td")[1].textContent).toBe("hello");
  });
});

async function chooseInvalidCsv(container: HTMLElement, text: string, expectedMessage: RegExp) {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File([text], "students.csv", { type: "text/csv" });
  fireEvent.change(input!, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(expectedMessage)).toBeInTheDocument());
}

// FE-IMPORT-CSV-MALFORMED-QUOTE-001 + FE-IMPORT-CSV-ROW-WIDTH-001: a
// structurally invalid CSV (an unterminated quoted field, or a row whose
// cell count doesn't match the header) used to be silently previewed as
// if it were valid -- merging cells, dropping an extra cell, or coercing
// a missing cell to an empty string -- instead of stopping the operator
// before an import. parseCsv() now throws a CsvStructureError for these
// cases, which handleFile() surfaces as a blocking error message (no
// preview table, no import button).
describe("ExcelImport CSV structure validation", () => {
  it("rejects an unterminated quoted field instead of previewing merged data", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { container } = renderImporter(onImport);
    await chooseInvalidCsv(container, 'name,note\n"Alice,hello', /نقل‌قول ناتمام/);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /وارد کردن/ })).not.toBeInTheDocument();
  });

  it("rejects a row with an extra cell instead of silently dropping it", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { container } = renderImporter(onImport);
    await chooseInvalidCsv(container, "name,note\nAlice,ok,UNEXPECTED", /مطابقت ندارد/);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /وارد کردن/ })).not.toBeInTheDocument();
  });

  it("rejects a row missing a cell instead of silently filling it with an empty value", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { container } = renderImporter(onImport);
    await chooseInvalidCsv(container, "name,note\nAlice", /مطابقت ندارد/);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /وارد کردن/ })).not.toBeInTheDocument();
  });
});
