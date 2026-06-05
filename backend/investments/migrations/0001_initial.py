from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Security",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("symbol", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(blank=True, default="", max_length=255)),
                ("asset_type", models.CharField(blank=True, default="", max_length=100)),
                ("currency", models.CharField(default="USD", max_length=8)),
                ("exchange", models.CharField(blank=True, default="", max_length=100)),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["symbol"]},
        ),
        migrations.CreateModel(
            name="SnapTradeConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("snaptrade_user_id", models.CharField(max_length=255, unique=True)),
                ("user_secret", models.CharField(max_length=255)),
                ("brokerage_authorization_id", models.CharField(blank=True, max_length=255, null=True)),
                ("brokerage_name", models.CharField(blank=True, max_length=255, null=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("active", "Active"), ("broken", "Broken"), ("disconnected", "Disconnected")], default="pending", max_length=20)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("last_holdings_sync_at", models.DateTimeField(blank=True, null=True)),
                ("last_orders_sync_at", models.DateTimeField(blank=True, null=True)),
                ("disabled_reason", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="snaptrade_connections", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="InvestmentAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider_account_id", models.CharField(max_length=255, unique=True)),
                ("account_name", models.CharField(max_length=255)),
                ("brokerage_name", models.CharField(blank=True, default="", max_length=255)),
                ("account_type", models.CharField(blank=True, default="", max_length=100)),
                ("account_number_mask", models.CharField(blank=True, default="", max_length=32)),
                ("currency", models.CharField(default="USD", max_length=8)),
                ("total_value", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("cash_balance", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("buying_power", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("is_active", models.BooleanField(default=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("connection", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="accounts", to="investments.snaptradeconnection")),
            ],
            options={"ordering": ["account_name"]},
        ),
        migrations.CreateModel(
            name="OrderSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider_order_id", models.CharField(max_length=255, unique=True)),
                ("symbol", models.CharField(blank=True, default="", max_length=50)),
                ("side", models.CharField(blank=True, default="", max_length=32)),
                ("status", models.CharField(blank=True, default="", max_length=64)),
                ("order_type", models.CharField(blank=True, default="", max_length=64)),
                ("quantity", models.DecimalField(decimal_places=8, default=0, max_digits=24)),
                ("filled_quantity", models.DecimalField(decimal_places=8, default=0, max_digits=24)),
                ("limit_price", models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ("stop_price", models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ("average_filled_price", models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ("placed_at", models.DateTimeField(blank=True, null=True)),
                ("executed_at", models.DateTimeField(blank=True, null=True)),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="orders", to="investments.investmentaccount")),
            ],
            options={"ordering": ["-placed_at", "-updated_at"]},
        ),
        migrations.CreateModel(
            name="HoldingSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.DecimalField(decimal_places=8, default=0, max_digits=24)),
                ("average_purchase_price", models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ("current_price", models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ("market_value", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("cost_basis", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("weight_percent", models.DecimalField(decimal_places=4, default=0, max_digits=8)),
                ("as_of", models.DateTimeField()),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="holdings", to="investments.investmentaccount")),
                ("security", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="holdings", to="investments.security")),
            ],
            options={"ordering": ["-market_value", "security__symbol"], "unique_together": {("account", "security")}},
        ),
    ]
