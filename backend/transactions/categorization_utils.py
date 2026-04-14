import re
from typing import Optional, Tuple

from django.db.models import Q

from .models import MerchantCategoryMemory, Transaction

MERCHANT_MEMORY_AUTO_APPLY_MIN_CONFIDENCE = 0.85

CATEGORY_ALIAS_KEYS = {
    "shops": "shopping",
    "shop": "shopping",
    "food and drink": "food and dining",
    "food drink": "food and dining",
    "dining": "restaurants",
    "restaurant": "restaurants",
    "healthcare": "health and fitness",
    "health care": "health and fitness",
    "medical": "health and fitness",
    "bank fee": "bank fees",
    "fees": "bank fees",
}


def normalize_category_key(text: str) -> str:
    s = (text or "").strip().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_merchant_key(text: str) -> str:
    s = (text or "").upper().strip()
    s = re.sub(r"\d+", " ", s)
    s = re.sub(r"[^A-Z ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:255]


def format_transaction_for_categorization_prompt(
    description: str, txn: Optional[Transaction]
) -> str:
    """Rich single-line context for the LLM when a Transaction row is available."""
    parts = [f"Description: {(description or '').strip() or '(none)'}"]
    if txn is None:
        return parts[0]
    mn = (getattr(txn, "merchant_name", None) or "").strip()
    if mn:
        parts.append(f"Merchant: {mn}")
    parts.append(f"Amount: {txn.amount}")
    parts.append(f"Date: {txn.date}")
    acc = getattr(txn, "account", None)
    if acc is not None:
        an = getattr(acc, "account_name", None) or getattr(acc, "name", None)
        if an:
            parts.append(f"Account: {an}")
    ch = (getattr(txn, "payment_channel", None) or "").strip()
    if ch:
        parts.append(f"Channel: {ch}")
    return " | ".join(parts)


def get_allowed_category_map(user):
    """Return (lower_name -> canonical_name, comma-separated list for prompts)."""
    from categories.models import Category

    names = list(
        Category.objects.filter(Q(is_system=True) | Q(user=user)).values_list(
            "name", flat=True
        )
    )
    allowed = {}
    unique_names = sorted({name.strip() for name in names if isinstance(name, str) and name.strip()})

    for name in unique_names:
        allowed[name.lower()] = name
        allowed[normalize_category_key(name)] = name

    if "uncategorized" not in allowed:
        allowed["uncategorized"] = "Uncategorized"
    if normalize_category_key("Uncategorized") not in allowed:
        allowed[normalize_category_key("Uncategorized")] = "Uncategorized"

    for alias_key, target_key in CATEGORY_ALIAS_KEYS.items():
        mapped = allowed.get(target_key)
        if mapped:
            allowed[alias_key] = mapped

    categories_list_str = ", ".join(unique_names)
    return allowed, categories_list_str


def normalize_to_allowed_category(trimmed: str, allowed_map: dict) -> str:
    if not (trimmed or "").strip():
        return allowed_map.get("uncategorized", "Uncategorized")
    raw_value = trimmed.strip()
    mapped = allowed_map.get(raw_value.lower())
    if mapped:
        return mapped
    normalized_key = normalize_category_key(raw_value)
    normalized_key = CATEGORY_ALIAS_KEYS.get(normalized_key, normalized_key)
    mapped = allowed_map.get(normalized_key)
    if mapped:
        return mapped
    return allowed_map.get("uncategorized", "Uncategorized")


def remember_category(user, transaction, category):
    """
    Upsert MerchantCategoryMemory for this transaction's merchant key.
    `category` may be a Category instance or a category name string resolvable for this user.
    """
    from categories.models import Category

    merchant_key = normalize_merchant_key(
        getattr(transaction, "description", "") or getattr(transaction, "name", "")
    )
    if not merchant_key:
        return None

    cat_obj = None
    if category is None:
        return None
    if isinstance(category, Category):
        cat_obj = category
    elif isinstance(category, str):
        qs = Category.objects.filter(Q(is_system=True) | Q(user=user))
        cat_obj = qs.filter(name__iexact=category.strip()).first()
    if not cat_obj:
        return None

    obj, created = MerchantCategoryMemory.objects.get_or_create(
        user=user,
        merchant_key=merchant_key,
        defaults={
            "category_ref": cat_obj,
            "learned_from_transaction": transaction,
            "confidence": 1.0,
            "times_seen": 1,
        },
    )
    if not created:
        if obj.category_ref_id == cat_obj.id:
            obj.times_seen += 1
            obj.confidence = min(1.0, obj.confidence + 0.05)
        else:
            obj.category_ref = cat_obj
            obj.learned_from_transaction = transaction
            obj.times_seen = 1
            obj.confidence = 0.9
        obj.save(
            update_fields=[
                "category_ref",
                "learned_from_transaction",
                "times_seen",
                "confidence",
                "updated_at",
            ]
        )
    return obj


def apply_transaction_category(
    user,
    transaction: Transaction,
    category_label: str,
    *,
    remember: bool = True,
    allowed_map: Optional[dict] = None,
) -> str:
    """
    Set transaction.category (and category_ref via Transaction.save), optionally reinforce merchant memory.
    Single path for manual PATCH, AI categorization, and imports.
    """
    if allowed_map is None:
        allowed_map, _ = get_allowed_category_map(user)
    canonical = normalize_to_allowed_category(
        (category_label or "").strip(), allowed_map
    )
    transaction.category = canonical
    transaction.save()
    if remember:
        ref = getattr(transaction, "category_ref", None)
        remember_category(user, transaction, ref if ref is not None else canonical)
    return canonical


def try_precategorize(
    user,
    description: str,
    transaction: Optional[Transaction],
    allowed_map: dict,
) -> Tuple[Optional[str], str, Optional[float]]:
    """
    Return (canonical_category, source, confidence_or_none) without calling the LLM.
    source is transfer | rule | memory | none.
    """
    text = description or ""

    if transaction is not None and getattr(transaction, "is_transfer", False):
        c = normalize_to_allowed_category("Transfer", allowed_map)
        if c != "Uncategorized":
            return c, "transfer", 1.0
        return normalize_to_allowed_category("Uncategorized", allowed_map), "transfer", 1.0

    rule = rule_based_category_name(text)
    if rule:
        c = normalize_to_allowed_category(rule, allowed_map)
        if c != "Uncategorized":
            return c, "rule", 0.98

    key = normalize_merchant_key(text)
    if key:
        mem = (
            MerchantCategoryMemory.objects.filter(user=user, merchant_key=key)
            .select_related("category_ref")
            .first()
        )
        if (
            mem
            and mem.category_ref
            and float(mem.confidence) >= MERCHANT_MEMORY_AUTO_APPLY_MIN_CONFIDENCE
        ):
            c = normalize_to_allowed_category(mem.category_ref.name, allowed_map)
            if c != "Uncategorized":
                return c, "memory", float(mem.confidence)

    return None, "none", None


RULE_CATEGORY_KEYWORDS = {
    "Income": ["PAYROLL", "QUICKBOOKS", "DIRECT DEPOSIT", "SALARY"],
    "Transfer": [
        "PAYMENT TO",
        "BILL PAY",
        "ACH TRANSFER",
        "ONLINE TRANSFER",
        "INTERNAL TRANSFER",
    ],
    "Subscriptions": ["NETFLIX", "SPOTIFY", "APPLE.COM/BILL", "YOUTUBE PREMIUM"],
    "Groceries": ["TRADER JOE", "KROGER", "WALMART GROCERY", "ALDI", "COSTCO", "INSTACART"],
    "Restaurants": ["UBER EATS", "DOORDASH", "CHIPOTLE", "MCDONALD", "STARBUCKS"],
    "Transportation": ["UBER", "LYFT", "SHELL", "EXXON", "CHEVRON"],
    "Personal Care": ["GREAT CLIPS", "SUPERCUTS", "SPORT CLIPS"],
}


def rule_based_category_name(text: str) -> Optional[str]:
    key = normalize_merchant_key(text)
    if not key:
        return None
    for category, keywords in RULE_CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in key:
                return category
    return None
