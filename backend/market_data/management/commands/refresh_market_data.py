import json

from django.core.management.base import BaseCommand, CommandError

from market_data.services import DEFAULT_TRACKED_SYMBOLS, MarketDataError, refresh_market_data


class Command(BaseCommand):
    help = "Refresh cached OpenBB market data for tracked symbols."

    def add_arguments(self, parser):
        parser.add_argument(
            "--symbols",
            default=",".join(DEFAULT_TRACKED_SYMBOLS.keys()),
            help="Comma-separated symbols to refresh.",
        )
        parser.add_argument("--provider", default="yfinance")

    def handle(self, *args, **options):
        symbols = [symbol.strip().upper() for symbol in options["symbols"].split(",") if symbol.strip()]
        try:
            result = refresh_market_data(symbols=symbols, provider=options["provider"])
        except MarketDataError as exc:
            raise CommandError(str(exc)) from exc
        output = json.dumps(result, indent=2, sort_keys=True)
        if result.get("errors"):
            raise CommandError(output)
        self.stdout.write(self.style.SUCCESS(output))
