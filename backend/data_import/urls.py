from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BankStatementViewSet

router = DefaultRouter()
router.register(r'', BankStatementViewSet, basename='bank-statement')

urlpatterns = [
    path('', include(router.urls)),
]
