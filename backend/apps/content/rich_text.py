import json
import re
from html import escape
from urllib.parse import urlparse


def validate_tiptap_document(value):
    if not isinstance(value, dict) or value.get("type") != "doc":
        raise ValueError("بدنه ساختاریافته باید یک سند معتبر ویرایشگر باشد.")
    if "content" in value and not isinstance(value["content"], list):
        raise ValueError("بلوک‌های سند معتبر نیستند.")
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
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith(("/", "#")):
        return raw
    parsed = urlparse(raw)
    return raw if parsed.scheme in ("http", "https") else ""


def _safe_dimension(value, fallback):
    raw = str(value or "").strip()
    if re.fullmatch(r"\d+(?:px|rem|%)", raw):
        return raw
    return fallback


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
        src = _safe_url(item.get("src"))
        if not src:
            continue
        items.append((src, "video" if item.get("type") == "video" else "image"))
    return items


def _render_children(node):
    return "".join(render_tiptap_node(child) for child in node.get("content") or [])


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
            elif mark_type == "link":
                attrs = mark.get("attrs") if isinstance(mark.get("attrs"), dict) else {}
                href = _safe_url(attrs.get("href"))
                if href:
                    value = f'<a href="{escape(href, quote=True)}">{value}</a>'
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
        src = _safe_url(attrs.get("src"))
        if not src:
            return ""
        alt = escape(str(attrs.get("alt") or ""), quote=True)
        title = escape(str(attrs.get("title") or ""), quote=True)
        title_attr = f' title="{title}"' if title else ""
        return f'<figure><img src="{escape(src, quote=True)}" alt="{alt}"{title_attr}></figure>'
    if node_type == "besatGalleryBlock":
        items = "".join(
            '<div data-besat-gallery-item data-type="{}" data-src="{}"></div>'.format(
                media_type,
                escape(src, quote=True),
            )
            for src, media_type in _gallery_items(attrs.get("items"))
        )
        width = escape(_safe_dimension(attrs.get("width"), "100%"), quote=True)
        height = escape(_safe_dimension(attrs.get("height"), "14rem"), quote=True)
        return (
            '<section data-besat-block="gallery" data-width="{}" '
            'data-height="{}">{}</section>'
        ).format(width, height, items)
    if node_type == "table":
        return f"<table><tbody>{children}</tbody></table>"
    if node_type == "tableRow":
        return f"<tr>{children}</tr>"
    if node_type == "tableHeader":
        return f"<th>{children}</th>"
    if node_type == "tableCell":
        return f"<td>{children}</td>"
    if node_type == "codeBlock":
        return f"<pre><code>{children}</code></pre>"
    return children


def render_tiptap_html(value):
    if not isinstance(value, dict) or value.get("type") != "doc":
        return ""
    return render_tiptap_node(value)
