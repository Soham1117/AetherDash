from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, CreditCardProfileViewSet

router = DefaultRouter()
router.register(r'credit-card-profiles', CreditCardProfileViewSet, basename='credit-card-profile')
router.register(r'', AccountViewSet, basename='account')

urlpatterns = [
    path('', include(router.urls)),
]
