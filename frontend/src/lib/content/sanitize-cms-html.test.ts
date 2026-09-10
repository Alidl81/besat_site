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

  it("keeps a real <table> caption and the table theme data attributes", () => {
    const clean = sanitizeCmsHtml(
      '<div class="besat-table-wrapper"><table class="besat-table besat-table--theme-formal" data-theme="formal" data-density="normal" data-striped="false" data-full-width="true"><caption>عنوان جدول</caption><tbody><tr><td>سلول</td></tr></tbody></table></div>',
    );
    expect(clean).toContain("<caption>عنوان جدول</caption>");
    expect(clean).toContain('data-theme="formal"');
    expect(clean).toContain("besat-table--theme-formal");
  });

  it("keeps a hex color/background-color style but strips a url()-based one", () => {
    const safe = sanitizeCmsHtml('<span style="color:#0a2848">متن</span>');
    expect(safe).toContain("color: #0a2848");

    const unsafe = sanitizeCmsHtml('<mark style="background-color:url(javascript:alert(1))">متن</mark>');
    expect(unsafe).not.toContain("url(");
    expect(unsafe).not.toContain("javascript:");
  });

  it("keeps the image alignment margin style and data-align/data-radius/data-lightbox attrs", () => {
    const clean = sanitizeCmsHtml(
      '<figure data-besat-block="image" data-align="left" data-radius="lg" data-lightbox="true"><img src="/media/a.jpg" alt="" data-align="left" data-radius="lg" style="display:block;max-width:100%;height:auto;margin:0 auto 0 0;"></figure>',
    );
    expect(clean).toContain("margin: 0 auto 0 0");
    expect(clean).toContain('data-align="left"');
    expect(clean).toContain('data-radius="lg"');
    expect(clean).toContain('data-lightbox="true"');
  });

  // SEC-FE-RICH-LINK-001: a protocol-relative href resolves against
  // whatever host it names, not this site -- DOMPurify's default URI
  // check doesn't reject it since it carries no dangerous scheme at all.
  it("strips a protocol-relative anchor href but keeps a genuine same-origin path and external https link", () => {
    const unsafe = sanitizeCmsHtml('<a href="//evil.example/phish">لینک</a>');
    expect(unsafe).not.toContain("href=");

    const relative = sanitizeCmsHtml('<a href="/shop/some-product">لینک</a>');
    expect(relative).toContain('href="/shop/some-product"');

    const external = sanitizeCmsHtml('<a href="https://example.com/page">لینک</a>');
    expect(external).toContain('href="https://example.com/page"');
  });

  it("drops an embed iframe pointing at a disallowed host", () => {
    const clean = sanitizeCmsHtml(
      '<figure data-besat-block="embed" data-src="https://evil.example.com/x"><iframe src="https://evil.example.com/x" title="x"></iframe></figure>',
    );
    expect(clean).not.toContain("<iframe");
  });

  // FE-RICH-EMBED-STANDARD-URL-COMPAT-001: normalizeSafeEmbedUrl()
  // recognizes a safe provider URL and returns its *canonical* embed form,
  // which is not byte-identical to most legitimate input (a standard
  // "youtube.com/watch?v=..." URL normalizes to a different
  // "youtube-nocookie.com/embed/..." string). Requiring the normalized
  // output to equal the original input rejected every recognized-but-not-
  // yet-canonical URL, and DOMPurify's own src-less-iframe cleanup then
  // removed the whole embed block. The attribute is now rewritten to the
  // canonical form when recognized, rather than only ever kept
  // byte-identical.
  it("preserves a safe standard YouTube watch URL as an embed", () => {
    const output = sanitizeCmsHtml(
      '<figure data-besat-block="embed" data-src="https://www.youtube.com/watch?v=abcDEF123" data-title="ویدئو"><iframe src="https://www.youtube.com/watch?v=abcDEF123" title="ویدئو"></iframe></figure>',
    );

    expect(output).toContain("<iframe");
    expect(output).toContain("youtube-nocookie.com/embed/abcDEF123");
  });

  it("preserves a safe standard Vimeo URL as an embed", () => {
    const output = sanitizeCmsHtml(
      '<figure data-besat-block="embed" data-src="https://vimeo.com/123456789" data-title="ویدئو"><iframe src="https://vimeo.com/123456789" title="ویدئو"></iframe></figure>',
    );

    expect(output).toContain("<iframe");
    expect(output).toContain("player.vimeo.com/video/123456789");
  });

  it("keeps the code block copy button and line-number data attributes", () => {
    const clean = sanitizeCmsHtml(
      '<pre class="besat-code" data-language="python" data-line-numbers="true" data-wrap="false" data-copy="true"><button type="button" class="besat-code-copy-button" data-copy-code>کپی</button><code class="language-python"><span class="besat-code-line">print(1)</span></code></pre>',
    );
    expect(clean).toContain('data-language="python"');
    expect(clean).toContain('data-line-numbers="true"');
    expect(clean).toContain("besat-code-copy-button");
  });
});
