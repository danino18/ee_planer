"""
upload_to_pinecone.py
─────────────────────
מעלה את pinecone_records_v6.jsonl לאינדקס "ece" ב-Pinecone.

המודל: multilingual-e5-large (מובנה ב-Pinecone — לא צריך OpenAI).
ה-embedding נעשה דרך Pinecone Inference API.

התקנה:
    pip install pinecone

הרצה:
    set PINECONE_API_KEY=pcsk_...
    python upload_to_pinecone.py
"""

import json
import os
import time
from pathlib import Path
from typing import List, Dict

from pinecone import Pinecone

# ── הגדרות ───────────────────────────────────────────────────────────────────

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
INDEX_NAME       = "ece"
EMBED_MODEL      = "multilingual-e5-large"
BATCH_SIZE       = 48          # מקסימום שהמודל מקבל בבקשה אחת
INPUT_FILE       = Path(__file__).parent / "pinecone_records_v6.jsonl"

if not PINECONE_API_KEY:
    raise ValueError("חסר PINECONE_API_KEY — הגדר כ-environment variable")

# ── חיבור ────────────────────────────────────────────────────────────────────

pc    = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

# ── טעינת הרשומות ─────────────────────────────────────────────────────────────

def load_records() -> List[Dict]:
    records = []
    with open(INPUT_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records

# ── embedding + upsert ────────────────────────────────────────────────────────

def upsert_batch(batch: List[Dict]):
    texts = [r["text"] for r in batch]

    # Pinecone Inference — multilingual-e5-large
    # input_type="passage" = מסמכים שמאחסנים (לא שאילתות)
    embeddings = pc.inference.embed(
        model=EMBED_MODEL,
        inputs=texts,
        parameters={"input_type": "passage", "truncate": "END"},
    )

    vectors = []
    for rec, emb in zip(batch, embeddings):
        # ניקוי metadata — Pinecone לא מקבל None בתוך metadata
        meta = {k: v for k, v in rec["metadata"].items() if v is not None}
        vectors.append({
            "id":       rec["id"],
            "values":   emb["values"],
            "metadata": meta,
        })

    index.upsert(vectors=vectors)

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    records = load_records()
    total   = len(records)
    print(f"נטענו {total} רשומות מ-{INPUT_FILE.name}")
    print(f"מעלה ל-index '{INDEX_NAME}' עם מודל '{EMBED_MODEL}'...\n")

    for start in range(0, total, BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        end   = min(start + len(batch), total)
        print(f"  batch {start+1}–{end} / {total}  ({len(batch)} רשומות)...")
        upsert_batch(batch)
        time.sleep(0.5)   # מניעת rate-limit

    # בדיקה סופית
    time.sleep(2)
    stats = index.describe_index_stats()
    print(f"\n✅ הושלם! Index '{INDEX_NAME}' מכיל {stats['total_vector_count']} vectors.")

if __name__ == "__main__":
    main()
