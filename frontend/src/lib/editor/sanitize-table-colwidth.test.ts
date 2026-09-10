import { describe, expect, it } from "vitest";

import { sanitizeStoredTiptapDocument } from "./sanitize-table-colwidth";

type TestNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TestNode[];
};

function tableDoc(colwidth: unknown, cellType: "tableCell" | "tableHeader" = "tableCell"): TestNode {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: cellType,
                attrs: { colwidth },
                content: [{ type: "paragraph", content: [{ type: "text" }] }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function cellAttrs(doc: TestNode) {
  return doc.content![0].content![0].content![0].attrs as { colwidth: unknown };
}

describe("sanitizeStoredTiptapDocument", () => {
  it("leaves an in-range colwidth unchanged", () => {
    const result = sanitizeStoredTiptapDocument(tableDoc([260]));

    expect(cellAttrs(result).colwidth).toEqual([260]);
  });

  it("clamps every forged colwidth entry to null", () => {
    for (const forged of [-10, -5, 0, 999999, "120px", "abc", true, null, [1, 2]]) {
      const result = sanitizeStoredTiptapDocument(tableDoc([forged]));

      expect(cellAttrs(result).colwidth, `forged colwidth ${JSON.stringify(forged)} was not sanitized`).toEqual([
        null,
      ]);
    }
  });

  it("truncates an in-range float instead of rejecting it", () => {
    const result = sanitizeStoredTiptapDocument(tableDoc([120.5]));

    expect(cellAttrs(result).colwidth).toEqual([120]);
  });

  it("drops a non-array colwidth entirely", () => {
    const result = sanitizeStoredTiptapDocument(tableDoc("999999" as unknown));

    expect(cellAttrs(result).colwidth).toBeNull();
  });

  it("reaches a tableHeader node too", () => {
    const result = sanitizeStoredTiptapDocument(tableDoc([999999], "tableHeader"));

    expect(cellAttrs(result).colwidth).toEqual([null]);
  });

  it("passes through null/undefined without throwing", () => {
    expect(sanitizeStoredTiptapDocument(null)).toBeNull();
    expect(sanitizeStoredTiptapDocument(undefined)).toBeUndefined();
  });
});
