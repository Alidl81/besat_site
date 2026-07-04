from pathlib import Path

from django.core.exceptions import ValidationError


ALLOWED_STAFF_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_STAFF_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_STAFF_IMAGE_SIZE = 5 * 1024 * 1024


def validate_staff_image_file(file):
    if not file:
        return

    file_size = getattr(file, "size", 0)

    if file_size and file_size > MAX_STAFF_IMAGE_SIZE:
        raise ValidationError("حجم تصویر عضو کادر نباید بیشتر از ۵ مگابایت باشد.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()

    if extension and extension not in ALLOWED_STAFF_IMAGE_EXTENSIONS:
        raise ValidationError("فرمت تصویر باید jpg، jpeg، png یا webp باشد.")

    content_type = getattr(file, "content_type", None)

    if content_type and content_type not in ALLOWED_STAFF_IMAGE_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")