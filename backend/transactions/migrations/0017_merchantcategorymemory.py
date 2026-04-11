from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("categories", "0002_initial"),
        ("transactions", "0016_transaction_transfer_override"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MerchantCategoryMemory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("merchant_key", models.CharField(db_index=True, max_length=255)),
                ("confidence", models.FloatField(default=1.0)),
                ("times_seen", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category_ref", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="categories.category")),
                ("learned_from_transaction", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="transactions.transaction")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="merchant_category_memories", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("user", "merchant_key")}},
        ),
    ]
