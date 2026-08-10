from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

ALLOWED_GALLERY_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

ALLOWED_GALLERY_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


MAX_GALLERY_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB


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


def validate_gallery_image_file(file):
    """Model-field validator: runs on every full_clean(), including saves
    of already-stored, already-validated files that carry no upload
    metadata (e.g. a FieldFile re-saved after an unrelated field changes).
    Only a file presenting Django's UploadedFile `content_type` — i.e. an
    actual fresh multipart upload — gets the strict, fail-closed checks;
    a bare FieldFile is trusted, since it was already validated once at
    upload time by this same function.
    """
    if not file:
        return

    file_size = getattr(file, "size", 0)
    if file_size and file_size > MAX_GALLERY_IMAGE_SIZE:
        raise ValidationError("حجم تصویر گالری نباید بیشتر از ۸ مگابایت باشد.")

    content_type = getattr(file, "content_type", None)
    if not content_type:
        return

    if content_type not in ALLOWED_GALLERY_IMAGE_CONTENT_TYPES:
        raise ValidationError("نوع فایل معتبر نیست. فقط تصویر مجاز است.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()
    if not extension or extension not in ALLOWED_GALLERY_IMAGE_EXTENSIONS:
        raise ValidationError("فرمت تصویر گالری باید jpg، jpeg، png یا webp باشد.")

    _verify_image_bytes(file, "فایل ارسال‌شده یک تصویر معتبر نیست.")


# --- Media library (images + short-form video) -----------------------------

ALLOWED_MEDIA_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
ALLOWED_MEDIA_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

ALLOWED_MEDIA_VIDEO_CONTENT_TYPES = {
    "video/mp4",
    "video/webm",
    "video/ogg",
}
ALLOWED_MEDIA_VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".ogg"}

MAX_MEDIA_ASSET_SIZE = 25 * 1024 * 1024  # 25 MB

# Signature checks are format-family checks, not full container parsers:
# they reject files whose first bytes cannot possibly belong to the
# declared container, which is the class of MIME/extension spoofing an
# upload endpoint actually needs to defend against.
_VIDEO_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "video/mp4": (b"ftyp",),  # located at byte offset 4 in a valid MP4/ISO-BMFF box
    "video/webm": (b"\x1a\x45\xdf\xa3",),  # EBML header (WebM/Matroska)
    "video/ogg": (b"OggS",),
}


def _verify_video_bytes(file, content_type, error_message):
    position = file.tell() if hasattr(file, "tell") else None
    try:
        header = file.read(64)
    finally:
        if position is not None:
            file.seek(position)

    if not header:
        raise ValidationError(error_message)

    if content_type == "video/mp4":
        if b"ftyp" not in header[:32]:
            raise ValidationError(error_message)
        return

    signatures = _VIDEO_SIGNATURES.get(content_type, ())
    if not any(header.startswith(signature) for signature in signatures):
        raise ValidationError(error_message)


def validate_media_asset_file(file):
    """Serializer-level validator for fresh multipart uploads only (always
    called with a real UploadedFile, so content_type is always present)."""
    if not file:
        raise ValidationError("فایلی برای بارگذاری ارسال نشده است.")

    file_size = getattr(file, "size", 0)
    if file_size and file_size > MAX_MEDIA_ASSET_SIZE:
        raise ValidationError("حجم فایل نباید بیشتر از ۲۵ مگابایت باشد.")

    filename = getattr(file, "name", "")
    extension = Path(filename).suffix.lower()
    content_type = getattr(file, "content_type", None)

    if not content_type:
        raise ValidationError("نوع فایل مشخص نیست.")

    if content_type in ALLOWED_MEDIA_IMAGE_CONTENT_TYPES:
        if not extension or extension not in ALLOWED_MEDIA_IMAGE_EXTENSIONS:
            raise ValidationError("فرمت تصویر پشتیبانی نمی‌شود.")
        _verify_image_bytes(file, "فایل ارسال‌شده یک تصویر معتبر نیست.")
        return

    if content_type in ALLOWED_MEDIA_VIDEO_CONTENT_TYPES:
        if not extension or extension not in ALLOWED_MEDIA_VIDEO_EXTENSIONS:
            raise ValidationError("فرمت ویدئو پشتیبانی نمی‌شود.")
        _verify_video_bytes(file, content_type, "فایل ارسال‌شده یک ویدئوی معتبر نیست.")
        return

    raise ValidationError("نوع فایل پشتیبانی نمی‌شود.")
