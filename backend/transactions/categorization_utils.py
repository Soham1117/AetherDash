import re
from .models import MerchantCategoryMemory


def normalize_merchant_key(text: str) -> str:
    s = (text or '').upper().strip()
    s = re.sub(r'\d+', ' ', s)
    s = re.sub(r'[^A-Z ]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s[:255]


def remember_category(user, transaction, category):
    merchant_key = normalize_merchant_key(getattr(transaction, 'description', '') or getattr(transaction, 'name', ''))
    if not merchant_key or category is None:
        return None
    obj, created = MerchantCategoryMemory.objects.get_or_create(
        user=user,
        merchant_key=merchant_key,
        defaults={
            'category_ref': category,
            'learned_from_transaction': transaction,
            'confidence': 1.0,
            'times_seen': 1,
        }
    )
    if not created:
        if obj.category_ref_id == category.id:
            obj.times_seen += 1
            obj.confidence = min(1.0, obj.confidence + 0.05)
        else:
            obj.category_ref = category
            obj.learned_from_transaction = transaction
            obj.times_seen = 1
            obj.confidence = 0.9
        obj.save(update_fields=['category_ref', 'learned_from_transaction', 'times_seen', 'confidence', 'updated_at'])
    return obj


RULE_CATEGORY_KEYWORDS = {
    'Income': ['PAYROLL', 'QUICKBOOKS', 'DIRECT DEPOSIT', 'SALARY'],
    'Transfer': ['PAYMENT TO', 'BILL PAY', 'ACH TRANSFER', 'ONLINE TRANSFER', 'INTERNAL TRANSFER'],
    'Subscriptions': ['NETFLIX', 'SPOTIFY', 'APPLE.COM/BILL', 'YOUTUBE PREMIUM'],
    'Groceries': ['TRADER JOE', 'KROGER', 'WALMART GROCERY', 'ALDI', 'COSTCO'],
    'Restaurants': ['UBER EATS', 'DOORDASH', 'CHIPOTLE', 'MCDONALD', 'STARBUCKS'],
    'Transportation': ['UBER', 'LYFT', 'SHELL', 'EXXON', 'CHEVRON'],
}


def rule_based_category_name(text: str) -> str | None:
    key = normalize_merchant_key(text)
    if not key:
        return None
    for category, keywords in RULE_CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in key:
                return category
    return None
