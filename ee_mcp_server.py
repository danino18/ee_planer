"""
MCP Server — חיפוש סמנטי ב-Pinecone index "ee"
"""

import uvicorn
from mcp.server.fastmcp import FastMCP
from pinecone import Pinecone

# ── הגדרות Pinecone ─────────────────────────────────────
API_KEY     = "pcsk_4zagMX_2iCZK9tgjH3BB3f9geqvEQsPaM6WWiQh6LZHQXteCDCkTgSnTZjs7P1XhDGAi4K"
INDEX_HOST  = "https://ee-ppvymzk.svc.aped-4627-b74a.pinecone.io"
EMBED_MODEL = "multilingual-e5-large"
TOP_K       = 3

# ── הגדרות שרת ──────────────────────────────────────────
PORT = 8765
# ────────────────────────────────────────────────────────

pc    = Pinecone(api_key=API_KEY)
index = pc.Index(host=INDEX_HOST)

mcp = FastMCP("ee-pdf-search", host="127.0.0.1", port=PORT)


@mcp.tool()
def search_ee_pdf(query: str) -> str:
    """
    מחפש מידע בתוכנית הלימודים של הפקולטה להנדסת חשמל ומחשבים (תשפ"ו).
    השתמש בכלי זה בכל שאלה הנוגעת לקורסים, מסלולים, דרישות קדם, נקודות זכות,
    מגמות, חובות לימוד, תכניות מיוחדות וכל מידע אחר מתוכנית הלימודים.

    Args:
        query: השאלה או הנושא לחיפוש (בעברית או באנגלית)
    """
    embedding = pc.inference.embed(
        model=EMBED_MODEL,
        inputs=[query],
        parameters={"input_type": "query", "truncate": "END"},
    )

    results = index.query(
        vector=embedding[0]["values"],
        top_k=TOP_K,
        include_metadata=True,
    )

    if not results.matches:
        return "לא נמצאו תוצאות רלוונטיות."

    parts = []
    for i, match in enumerate(results.matches, 1):
        meta  = match.metadata
        topic = meta.get("topic", "")
        pages = f"עמ' {int(meta.get('page_start', '?'))}–{int(meta.get('page_end', '?'))}"
        text  = meta.get("text", "")
        score = round(match.score, 3)
        parts.append(f"[{i}] {topic} ({pages}) | רלוונטיות: {score}\n{text}\n")

    return "\n---\n".join(parts)


if __name__ == "__main__":
    print(f"Starting MCP server on http://127.0.0.1:{PORT}")
    print(f"MCP endpoint: http://127.0.0.1:{PORT}/mcp")
    uvicorn.run(mcp.streamable_http_app(), host="127.0.0.1", port=PORT)
