from django.test import SimpleTestCase

from .sanitize import sanitize_product_html


class SanitizeProductHtmlTests(SimpleTestCase):
    def test_strips_script_tags(self):
        result = sanitize_product_html('<p>سلام</p><script>alert(1)</script>')
        self.assertIn("سلام", result)
        self.assertNotIn("<script", result)
        self.assertNotIn("alert(1)", result)

    def test_strips_inline_event_handlers(self):
        result = sanitize_product_html('<img src="x.jpg" onerror="alert(1)">')
        self.assertNotIn("onerror", result)

    def test_strips_javascript_href(self):
        result = sanitize_product_html('<a href="javascript:alert(1)">لینک</a>')
        self.assertNotIn("javascript:", result)

    def test_preserves_ordinary_formatting(self):
        html = "<p>این یک <strong>توضیح</strong> با <em>تأکید</em> است.</p>"
        result = sanitize_product_html(html)
        self.assertIn("<strong>توضیح</strong>", result)
        self.assertIn("<em>تأکید</em>", result)

    def test_none_passthrough(self):
        self.assertIsNone(sanitize_product_html(None))

    def test_empty_string_passthrough(self):
        self.assertEqual(sanitize_product_html(""), "")
