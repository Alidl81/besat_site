from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

ALLOWED_PRODUCT_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_PRODUCT_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_PRODUCT_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB


def _verify_image_bytes(file, error_message):
    """Reject files that are not genuinely decodable as the declared image
    type (MIME-spoofing / extension-spoofing defense), not just files whose
    client-supplied metadata happens to look right."""
    position = file.tell() if hasattr(file, "tell") else None
    try:
        Image.open(file).verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError(error_message)
    finally:
        if position is not None:
            file.seek(position)


def validate_product_image_file(file):
    """Model-field validator, mirrors apps.gallery.validators.validate_gallery_image_file.
    Only a file presenting Django's UploadedFile `content_type` -- i.e. an
    actual fresh multipart upload -- gets the strict, fail-closed checks;
    an already-persisted FieldFile is trusted (validated once at upload)."""
    if not file:
        return

    file_size = getattr(file, "size", 0)
    if file_size and file_size > MAX_PRODUCT_IMAGE_SIZE:
        raise ValidationError("حجم تصویر محصول نباید بیشتر از ۸ مگابایت باشد.")

    content_type = getattr(file, "content_type", None)
    if not content_type:
        return

    if content_type not in ALLOWED_PRODUCT_IMAGE_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()
    if not extension or extension not in ALLOWED_PRODUCT_IMAGE_EXTENSIONS:
        raise ValidationError("فرمت تصویر باید jpg، jpeg، png یا webp باشد.")

    _verify_image_bytes(file, "فایل ارسال‌شده یک تصویر معتبر نیست.")
