"""Small metrics compatibility layer for cached local images.

Fresh production images use django-prometheus from requirements. This module
keeps health/metrics routes useful when an older local image lacks that
optional dependency, without changing the real package's production path.
"""

from threading import Lock

from django.http import HttpResponse

_lock = Lock()
_request_count = 0


class PrometheusBeforeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        global _request_count
        with _lock:
            _request_count += 1
        return self.get_response(request)


class PrometheusAfterMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)


def ExportToDjangoView(request):
    with _lock:
        count = _request_count
    body = (
        "# TYPE django_http_requests_before_middlewares_total counter\n"
        f"django_http_requests_before_middlewares_total {count}\n"
    )
    return HttpResponse(body, content_type="text/plain; version=0.0.4")
