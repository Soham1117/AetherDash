from django.core.management.base import BaseCommand
from categories.models import Category

class Command(BaseCommand):
    help = 'Seeds initial standard financial categories'

    def handle(self, *args, **kwargs):
        categories = [
            # (Name, ParentName, Icon, Color)
            ("Income", None, "💰", "#10B981"),
            ("Transfer", None, "↔️", "#6B7280"),
            ("Uncategorized", None, "❓", "#9CA3AF"),
            
            # Expenses - Living
            ("Housing", None, "🏠", "#F59E0B"),
            ("Rent", "Housing", "🔑", "#F59E0B"),
            ("Mortgage", "Housing", "🏦", "#F59E0B"),
            ("Utilities", "Housing", "💡", "#FBBF24"),
            ("Home & Garden", "Housing", "🏡", "#F59E0B"),
            ("Insurance", "Housing", "🛡️", "#F59E0B"),
            
            # Expenses - Food
            ("Food & Dining", None, "🍔", "#EF4444"),
            ("Groceries", "Food & Dining", "🛒", "#F87171"),
            ("Restaurants", "Food & Dining", "🍽️", "#EF4444"),
            ("Coffee & Bars", "Food & Dining", "☕", "#FCA5A5"),
            
            # Expenses - Transport
            ("Transportation", None, "🚗", "#3B82F6"),
            ("Public Transit", "Transportation", "🚌", "#60A5FA"),
            ("Gas & Fuel", "Transportation", "⛽", "#3B82F6"),
            ("Car Maintenance", "Transportation", "🔧", "#93C5FD"),
            
            # Expenses - Lifestyle
            ("Entertainment", None, "🎬", "#8B5CF6"),
            ("Movies & TV", "Entertainment", "🍿", "#A78BFA"),
            ("Games", "Entertainment", "🎮", "#C4B5FD"),
            ("Subscriptions", "Entertainment", "🔄", "#A78BFA"),
            
            ("Shopping", None, "🛍️", "#EC4899"),
            ("Clothing", "Shopping", "👕", "#F472B6"),
            ("Electronics", "Shopping", "💻", "#F9A8D4"),
            
            ("Health & Fitness", None, "💪", "#14B8A6"),
            ("Doctor", "Health & Fitness", "👨‍⚕️", "#2DD4BF"),
            ("Pharmacy", "Health & Fitness", "💊", "#5EEAD4"),
            ("Gym", "Health & Fitness", "🏋️", "#99F6E4"),
            
            ("Travel", None, "✈️", "#06B6D4"),
            ("Personal Care", None, "💇", "#D946EF"),
            ("Education", None, "🎓", "#6366F1"),
            ("Gifts & Donations", None, "🎁", "#F43F5E"),
            ("Investments", None, "📈", "#84CC16"),
            ("Taxes", None, "💸", "#EF4444"),
            ("Bank Fees", None, "🏦", "#9CA3AF"),
        ]

        created_count = 0
        
        # Pass 1: Create Parents
        for name, parent_name, icon, color in categories:
            if not parent_name:
                Category.objects.get_or_create(
                    name=name,
                    is_system=True,
                    defaults={'icon': icon, 'color': color, 'parent': None}
                )
                created_count += 1

        # Pass 2: Create Children
        for name, parent_name, icon, color in categories:
            if parent_name:
                parent = Category.objects.filter(name=parent_name, is_system=True).first()
                if parent:
                    Category.objects.get_or_create(
                        name=name,
                        is_system=True,
                        defaults={'icon': icon, 'color': color, 'parent': parent}
                    )
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {created_count} categories'))