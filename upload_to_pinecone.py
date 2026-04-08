"""
Upload PDF to Pinecone - חלוקה לפי נושאים מוגדרים
PDF: 04-הנדסת-חשמל-ומחשבים-תשפ״ו

הוראות הפעלה:
1. pip install pinecone pymupdf
2. שנה את PDF_PATH לנתיב הקובץ אצלך
3. python upload_to_pinecone.py
"""

import fitz  # PyMuPDF
from pinecone import Pinecone

# ── הגדרות ──────────────────────────────────────────────
PDF_PATH   = r"C:\Users\eyald\OneDrive - Technion\planer_ee\katalog 04-הנדסת-חשמל-ומחשבים-תשפ״ו.pdf"
API_KEY    = "pcsk_4zagMX_2iCZK9tgjH3BB3f9geqvEQsPaM6WWiQh6LZHQXteCDCkTgSnTZjs7P1XhDGAi4K"
INDEX_HOST = "https://ee-ppvymzk.svc.aped-4627-b74a.pinecone.io"
EMBED_MODEL = "multilingual-e5-large"

BATCH_SIZE = 3   # <-- שנה כאן את גודל הבאץ' (כמה צ'אנקים בכל קריאה ל-Pinecone)

# ── הגדרת הצ'אנקים: (id, תיאור, עמוד_התחלה, עמוד_סיום) ──
# הערה: המספרים הם עמודי PDF (1-based), הטווח כולל את שני הקצוות
CHUNKS = [
    ("chunk_01", "הסבר כללי על המסלולים השונים",                                           1,  2),
    ("chunk_02", "המסלול להנדסת חשמל",                                                     3,  7),
    ("chunk_03", "המסלול להנדסת חשמל ומתמטיקה",                                            8, 11),
    ("chunk_04", "המסלול להנדסת מחשבים ותוכנה",                                           11, 13),
    ("chunk_05", "המסלול להנדסת חשמל ופיזיקה",                                            14, 17),
    ("chunk_06", "מסלול משולב לתואר מוסמך למדעים בהנדסת חשמל ובפיזיקה",                  17, 20),
    ("chunk_07", "המסלול להנדסת מחשבים",                                                   21, 24),
    ("chunk_08", "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי",                            24, 24),
    ("chunk_09", "תכנית התמחות משנה בין פקולטית ברובוטיקה",                               24, 24),
]
# ────────────────────────────────────────────────────────


def extract_chunk_text(doc: fitz.Document, page_start: int, page_end: int) -> str:
    """מחבר את הטקסט של עמודים page_start עד page_end (כולל שניהם, 1-based)."""
    texts = []
    for page_num in range(page_start - 1, page_end):   # המרה ל-0-based
        page = doc[page_num]
        text = page.get_text().strip()
        if text:
            texts.append(text)
    return "\n\n".join(texts)


def embed_and_upsert(chunks_data: list[dict], pc: Pinecone, index) -> None:
    """יוצר embeddings ומעלה ל-Pinecone בבאצ'ים."""
    total = len(chunks_data)
    for batch_start in range(0, total, BATCH_SIZE):
        batch = chunks_data[batch_start : batch_start + BATCH_SIZE]
        texts = [c["text"] for c in batch]

        embeddings_response = pc.inference.embed(
            model=EMBED_MODEL,
            inputs=texts,
            parameters={"input_type": "passage", "truncate": "END"},
        )

        vectors = []
        for chunk, emb in zip(batch, embeddings_response):
            vectors.append({
                "id": chunk["id"],
                "values": emb["values"],
                "metadata": {
                    "topic":      chunk["topic"],
                    "page_start": chunk["page_start"],
                    "page_end":   chunk["page_end"],
                    "text":       chunk["text"][:1000],
                    "source":     "04-הנדסת-חשמל-ומחשבים-תשפ״ו",
                },
            })

        index.upsert(vectors=vectors)
        ids = [c["id"] for c in batch]
        print(f"  ⬆️  הועלו: {', '.join(ids)}")


def main():
    print("📄 קורא PDF...")
    doc = fitz.open(PDF_PATH)

    chunks_data = []
    for chunk_id, topic, p_start, p_end in CHUNKS:
        text = extract_chunk_text(doc, p_start, p_end)
        chunks_data.append({
            "id":         chunk_id,
            "topic":      topic,
            "page_start": p_start,
            "page_end":   p_end,
            "text":       text,
        })
        print(f"  ✅ {chunk_id} | עמ' {p_start}–{p_end} | {topic[:40]} | {len(text)} תווים")

    print(f"\n🔌 מתחבר ל-Pinecone...")
    pc = Pinecone(api_key=API_KEY)
    index = pc.Index(host=INDEX_HOST)

    stats_before = index.describe_index_stats()
    print(f"📊 וקטורים לפני: {stats_before.total_vector_count}")

    print(f"\n🚀 מתחיל העלאה ({EMBED_MODEL}, באץ' של {BATCH_SIZE})...")
    embed_and_upsert(chunks_data, pc, index)

    stats_after = index.describe_index_stats()
    print(f"\n✅ סיום! סה\"כ {stats_after.total_vector_count} וקטורים ב-index")


if __name__ == "__main__":
    main()
