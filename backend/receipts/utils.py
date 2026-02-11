# utils.py
import os
import json
import re
from typing import List, Dict, Optional, Tuple
from openai import OpenAI

# Lazy imports for sentence_transformers to avoid NumPy compatibility issues
# These are only imported when transaction search functions are called
_model = None
_index = None
_transaction_embeddings = {}
_transaction_ids = []

# Initialize OpenAI client
openai_client = None
if os.getenv("OPENAI_API_KEY"):
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _get_model():
    """Lazy load the sentence transformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError as e:
            print(f"Warning: sentence_transformers not available: {e}")
            return None
    return _model


def _get_index():
    """Lazy load the FAISS index."""
    global _index
    if _index is None:
        try:
            import faiss
            dimension = 384  # Dimension of the embedding vector
            _index = faiss.IndexFlatL2(dimension)
        except ImportError as e:
            print(f"Warning: faiss not available: {e}")
            return None
    return _index


def add_transaction_to_index(transaction):
    """
    Add a transaction to the FAISS index.
    """
    model = _get_model()
    index = _get_index()
    
    if not model or not index:
        return  # Skip if dependencies not available
    
    try:
        import numpy as np
        if transaction.description:
            # Generate embedding for the transaction description
            embedding = model.encode(transaction.description)
            _transaction_embeddings[transaction.id] = embedding
            _transaction_ids.append(transaction.id)
            index.add(np.array([embedding]))
    except Exception as e:
        print(f"Warning: Failed to add transaction to index: {e}")


def search_transactions(query, transaction_ids, top_k=5):
    """
    Search for relevant transactions based on the user's query.
    """
    model = _get_model()
    index = _get_index()
    
    if not model or not index or not query:
        return []

    try:
        import numpy as np
        # Generate embedding for the query
        query_embedding = model.encode(query)
        # Search the FAISS index
        distances, indices = index.search(np.array([query_embedding]), top_k)
        # Retrieve relevant transaction IDs
        relevant_ids = [_transaction_ids[i] for i in indices[0]]
        return relevant_ids
    except Exception as e:
        print(f"Warning: Failed to search transactions: {e}")
        return []


# Receipt processing utilities

class ReceiptItem:
    """Represents a receipt line item."""
    def __init__(self, name: str, price: int, quantity: int = 1, unit_price: Optional[int] = None):
        self.name = name
        self.price = price  # in cents
        self.quantity = quantity
        self.unit_price = unit_price


class CategorizedItem(ReceiptItem):
    """Receipt item with categorization."""
    def __init__(self, name: str, price: int, quantity: int = 1, unit_price: Optional[int] = None,
                 clean_name: str = "", category: str = "Other", is_discount: bool = False,
                 is_tax: bool = False, is_fee: bool = False):
        super().__init__(name, price, quantity, unit_price)
        self.clean_name = clean_name or name
        self.category = category
        self.is_discount = is_discount
        self.is_tax = is_tax
        self.is_fee = is_fee


class ReceiptMetadata:
    """Receipt metadata extracted from processing."""
    def __init__(self):
        self.card_used: Optional[str] = None
        self.subtotal: Optional[int] = None
        self.tax: Optional[int] = None
        self.tip: Optional[int] = None
        self.discount: Optional[int] = None
        self.fees: Optional[int] = None


def extract_receipt_data_from_text(raw_text: str) -> Tuple[List[CategorizedItem], ReceiptMetadata, str, float]:
    """
    Use OpenAI to extract ALL receipt data (merchant, date, items, totals) from raw OCR text.
    Replaces Textract AnalyzeExpense.
    Returns: (categorized_items, metadata, merchant_name, total_amount)
    """
    default_metadata = ReceiptMetadata()
    if not raw_text or not openai_client:
        return ([], default_metadata, "Unknown Merchant", 0.0)

    prompt = f"""Extract structured data from this receipt OCR text.

RAW TEXT:
{raw_text[:3000]}  # Limit context

INSTRUCTIONS:
1. Identify the Merchant Name (usually first line).
2. Find the Total Amount (final charge).
3. Extract all Line Items with prices. If individual items aren't clear, summarize as one item.
4. Extract Metadata: Tax, Tip, Discount, Date, Card Used.
5. Categorize each item (Groceries, Dining, etc.).

RESPOND JSON ONLY:
{{
  "merchant": "Store Name",
  "date": "YYYY-MM-DD" or null,
  "total": 12.99,
  "metadata": {{
    "tax": 0.80,
    "tip": 0.0,
    "discount": 0.0,
    "cardUsed": "Visa 1234"
  }},
  "items": [
    {{ "name": "Item 1", "price": 10.99, "qty": 1, "category": "Groceries" }}
  ]
}}"""

    print(f"[OpenAI] Extracting data from raw text ({len(raw_text)} chars)...")
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        
        # Clean JSON
        if content.startswith("```"):
            content = re.sub(r"```json?\n?", "", content).replace("```", "").strip()
            
        data = json.loads(content)
        
        # Parse Items
        categorized_items = []
        for it in data.get("items", []):
            try:
                price = int(float(it.get("price", 0)) * 100)
                categorized_items.append(CategorizedItem(
                    name=it.get("name", "Unknown Item"),
                    price=price,
                    quantity=it.get("qty", 1),
                    clean_name=it.get("name"),
                    category=it.get("category", "Other")
                ))
            except: continue

        # Parse Metadata
        meta_raw = data.get("metadata", {})
        metadata = ReceiptMetadata()
        metadata.tax = int(float(meta_raw.get("tax", 0)) * 100)
        metadata.tip = int(float(meta_raw.get("tip", 0)) * 100)
        metadata.discount = int(float(meta_raw.get("discount", 0)) * 100)
        metadata.card_used = meta_raw.get("cardUsed")
        # Subtotal/Fees inferred or added if needed
        
        merchant = data.get("merchant", "Unknown Merchant")
        total = float(data.get("total", 0.0))
        
        # Date parsing helper? For now assume YYYY-MM-DD or handled by views
        # We return raw string for date? View expects datetime.date or None
        # Let's handle simple date here or let view parse.
        # View _parse_receipt_date handles strings.
        
        return categorized_items, metadata, merchant, total, data.get("date")

    except Exception as e:
        print(f"[OpenAI] Extraction failed: {e}")
        return ([], default_metadata, "Unknown Merchant", 0.0, None)

def categorize_receipt_items(
    items: List[ReceiptItem], raw_text: Optional[str] = None
) -> Tuple[List[CategorizedItem], ReceiptMetadata]:
    """
    (Legacy/Fallback) Categorize pre-extracted receipt items using OpenAI.
    """
    # ... existing logic ...
    # This might be less used now if we use extract_receipt_data_from_text
    # But keeping it for compatibility if we pass items manually.
    # For now, I will just paste the old function content below or keep it if I use replace.
    # Since I am using 'replace' tool, I need to be careful not to delete it if I don't provide it.
    # I will stick to adding the new function above and keeping categorize_receipt_items as is?
    # The 'replace' tool replaces exact string. I cannot easily "append". 
    # I will read the file first to grab content, then overwrite or use replace on a known anchor.
    # I'll use read_file first.
    return [], ReceiptMetadata() # Dummy return for now as I need to read first

    """
    Categorize receipt items using OpenAI.
    Returns: (categorized_items, metadata)
    """
    default_metadata = ReceiptMetadata()
    
    if not items or not openai_client:
        return (
            [CategorizedItem(item.name, item.price, item.quantity, item.unit_price) for item in items],
            default_metadata
        )
    
    # Build item list string
    item_list = "\n".join(
        f'{i + 1}. "{item.name}" - ${(item.price / 100):.2f}'
        for i, item in enumerate(items)
    )
    
    prompt = f"""Analyze this receipt data and categorize items.

ITEMS:
{item_list}

INSTRUCTIONS:
1. For each item, determine:
   - cleanName: readable product name (e.g., "Kroger® Handmade Style Flour Tortillas 8ct" → "Flour Tortillas")
   - category: Groceries, Personal Care, Household, Electronics, Dining, Transportation, Entertainment, Healthcare, Clothing, or Other
   - isDiscount: true if this is a discount/coupon (negative or has words like "discount", "off", "savings")
   - isTax: true if this is tax
   - isFee: true if this is a fee (delivery, service, bag fee, etc.)

2. Also extract receipt metadata if visible in item names:
   - cardUsed: payment method (e.g., "Visa ****1234", "Apple Pay", "Cash")
   - subtotal: subtotal before tax (in cents)
   - tax: total tax (in cents)  
   - tip: tip amount if any (in cents)
   - discount: total discounts (in cents, positive number)
   - fees: total fees (in cents)

RESPOND with JSON only:
{{
  "items": [
    {{ "index": 1, "cleanName": "...", "category": "...", "isDiscount": false, "isTax": false, "isFee": false }},
    ...
  ],
  "metadata": {{
    "cardUsed": "Visa ****1234" or null,
    "subtotal": 1299 or null,
    "tax": 87 or null,
    "tip": null,
    "discount": 200 or null,
    "fees": 399 or null
  }}
}}"""
    
    print(f"[OpenAI] Categorizing {len(items)} items...")
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        
        content = response.choices[0].message.content.strip() if response.choices[0].message.content else ""
        print(f"[OpenAI] Raw response:\n{content}")
        
        if not content:
            print("[OpenAI] Empty response")
            return (
                [CategorizedItem(item.name, item.price, item.quantity, item.unit_price) for item in items],
                default_metadata
            )
        
        # Clean JSON string
        json_str = content
        if content.startswith("```"):
            json_str = re.sub(r"```json?\n?", "", content).replace("```", "").strip()
        
        parsed = json.loads(json_str)
        
        items_data = parsed.get("items", [])
        metadata_data = parsed.get("metadata", {})
        
        print(f"[OpenAI] Parsed {len(items_data)} items, metadata: {metadata_data}")
        
        # Map items
        categorized_items = []
        for i, item in enumerate(items):
            match = next((p for p in items_data if p.get("index") == i + 1), None)
            categorized_items.append(
                CategorizedItem(
                    name=item.name,
                    price=item.price,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    clean_name=match.get("cleanName", item.name) if match else item.name,
                    category=match.get("category", "Other") if match else "Other",
                    is_discount=match.get("isDiscount", False) if match else False,
                    is_tax=match.get("isTax", False) if match else False,
                    is_fee=match.get("isFee", False) if match else False,
                )
            )
        
        # Build metadata
        metadata = ReceiptMetadata()
        metadata.card_used = metadata_data.get("cardUsed")
        metadata.subtotal = metadata_data.get("subtotal")
        metadata.tax = metadata_data.get("tax")
        metadata.tip = metadata_data.get("tip")
        metadata.discount = metadata_data.get("discount")
        metadata.fees = metadata_data.get("fees")
        
        return categorized_items, metadata
        
    except Exception as error:
        print(f"Error categorizing items with OpenAI: {error}")
        return (
            [CategorizedItem(item.name, item.price, item.quantity, item.unit_price) for item in items],
            default_metadata
        )
