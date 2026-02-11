# utils.py
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# Load a pre-trained embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize FAISS index
dimension = 384  # Dimension of the embedding vector
index = faiss.IndexFlatL2(dimension)

# Store embeddings and corresponding transaction IDs
transaction_embeddings = {}
transaction_ids = []


def add_transaction_to_index(transaction):
    """
    Add a transaction to the FAISS index.
    """
    if transaction.description:
        # Generate embedding for the transaction description
        embedding = model.encode(transaction.description)
        transaction_embeddings[transaction.id] = embedding
        transaction_ids.append(transaction.id)
        index.add(np.array([embedding]))


def search_transactions(query, transaction_ids, top_k=5):
    """
    Search for relevant transactions based on the user's query.
    """
    if not query:
        return []

    # Generate embedding for the query
    query_embedding = model.encode(query)
    # Search the FAISS index
    distances, indices = index.search(np.array([query_embedding]), top_k)
    # Retrieve relevant transaction IDs
    relevant_ids = [transaction_ids[i] for i in indices[0]]
    return relevant_ids
