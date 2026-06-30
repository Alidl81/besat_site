from pathlib import Path

from django.core.exceptions import ValidationError


ALLOWED_HOME_SLIDE_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_HOME_SLIDE_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_HOME_SLIDE_IMAGE_SIZE = 8 * 1024 * 1024


def validate_home_slide_image_file(file):
    if not file:
        return

    file_size = getattr(file, "size", 0)

    if file_size and file_size > MAX_HOME_SLIDE_IMAGE_SIZE:
        raise ValidationError("حجم تصویر اسلاید نباید بیشتر از ۸ مگابایت باشد.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()

    if extension and extension not in ALLOWED_HOME_SLIDE_IMAGE_EXTENSIONS:
        raise ValidationError("فرمت تصویر اسلاید باید jpg، jpeg، png یا webp باشد.")

    content_type = getattr(file, "content_type", None)

    if content_type and content_type not in ALLOWED_HOME_SLIDE_IMAGE_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")