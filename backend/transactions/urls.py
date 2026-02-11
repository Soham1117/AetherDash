from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet, TagViewSet, CategorizationRuleViewSet, RecurringTransactionViewSet, SavingsGoalViewSet

router = DefaultRouter()
router.register(r"tags", TagViewSet, basename="tag")
router.register(r"rules", CategorizationRuleViewSet, basename="rule")
router.register(r"recurring", RecurringTransactionViewSet, basename="recurring")
router.register(r"goals", SavingsGoalViewSet, basename="goal")
router.register(r"", TransactionViewSet, basename="transaction")

urlpatterns = [
    path("", include(router.urls)),
]
