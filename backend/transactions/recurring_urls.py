from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RecurringTransactionViewSet

router = DefaultRouter()
router.register(r"", RecurringTransactionViewSet, basename="recurring_transactions")

urlpatterns = [
    path("", include(router.urls)),
]
