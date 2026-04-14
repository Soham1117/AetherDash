from django.core.management.base import BaseCommand

from transactions.categorization_utils import (
    get_allowed_category_map,
    normalize_to_allowed_category,
)
from transactions.models import Transaction


class Command(BaseCommand):
    help = "Normalize stored transaction categories to canonical category names."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the rows that would change without saving them.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        updated_count = 0
        unchanged_count = 0

        queryset = (
            Transaction.objects.select_related("account__user", "category_ref")
            .order_by("id")
        )

        for transaction in queryset.iterator():
            user = getattr(getattr(transaction, "account", None), "user", None)
            if user is None:
                unchanged_count += 1
                continue

            allowed_map, _ = get_allowed_category_map(user)
            original_category = transaction.category or ""

            source_category = (
                transaction.category_ref.name
                if transaction.category_ref_id
                else original_category
            )
            canonical_category = normalize_to_allowed_category(
                source_category, allowed_map
            )

            needs_update = (
                (original_category or "") != canonical_category
                or transaction.category_ref_id is None
            )

            if not needs_update:
                unchanged_count += 1
                continue

            updated_count += 1
            self.stdout.write(
                f"txn={transaction.id}: {original_category or '(blank)'} -> {canonical_category}"
            )

            if dry_run:
                continue

            transaction.category = canonical_category
            transaction.save()

        summary = (
            f"Normalized {updated_count} transaction(s); "
            f"{unchanged_count} already canonical."
        )
        if dry_run:
            summary = f"[dry-run] {summary}"
        self.stdout.write(self.style.SUCCESS(summary))
