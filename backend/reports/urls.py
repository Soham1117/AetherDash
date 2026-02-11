from django.urls import path
from .views import CashFlowSankeyView

urlpatterns = [
    path('flow/', CashFlowSankeyView.as_view(), name='cashflow-sankey'),
]
