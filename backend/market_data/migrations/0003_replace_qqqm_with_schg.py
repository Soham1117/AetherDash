from decimal import Decimal

from django.db import migrations


def replace_qqqm_with_schg(apps, schema_editor):
    TrackedSymbol = apps.get_model("market_data", "TrackedSymbol")
    TrackedSymbol.objects.update_or_create(
        symbol="SCHG",
        defaults={
            "asset_type": "etf",
            "provider": "yfinance",
            "target_weight_percent": Decimal("27.0000"),
            "active": True,
        },
    )
    TrackedSymbol.objects.filter(symbol="QQQM").update(active=False, target_weight_percent=None)


def restore_qqqm(apps, schema_editor):
    TrackedSymbol = apps.get_model("market_data", "TrackedSymbol")
    TrackedSymbol.objects.update_or_create(
        symbol="QQQM",
        defaults={
            "asset_type": "etf",
            "provider": "yfinance",
            "target_weight_percent": Decimal("27.0000"),
            "active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("market_data", "0002_marketnewsarticle"),
    ]

    operations = [
        migrations.RunPython(replace_qqqm_with_schg, restore_qqqm),
    ]
