from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("alerts/", include("alerts.urls")),
    path("auth/", include("users.urls")),
    path("budgets/", include("budgets.urls")),
    path("recurring_transactions/", include("transactions.recurring_urls")),
    path("transactions/", include("transactions.urls")),
    path("predictions/", include("predictions.urls")),
    path("receipts/", include("receipts.urls")),
    path("plaid_integration/", include("plaid_integration.urls")),
    path("categories/", include("categories.urls")),
    path("import/", include("data_import.urls")),
    path("reports/", include("reports.urls")),
]
