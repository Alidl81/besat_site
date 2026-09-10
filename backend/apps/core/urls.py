from django.urls import path

from .views import deep_health_check, healthy_check, liveness_check, metrics_view, readiness_check

app_name = "core"

urlpatterns = [
    # Pre-existing public contract, now backed by a real DB-connectivity
    # check (readiness semantics) instead of an unconditional 200 -- see
    # views.py for why. docker-compose's backend healthcheck targets this.
    path("health/", healthy_check, name="health-check"),
    path("health/live/", liveness_check, name="health-live"),
    path("health/ready/", readiness_check, name="health-ready"),
    path("health/deep/", deep_health_check, name="health-deep"),
    # Internal-token-gated -- see metrics_view's own docstring. Not under
    # django_prometheus.urls's own "metrics" name/path, kept explicit here
    # so it's obvious this is a wrapped, non-default view.
    path("metrics/", metrics_view, name="metrics"),
]
