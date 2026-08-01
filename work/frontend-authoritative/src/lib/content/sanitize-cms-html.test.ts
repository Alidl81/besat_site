import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";

describe("sanitizeCmsHtml", () => {
  it("removes scripts, event handlers and unsafe URLs", () => {
    const clean = sanitizeCmsHtml(
      '<p onclick="alert(1)">متن</p><script>alert(1)</script><a href="javascript:alert(1)">لینک</a>',
    );
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("متن");
  });
});
