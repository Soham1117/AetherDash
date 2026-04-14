from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Account
from categories.models import Category
from transactions.categorization_utils import (
    get_allowed_category_map,
    normalize_to_allowed_category,
)
from transactions.models import Transaction


class CategoryNormalizationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="secret")
        self.shopping = Category.objects.create(name="Shopping", is_system=True)
        self.food = Category.objects.create(name="Food & Dining", is_system=True)
        self.restaurants = Category.objects.create(
            name="Restaurants", is_system=True, parent=self.food
        )
        self.health = Category.objects.create(name="Health & Fitness", is_system=True)
        self.uncategorized = Category.objects.create(
            name="Uncategorized", is_system=True
        )
        self.account = Account.objects.create(
            user=self.user,
            account_name="Checking",
            account_type="bank",
            balance=Decimal("0.00"),
            currency="USD",
        )

    def test_aliases_map_to_canonical_category_names(self):
        allowed_map, _ = get_allowed_category_map(self.user)

        self.assertEqual(
            normalize_to_allowed_category("Shops", allowed_map), "Shopping"
        )
        self.assertEqual(
            normalize_to_allowed_category("Food and Drink", allowed_map),
            "Food & Dining",
        )
        self.assertEqual(
            normalize_to_allowed_category("Healthcare", allowed_map),
            "Health & Fitness",
        )

    def test_transaction_save_normalizes_alias_and_sets_category_ref(self):
        transaction = Transaction.objects.create(
            account=self.account,
            amount=Decimal("-24.99"),
            name="Target",
            date="2026-04-14",
            category="Shops",
        )

        transaction.refresh_from_db()

        self.assertEqual(transaction.category, "Shopping")
        self.assertEqual(transaction.category_ref_id, self.shopping.id)

    def test_transaction_save_updates_existing_category_ref_from_explicit_label(self):
        transaction = Transaction.objects.create(
            account=self.account,
            amount=Decimal("-12.00"),
            name="Lunch",
            date="2026-04-14",
            category="Uncategorized",
            category_ref=self.uncategorized,
        )

        transaction.category = "Dining"
        transaction.save()
        transaction.refresh_from_db()

        self.assertEqual(transaction.category, "Restaurants")
        self.assertEqual(transaction.category_ref_id, self.restaurants.id)

    def test_transaction_save_uses_category_ref_name_when_no_label_present(self):
        transaction = Transaction.objects.create(
            account=self.account,
            amount=Decimal("-8.50"),
            name="Coffee",
            date="2026-04-14",
            category=None,
            category_ref=self.restaurants,
        )

        transaction.refresh_from_db()

        self.assertEqual(transaction.category, "Restaurants")
        self.assertEqual(transaction.category_ref_id, self.restaurants.id)
