from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import UserUnitMembership

from .models import RegistrationInfo, RegistrationRequest
from .permissions import (
    HasRegistrationRequestCMSPermission,
    get_accessible_unit_ids,
    is_general_manager,
)
from .serializers import (
    CMSRegistrationRequestSerializer,
    CMSRegistrationRequestUpdateSerializer,
    RegistrationInfoSerializer,
    RegistrationRequestCreateSerializer,
    RegistrationRequestSuccessSerializer,
)


def empty_registration_payload():
    return {
        "title": "پیش‌ثبت‌نام",
        "description": None,
        "is_open": False,
        "open_message": None,
        "closed_message": "در حال حاضر اطلاعات ثبت‌نام فعال نیست.",
        "required_documents": [],
        "notes": None,
    }


class RegistrationInfoAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Registration"],
        summary="Get public registration information",
        responses=RegistrationInfoSerializer,
    )
    def get(self, request):
        registration_info = RegistrationInfo.objects.filter(is_active=True).first()

        if registration_info is None:
            return Response(empty_registration_payload())

        serializer = RegistrationInfoSerializer(
            registration_info,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)

    @extend_schema(
        tags=["Registration"],
        summary="Create public registration request (frontend-compatible alias)",
        request=RegistrationRequestCreateSerializer,
        responses={201: RegistrationRequestSuccessSerializer},
    )
    def post(self, request):
        return create_registration_request_response(request)


class RegistrationRequestCreateAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "registration"

    @extend_schema(
        tags=["Registration"],
        summary="Create public registration request",
        request=RegistrationRequestCreateSerializer,
        responses={
            201: RegistrationRequestSuccessSerializer,
        },
    )
    def post(self, request):
        return create_registration_request_response(request)


def create_registration_request_response(request):
    serializer = RegistrationRequestCreateSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    registration_request = serializer.save()

    return Response(
        {
            "message": "درخواست پیش‌ثبت‌نام با موفقیت ثبت شد.",
            "id": registration_request.id,
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Registration Requests"],
        summary="CMS list registration requests",
        parameters=[
            OpenApiParameter("status", str, required=False),
            OpenApiParameter("unit_id", int, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["CMS - Registration Requests"],
        summary="CMS retrieve registration request",
    ),
    update=extend_schema(
        tags=["CMS - Registration Requests"],
        summary="CMS update registration request",
    ),
    partial_update=extend_schema(
        tags=["CMS - Registration Requests"],
        summary="CMS partially update registration request",
    ),
    destroy=extend_schema(
        tags=["CMS - Registration Requests"],
        summary="CMS delete registration request",
    ),
)
class CMSRegistrationRequestViewSet(ModelViewSet):
    queryset = RegistrationRequest.objects.none()
    permission_classes = [HasRegistrationRequestCMSPermission]

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "student_full_name",
        "parent_full_name",
        "parent_phone",
        "parent_email",
        "requested_grade",
        "description",
        "requested_unit__title",
    )
    ordering_fields = (
        "created_at",
        "updated_at",
        "status",
    )
    ordering = (
        "-created_at",
        "-id",
    )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return RegistrationRequest.objects.none()

        queryset = (
            RegistrationRequest.objects.select_related("requested_unit")
            .order_by("-created_at", "-id")
        )

        if not is_general_manager(self.request.user):
            accessible_unit_ids = get_accessible_unit_ids(self.request.user)

            if not accessible_unit_ids:
                return RegistrationRequest.objects.none()

            queryset = queryset.filter(requested_unit_id__in=accessible_unit_ids)

        status_param = self.request.query_params.get("status")

        if status_param:
            queryset = queryset.filter(status=status_param)

        unit_id = self.request.query_params.get("unit_id")

        if unit_id:
            queryset = queryset.filter(requested_unit_id=unit_id)

        return queryset

    def get_serializer_class(self):
        if self.action in (
            "update",
            "partial_update",
        ):
            return CMSRegistrationRequestUpdateSerializer

        return CMSRegistrationRequestSerializer
