from html import unescape
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
from django.utils.html import strip_tags

ALLOWED_EDITOR_BLOCK_TYPES = {
    "paragraph",
    "header",
    "list",
    "quote",
    "delimiter",
    "image",
}

LEGACY_BLOCK_TYPE_ALIASES = {
    "qoute": "quote",
}

FORBIDDEN_URL_PREFIXES = (
    "javascript:",
    "data:",
    "file:",
    "vbscript:",
)

ALLOWED_URL_SCHEMES = {
    "http",
    "https",
}

MAX_EDITOR_BLOCKS = 100
MAX_EDITOR_TEXT_LENGTH = 10000
MAX_EDITOR_URL_LENGTH = 1000

def default_news_content_json():
    return {
        "time": None,
        "blocks":[],
        "version": None,
    }

def normalize_plain_text(value: str | None) -> str:
    if value is None:
        return ""
    
    value = strip_tags(str(value))
    value = unescape(value)

    return " ".join(value.strip().split())


def validate_editorjs_content(value):
    if value in (None, ""):
        return default_news_content_json()
    
    if not isinstance(value, dict):
        raise ValidationError("ساختار محتوای خبر باید JSON object معتبر باشد.")

    blocks = value.get("blocks", [])

    if blocks is None:
        blocks = []

    if not isinstance(blocks, list):
        raise ValidationError("فهرست بلاک‌های محتوا معتبر نیست.")

    if len(blocks) > MAX_EDITOR_BLOCKS:
        raise ValidationError("تعداد بلاک‌های محتوا بیش از حد مجاز است.")

    if not isinstance(blocks, list):
        raise ValidationError("فیلد blocks باید یک لیست باشد.")

    for index, block in enumerate(blocks):
        if not isinstance(block, dict):
            raise ValidationError(f"بلاک شماره {index + 1} معتبر نیست.")

        block_type = block.get("type")
        block_type = LEGACY_BLOCK_TYPE_ALIASES.get(block_type, block_type)

        if block_type not in ALLOWED_EDITOR_BLOCK_TYPES:
            raise ValidationError(
                f"نوع بلاک '{block_type}' مجاز نیست."
            )

        block["type"] = block_type

        data = block.get("data", {})

        if data is None:
            data = {}

        if not isinstance(data, dict):
            raise ValidationError(f"data بلاک شماره {index + 1} معتبر نیست.")

        _validate_block_data(block_type=block_type, data=data, index=index)

    normalized_value = dict(value)
    normalized_value["blocks"] = blocks

    return normalized_value

def validate_editor_text(value, field_label: str) -> None:
    if value is None:
        return

    if not isinstance(value, str):
        raise ValidationError(f"{field_label} معتبر نیست.")

    if len(value) > MAX_EDITOR_TEXT_LENGTH:
        raise ValidationError(f"{field_label} بیش از حد طولانی است.")


def validate_safe_editor_url(url: str) -> str:
    if not isinstance(url, str):
        raise ValidationError("URL تصویر معتبر نیست.")

    url = url.strip()

    if not url:
        raise ValidationError("URL تصویر الزامی است.")

    if len(url) > MAX_EDITOR_URL_LENGTH:
        raise ValidationError("URL تصویر بیش از حد طولانی است.")

    lowered_url = url.lower().strip()

    if lowered_url.startswith(FORBIDDEN_URL_PREFIXES):
        raise ValidationError("URL تصویر مجاز نیست.")

    if url.startswith("/"):
        return url

    parsed = urlparse(url)

    if parsed.scheme and parsed.scheme not in ALLOWED_URL_SCHEMES:
        raise ValidationError("Scheme لینک مجاز نیست.")

    if not parsed.scheme and not url.startswith("/"):
        raise ValidationError("URL باید داخلی یا http/https باشد.")

    return url

def _validate_block_data(block_type: str, data: dict, index: int) -> None:
    if block_type == "paragraph":
        text = data.get("text", "")

        validate_editor_text(text, f"متن پاراگراف شماره {index + 1}")

    elif block_type == "header":
        text = data.get("text", "")
        level = data.get("level", 2)

        validate_editor_text(text, f"متن تیتر شماره {index + 1}")

        if level not in (1, 2, 3, 4, 5, 6):
            raise ValidationError(f"سطح تیتر شماره {index + 1} معتبر نیست.")

    elif block_type == "list":
        items = data.get("items", [])
        style = data.get("style", "unordered")

        if style not in ("ordered", "unordered", "checklist"):
            raise ValidationError(f"نوع لیست شماره {index + 1} معتبر نیست.")

        if not isinstance(items, list):
            raise ValidationError(f"آیتم‌های لیست شماره {index + 1} معتبر نیستند.")

    elif block_type == "quote":
        text = data.get("text", "")
        caption = data.get("caption", "")

        validate_editor_text(text, f"متن نقل‌قول شماره {index + 1}")
        validate_editor_text(caption, f"توضیح نقل‌قول شماره {index + 1}")

    elif block_type == "image":
        file_data = data.get("file", {})
        caption = data.get("caption", "")

        if not isinstance(file_data, dict):
            raise ValidationError(f"اطلاعات تصویر شماره {index + 1} معتبر نیست.")

        url = file_data.get("url")
        file_data["url"] = validate_safe_editor_url(url)

        validate_editor_text(caption, f"کپشن تصویر شماره {index + 1}")


def extract_editorjs_plain_text(value) -> str:
    if not isinstance(value, dict):
        return ""

    blocks = value.get("blocks", [])

    if not isinstance(blocks, list):
        return ""

    parts: list[str] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue

        block_type = block.get("type")
        data = block.get("data", {})

        if not isinstance(data, dict):
            continue

        if block_type in ("paragraph", "header"):
            parts.append(normalize_plain_text(data.get("text")))

        elif block_type == "quote":
            parts.append(normalize_plain_text(data.get("text")))
            parts.append(normalize_plain_text(data.get("caption")))

        elif block_type == "list":
            parts.extend(_extract_list_items_text(data.get("items", [])))

        elif block_type == "image":
            parts.append(normalize_plain_text(data.get("caption")))

    return normalize_plain_text(" ".join(part for part in parts if part))


def _extract_list_items_text(items) -> list[str]:
    extracted: list[str] = []

    if not isinstance(items, list):
        return extracted

    for item in items:
        if isinstance(item, str):
            extracted.append(normalize_plain_text(item))

        elif isinstance(item, dict):
            extracted.append(normalize_plain_text(item.get("content")))
            extracted.extend(_extract_list_items_text(item.get("items", [])))

    return extracted
