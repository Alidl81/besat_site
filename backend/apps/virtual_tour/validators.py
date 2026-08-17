from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

# Panoramas are typically large equirectangular photographs (4000x2000+),
# meaningfully bigger than an ordinary gallery photo -- hence the higher
# cap than apps/gallery/validators.py's 8MB.
ALLOWED_PANORAMA_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_PANORAMA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PANORAMA_SIZE = 20 * 1024 * 1024  # 20 MB
MIN_PANORAMA_ASPECT_RATIO = 1.6  # equirectangular panoramas are ~2:1; reject obviously-wrong crops


def _verify_image_bytes(file, error_message):
    """Reject files that are not genuinely decodable as the declared image
    type (MIME-spoofing / extension-spoofing defense), mirroring
    apps/gallery/validators.py's identical helper."""
    position = file.tell() if hasattr(file, "tell") else None
    try:
        image = Image.open(file)
        image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError(error_message)
    finally:
        if position is not None:
            file.seek(position)


def validate_panorama_image_file(file):
    """Model-field validator: runs on every full_clean(). A bare FieldFile
    (no upload metadata) is trusted -- it was already validated once at
    upload time by this same function, matching the gallery validator's
    documented convention."""
    if not file:
        return

    file_size = getattr(file, "size", 0)
    if file_size and file_size > MAX_PANORAMA_SIZE:
        raise ValidationError("حجم تصویر پانوراما نباید بیشتر از ۲۰ مگابایت باشد.")

    content_type = getattr(file, "content_type", None)
    if not content_type:
        return

    if content_type not in ALLOWED_PANORAMA_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()
    if not extension or extension not in ALLOWED_PANORAMA_EXTENSIONS:
        raise ValidationError("فرمت تصویر پانوراما باید jpg، jpeg، png یا webp باشد.")

    _verify_image_bytes(file, "فایل ارسال‌شده یک تصویر معتبر نیست.")


def validate_thumbnail_image_file(file):
    """Same shape as the gallery image validator (8MB is plenty for a cover thumbnail)."""
    if not file:
        return

    file_size = getattr(file, "size", 0)
    if file_size and file_size > 8 * 1024 * 1024:
        raise ValidationError("حجم تصویر بندانگشتی نباید بیشتر از ۸ مگابایت باشد.")

    content_type = getattr(file, "content_type", None)
    if not content_type:
        return

    if content_type not in ALLOWED_PANORAMA_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()
    if not extension or extension not in ALLOWED_PANORAMA_EXTENSIONS:
        raise ValidationError("فرمت تصویر باید jpg، jpeg، png یا webp باشد.")

    _verify_image_bytes(file, "فایل ارسال‌شده یک تصویر معتبر نیست.")
