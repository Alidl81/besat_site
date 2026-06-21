from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    tags=["Core"],
    responses={
        200: OpenApiResponse(description="API is healthy"),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def healthy_check(request):
    return Response(
        {
            "status": "ok.",
            "service": "besat-backend",
        }
    )