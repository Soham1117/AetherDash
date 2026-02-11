from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PredictionViewSet, FinanceAgentView

router = DefaultRouter()
router.register(r"agent", FinanceAgentView, basename="agent")
router.register(r"", PredictionViewSet, basename="prediction")

urlpatterns = [
    path("", include(router.urls)),
]
