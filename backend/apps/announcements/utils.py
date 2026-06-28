from html import unescape

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


def default_announcement_content_json():
    return {
        "time": None,
        "blocks": [],
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
        return default_announcement_content_json()

    if not isinstance(value, dict):
        raise ValidationError("ساختار محتوای اطلاعیه باید JSON object معتبر باشد.")

    blocks = value.get("blocks", [])

    if blocks is None:
        blocks = []

    if not isinstance(blocks, list):
        raise ValidationError("فیلد blocks باید یک لیست باشد.")

    for index, block in enumerate(blocks):
        if not isinstance(block, dict):
            raise ValidationError(f"بلاک شماره {index + 1} معتبر نیست.")

        block_type = block.get("type")

        if block_type not in ALLOWED_EDITOR_BLOCK_TYPES:
            raise ValidationError(f"نوع بلاک '{block_type}' مجاز نیست.")

        data = block.get("data", {})

        if data is None:
            data = {}

        if not isinstance(data, dict):
            raise ValidationError(f"data بلاک شماره {index + 1} معتبر نیست.")

        _validate_block_data(block_type=block_type, data=data, index=index)

    normalized_value = dict(value)
    normalized_value["blocks"] = blocks

    return normalized_value


def _validate_block_data(block_type: str, data: dict, index: int) -> None:
    if block_type == "paragraph":
        text = data.get("text", "")

        if text is not None and not isinstance(text, str):
            raise ValidationError(f"متن پاراگراف شماره {index + 1} معتبر نیست.")

    elif block_type == "header":
        text = data.get("text", "")
        level = data.get("level", 2)

        if text is not None and not isinstance(text, str):
            raise ValidationError(f"متن تیتر شماره {index + 1} معتبر نیست.")

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

        if text is not None and not isinstance(text, str):
            raise ValidationError(f"متن نقل‌قول شماره {index + 1} معتبر نیست.")

        if caption is not None and not isinstance(caption, str):
            raise ValidationError(f"توضیح نقل‌قول شماره {index + 1} معتبر نیست.")

    elif block_type == "image":
        file_data = data.get("file", {})
        caption = data.get("caption", "")

        if not isinstance(file_data, dict):
            raise ValidationError(f"اطلاعات تصویر شماره {index + 1} معتبر نیست.")

        url = file_data.get("url")

        if not url or not isinstance(url, str):
            raise ValidationError(f"تصویر شماره {index + 1} باید URL معتبر داشته باشد.")

        if caption is not None and not isinstance(caption, str):
            raise ValidationError(f"کپشن تصویر شماره {index + 1} معتبر نیست.")


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