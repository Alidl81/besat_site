from pathlib import Path

from django.core.exceptions import ValidationError


ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_AVATAR_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_AVATAR_SIZE = 5 * 1024 * 1024 # 3MB


def validate_avatar_image_file(file):
    if not file:
        return

    file_size = getattr(file, "size", 0)

    if file_size and file_size > MAX_AVATAR_SIZE:
        raise ValidationError("حجم تصویر پروفایل نباید بیشتر از ۳ مگابایت باشد.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()

    if extension and extension not in ALLOWED_AVATAR_EXTENSIONS:
        raise ValidationError("فرمت تصویر پروفایل باید jpg، jpeg، png یا webp باشد.")

    content_type = getattr(file, "content_type", None)

    if content_type and content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise ValidationError("نوع فایل تصویر پروفایل معتبر نیست.")
