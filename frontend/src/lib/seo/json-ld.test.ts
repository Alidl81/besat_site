import { describe, expect, it } from "vitest";
import { safeJsonLd } from "./json-ld";

describe("safeJsonLd (SEC-SHOP-001 regression)", () => {
  it("neutralizes a literal </script> inside a string field so it can't close the script tag early", () => {
    const malicious = {
      "@type": "Product",
      name: '</script><script>alert(document.cookie)</script>',
    };

    const html = safeJsonLd(malicious);

    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("\\u003c/script>");
  });

  it("still produces valid JSON once the escape is reversed by a JSON/HTML parser", () => {
    const value = { name: "</script>" };
    const html = safeJsonLd(value);

    // \u003c is a standard JSON string escape for "<" -- valid JSON, and
    // this is exactly how a browser's JSON-LD/script parser will read it
    // back, so the escaping is invisible to legitimate consumers.
    expect(JSON.parse(html.replace(/\\u003c/g, "<"))).toEqual(value);
  });

  it("leaves ordinary content unaffected", () => {
    const value = { name: "دوره آموزشی ریاضی", price: 100 };
    expect(JSON.parse(safeJsonLd(value))).toEqual(value);
  });
});
