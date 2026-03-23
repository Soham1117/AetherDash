from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_account_color"),
    ]

    operations = [
        migrations.CreateModel(
            name="CreditCardProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("credit_limit", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("target_statement_utilization_pct", models.DecimalField(decimal_places=2, default=6.0, max_digits=5)),
                ("statement_day", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("due_day", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="credit_profile", to="accounts.account")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="credit_card_profiles", to="auth.user")),
            ],
            options={},
        ),
        migrations.AddConstraint(
            model_name="creditcardprofile",
            constraint=models.UniqueConstraint(fields=("account",), name="unique_credit_profile_per_account"),
        ),
    ]
