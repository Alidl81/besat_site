from pathlib import Path

from django.core.exceptions import ValidationError


ALLOWED_NEWS_IMAGE_CONTENT_TYPES = {
    "image/jepg",
    "image/png",
    "image/webp",
}

ALLOWED_NEWS_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_NEWS_IMAGE_SIZE = 5 * 1024 * 1024 # 5 MB

def validate_news_image_file(file):
    if not file:
        return
    
    file_size = getattr(file, "size", 0)

    if file_size and file_size > MAX_NEWS_IMAGE_SIZE:
        raise ValidationError("حجم تصویر نباید از 5 مگابایت بیشتر باشد.")
    
    filename = getattr(file, "name", "")
    extention = Path(filename).suffix.lower()

    if extention and extention not in ALLOWED_NEWS_IMAGE_EXTENSIONS:
        raise ValidationError("فرمت تصویر باید jpg، jpeg، png یا webp باشد.")
    
    content_type = getattr(file, "content_type", None)

    if content_type and content_type not in ALLOWED_NEWS_IMAGE_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")
    
