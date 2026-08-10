import hashlib
import hmac
import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import UserInvitation


logger = logging.getLogger(__name__)

TOKEN_BYTES = 32


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_invitation(user, created_by) -> tuple[UserInvitation, str]:
    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    invitation = UserInvitation.objects.create(
        user=user,
        created_by=created_by,
        token_hash=hash_token(raw_token),
        expires_at=timezone.now() + UserInvitation.TOKEN_VALIDITY,
    )
    logger.info(
        "user invitation created: invitation_id=%s user_id=%s created_by_id=%s expires_at=%s",
        invitation.id, user.id, getattr(created_by, "id", None), invitation.expires_at.isoformat(),
    )
    return invitation, raw_token


def find_invitation(raw_token: str):
    token_hash = hash_token(raw_token)
    invitation = (
        UserInvitation.objects.select_related("user")
        .filter(token_hash=token_hash)
        .first()
    )
    # The unique lookup above already enforces equality; re-checking with a
    # constant-time comparison keeps a future query change from silently
    # weakening this into a timing-observable match.
    if invitation is None or not hmac.compare_digest(invitation.token_hash, token_hash):
        return None
    return invitation


def build_invite_link(raw_token: str) -> str:
    base_url = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base_url}/set-password?token={raw_token}"


def email_backend_is_configured() -> bool:
    return bool(settings.EMAIL_HOST)


def send_invitation_email(user, raw_token: str) -> bool:
    if not email_backend_is_configured() or not user.email:
        return False

    link = build_invite_link(raw_token)

    try:
        send_mail(
            subject="تعیین رمز عبور حساب کاربری — مجتمع آموزشی بعثت",
            message=(
                "حساب کاربری شما در سامانه مجتمع آموزشی بعثت ایجاد شد.\n"
                f"برای تعیین رمز عبور، روی لینک زیر کلیک کنید:\n\n{link}\n\n"
                "این لینک تا ۷۲ ساعت دیگر معتبر است و فقط یک‌بار قابل استفاده است."
            ),
            from_email=None,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception:
        # Email delivery must never block user creation — the raw link is
        # always returned in the API response as a fallback (see CMSUserViewSet.create).
        logger.exception("user invitation email failed: user_id=%s", user.id)
        return False

    logger.info("user invitation email sent: user_id=%s", user.id)
    return True
