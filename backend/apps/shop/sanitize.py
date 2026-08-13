"""Server-side HTML sanitization for product descriptions (defense in
depth). The rest of this codebase's CMS content types (News,
Announcements, Gallery) sanitize only on the frontend at render time
(DOMPurify, see frontend/src/lib/content/sanitize-cms-html.ts) and trust
that every admin/media-manager author is already an authenticated staff
account -- the same trust model this app inherits. This module does not
retrofit those other apps (out of scope for this task); it adds one
extra layer specifically for new Product content, using `nh3` (a small,
actively-maintained Rust-backed sanitizer) so a compromised or malicious
CMS account, or an API consumer that bypasses the frontend entirely,
can't persist a stored-XSS payload through this specific field."""

import nh3

ALLOWED_TAGS = {
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "span", "div",
    "blockquote", "a", "img",
    "table", "thead", "tbody", "tr", "td", "th",
    "figure", "figcaption",
}

ALLOWED_ATTRIBUTES = {
    # "rel" is deliberately excluded -- link_rel below manages it.
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
    "span": {"class"},
    "div": {"class"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}


def sanitize_product_html(value: str | None) -> str | None:
    if not value:
        return value

    return nh3.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        link_rel="noopener noreferrer nofollow",
    )
