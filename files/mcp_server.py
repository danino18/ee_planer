"""
mcp_server.py — MCP Server לתכנון תואר בפקולטה להנדסת חשמל ומחשבים, טכניון.

כלים זמינים:
  search_courses   — חיפוש קורסים לפי שאלה חופשית
  get_track_info   — מידע על מסלול לימודים
  get_degree_rules — כללי גמר ודרישות תואר

התקנה:
    pip install pinecone mcp

הרצה:
    set PINECONE_API_KEY=pcsk_...
    python mcp_server.py

רישום ב-Claude Code / Cursor (claude_desktop_config.json):
    {
      "mcpServers": {
        "technion-ece": {
          "command": "python",
          "args": ["C:/Users/eyald/OneDrive - Technion/planer_ee/files/mcp_server.py"],
          "env": {
            "PINECONE_API_KEY": "pcsk_7A2auo_GK7Br7suohjBAucJC4SgsoKxiEqXDNgVtoMqasymWhnGuRnv72FNagr1oYAY6DS"
          }
        }
      }
    }
"""

import json
import os
from typing import Optional

from pinecone import Pinecone
import mcp.server.stdio
from mcp.server import Server
from mcp.types import Tool, TextContent

# ── הגדרות ───────────────────────────────────────────────────────────────────

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
INDEX_NAME       = "ece"
EMBED_MODEL      = "multilingual-e5-large"

if not PINECONE_API_KEY:
    raise ValueError("חסר PINECONE_API_KEY")

pc    = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

# ── helpers ───────────────────────────────────────────────────────────────────

def embed_query(text: str):
    """הטמעת שאלת חיפוש עם input_type=query."""
    resp = pc.inference.embed(
        model=EMBED_MODEL,
        inputs=[text],
        parameters={"input_type": "query", "truncate": "END"},
    )
    return resp[0].values

def pinecone_query(query_text: str, filter_dict: dict, top_k: int = 10):
    vec = embed_query(query_text)
    return index.query(
        vector=vec,
        top_k=top_k,
        filter=filter_dict if filter_dict else None,
        include_metadata=True,
    )

# ── MCP Server ────────────────────────────────────────────────────────────────

app = Server("technion-ece-planner")

@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="search_courses",
            description=(
                "חיפוש קורסים מתוכנית הלימודים של הפקולטה להנדסת חשמל ומחשבים בטכניון. "
                "מחזיר קורסים רלוונטיים עם קוד קורס, שם, מסלול, סמסטר ונקודות זכות. "
                "ניתן לסנן לפי מסלול ו/או סמסטר."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "שאלה חופשית בעברית או אנגלית. דוגמה: 'קורסי חובה בסמסטר 3'"
                    },
                    "track": {
                        "type": "string",
                        "description": (
                            "סינון לפי מסלול (אופציונלי). ערכים אפשריים:\n"
                            "  'המסלול להנדסת חשמל'\n"
                            "  'המסלול להנדסת חשמל ומתמטיקה'\n"
                            "  'המסלול להנדסת מחשבים ותוכנה'\n"
                            "  'המסלול להנדסת חשמל ופיזיקה'\n"
                            "  'המסלול להנדסת מחשבים'\n"
                            "  'מסלול משולב לתואר מוסמך למדעים בהנדסת חשמל ובפיזיקה'"
                        )
                    },
                    "semester": {
                        "type": "integer",
                        "description": "סינון לפי סמסטר (אופציונלי), מספר שלם 1–8"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "מספר תוצאות מקסימלי (ברירת מחדל: 10, מקסימום: 20)",
                        "default": 10
                    }
                },
                "required": ["query"]
            },
        ),
        Tool(
            name="get_track_info",
            description=(
                "מחזיר תיאור מפורט על מסלול לימודים: מטרות, מבנה, ייחודיות. "
                "שימושי לשאלות כמו 'מה ההבדל בין מסלול חשמל למחשבים?'"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "track_name": {
                        "type": "string",
                        "description": "שם המסלול בעברית, למשל: 'המסלול להנדסת מחשבים'"
                    }
                },
                "required": ["track_name"]
            },
        ),
        Tool(
            name="get_degree_rules",
            description=(
                "מחזיר את כללי הגמר ודרישות הסמכה לתואר: מינימום נקודות, קבוצות חובה, "
                "קבוצות התמחות וכו'. ניתן לסנן לפי מסלול."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "track_name": {
                        "type": "string",
                        "description": "שם המסלול (אופציונלי). ללא סינון — מחזיר כללים כלליים."
                    }
                },
                "required": []
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict):

    # ── search_courses ────────────────────────────────────────────────────────
    if name == "search_courses":
        query    = arguments["query"]
        track    = arguments.get("track")
        semester = arguments.get("semester")
        top_k    = min(int(arguments.get("top_k", 10)), 20)

        filt = {"record_type": {"$eq": "course"}}
        if track:
            filt["track_title"] = {"$eq": track}
        if semester is not None:
            filt["semester"] = {"$eq": int(semester)}

        res = pinecone_query(query, filt, top_k)

        results = []
        for match in res.matches:
            m = match.metadata or {}
            results.append({
                "ציון_דמיון":  round(match.score, 3),
                "קוד_קורס":    m.get("course_code"),
                "שם_קורס":     m.get("course_name"),
                "מסלול":       m.get("track_title"),
                "סמסטר":       m.get("semester"),
                "נקודות":      m.get("points"),
            })

        return [TextContent(type="text", text=json.dumps(results, ensure_ascii=False, indent=2))]

    # ── get_track_info ────────────────────────────────────────────────────────
    elif name == "get_track_info":
        track_name = arguments["track_name"]

        filt = {"record_type": {"$eq": "track_summary"}}
        res  = pinecone_query(track_name + " תיאור מסלול", filt, top_k=5)

        results = []
        for match in res.matches:
            m = match.metadata or {}
            # Return the full text from the vector store
            results.append({
                "ציון_דמיון":  round(match.score, 3),
                "כותרת":       m.get("track_title"),
                "סוג_תוכן":    m.get("content_type"),
                "טווח_עמודים": m.get("page_range"),
            })

        return [TextContent(type="text", text=json.dumps(results, ensure_ascii=False, indent=2))]

    # ── get_degree_rules ──────────────────────────────────────────────────────
    elif name == "get_degree_rules":
        track_name = arguments.get("track_name", "")
        query_text = (track_name + " כללי גמר נקודות חובה דרישות הסמכה").strip()

        filt = {"record_type": {"$eq": "rule"}}
        if track_name:
            filt["track_title"] = {"$eq": track_name}

        res = pinecone_query(query_text, filt, top_k=15)

        results = []
        for match in res.matches:
            m = match.metadata or {}
            results.append({
                "ציון_דמיון": round(match.score, 3),
                "מסלול":      m.get("track_title"),
                "סוג_כלל":    m.get("rule_type"),
                "ערך":        m.get("value"),
            })

        return [TextContent(type="text", text=json.dumps(results, ensure_ascii=False, indent=2))]

    return [TextContent(type="text", text=f"כלי לא מוכר: {name}")]


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    asyncio.run(mcp.server.stdio.run(app))
