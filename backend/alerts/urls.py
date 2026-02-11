from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlertViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"", AlertViewSet, basename="alert")

urlpatterns = [
    path("", include(router.urls)),
]