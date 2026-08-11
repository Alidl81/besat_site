"""Shop CMS permissions. Deliberately a SIMPLER two-tier model than the
branch-scoped news/gallery permission system (verified in
apps.news.permissions and apps.content.cms._ensure_write_access, both of
which give unit_manager real, unit-scoped write/delete/review power):
this shop is a single, unified whole-school catalog, not per-branch
content, so there is no "own unit" concept to scope unit_manager's grant
to. The product spec (Admin / Media Manager / Customer) also only ever
describes two CMS-facing tiers. So here: general_manager = full Admin;
unit_media = content-only Media Manager (no unit scoping needed, since
products aren't unit content); unit_manager and parent get no shop-CMS
grant at all -- a deliberate, documented departure from the news/gallery
precedent, not an oversight."""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.news.permissions import is_general_manager, is_unit_media, user_has_active_profile

# Fields a Media Manager (unit_media) may write. Everything else on
# Product (price_amount, sale_price_amount, and every type-specific
# detail's financial/inventory fields) is admin-only, enforced in the
# viewset, not just hidden in a serializer.
MEDIA_MANAGER_WRITABLE_PRODUCT_FIELDS = {
    "product_type",
    "title",
    "slug",
    "category",
    "tags",
    "short_description",
    "description",
    "featured_image",
    "featured_image_url",
    "is_featured",
    "is_important",
    "focus_keyphrase",
    "seo_title",
    "meta_description",
    "canonical_url",
    "og_title",
    "og_description",
    "og_image_url",
    "is_indexable",
    "is_followable",
    "is_cornerstone",
}


class HasShopProductCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False

        if is_general_manager(request.user):
            return True

        if not is_unit_media(request.user):
            return False

        action = getattr(view, "action", None)

        if action == "upload_image":
            return True
        if action == "submit_review":
            return True
        # Approve/publish/reject/archive/restore/delete are GM-only -- the
        # media role authors and submits content, it does not moderate it.
        if action in ("approve", "publish", "reject", "archive", "restore"):
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.method in ("POST", "PUT", "PATCH"):
            return True
        if request.method == "DELETE":
            return False
        return False

    def has_object_permission(self, request, view, obj) -> bool:
        return self.has_permission(request, view)


class HasShopCategoryCMSPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        if not user_has_active_profile(request.user):
            return False
        if is_general_manager(request.user):
            return True
        if request.method in SAFE_METHODS:
            return is_unit_media(request.user)
        return False


class HasShopOrderCMSPermission(BasePermission):
    """GM-only for every method -- order/payment data is never exposed
    through the media-manager surface."""

    def has_permission(self, request, view) -> bool:
        return is_general_manager(request.user)


HasShopPaymentCMSPermission = HasShopOrderCMSPermission
HasShopSettingsCMSPermission = HasShopOrderCMSPermission
