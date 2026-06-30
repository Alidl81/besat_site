from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AboutPage
from .serializers import AboutPageSerializer


def empty_about_payload():
    return {
        "title": None,
        "description": None,
        "image": None,
        "meta_description": None,
    }


class AboutPageAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["About"],
        summary="Get public about page information",
        responses=AboutPageSerializer,
    )
    def get(self, request):
        about_page = AboutPage.objects.filter(is_active=True).first()

        if about_page is None:
            return Response(empty_about_payload())

        serializer = AboutPageSerializer(
            about_page,
            context={
                "request": request,
            },
        )

        return Response(serializer.data)