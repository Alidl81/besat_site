from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import ContactInfo, ContactMessage
from .permissions import HasContactMessageCMSPermission
from .serializers import (
    CMSContactMessageSerializer,
    CMSContactMessageUpdateSerializer,
    ContactInfoSerializer,
    ContactMessageCreateSerializer,
    ContactMessageSuccessSerializer,
)


def empty_contact_payload():
    return {
        "title": "تماس با ما",
        "description": None,
        "address": None,
        "phone": None,
        "phone_secondary": None,
        "email": None,
        "working_hours": None,
        "map_url": None,
        "latitude": None,
        "longitude": None,
    }


class ContactInfoAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Contact"],
        summary="Get public contact information",
        responses=ContactInfoSerializer,
    )
    def get(self, request):
        contact_info = ContactInfo.objects.filter(is_active=True).first()

        if contact_info is None:
            return Response(empty_contact_payload())

        serializer = ContactInfoSerializer(
            contact_info,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)


class ContactMessageCreateAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Contact"],
        summary="Create public contact message",
        request=ContactMessageCreateSerializer,
        responses={
            201: ContactMessageSuccessSerializer,
        },
    )
    def post(self, request):
        serializer = ContactMessageCreateSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": "پیام شما با موفقیت ثبت شد.",
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    list=extend_schema(
        tags=["CMS - Messages"],
        summary="CMS list contact messages",
        parameters=[
            OpenApiParameter("status", str, required=False),
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("ordering", str, required=False),
            OpenApiParameter("page", int, required=False),
        ],
    ),
    retrieve=extend_schema(
        tags=["CMS - Messages"],
        summary="CMS retrieve contact message",
    ),
    update=extend_schema(
        tags=["CMS - Messages"],
        summary="CMS update contact message",
    ),
    partial_update=extend_schema(
        tags=["CMS - Messages"],
        summary="CMS partially update contact message",
    ),
    destroy=extend_schema(
        tags=["CMS - Messages"],
        summary="CMS delete contact message",
    ),
)
class CMSContactMessageViewSet(ModelViewSet):
    queryset = ContactMessage.objects.all()
    permission_classes = [HasContactMessageCMSPermission]

    filter_backends = (
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "full_name",
        "phone",
        "email",
        "subject",
        "message",
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
            return ContactMessage.objects.none()

        queryset = ContactMessage.objects.all().order_by("-created_at", "-id")

        status_param = self.request.query_params.get("status")

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def get_serializer_class(self):
        if self.action in (
            "update",
            "partial_update",
        ):
            return CMSContactMessageUpdateSerializer

        return CMSContactMessageSerializer