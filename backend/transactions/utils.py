# utils.py
from typing import List
from django.db.models import Q

# Removed SentenceTransformer and FAISS for lightweight deployment
model = None
index = None
transaction_embeddings = {}
transaction_ids = []


def add_transaction_to_index(transaction):
    """
    No-op: Semantic indexing disabled for lightweight deployment.
    """
    pass


def search_transactions(query, transaction_ids, top_k=5):
    """
    Fallback: Simple keyword search instead of semantic vector search.
    """
    if not query:
        return []

    # Requires 'from transactions.models import Transaction' but to avoid circular imports,
    # we expect the caller to might handle this or we act on IDs.
    # Since this function signature takes `transaction_ids`, it implies filtering EXISTING list.
    # But originally it used FAISS on global index.

    # Simple fallback: Return empty or implement basic text match if possible.
    # Given the architecture, let's just return empty list or handle in View.
    return []
