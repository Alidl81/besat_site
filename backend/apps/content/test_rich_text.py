import json

from django.test import SimpleTestCase, override_settings

from .rich_text import (
    has_empty_table_header_cells,
    render_tiptap_html,
    sanitize_stored_tiptap_document,
    validate_tiptap_document,
)


class RenderTiptapImageTests(SimpleTestCase):
    """Covers the image case's width/alignment output -- this is what makes
    an editor-side resize (see rich-editor.tsx's resizable image NodeView)
    actually show up the same size on the rendered/public page instead of
    only affecting the CMS editor's own view."""

    def _image_doc(self, attrs):
        return {
            "type": "doc",
            "content": [{"type": "image", "attrs": attrs}],
        }

    def test_stored_width_is_rendered_as_inline_style_and_data_attribute(self):
        html = render_tiptap_html(
            self._image_doc({"src": "/media/photo.jpg", "alt": "توضیح", "width": "420px"}),
        )

        self.assertIn('data-width="420px"', html)
        self.assertIn("width:420px;", html)
        self.assertIn('alt="توضیح"', html)

    def test_missing_width_renders_without_a_fixed_width_style(self):
        html = render_tiptap_html(self._image_doc({"src": "/media/photo.jpg", "alt": "توضیح"}))

        self.assertNotIn("data-width=", html)
        self.assertIn("max-width:100%;height:auto;", html)

    def test_image_always_has_responsive_max_width_regardless_of_stored_width(self):
        html = render_tiptap_html(
            self._image_doc({"src": "/media/photo.jpg", "width": "900px"}),
        )

        self.assertIn("max-width:100%;", html)

    def test_alignment_maps_to_the_expected_margin(self):
        left = render_tiptap_html(self._image_doc({"src": "/media/photo.jpg", "align": "left"}))
        right = render_tiptap_html(self._image_doc({"src": "/media/photo.jpg", "align": "right"}))
        center = render_tiptap_html(self._image_doc({"src": "/media/photo.jpg", "align": "center"}))

        self.assertIn("margin:0 auto 0 0;", left)
        self.assertIn('data-align="left"', left)
        self.assertIn("margin:0 0 0 auto;", right)
        self.assertIn('data-align="right"', right)
        self.assertIn("margin:0 auto;", center)
        self.assertIn('data-align="center"', center)

    def test_unrecognized_align_value_falls_back_to_center(self):
        html = render_tiptap_html(self._image_doc({"src": "/media/photo.jpg", "align": "diagonal"}))

        self.assertIn('data-align="center"', html)
        self.assertIn("margin:0 auto;", html)

    def test_missing_src_renders_nothing(self):
        html = render_tiptap_html(self._image_doc({"alt": "بدون منبع"}))

        self.assertEqual(html, "")

    def test_unsafe_src_scheme_is_rejected(self):
        html = render_tiptap_html(
            self._image_doc({"src": "javascript:alert(1)", "alt": "ناامن"}),
        )

        self.assertEqual(html, "")

    def test_absolute_media_url_is_rewritten_to_a_relative_path(self):
        # SEC-FE-RICH-MEDIA-ORIGIN-001 residual: editor_json can carry
        # whatever Host the upload request resolved against at authoring
        # time (e.g. a dev machine's own "http://localhost:3000"), and
        # this renderer used to re-emit that exact wrong absolute URL on
        # every single read, forever. Any absolute URL under /media/ must
        # come back as a bare relative path -- this backend serves that
        # path itself, and the frontend's own rewrite proxies it straight
        # through, so there is no origin left to get wrong.
        html = render_tiptap_html(
            self._image_doc({"src": "http://localhost:3000/media/photo.jpg", "alt": "توضیح"}),
        )

        self.assertIn('src="/media/photo.jpg"', html)
        self.assertNotIn("localhost", html)

    @override_settings(ALLOWED_HOSTS=["localhost", "127.0.0.1", "besat.org"])
    def test_absolute_media_url_on_a_real_production_host_is_also_rewritten_to_relative(self):
        html = render_tiptap_html(
            self._image_doc({"src": "https://besat.org/media/photo.jpg", "alt": "توضیح"}),
        )

        self.assertIn('src="/media/photo.jpg"', html)
        self.assertNotIn("besat.org", html)

    def test_absolute_url_outside_the_media_path_is_left_untouched(self):
        html = render_tiptap_html(
            self._image_doc({"src": "https://cdn.example.com/photo.jpg", "alt": "توضیح"}),
        )

        self.assertIn('src="https://cdn.example.com/photo.jpg"', html)

    def test_media_path_on_a_genuinely_different_host_is_left_untouched(self):
        # SEC-FE-RICH-MEDIA-ORIGIN-002: an independent live probe found
        # that a genuinely external host whose OWN file layout coincidentally
        # also uses a "/media/" prefix (e.g. an admin-pasted CDN image) was
        # being silently rewritten down to a same-origin relative path --
        # repointing it at whatever (if anything) this backend serves at
        # that identical path instead of the real external file. Only a
        # host actually in ALLOWED_HOSTS may be narrowed.
        html = render_tiptap_html(
            self._image_doc({"src": "https://cdn.example.com/media/remote.jpg", "alt": "توضیح"}),
        )

        self.assertIn('src="https://cdn.example.com/media/remote.jpg"', html)


class RenderTiptapAtomBlockTests(SimpleTestCase):
    """besatMediaBlock/besatQuoteBlock/besatCalloutBlock/besatEmbedBlock are
    atom nodes with no `content` children -- before this fix
    render_tiptap_node had no branch for any of them, so they fell through
    to `return children` and rendered as an empty string, silently dropping
    any single-media/quote/callout/embed block an editor inserted from the
    published body_html. These tests pin the fix and match the data-*
    attribute names frontend/src/components/content/rich-content-renderer.tsx
    parses back out of the published HTML."""

    def _doc(self, node_type, attrs):
        return {"type": "doc", "content": [{"type": node_type, "attrs": attrs}]}

    def test_media_block_renders_image_with_expected_attributes(self):
        html = render_tiptap_html(self._doc("besatMediaBlock", {
            "src": "/media/photo.jpg",
            "mediaType": "image",
            "title": "عکس",
            "alt": "توضیح تصویر",
            "caption": "زیرنویس",
            "credit": "عکاس: علی",
        }))

        self.assertIn('data-besat-block="media"', html)
        self.assertIn('data-media-type="image"', html)
        self.assertIn('src="/media/photo.jpg"', html)
        self.assertIn('alt="توضیح تصویر"', html)
        self.assertIn("<figcaption>زیرنویس</figcaption>", html)
        self.assertIn("<cite>عکاس: علی</cite>", html)

    def test_media_block_video_renders_video_tag(self):
        html = render_tiptap_html(self._doc("besatMediaBlock", {
            "src": "/media/clip.mp4",
            "mediaType": "video",
        }))

        self.assertIn('data-media-type="video"', html)
        self.assertIn("<video ", html)

    def test_media_block_unsafe_src_renders_nothing(self):
        html = render_tiptap_html(self._doc("besatMediaBlock", {
            "src": "javascript:alert(1)",
            "mediaType": "image",
        }))

        self.assertEqual(html, "")

    def test_media_block_absolute_media_url_is_rewritten_to_a_relative_path(self):
        html = render_tiptap_html(self._doc("besatMediaBlock", {
            "src": "http://localhost:3000/media/clip.jpg",
            "mediaType": "image",
        }))

        self.assertIn('src="/media/clip.jpg"', html)
        self.assertNotIn("localhost", html)

    def test_quote_block_renders_text_and_cite(self):
        html = render_tiptap_html(self._doc("besatQuoteBlock", {
            "text": "دانش قدرت است.",
            "cite": "امام علی (ع)",
        }))

        self.assertIn('data-besat-block="quote"', html)
        self.assertIn("<p>دانش قدرت است.</p>", html)
        self.assertIn("<cite>امام علی (ع)</cite>", html)

    def test_quote_block_without_text_renders_nothing(self):
        html = render_tiptap_html(self._doc("besatQuoteBlock", {"cite": "بدون متن"}))

        self.assertEqual(html, "")

    def test_callout_block_renders_title_body_and_tone(self):
        html = render_tiptap_html(self._doc("besatCalloutBlock", {
            "title": "توجه",
            "body": "این یک اطلاعیه مهم است.",
            "tone": "warning",
        }))

        self.assertIn('data-besat-block="callout"', html)
        self.assertIn('data-tone="warning"', html)
        self.assertIn("<h3>توجه</h3>", html)
        self.assertIn("<p>این یک اطلاعیه مهم است.</p>", html)

    def test_callout_block_unknown_tone_defaults_to_info(self):
        html = render_tiptap_html(self._doc("besatCalloutBlock", {
            "body": "متن",
            "tone": "not-a-real-tone",
        }))

        self.assertIn('data-tone="info"', html)

    def test_embed_block_allows_youtube_and_normalizes_url(self):
        html = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "ویدئوی آموزشی",
        }))

        self.assertIn('data-besat-block="embed"', html)
        self.assertIn("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", html)

    def test_embed_block_rejects_disallowed_host(self):
        html = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "https://evil.example.com/iframe.html",
            "title": "نامعتبر",
        }))

        self.assertEqual(html, "")

    def test_embed_block_rejects_unsafe_scheme(self):
        html = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "javascript:alert(1)",
        }))

        self.assertEqual(html, "")

    def test_embed_block_aspect_defaults_and_validates(self):
        default = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "https://youtu.be/dQw4w9WgXcQ",
        }))
        self.assertIn('data-aspect="16:9"', default)

        custom = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "https://youtu.be/dQw4w9WgXcQ",
            "aspect": "4:3",
        }))
        self.assertIn('data-aspect="4:3"', custom)

        invalid = render_tiptap_html(self._doc("besatEmbedBlock", {
            "src": "https://youtu.be/dQw4w9WgXcQ",
            "aspect": "9:16; background:url(javascript:alert(1))",
        }))
        self.assertIn('data-aspect="16:9"', invalid)


class RenderTiptapTableTests(SimpleTestCase):
    """Table is the flagship upgrade -- theme/density/striped/fullWidth/
    caption must persist through editor_json -> published HTML, legacy
    tables (no attrs at all) must render with safe defaults, header rows
    must become a real <thead>, and merged cells (colspan/rowspan) must
    survive -- none of this existed before this change (the old renderer
    emitted a bare <table><tbody>...)."""

    def _table_doc(self, table_attrs=None, rows=None):
        default_rows = rows or [
            {
                "type": "tableRow",
                "content": [
                    {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "الف"}]}]},
                ],
            },
        ]
        return {
            "type": "doc",
            "content": [{"type": "table", "attrs": table_attrs or {}, "content": default_rows}],
        }

    def test_legacy_table_with_no_attrs_uses_safe_defaults(self):
        html = render_tiptap_html(self._table_doc())

        self.assertIn('data-theme="minimal"', html)
        self.assertIn('data-density="normal"', html)
        self.assertIn('data-striped="false"', html)
        self.assertIn('data-full-width="true"', html)
        self.assertIn('<div class="besat-table-wrapper">', html)

    def test_theme_density_striped_and_caption_persist(self):
        html = render_tiptap_html(self._table_doc({
            "theme": "formal",
            "density": "compact",
            "striped": True,
            "fullWidth": False,
            "caption": "برنامه هفتگی",
        }))

        self.assertIn("besat-table--theme-formal", html)
        self.assertIn("besat-table--density-compact", html)
        self.assertIn("besat-table--striped", html)
        self.assertIn("besat-table--auto-width", html)
        self.assertIn("<caption>برنامه هفتگی</caption>", html)

    def test_unknown_theme_falls_back_to_minimal(self):
        html = render_tiptap_html(self._table_doc({"theme": "<script>evil"}))

        self.assertIn('data-theme="minimal"', html)
        self.assertNotIn("<script>", html)

    def test_leading_header_row_becomes_thead(self):
        rows = [
            {
                "type": "tableRow",
                "content": [{"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "ستون"}]}]}],
            },
            {
                "type": "tableRow",
                "content": [{"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "مقدار"}]}]}],
            },
        ]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertIn("<thead><tr><th>", html)
        self.assertIn("</thead><tbody><tr><td>", html)

    def test_empty_header_row_is_downgraded_to_data_cells(self):
        rows = [{
            "type": "tableRow",
            "content": [{"type": "tableHeader", "content": [{"type": "paragraph"}]}],
        }]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertNotIn("<thead>", html)
        self.assertNotIn("<th>", html)
        self.assertIn("<tbody><tr><td>", html)

    def test_empty_header_detector_distinguishes_named_headers(self):
        empty = self._table_doc(rows=[{
            "type": "tableRow",
            "content": [{"type": "tableHeader", "content": [{"type": "paragraph"}]}],
        }])
        named = self._table_doc(rows=[{
            "type": "tableRow",
            "content": [{"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "عنوان"}]}]}],
        }])

        self.assertTrue(has_empty_table_header_cells(empty))
        self.assertFalse(has_empty_table_header_cells(named))

    def test_merged_cell_colspan_rowspan_survive(self):
        rows = [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableCell",
                        "attrs": {"colspan": 2, "rowspan": 3},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "ادغام‌شده"}]}],
                    },
                ],
            },
        ]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertIn('colspan="2"', html)
        self.assertIn('rowspan="3"', html)

    def test_cell_vertical_align_persists(self):
        rows = [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableCell",
                        "attrs": {"verticalAlign": "middle"},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "وسط"}]}],
                    },
                ],
            },
        ]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertIn('class="besat-valign-middle"', html)

    def test_cell_colwidths_persist_as_colgroup(self):
        # CMS-TABLE-COLWIDTH-001: header/cell colwidth was silently dropped
        # by the public renderer even though the editor round-trip retained
        # it, so a reader never saw the column widths an editor set.
        rows = [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableHeader",
                        "attrs": {"colwidth": [120]},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "A"}]}],
                    },
                    {
                        "type": "tableCell",
                        "attrs": {"colwidth": [260]},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "B"}]}],
                    },
                ],
            },
        ]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertIn("<colgroup>", html)
        self.assertIn('<col width="120">', html)
        self.assertIn('<col width="260">', html)
        # colgroup must precede the body content per the HTML table content
        # model (caption?, colgroup*, thead?, tbody).
        self.assertLess(html.index("<colgroup>"), html.index("<tbody>"))

    def test_colwidth_spans_multiple_columns_via_colspan(self):
        rows = [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableCell",
                        "attrs": {"colspan": 2, "colwidth": [100, 150]},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "ادغام‌شده"}]}],
                    },
                ],
            },
        ]
        html = render_tiptap_html(self._table_doc(rows=rows))

        self.assertIn('<col width="100"><col width="150">', html)

    def test_colwidth_ignores_forged_out_of_range_and_non_numeric_values(self):
        for forged in (-5, 0, 999999, "120px", True, None, [1, 2]):
            rows = [
                {
                    "type": "tableRow",
                    "content": [
                        {
                            "type": "tableCell",
                            "attrs": {"colwidth": [forged]},
                            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "خ"}]}],
                        },
                    ],
                },
            ]
            html = render_tiptap_html(self._table_doc(rows=rows))

            self.assertNotIn("<colgroup>", html, msg=f"forged colwidth {forged!r} leaked a colgroup")

    def test_missing_colwidth_on_legacy_table_emits_no_colgroup(self):
        html = render_tiptap_html(self._table_doc())

        self.assertNotIn("<colgroup>", html)


class RenderTiptapQuoteStyleTests(SimpleTestCase):
    def test_style_and_author_source_persist(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{
                "type": "besatQuoteBlock",
                "attrs": {"text": "متن", "style": "accent", "author": "نویسنده", "source": "منبع"},
            }],
        })

        self.assertIn('data-style="accent"', html)
        self.assertIn('data-author="نویسنده"', html)
        self.assertIn('data-source="منبع"', html)
        self.assertIn("نویسنده — منبع", html)

    def test_legacy_cite_still_renders_when_author_source_absent(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{"type": "besatQuoteBlock", "attrs": {"text": "متن", "cite": "منبع قدیمی"}}],
        })

        self.assertIn("<cite>منبع قدیمی</cite>", html)

    def test_unknown_style_falls_back_to_classic(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{"type": "besatQuoteBlock", "attrs": {"text": "متن", "style": "not-real"}}],
        })

        self.assertIn('data-style="classic"', html)


class RenderTiptapCalloutToneTests(SimpleTestCase):
    def test_all_five_tones_render_with_icon(self):
        for tone in ("note", "info", "success", "warning", "important"):
            html = render_tiptap_html({
                "type": "doc",
                "content": [{"type": "besatCalloutBlock", "attrs": {"body": "متن", "tone": tone}}],
            })
            self.assertIn(f'data-tone="{tone}"', html)
            self.assertIn("<svg", html)
            self.assertIn('class="besat-callout-icon"', html)

    def test_unknown_tone_falls_back_to_info(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{"type": "besatCalloutBlock", "attrs": {"body": "متن", "tone": "javascript:alert(1)"}}],
        })

        self.assertIn('data-tone="info"', html)


class RenderTiptapImageExtrasTests(SimpleTestCase):
    def _image_doc(self, attrs):
        return {"type": "doc", "content": [{"type": "image", "attrs": attrs}]}

    def test_plain_image_with_no_extras_is_unwrapped(self):
        html = render_tiptap_html(self._image_doc({"src": "/media/a.jpg"}))

        self.assertTrue(html.startswith("<img "))

    def test_caption_link_and_lightbox_wrap_in_figure(self):
        html = render_tiptap_html(self._image_doc({
            "src": "/media/a.jpg",
            "caption": "زیرنویس",
            "link": "https://example.com",
            "lightbox": True,
        }))

        self.assertIn('data-besat-block="image"', html)
        self.assertIn('data-lightbox="true"', html)
        self.assertIn('<a href="https://example.com">', html)
        self.assertIn("<figcaption>زیرنویس</figcaption>", html)

    def test_unsafe_link_is_dropped_but_image_still_renders(self):
        html = render_tiptap_html(self._image_doc({
            "src": "/media/a.jpg",
            "caption": "زیرنویس",
            "link": "javascript:alert(1)",
        }))

        self.assertNotIn("javascript:", html)
        self.assertIn("<img ", html)

    def test_protocol_relative_link_is_dropped(self):
        # SEC-FE-RICH-LINK-001: a bare `startswith("/")` also accepts
        # "//evil.example/..." unchanged -- a browser resolves that against
        # evil.example, not this site.
        html = render_tiptap_html(self._image_doc({
            "src": "/media/a.jpg",
            "caption": "زیرنویس",
            "link": "//evil.example/x",
        }))

        self.assertNotIn('href="//evil.example', html)
        self.assertIn("<img ", html)

    def test_backslash_mixed_separator_link_is_dropped(self):
        # A browser's URL parser normalizes a leading backslash into a
        # second forward slash for special schemes (http/https), so
        # "http:\\evil.example/x" resolves identically to
        # "http://evil.example/x" even though Python's own urlparse()
        # reports scheme="http" for it (verified directly).
        html = render_tiptap_html(self._image_doc({
            "src": "/media/a.jpg",
            "caption": "زیرنویس",
            "link": "http:\\\\evil.example/x",
        }))

        self.assertNotIn("evil.example", html)
        self.assertIn("<img ", html)

    def test_radius_renders_as_data_attribute(self):
        html = render_tiptap_html(self._image_doc({"src": "/media/a.jpg", "radius": "lg"}))

        self.assertIn('data-radius="lg"', html)


class RenderTiptapGalleryExtrasTests(SimpleTestCase):
    def test_per_item_metadata_and_layout_attrs_persist(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{
                "type": "besatGalleryBlock",
                "attrs": {
                    "items": [{"src": "/media/a.jpg", "type": "image", "alt": "الف", "caption": "زیر", "credit": "منبع"}],
                    "columns": "3",
                    "gap": "compact",
                    "aspect": "square",
                    "captions": False,
                    "lightbox": False,
                },
            }],
        })

        self.assertIn('data-alt="الف"', html)
        self.assertIn('data-caption="زیر"', html)
        self.assertIn('data-credit="منبع"', html)
        self.assertIn('data-columns="3"', html)
        self.assertIn("besat-gallery--gap-compact", html)
        self.assertIn("besat-gallery--aspect-square", html)
        self.assertIn('data-captions="false"', html)
        self.assertIn('data-lightbox="false"', html)

    def test_absolute_media_url_in_a_gallery_item_is_rewritten_to_a_relative_path(self):
        html = render_tiptap_html({
            "type": "doc",
            "content": [{
                "type": "besatGalleryBlock",
                "attrs": {
                    "items": [{"src": "http://localhost:3000/media/a.jpg", "type": "image"}],
                },
            }],
        })

        self.assertIn('data-src="/media/a.jpg"', html)
        self.assertNotIn("localhost", html)


class RenderTiptapCodeBlockTests(SimpleTestCase):
    def _code_doc(self, text, attrs):
        return {
            "type": "doc",
            "content": [{"type": "codeBlock", "attrs": attrs, "content": [{"type": "text", "text": text}]}],
        }

    def test_language_and_toggles_persist(self):
        html = render_tiptap_html(self._code_doc("print(1)", {
            "language": "python",
            "lineNumbers": True,
            "wrap": True,
            "copyButton": False,
        }))

        self.assertIn('data-language="python"', html)
        self.assertIn('data-line-numbers="true"', html)
        self.assertIn('data-wrap="true"', html)
        self.assertIn('data-copy="false"', html)
        self.assertNotIn("besat-code-copy-button", html)

    def test_line_numbers_split_into_spans(self):
        html = render_tiptap_html(self._code_doc("a\nb\nc", {"lineNumbers": True}))

        self.assertEqual(html.count('class="besat-code-line"'), 3)

    def test_unknown_language_falls_back_to_plaintext(self):
        html = render_tiptap_html(self._code_doc("x", {"language": "<script>"}))

        self.assertIn('data-language="plaintext"', html)
        self.assertNotIn("<script>", html)


class RenderTiptapTextLinkMarkTests(SimpleTestCase):
    """SEC-FE-RICH-LINK-001: the inline text `link` mark's href goes
    through the same _safe_url() as the image `link` attr -- covering it
    here directly since no test previously exercised this specific mark at
    all."""

    def _link_doc(self, href):
        return {
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "متن پیوند",
                    "marks": [{"type": "link", "attrs": {"href": href}}],
                }],
            }],
        }

    def test_safe_absolute_link_renders(self):
        html = render_tiptap_html(self._link_doc("https://example.com/page"))

        self.assertIn('<a href="https://example.com/page">متن پیوند</a>', html)

    def test_javascript_link_is_dropped(self):
        html = render_tiptap_html(self._link_doc("javascript:alert(1)"))

        self.assertNotIn("<a ", html)
        self.assertIn("متن پیوند", html)

    def test_protocol_relative_link_is_dropped(self):
        html = render_tiptap_html(self._link_doc("//evil.example/x"))

        self.assertNotIn("<a ", html)
        self.assertNotIn("evil.example", html)

    def test_backslash_mixed_separator_link_is_dropped(self):
        html = render_tiptap_html(self._link_doc("http:\\\\evil.example/x"))

        self.assertNotIn("<a ", html)
        self.assertNotIn("evil.example", html)


class ValidateTiptapDocumentColwidthSanitizationTests(SimpleTestCase):
    """CMS-TABLE-FORGED-COLWIDTH-001: the CMS write path persisted any
    colwidth value verbatim into editor_json with no bound at all -- the
    public renderer already dropped an invalid entry safely at render time
    (test_colwidth_ignores_forged_out_of_range_and_non_numeric_values,
    above), but reopening that SAME stored document in the CMS editor fed
    the raw forged value straight into ProseMirror's own table plugin,
    blowing the table out to 1,000,000+ px wide inside the editor itself.
    validate_tiptap_document() runs on every News/Announcement save (see
    News.clean()/Announcement.clean()), so sanitizing colwidth there closes
    both the write boundary and, by construction, every later hydration."""

    def _doc_with_colwidth(self, colwidth):
        return {
            "type": "doc",
            "content": [{
                "type": "table",
                "content": [{
                    "type": "tableRow",
                    "content": [{
                        "type": "tableCell",
                        "attrs": {"colwidth": colwidth},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "خ"}]}],
                    }],
                }],
            }],
        }

    def test_valid_colwidth_survives_unchanged(self):
        result = validate_tiptap_document(self._doc_with_colwidth([260]))

        cell = result["content"][0]["content"][0]["content"][0]
        self.assertEqual(cell["attrs"]["colwidth"], [260])

    def test_forged_colwidth_entries_are_clamped_to_none(self):
        # -5/0/999999/"120px"/True/None/[1,2] mirror
        # test_colwidth_ignores_forged_out_of_range_and_non_numeric_values
        # above exactly, so write-time sanitization rejects precisely what
        # render-time sanitization already rejects.
        for forged in (-10, -5, 0, 999999, "120px", "abc", True, None, [1, 2]):
            with self.subTest(forged=forged):
                result = validate_tiptap_document(self._doc_with_colwidth([forged]))
                cell = result["content"][0]["content"][0]["content"][0]
                self.assertEqual(
                    cell["attrs"]["colwidth"], [None],
                    f"forged colwidth {forged!r} was persisted unchanged instead of being sanitized",
                )

    def test_float_colwidth_is_truncated_to_an_int_not_rejected(self):
        # _safe_colwidth() deliberately truncates a finite float via int()
        # rather than rejecting it outright (it's the same coercion the
        # renderer has always applied) -- 120.5 is in-range once truncated,
        # so it survives as 120, not None.
        result = validate_tiptap_document(self._doc_with_colwidth([120.5]))

        cell = result["content"][0]["content"][0]["content"][0]
        self.assertEqual(cell["attrs"]["colwidth"], [120])

    def test_non_list_colwidth_is_dropped_entirely(self):
        result = validate_tiptap_document(self._doc_with_colwidth("999999"))

        cell = result["content"][0]["content"][0]["content"][0]
        self.assertIsNone(cell["attrs"]["colwidth"])

    def test_colwidth_sanitization_reaches_a_tableheader_too(self):
        doc = {
            "type": "doc",
            "content": [{
                "type": "table",
                "content": [{
                    "type": "tableRow",
                    "content": [{
                        "type": "tableHeader",
                        "attrs": {"colwidth": [999999]},
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "س"}]}],
                    }],
                }],
            }],
        }
        result = validate_tiptap_document(doc)

        cell = result["content"][0]["content"][0]["content"][0]
        self.assertEqual(cell["attrs"]["colwidth"], [None])


class MediaUrlOriginSanitizationTests(SimpleTestCase):
    """SEC-FE-RICH-MEDIA-ORIGIN-001 (reopened): _safe_media_url() only ever
    ran inside render_tiptap_node(), so a stored "http://localhost:3000/
    media/..." value (whatever Host the upload request resolved against at
    authoring time) was narrowed in the rendered body_html but re-served
    unchanged in the raw body_json/editor_json field News/Announcement
    serializers also expose. validate_tiptap_document() (write path) and
    sanitize_stored_tiptap_document() (read path, for rows written before
    this fix existed) both now narrow it the same way, for every node type
    that carries a media src: image, besatMediaBlock, besatGalleryBlock."""

    def _image_node(self, src):
        return {"type": "image", "attrs": {"src": src, "alt": "توضیح"}}

    def _media_block_node(self, src):
        return {"type": "besatMediaBlock", "attrs": {"src": src, "mediaType": "image"}}

    def _gallery_node(self, items):
        return {"type": "besatGalleryBlock", "attrs": {"items": items}}

    def _doc(self, *nodes):
        return {"type": "doc", "content": list(nodes)}

    def test_write_time_narrows_same_origin_media_url_on_image_node(self):
        doc = self._doc(self._image_node("http://localhost:3000/media/photo.jpg"))
        result = validate_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "/media/photo.jpg")

    @override_settings(ALLOWED_HOSTS=["localhost", "127.0.0.1", "besat.org"])
    def test_write_time_narrows_same_origin_media_url_on_media_block_node(self):
        doc = self._doc(self._media_block_node("https://besat.org/media/clip.jpg"))
        result = validate_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "/media/clip.jpg")

    def test_write_time_narrows_same_origin_media_url_in_gallery_items_list(self):
        doc = self._doc(self._gallery_node([
            {"src": "http://localhost:3000/media/a.jpg", "type": "image"},
            {"src": "/media/already-relative.jpg", "type": "image"},
        ]))
        result = validate_tiptap_document(doc)
        items = result["content"][0]["attrs"]["items"]
        self.assertEqual(items[0]["src"], "/media/a.jpg")
        self.assertEqual(items[1]["src"], "/media/already-relative.jpg")

    def test_write_time_narrows_same_origin_media_url_in_gallery_items_json_string(self):
        # _gallery_items() (the renderer) already accepts items stored as a
        # JSON-encoded string, not just a native list -- the sanitizer must
        # not silently skip that shape.
        doc = self._doc(self._gallery_node(json.dumps([
            {"src": "http://localhost:3000/media/b.jpg", "type": "image"},
        ])))
        result = validate_tiptap_document(doc)
        items = json.loads(result["content"][0]["attrs"]["items"])
        self.assertEqual(items[0]["src"], "/media/b.jpg")

    def test_read_time_narrows_a_legacy_stored_document_never_validated(self):
        # Simulates a row written before this fix existed (or via a raw DB
        # write that bypassed validate_tiptap_document() entirely) -- the
        # read path must catch it too, exactly like
        # CMS-TABLE-FORGED-COLWIDTH-001-R1 already does for colwidth.
        doc = self._doc(self._image_node("http://localhost:3000/media/legacy.jpg"))
        result = sanitize_stored_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "/media/legacy.jpg")

    def test_read_time_narrows_nested_media_inside_other_blocks(self):
        # _sanitize_media_urls() recurses through node.content the same way
        # _sanitize_table_colwidths() does -- an image nested inside a
        # blockquote must be reached too, not just top-level nodes.
        doc = self._doc({
            "type": "blockquote",
            "content": [self._image_node("http://localhost:3000/media/nested.jpg")],
        })
        result = sanitize_stored_tiptap_document(doc)
        nested_image = result["content"][0]["content"][0]
        self.assertEqual(nested_image["attrs"]["src"], "/media/nested.jpg")

    def test_a_genuinely_different_host_is_left_untouched(self):
        # Only this backend's own /media/ path is narrowed -- an
        # externally-hosted image src (a legitimate use case for a direct
        # <img> node) must never be rewritten or dropped.
        doc = self._doc(self._image_node("https://cdn.example.com/photo.jpg"))
        result = validate_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "https://cdn.example.com/photo.jpg")

    def test_a_different_host_with_a_coincidental_media_path_is_left_untouched(self):
        # SEC-FE-RICH-MEDIA-ORIGIN-002: an independent live probe found
        # that https://cdn.example.com/media/remote.jpg -- a genuinely
        # external host whose own file layout happens to also use a
        # "/media/" prefix -- was being silently rewritten down to a
        # same-origin relative path, repointing it at whatever (if
        # anything) this backend serves at that identical path instead of
        # the real external file. Only a host actually in ALLOWED_HOSTS
        # may be narrowed; a path-prefix match alone is not enough.
        doc = self._doc(self._image_node("https://cdn.example.com/media/remote.jpg"))
        result = validate_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "https://cdn.example.com/media/remote.jpg")

    def test_a_different_host_with_a_coincidental_media_path_is_left_untouched_in_gallery_items(self):
        doc = self._doc(self._gallery_node([
            {"src": "https://cdn.example.com/media/gallery.jpg", "type": "image"},
        ]))
        result = validate_tiptap_document(doc)
        items = result["content"][0]["attrs"]["items"]
        self.assertEqual(items[0]["src"], "https://cdn.example.com/media/gallery.jpg")

    def test_an_already_relative_media_url_is_left_untouched(self):
        doc = self._doc(self._image_node("/media/already-fine.jpg"))
        result = sanitize_stored_tiptap_document(doc)
        self.assertEqual(result["content"][0]["attrs"]["src"], "/media/already-fine.jpg")
