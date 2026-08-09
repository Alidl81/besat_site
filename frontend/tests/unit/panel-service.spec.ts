import { expect, test } from "@playwright/test";

import { panelService } from "../../src/services/panel-service";

test("student export uses the CSV endpoint without a misleading format override", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response("\ufefffull_name\r\n", {
      status: 200,
      headers: {
        "content-disposition": 'attachment; filename="besat-students.csv"',
        "content-type": "text/csv; charset=utf-8",
      },
    });
  };

  try {
    const result = await panelService.exportStudents({ search: "" });
    const url = new URL(requestedUrl);

    expect(url.pathname).toMatch(/\/cms\/students\/export\/$/);
    expect(url.searchParams.has("format")).toBe(false);
    expect(result.filename).toBe("besat-students.csv");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
