import json
import re
from html import escape
from urllib.parse import parse_qs, urlparse, urlunparse

from django.conf import settings


def _sanitize_table_colwidths(node):
    """Recursively clamps every tableCell/tableHeader node's attrs.colwidth
    in place, using the same bound _safe_colwidth() already enforces at
    render time (CMS-TABLE-FORGED-COLWIDTH-001). Without this, a forged
    write (negative, absurdly large, a float, a string, a boolean, or
    null) persisted straight into editor_json unchanged -- the public
    renderer already dropped an invalid entry safely, but reopening that
    SAME stored document in the CMS editor fed the raw value straight into
    ProseMirror's own table plugin, which applied it as a literal inline
    pixel width, observed blowing a table out past 1,000,000px wide inside
    a 390px editor viewport.

    CMS-TABLE-FORGED-COLWIDTH-001-R1: calling this only from
    validate_tiptap_document() (the write path) was not enough on its own
    -- a row that reaches the database without ever running full_clean()
    (a raw DB write, a fixture, a management command, data saved before
    this guard existed) still carries the forged value forever, and every
    *read* of that row's raw editor_json (the CMS editor's own hydration
    payload, not just body_html) re-served it unbounded. This function is
    now also called read-side, via sanitize_stored_tiptap_document()
    below -- see that function's docstring for why a read path needs its
    own, non-raising entry point rather than reusing
    validate_tiptap_document() directly."""
    if not isinstance(node, dict):
        return
    if node.get("type") in ("tableCell", "tableHeader"):
        attrs = node.get("attrs")
        if isinstance(attrs, dict) and "colwidth" in attrs:
            raw = attrs["colwidth"]
            attrs["colwidth"] = [_safe_colwidth(entry) for entry in raw] if isinstance(raw, list) else None
    for child in node.get("content") or []:
        _sanitize_table_colwidths(child)


def validate_tiptap_document(value):
    if not isinstance(value, dict) or value.get("type") != "doc":
        raise ValueError("بدنه ساختاریافته باید یک سند معتبر ویرایشگر باشد.")
    if "content" in value and not isinstance(value["content"], list):
        raise ValueError("بلوک‌های سند معتبر نیستند.")
    for node in value.get("content") or []:
        _sanitize_table_colwidths(node)
        # SEC-FE-RICH-MEDIA-ORIGIN-001: narrows a same-origin-media
        # absolute URL (e.g. whatever Host the upload request resolved
        # against at authoring time) down to a bare /media/... path at
        # write time too, not just on read -- see _sanitize_media_urls()'s
        # docstring.
        _sanitize_media_urls(node)
    return value


def sanitize_stored_tiptap_document(value):
    """Read-time counterpart to validate_tiptap_document()'s write-time
    colwidth AND media-origin sanitization. Every CMS read of a stored
    document's raw editor_json -- the internal CMS editor's own hydration
    payload (serialize_content_item()'s body_json, revision snapshots),
    and the public API's exposed editor_json field -- must go through
    this before being handed back to any client, because a row can carry
    a forged colwidth or a stale authoring-time media origin without ever
    having passed through validate_tiptap_document() at all (see
    CMS-TABLE-FORGED-COLWIDTH-001-R1 and SEC-FE-RICH-MEDIA-ORIGIN-001).
    Deliberately never raises: a read must never 500 just because older/
    bypassed data predates this fix -- it only ever narrows an already-
    unsafe value, the same way a missing/invalid width has always safely
    fallen back to natural sizing."""
    if isinstance(value, dict):
        for node in value.get("content") or []:
            _sanitize_table_colwidths(node)
            _sanitize_media_urls(node)
    return value


def extract_tiptap_plain_text(value):
    if not isinstance(value, dict):
        return ""

    fragments = []

    def walk(node):
        if not isinstance(node, dict):
            return
        text = node.get("text")
        if isinstance(text, str):
            fragments.append(text)
        attrs = node.get("attrs")
        if isinstance(attrs, dict):
            for key in ("alt", "caption", "title"):
                if isinstance(attrs.get(key), str):
                    fragments.append(attrs[key])
        for child in node.get("content") or []:
            walk(child)

    walk(value)
    return " ".join(part.strip() for part in fragments if part.strip())


def _safe_url(value):
    """Mirrors frontend/src/lib/url-safety.ts's isSafeRelativePath()/
    isSafeExternalHttpUrl() (SEC-FE-RICH-LINK-001): a bare
    `raw.startswith("/")` also accepts a protocol-relative
    "//evil.example/..." unchanged (a browser resolves that against
    "evil.example", not this site), and a bare scheme check accepts a
    backslash/mixed-separator absolute URL like "http:\\evil.example/..."
    -- Python's own urlparse() already reports scheme="http" for that
    string (verified directly), and a browser's URL parser normalizes the
    backslash into a second forward slash for "special" schemes like
    http(s), reproducing the exact same off-origin redirect once this
    renderer's output reaches a client. Both bypasses were already fixed
    on the frontend's own sanitizer; this backend renderer is a fully
    independent code path (used directly by the News/Announcement public
    serializers) with no guarantee the frontend sanitizer runs before this
    HTML is served, so it needs the identical protection, not just the
    same intent."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    if re.search(r"[\\\t\n\r]", raw):
        return ""
    if raw.startswith("#"):
        return raw
    if raw.startswith("/") and not raw.startswith("//"):
        return raw
    parsed = urlparse(raw)
    return raw if parsed.scheme in ("http", "https") and parsed.netloc else ""


_MEDIA_PATH_PREFIX = "/media/"


def _is_own_backend_host(hostname):
    """SEC-FE-RICH-MEDIA-ORIGIN-002: _strip_own_media_origin() below must
    only rewrite an absolute URL when it actually points at THIS backend
    -- a path merely starting with "/media/" is not enough on its own, an
    independent live probe found a genuinely different host
    ("https://cdn.example.com/media/remote.jpg", an admin-pasted external
    image whose own file layout happens to also use a "/media/" prefix)
    silently rewritten down to a same-origin relative path, which would
    have repointed it at whatever (if anything) THIS backend happens to
    serve at that identical path -- wrong content, or a 404, either way
    not the stored value. settings.ALLOWED_HOSTS is the existing trust
    boundary for "a Host header this backend actually answers requests
    for": any URL that was genuinely persisted by an upload against this
    backend necessarily carried a Host header Django accepted at write
    time (Django itself returns 400 Bad Request for anything else, DEBUG
    aside), so reusing that boundary here -- by hostname only, ignoring
    port, since the same backend is legitimately reachable on different
    ports across dev/prod -- is correct rather than inventing a new one."""
    if not hostname:
        return False
    hostname = hostname.lower()
    for allowed in settings.ALLOWED_HOSTS:
        allowed = allowed.strip().lower()
        if allowed in ("*", hostname):
            return True
        if allowed.startswith(".") and (hostname == allowed[1:] or hostname.endswith(allowed)):
            return True
    return False


def _strip_own_media_origin(raw):
    """The origin-stripping half of _safe_media_url() below, split out so
    it can also run as a non-destructive read-time narrowing step (see
    _sanitize_media_urls()) -- unlike _safe_media_url(), this never blanks
    an unsafe value, it only rewrites an absolute URL that already points
    at this backend's own /media/ path down to a bare relative path.
    Anything else (already relative, a genuinely different host, not even
    a valid URL) is returned unchanged."""
    parsed = urlparse(raw)
    if (
        parsed.scheme in ("http", "https")
        and parsed.netloc
        and parsed.path.startswith(_MEDIA_PATH_PREFIX)
        and _is_own_backend_host(parsed.hostname)
    ):
        return urlunparse(("", "", parsed.path, parsed.params, parsed.query, parsed.fragment))
    return raw


def _safe_media_url(value):
    """Like _safe_url(), but additionally strips the scheme+host off any
    absolute URL under this backend's own media path (matching
    MEDIA_URL's default in backend/config/settings/base.py, mirrored from
    the frontend's normalizeMediaOrigin() in
    frontend/src/lib/media/safe-url.ts). SEC-FE-RICH-MEDIA-ORIGIN-001's
    residual gap: editor_json can carry whatever Host the upload request
    happened to resolve against at authoring time (e.g. a dev machine's
    "http://localhost:3000"), and this renderer used to re-emit that same
    wrong absolute URL on every single read, forever, from a stored
    document. A bare "/media/..." path is always correct for every
    consumer of this HTML: this backend itself serves that exact path,
    and the frontend's own next.config.ts rewrites proxy the identical
    path straight through to this backend -- there is no origin left to
    get wrong. Only used for actual media src attributes (image/gallery/
    video), never for link hrefs, which may legitimately point anywhere."""
    raw = _safe_url(value)
    if not raw:
        return raw
    return _strip_own_media_origin(raw)


_MEDIA_URL_NODE_TYPES = ("image", "besatMediaBlock")


def _sanitize_media_urls(node):
    """Read-time (and, via validate_tiptap_document(), write-time)
    counterpart to _safe_media_url()'s render-time origin stripping --
    same relationship _sanitize_table_colwidths() has to _safe_colwidth().

    SEC-FE-RICH-MEDIA-ORIGIN-001's reopened residual: _safe_media_url()
    only ever ran inside render_tiptap_node(), i.e. only on the rendered
    body_html output. The serializers also expose the *raw* stored
    document as body_json/editor_json for the CMS editor's own hydration
    and for any other API consumer -- a live check found a News detail
    response with zero localhost strings in body_html (the render-time
    fix already covers that) but three persisted
    "http://localhost:3000/media/..." values still sitting untouched
    inside body_json.content[...].attrs.items. This walks the same tree
    _sanitize_table_colwidths() already walks and narrows every image/
    besatMediaBlock attrs.src and every besatGalleryBlock attrs.items[]
    entry's src the exact same way _safe_media_url() narrows them for
    HTML -- in place, non-destructively (an already-safe or already-
    relative value is left untouched; only a same-origin-media absolute
    URL is rewritten), so both the rendered HTML and the raw JSON a
    client reads agree on the same relative path."""
    if not isinstance(node, dict):
        return
    node_type = node.get("type")
    attrs = node.get("attrs")
    if node_type in _MEDIA_URL_NODE_TYPES and isinstance(attrs, dict):
        src = attrs.get("src")
        if isinstance(src, str) and src:
            attrs["src"] = _strip_own_media_origin(src)
    elif node_type == "besatGalleryBlock" and isinstance(attrs, dict):
        items = attrs.get("items")
        # _gallery_items() above accepts items stored as either a native
        # list or a JSON-encoded string (some client versions serialize
        # it that way) -- mirror that here so a string-stored gallery
        # isn't silently skipped.
        was_json_string = isinstance(items, str)
        if was_json_string:
            try:
                items = json.loads(items)
            except (TypeError, ValueError):
                items = None
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("src"), str) and item["src"]:
                    item["src"] = _strip_own_media_origin(item["src"])
            if was_json_string:
                attrs["items"] = json.dumps(items)
    for child in node.get("content") or []:
        _sanitize_media_urls(child)


_YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,}$")
_VIMEO_ID_RE = re.compile(r"^\d+$")


def normalize_safe_embed_url(value):
    """Mirror of frontend/src/lib/editor/structured-content.ts's
    normalizeSafeEmbedUrl: only YouTube/Vimeo URLs survive, rewritten to a
    fixed privacy-friendlier embed form. Anything else (including
    javascript:/data: URLs or unrelated hosts) returns None."""
    raw = str(value or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        return None

    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path_parts = [part for part in parsed.path.split("/") if part]

    video_id = ""
    if host == "youtu.be":
        video_id = path_parts[0] if path_parts else ""
    elif host in ("youtube.com", "youtube-nocookie.com"):
        if parsed.path == "/watch":
            query = parse_qs(parsed.query)
            video_id = (query.get("v") or [""])[0]
        elif parsed.path.startswith("/embed/") and len(path_parts) >= 2:
            video_id = path_parts[1]
        elif parsed.path.startswith("/shorts/") and len(path_parts) >= 2:
            video_id = path_parts[1]

    if video_id and _YOUTUBE_ID_RE.fullmatch(video_id):
        return f"https://www.youtube-nocookie.com/embed/{video_id}"

    if host in ("vimeo.com", "player.vimeo.com"):
        vimeo_id = ""
        if host == "player.vimeo.com":
            if "video" in path_parts:
                index = path_parts.index("video")
                if index + 1 < len(path_parts):
                    vimeo_id = path_parts[index + 1]
        elif path_parts:
            vimeo_id = path_parts[0]
        if vimeo_id and _VIMEO_ID_RE.fullmatch(vimeo_id):
            return f"https://player.vimeo.com/video/{vimeo_id}"

    return None


def _safe_dimension(value, fallback):
    raw = str(value or "").strip()
    if re.fullmatch(r"\d+(?:px|rem|%)", raw):
        return raw
    return fallback


def _safe_enum(value, allowed, default):
    """Whitelists a stored attr against a fixed set of values -- every new
    presentation attr (theme/density/tone/style/language/aspect/radius/...)
    goes through this so a tampered/forged editor_json payload can never
    smuggle an arbitrary string into a class name or data attribute."""
    return value if value in allowed else default


def _attr(name, value):
    return f' {name}="{escape(str(value), quote=True)}"' if value else ""


def _bool_attr(value):
    return "true" if value else "false"


def _gallery_items(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            value = []

    if not isinstance(value, list):
        return []

    items = []
    for item in value:
        if not isinstance(item, dict):
            continue
        src = _safe_media_url(item.get("src"))
        if not src:
            continue
        items.append({
            "src": src,
            "type": "video" if item.get("type") == "video" else "image",
            "id": str(item.get("id") or "").strip(),
            "title": str(item.get("title") or "").strip(),
            "alt": str(item.get("alt") or "").strip(),
            "caption": str(item.get("caption") or "").strip(),
            "credit": str(item.get("credit") or "").strip(),
        })
    return items


def _plain_text_of(node):
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return str(node.get("text") or "")
    return "".join(_plain_text_of(child) for child in node.get("content") or [])


def _render_children(node):
    return "".join(render_tiptap_node(child) for child in node.get("content") or [])


_TABLE_THEMES = ("minimal", "bordered", "striped", "accent-header", "soft", "compact", "formal")
_TABLE_DENSITIES = ("compact", "normal", "comfortable")
_CELL_VALIGNS = ("top", "middle", "bottom")
_MAX_TABLE_COLWIDTH_PX = 2000


def _safe_colwidth(value):
    """Validates one prosemirror-tables `colwidth` entry: must be a finite
    positive integer within a sane pixel bound, never a bool (which is
    technically an int subclass in Python) and never an arbitrary/forged
    huge or negative number from a tampered editor_json payload."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    width = int(value)
    return width if 1 <= width <= _MAX_TABLE_COLWIDTH_PX else None


def _row_column_widths(row):
    """Expands one table row's cells into a flat per-output-column width
    list. Each cell's `attrs.colwidth` is prosemirror-tables' own
    convention: one entry per column the cell spans (so a colspan=2 cell
    can carry two independent widths); a missing/invalid entry leaves that
    column `None` (sized naturally) instead of dropping the whole row's
    widths."""
    widths = []
    for cell in row.get("content") or []:
        if not isinstance(cell, dict):
            continue
        cell_attrs = cell.get("attrs") if isinstance(cell.get("attrs"), dict) else {}
        colspan = cell_attrs.get("colspan")
        colspan = colspan if isinstance(colspan, int) and colspan > 0 else 1
        raw_widths = cell_attrs.get("colwidth")
        raw_widths = raw_widths if isinstance(raw_widths, list) else []
        for index in range(colspan):
            entry = raw_widths[index] if index < len(raw_widths) else None
            widths.append(_safe_colwidth(entry))
    return widths


def _colgroup_html(rows):
    """Builds a `<colgroup>` from the table's first row's effective column
    widths (CMS-TABLE-COLWIDTH-001: the public renderer previously dropped
    every stored `colwidth` outright). Omitted entirely when the first row
    carries no valid width at all, matching the existing natural-sizing
    behavior for tables that never had explicit widths set."""
    if not rows:
        return ""
    widths = _row_column_widths(rows[0])
    if not any(widths):
        return ""
    cols = "".join(f'<col width="{width}">' if width else "<col>" for width in widths)
    return f"<colgroup>{cols}</colgroup>"


def _render_table(node, attrs):
    theme = _safe_enum(attrs.get("theme"), _TABLE_THEMES, "minimal")
    density = _safe_enum(attrs.get("density"), _TABLE_DENSITIES, "normal")
    striped = bool(attrs.get("striped"))
    full_width = attrs.get("fullWidth") is not False
    caption = str(attrs.get("caption") or "").strip()

    classes = ["besat-table", f"besat-table--theme-{theme}", f"besat-table--density-{density}"]
    if striped:
        classes.append("besat-table--striped")
    classes.append("besat-table--full-width" if full_width else "besat-table--auto-width")

    # A leading run of rows made entirely of tableHeader cells becomes a
    # real <thead> for correct table semantics; everything else is <tbody>.
    rows = [row for row in (node.get("content") or []) if isinstance(row, dict)]
    split = 0
    while split < len(rows):
        cells = [cell for cell in (rows[split].get("content") or []) if isinstance(cell, dict)]
        if rows[split].get("type") == "tableRow" and cells and all(cell.get("type") == "tableHeader" for cell in cells):
            split += 1
        else:
            break

    thead_html = "".join(render_tiptap_node(row) for row in rows[:split])
    tbody_html = "".join(render_tiptap_node(row) for row in rows[split:])
    caption_html = f"<caption>{escape(caption)}</caption>" if caption else ""
    colgroup_html = _colgroup_html(rows)
    thead_wrap = f"<thead>{thead_html}</thead>" if thead_html else ""

    table_html = (
        f'<table class="{" ".join(classes)}" data-theme="{theme}" data-density="{density}"'
        f' data-striped="{_bool_attr(striped)}" data-full-width="{_bool_attr(full_width)}">'
        f"{caption_html}{colgroup_html}{thead_wrap}<tbody>{tbody_html}</tbody></table>"
    )
    return f'<div class="besat-table-wrapper">{table_html}</div>'


def _render_table_cell(tag, attrs, children):
    valign = _safe_enum(attrs.get("verticalAlign"), _CELL_VALIGNS, "top")
    class_attr = f' class="besat-valign-{valign}"' if valign != "top" else ""
    span_attrs = ""
    colspan = attrs.get("colspan")
    rowspan = attrs.get("rowspan")
    if isinstance(colspan, int) and colspan > 1:
        span_attrs += f' colspan="{colspan}"'
    if isinstance(rowspan, int) and rowspan > 1:
        span_attrs += f' rowspan="{rowspan}"'
    return f"<{tag}{class_attr}{span_attrs}>{children}</{tag}>"


_IMAGE_RADII = ("none", "sm", "md", "lg")


def _render_image(attrs):
    src = _safe_media_url(attrs.get("src"))
    if not src:
        return ""
    alt = escape(str(attrs.get("alt") or ""), quote=True)
    title = escape(str(attrs.get("title") or ""), quote=True)
    title_attr = f' title="{title}"' if title else ""
    width = _safe_dimension(attrs.get("width"), "")
    align = attrs.get("align") if attrs.get("align") in ("left", "center", "right") else "center"
    margin = {
        "left": "margin:0 auto 0 0;",
        "right": "margin:0 0 0 auto;",
        "center": "margin:0 auto;",
    }[align]
    width_attr = f' data-width="{escape(width, quote=True)}"' if width else ""
    radius = _safe_enum(attrs.get("radius"), _IMAGE_RADII, "none")
    radius_attr = f' data-radius="{radius}"' if radius != "none" else ""
    img_style = (
        "display:block;max-width:100%;height:auto;"
        + margin
        + (f"width:{escape(width, quote=True)};" if width else "")
    )
    img_html = (
        f'<img src="{escape(src, quote=True)}" alt="{alt}"{title_attr}'
        f' data-align="{align}"{width_attr}{radius_attr} style="{img_style}">'
    )

    caption = str(attrs.get("caption") or "").strip()
    link_href = _safe_url(attrs.get("link"))
    lightbox = bool(attrs.get("lightbox"))

    if not caption and not link_href and not lightbox:
        return img_html

    if link_href:
        img_html = f'<a href="{escape(link_href, quote=True)}">{img_html}</a>'

    figcaption = f"<figcaption>{escape(caption)}</figcaption>" if caption else ""
    lightbox_attr = ' data-lightbox="true"' if lightbox else ""
    return (
        f'<figure data-besat-block="image" data-align="{align}"{width_attr}{radius_attr}{lightbox_attr}>'
        f"{img_html}{figcaption}</figure>"
    )


_GALLERY_COLUMNS = ("2", "3", "4", "auto")
_GALLERY_GAPS = ("compact", "normal", "comfortable")
_GALLERY_ASPECTS = ("natural", "square", "4:3", "16:9")


def _render_gallery_block(attrs):
    items = _gallery_items(attrs.get("items"))
    item_html = "".join(
        '<div data-besat-gallery-item data-type="{}" data-src="{}"{}{}{}{}{}></div>'.format(
            item["type"],
            escape(item["src"], quote=True),
            _attr("data-id", item["id"]),
            _attr("data-title", item["title"]),
            _attr("data-alt", item["alt"]),
            _attr("data-caption", item["caption"]),
            _attr("data-credit", item["credit"]),
        )
        for item in items
    )
    width = escape(_safe_dimension(attrs.get("width"), "100%"), quote=True)
    height = escape(_safe_dimension(attrs.get("height"), "14rem"), quote=True)
    columns = _safe_enum(str(attrs.get("columns") or "auto"), _GALLERY_COLUMNS, "auto")
    gap = _safe_enum(attrs.get("gap"), _GALLERY_GAPS, "normal")
    aspect = _safe_enum(attrs.get("aspect"), _GALLERY_ASPECTS, "natural")
    captions = attrs.get("captions") is not False
    lightbox = attrs.get("lightbox") is not False
    aspect_class = aspect.replace(":", "-")

    return (
        '<section data-besat-block="gallery" data-width="{}" data-height="{}" '
        'data-columns="{}" data-gap="{}" data-aspect="{}" data-captions="{}" data-lightbox="{}" '
        'class="besat-gallery besat-gallery--columns-{} besat-gallery--gap-{} besat-gallery--aspect-{}">'
        "{}</section>"
    ).format(
        width, height, columns, gap, aspect, _bool_attr(captions), _bool_attr(lightbox),
        columns, gap, aspect_class, item_html,
    )


_CODE_LANGUAGES = ("plaintext", "javascript", "typescript", "python", "html", "css", "json", "bash")


def _render_code_block(node, attrs):
    language = _safe_enum(attrs.get("language"), _CODE_LANGUAGES, "plaintext")
    line_numbers = bool(attrs.get("lineNumbers"))
    wrap = bool(attrs.get("wrap"))
    copy_button = attrs.get("copyButton") is not False
    code_text = _plain_text_of(node)

    if line_numbers:
        lines = code_text.split("\n")
        body = "".join(f'<span class="besat-code-line">{escape(line)}</span>\n' for line in lines)
    else:
        body = escape(code_text)

    copy_html = (
        '<button type="button" class="besat-code-copy-button" data-copy-code>کپی</button>'
        if copy_button
        else ""
    )
    return (
        f'<pre class="besat-code" data-language="{language}" data-line-numbers="{_bool_attr(line_numbers)}"'
        f' data-wrap="{_bool_attr(wrap)}" data-copy="{_bool_attr(copy_button)}">'
        f'{copy_html}<code class="language-{language}">{body}</code></pre>'
    )


def render_tiptap_node(node):
    if not isinstance(node, dict):
        return ""

    node_type = node.get("type")
    if node_type == "text":
        value = escape(str(node.get("text") or ""))
        for mark in node.get("marks") or []:
            if not isinstance(mark, dict):
                continue
            mark_type = mark.get("type")
            if mark_type == "bold":
                value = f"<strong>{value}</strong>"
            elif mark_type == "italic":
                value = f"<em>{value}</em>"
            elif mark_type == "underline":
                value = f"<u>{value}</u>"
            elif mark_type == "strike":
                value = f"<s>{value}</s>"
            elif mark_type == "code":
                value = f"<code>{value}</code>"
            elif mark_type == "subscript":
                value = f"<sub>{value}</sub>"
            elif mark_type == "superscript":
                value = f"<sup>{value}</sup>"
            elif mark_type == "link":
                attrs = mark.get("attrs") if isinstance(mark.get("attrs"), dict) else {}
                href = _safe_url(attrs.get("href"))
                if href:
                    rel_attr = ' target="_blank" rel="noopener noreferrer"' if attrs.get("target") == "_blank" else ""
                    value = f'<a href="{escape(href, quote=True)}"{rel_attr}>{value}</a>'
            elif mark_type in ("textStyle", "highlight"):
                color = None
                attrs = mark.get("attrs") if isinstance(mark.get("attrs"), dict) else {}
                candidate = attrs.get("color")
                if isinstance(candidate, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", candidate):
                    color = candidate
                if color:
                    style = f"color:{color};" if mark_type == "textStyle" else f"background-color:{color};"
                    tag = "span" if mark_type == "textStyle" else "mark"
                    value = f'<{tag} style="{style}">{value}</{tag}>'
        return value

    children = _render_children(node)
    attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
    if node_type == "doc":
        return children
    if node_type == "paragraph":
        return f"<p>{children}</p>"
    if node_type == "heading":
        level = attrs.get("level", 2)
        level = level if level in (1, 2, 3, 4, 5, 6) else 2
        return f"<h{level}>{children}</h{level}>"
    if node_type == "blockquote":
        return f"<blockquote>{children}</blockquote>"
    if node_type == "bulletList":
        return f"<ul>{children}</ul>"
    if node_type == "orderedList":
        return f"<ol>{children}</ol>"
    if node_type == "listItem":
        return f"<li>{children}</li>"
    if node_type == "horizontalRule":
        return "<hr>"
    if node_type == "image":
        return _render_image(attrs)
    if node_type == "besatGalleryBlock":
        return _render_gallery_block(attrs)
    if node_type == "table":
        return _render_table(node, attrs)
    if node_type == "tableRow":
        return f"<tr>{children}</tr>"
    if node_type == "tableHeader":
        return _render_table_cell("th", attrs, children)
    if node_type == "tableCell":
        return _render_table_cell("td", attrs, children)
    if node_type == "codeBlock":
        return _render_code_block(node, attrs)
    if node_type == "besatMediaBlock":
        return _render_media_block(attrs)
    if node_type == "besatQuoteBlock":
        return _render_quote_block(attrs)
    if node_type == "besatCalloutBlock":
        return _render_callout_block(attrs)
    if node_type == "besatEmbedBlock":
        return _render_embed_block(attrs)
    return children


def _render_media_block(attrs):
    src = _safe_media_url(attrs.get("src"))
    if not src:
        return ""
    media_type = "video" if attrs.get("mediaType") == "video" else "image"
    title = str(attrs.get("title") or "").strip()
    alt = str(attrs.get("alt") or "").strip()
    caption = str(attrs.get("caption") or "").strip() or title
    credit = str(attrs.get("credit") or "").strip()
    width = _safe_dimension(attrs.get("width"), "")
    height = _safe_dimension(attrs.get("height"), "")

    media = (
        f'<video src="{escape(src, quote=True)}" controls preload="metadata"></video>'
        if media_type == "video"
        else f'<img src="{escape(src, quote=True)}" alt="{escape(alt, quote=True)}">'
    )
    figcaption = f"<figcaption>{escape(caption)}</figcaption>" if caption else ""
    cite = f"<cite>{escape(credit)}</cite>" if credit else ""

    return (
        f'<figure data-besat-block="media" data-src="{escape(src, quote=True)}"'
        f' data-media-type="{media_type}"{_attr("data-title", title)}'
        f'{_attr("data-alt", alt)}{_attr("data-caption", caption)}'
        f'{_attr("data-credit", credit)}{_attr("data-width", width)}'
        f'{_attr("data-height", height)}>{media}{figcaption}{cite}</figure>'
    )


_QUOTE_STYLES = ("classic", "accent", "minimal")


def _render_quote_block(attrs):
    text = str(attrs.get("text") or "").strip()
    if not text:
        return ""
    cite = str(attrs.get("cite") or "").strip()
    author = str(attrs.get("author") or "").strip()
    source = str(attrs.get("source") or "").strip()
    style = _safe_enum(attrs.get("style"), _QUOTE_STYLES, "classic")
    attribution = " — ".join(part for part in (author, source) if part) or cite
    cite_html = f"<cite>{escape(attribution)}</cite>" if attribution else ""
    return (
        f'<blockquote data-besat-block="quote" data-text="{escape(text, quote=True)}" data-style="{style}"'
        f'{_attr("data-cite", cite)}{_attr("data-author", author)}{_attr("data-source", source)}>'
        f"<p>{escape(text)}</p>{cite_html}</blockquote>"
    )


_CALLOUT_TONES = ("note", "info", "success", "warning", "important")

# Kept in lockstep with CALLOUT_ICON_PATHS in
# frontend/src/components/editor/rich-editor.tsx so the editor preview and
# the published page always show the same icon per tone.
_CALLOUT_ICON_PATHS = {
    "note": ["M6 4h9l3 3v13H6V4Z", "M9 9h6", "M9 13h6", "M9 17h3"],
    "info": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8h.01", "M11 12h1v4h1"],
    "success": ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.5l2.5 2.5L16 9"],
    "warning": [
        "M10.24 3.957 2.98 16.75A2 2 0 0 0 4.72 19.75h14.56a2 2 0 0 0 1.74-3L13.76 3.957a2 2 0 0 0-3.52 0Z",
        "M12 9v4",
        "M12 16h.01",
    ],
    "important": ["M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3Z", "M12 8v5", "M12 16h.01"],
}


def _callout_icon_svg(tone):
    paths = "".join(f'<path d="{d}"></path>' for d in _CALLOUT_ICON_PATHS[tone])
    return (
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '
        f'class="besat-callout-icon">{paths}</svg>'
    )


def _render_callout_block(attrs):
    body = str(attrs.get("body") or "").strip()
    if not body:
        return ""
    title = str(attrs.get("title") or "").strip()
    cite = str(attrs.get("cite") or "").strip()
    tone = _safe_enum(attrs.get("tone"), _CALLOUT_TONES, "info")
    title_html = f"<h3>{escape(title)}</h3>" if title else ""
    cite_html = f"<cite>{escape(cite)}</cite>" if cite else ""
    return (
        f'<section data-besat-block="callout" data-tone="{tone}"'
        f'{_attr("data-title", title)} data-body="{escape(body, quote=True)}"'
        f'{_attr("data-cite", cite)}>{_callout_icon_svg(tone)}{title_html}<p>{escape(body)}</p>{cite_html}</section>'
    )


_EMBED_ASPECTS = ("16:9", "4:3", "1:1")


def _render_embed_block(attrs):
    src = normalize_safe_embed_url(attrs.get("src"))
    if not src:
        return ""
    title = str(attrs.get("title") or "").strip() or "ویدئوی درج‌شده"
    caption = str(attrs.get("caption") or "").strip()
    aspect = _safe_enum(attrs.get("aspect"), _EMBED_ASPECTS, "16:9")
    figcaption = f"<figcaption>{escape(caption)}</figcaption>" if caption else ""
    return (
        f'<figure data-besat-block="embed" data-src="{escape(src, quote=True)}"'
        f' data-title="{escape(title, quote=True)}" data-aspect="{aspect}"{_attr("data-caption", caption)}>'
        f'<iframe src="{escape(src, quote=True)}" title="{escape(title, quote=True)}"'
        f' loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>'
        f"</iframe>{figcaption}</figure>"
    )


def render_tiptap_html(value):
    if not isinstance(value, dict) or value.get("type") != "doc":
        return ""
    return render_tiptap_node(value)
