import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "azure_layout_result.json"
OUTPUT_JSON = BASE_DIR / "processed_sections_v4.json"
OUTPUT_JSONL = BASE_DIR / "processed_sections_v4.jsonl"
SECTION_RANGES = [
    {"title": "הסבר כללי על המסלולים השונים", "start": 1, "end": 2},
    {"title": "המסלול להנדסת חשמל", "start": 3, "end": 7},
    {"title": "המסלול להנדסת חשמל ומתמטיקה", "start": 8, "end": 11},
    {"title": "המסלול להנדסת מחשבים ותוכנה", "start": 11, "end": 13},
    {"title": "המסלול להנדסת חשמל ופיזיקה", "start": 14, "end": 17},
    {"title": "מסלול משולב לתואר מוסמך למדעים בהנדסת חשמל ובפיזיקה", "start": 17, "end": 20},
    {"title": "המסלול להנדסת מחשבים", "start": 21, "end": 24},
    {"title": "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי", "start": 24, "end": 24},
    {"title": "תכנית התמחות משנה בין פקולטית ברובוטיקה", "start": 24, "end": 24},
]
NOISE_PATTERNS = [
    r":unselected:",
    r"הנדסת חשמל ומחשבים 04 / תכנית לימודים תשפ״ו 2025/2026",
]
DROP_LINE_PATTERNS = [
    r"^חברי הסגל האקדמי$",
    r"^דיקנית הפקולטה.*$",
    r"^פרופסור מחקר.*$",
    r"^פרופסור מן המניין$",
    r"^פרופסור חבר.*$",
    r"^מרצים בכירים$",
    r"^פרופסור בהשתייכות משנית$",
    r"^פרופ׳ חבר בהשתייכות משנית.*$",
    r"^פרופסור אורח מיוחד$",
    r"^פרופסור אורח$",
    r"^מדען/מרצה אורח$",
    r"^עמיתי מחקר.*$",
    r"^פרופסור אמריטוס$",
    r"^חבר סגל בגמלאות.*$",
]
GENERAL_MARKERS: List[Tuple[str, str]] = [
    ("תאור היחידה", r"(?m)^\s*תאור היחידה\s*$"),
    ("המסלול להנדסת חשמל", r"(?m)^\s*המסלול בהנדסת חשמל\s*$"),
    ("המסלול להנדסת חשמל ומתמטיקה", r"(?m)^\s*המגמה בהנדסת חשמל ומתמטיקה\s*$"),
    ("המסלול להנדסת מחשבים ותוכנה", r"(?m)^\s*המסלול בהנדסת מחשבים ותוכנה\s*$"),
    # זה הביטוי שבפועל מופיע אצלך גם כשהכותרת "חשמל ופיזיקה" לא נשמרת בנפרד
    ("המסלול להנדסת חשמל ופיזיקה", r"תכנית לימודים משותפת לפקולטה להנדסת חשמל ומחשבים והפקולטה לפיסיקה"),
    ("המסלול להנדסת מחשבים", r"(?m)^\s*המסלול בהנדסת מחשבים\s*$"),
    ("מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי", r"(?m)^\s*תכניות מיוחדות תכנית למצטיינים בדגש מחקרי\s*$"),
    ("העשרה במתמטיקה", r"(?m)^\s*העשרה במתמטיקה\s*$"),
    ("תארים נוספים", r"(?m)^\s*תארים נוספים\s*$"),
    # אצלך זה מתחיל בפועל מהמשפט הזה
    ("לימודים לקראת תואר ראשון נוסף הכולל תעודת הוראה", r"במקביל ללימודים לקראת תואר ראשון בפקולטה"),
    ("סטודנטים מצטיינים", r"(?m)^\s*סטודנטים מצטיינים\s*$"),
]
GENERIC_MARKERS: List[Tuple[str, str]] = [
    ("פטורים להנדסאים", r"(?m)^\s*פטורים .*?$"),
    ("תוכניות הלימודים", r"(?m)^\s*תוכניות הלימודים\s*$"),
    ("המסלול", r"(?m)^\s*המסלול .*?$"),
    ("המגמה", r"(?m)^\s*המגמה .*?$"),
    ("מקצועות חובה", r"(?m)^\s*מקצועות חובה:?\s*$"),
    ("מקצועות בחירה", r"(?m)^\s*מקצועות בחירה.*$"),
    ("הערות", r"(?m)^\s*הערות:?\s*$"),
]
SEMESTER_MARKERS: List[Tuple[str, str]] = [
    ("סמסטר 1", r"(?m)^\s*סמסטר\s+1\s*$"),
    ("סמסטר 2", r"(?m)^\s*סמסטר\s+2\s*$"),
    ("סמסטר 3", r"(?m)^\s*סמסטר\s+3\s*$"),
    ("סמסטר 4", r"(?m)^\s*סמסטר\s+4\s*$"),
    ("סמסטר 5", r"(?m)^\s*סמסטר\s+5\s*$"),
    ("סמסטר 6", r"(?m)^\s*סמסטר\s+6\s*$"),
    ("סמסטר 7", r"(?m)^\s*סמסטר\s+7\s*$"),
    ("סמסטר 8", r"(?m)^\s*סמסטר\s+8\s*$"),
]
MARKER_RE = re.compile(r"\[\[MARKER::(.*?)\]\]")
def load_json(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
def get_result_root(data: Dict[str, Any]) -> Dict[str, Any]:
    return data.get("analyzeResult", data)
def clean_text(text: str) -> str:
    if not text:
        return ""
    for pattern in NOISE_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
def is_noise_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    for pattern in DROP_LINE_PATTERNS:
        if re.match(pattern, s):
            return True
    words = s.split()
    if len(words) >= 8 and "פרויקט" not in s and "סמסטר" not in s and "מסלול" not in s:
        hebrew_ratio = sum(1 for ch in s if "\u0590" <= ch <= "\u05FF") / max(len(s), 1)
        if hebrew_ratio > 0.4 and s.count(",") == 0 and ":" not in s and "|" not in s:
            if not any(key in s for key in ["מקצוע", "קורס", "נק׳", "נקודות", "בחירה", "חובה"]):
                return True
    return False
def filter_noise_lines(text: str) -> str:
    return clean_text("\n".join(line for line in text.splitlines() if not is_noise_line(line)))
def span_text(full_content: str, span: Dict[str, Any]) -> str:
    offset = span.get("offset", 0)
    length = span.get("length", 0)
    return full_content[offset:offset + length]
def extract_page_text(result: Dict[str, Any]) -> Dict[int, str]:
    full_content = result.get("content", "")
    page_text: Dict[int, str] = {}
    paragraphs = result.get("paragraphs", [])
    if paragraphs:
        grouped: Dict[int, List[str]] = {}
        for para in paragraphs:
            spans = para.get("spans", [])
            text = "".join(span_text(full_content, sp) for sp in spans).strip()
            if not text:
                continue
            page_numbers = {
                br.get("pageNumber")
                for br in para.get("boundingRegions", [])
                if br.get("pageNumber") is not None
            }
            for p in page_numbers:
                grouped.setdefault(p, []).append(text)
        for p, items in grouped.items():
            page_text[p] = filter_noise_lines("\n".join(items))
    if not page_text:
        for page in result.get("pages", []):
            p = page.get("pageNumber")
            spans = page.get("spans", [])
            text = "".join(span_text(full_content, sp) for sp in spans)
            if p is not None:
                page_text[p] = filter_noise_lines(text)
    return page_text
def table_to_markdown(table: Dict[str, Any]) -> str:
    cells = table.get("cells", [])
    if not cells:
        return ""
    rows = max((cell.get("rowIndex", 0) for cell in cells), default=-1) + 1
    cols = max((cell.get("columnIndex", 0) for cell in cells), default=-1) + 1
    if rows <= 0 or cols <= 0:
        return ""
    grid = [["" for _ in range(cols)] for _ in range(rows)]
    for cell in cells:
        r = cell.get("rowIndex", 0)
        c = cell.get("columnIndex", 0)
        txt = clean_text(cell.get("content", ""))
        if 0 <= r < rows and 0 <= c < cols:
            grid[r][c] = txt
    if not any(any(cell.strip() for cell in row) for row in grid):
        return ""
    header = grid[0]
    md = []
    md.append("| " + " | ".join(header) + " |")
    md.append("| " + " | ".join(["---"] * len(header)) + " |")
    for row in grid[1:]:
        md.append("| " + " | ".join(row) + " |")
    return "\n".join(md)
def extract_tables_by_page(result: Dict[str, Any]) -> Dict[int, List[Dict[str, Any]]]:
    tables_by_page: Dict[int, List[Dict[str, Any]]] = {}
    for idx, table in enumerate(result.get("tables", []), start=1):
        pages = set()
        for br in table.get("boundingRegions", []):
            page_number = br.get("pageNumber")
            if page_number is not None:
                pages.add(page_number)
        md = table_to_markdown(table)
        fallback_text = clean_text(table.get("content", ""))
        obj = {
            "table_id": idx,
            "markdown": md,
            "text": fallback_text,
            "row_count": table.get("rowCount"),
            "column_count": table.get("columnCount"),
        }
        for p in pages:
            tables_by_page.setdefault(p, []).append(obj)
    return tables_by_page
def join_pages(page_text: Dict[int, str], start: int, end: int) -> str:
    parts = []
    for p in range(start, end + 1):
        txt = page_text.get(p, "").strip()
        if txt:
            parts.append(f"--- עמוד {p} ---\n{txt}")
    return clean_text("\n\n".join(parts))
def collect_tables(tables_by_page: Dict[int, List[Dict[str, Any]]], start: int, end: int) -> List[Dict[str, Any]]:
    collected = []
    for p in range(start, end + 1):
        for table in tables_by_page.get(p, []):
            item = dict(table)
            item["page"] = p
            collected.append(item)
    return collected
def insert_markers(text: str, marker_specs: List[Tuple[str, str]]) -> str:
    out = text
    for title, pattern in marker_specs:
        marker = f"[[MARKER::{title}]]"
        out = re.sub(pattern, lambda m: f"\n{marker}\n{m.group(0)}", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out
def split_marked_text(text: str, marker_specs: List[Tuple[str, str]], default_title: str = "כללי") -> List[Dict[str, str]]:
    marked = insert_markers(text, marker_specs)
    parts = MARKER_RE.split(marked)
    chunks: List[Dict[str, str]] = []
    preface = clean_text(parts[0]) if parts else ""
    if preface:
        chunks.append({
            "subsection_title": default_title,
            "content_text": preface,
            "content_type": content_type_from_title(default_title),
        })
    i = 1
    while i + 1 < len(parts):
        title = clean_text(parts[i])
        content = clean_text(parts[i + 1])
        if content:
            chunks.append({
                "subsection_title": title,
                "content_text": content,
                "content_type": content_type_from_title(title),
            })
        i += 2
    return dedupe_chunks(chunks)
def dedupe_chunks(chunks: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out = []
    seen = set()
    for c in chunks:
        key = (c["subsection_title"], c["content_text"])
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out
def content_type_from_title(title: str) -> str:
    if title.startswith("סמסטר"):
        return "semester"
    if "מקצועות חובה" in title:
        return "required_courses"
    if "מקצועות בחירה" in title:
        return "electives"
    if "פטורים" in title:
        return "exemptions"
    if title in {
        "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי",
        "סטודנטים מצטיינים",
        "העשרה במתמטיקה",
    }:
        return "honors"
    if title in {"תאור היחידה", "תוכניות הלימודים", "תארים נוספים", "לימודים לקראת תואר ראשון נוסף הכולל תעודת הוראה"}:
        return "subsection"
    if "מסלול" in title or "מגמה" in title:
        return "track_description"
    return "subsection"
def trim_general_section(text: str) -> str:
    marker = "תאור היחידה"
    idx = text.find(marker)
    if idx != -1:
        return clean_text(text[idx:])
    return clean_text(text)
def split_general_section(text: str) -> List[Dict[str, str]]:
    text = trim_general_section(text)
    return split_marked_text(text, GENERAL_MARKERS, default_title="כללי")
def split_non_general_section(text: str) -> List[Dict[str, str]]:
    marker_specs = []
    marker_specs.extend(GENERIC_MARKERS)
    marker_specs.extend(SEMESTER_MARKERS)
    chunks = split_marked_text(text, marker_specs, default_title="כללי")
    # אם יש chunk רחב בשם "כללי" והוא קצר וחסר ערך, זורקים
    filtered = []
    for c in chunks:
        if c["subsection_title"] == "כללי" and len(c["content_text"]) < 80:
            continue
        filtered.append(c)
    return dedupe_chunks(filtered)
def build_sections(result: Dict[str, Any], source_file: str) -> List[Dict[str, Any]]:
    page_text = extract_page_text(result)
    tables_by_page = extract_tables_by_page(result)
    sections: List[Dict[str, Any]] = []
    for section in SECTION_RANGES:
        title = section["title"]
        start = section["start"]
        end = section["end"]
        content_text = join_pages(page_text, start, end)
        tables = collect_tables(tables_by_page, start, end)
        if title == "הסבר כללי על המסלולים השונים":
            subsections = split_general_section(content_text)
        else:
            subsections = split_non_general_section(content_text)
        sections.append({
            "section_title": title,
            "page_start": start,
            "page_end": end,
            "page_range": f"{start}-{end}",
            "source_file": source_file,
            "language": "he",
            "doc_type": "study_program",
            "content_text": content_text,
            "tables": tables,
            "subsections": subsections,
        })
    return sections
def flatten_for_jsonl(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []
    # בכוונה לא מייצרים section-level records.
    # זה מוריד מאוד רעש ומונע chunks רחבים מדי ב-RAG.
    for sec_index, section in enumerate(sections, start=1):
        for sub_index, subsection in enumerate(section.get("subsections", []), start=1):
            text = subsection["content_text"].strip()
            if not text:
                continue
            records.append({
                "id": f"section-{sec_index}-sub-{sub_index}",
                "text": text,
                "metadata": {
                    "section_title": section["section_title"],
                    "subsection_title": subsection["subsection_title"],
                    "page_start": section["page_start"],
                    "page_end": section["page_end"],
                    "page_range": section["page_range"],
                    "source_file": section["source_file"],
                    "language": section["language"],
                    "doc_type": section["doc_type"],
                    "content_type": subsection["content_type"],
                }
            })
        for table in section.get("tables", []):
            table_text = clean_text(table.get("markdown") or table.get("text") or "")
            if not table_text:
                continue
            records.append({
                "id": f"section-{sec_index}-table-{table['table_id']}-page-{table['page']}",
                "text": table_text,
                "metadata": {
                    "section_title": section["section_title"],
                    "page_start": section["page_start"],
                    "page_end": section["page_end"],
                    "page_range": section["page_range"],
                    "table_id": table["table_id"],
                    "table_page": table["page"],
                    "source_file": section["source_file"],
                    "language": section["language"],
                    "doc_type": section["doc_type"],
                    "content_type": "table",
                }
            })
    return records
def save_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
def save_jsonl(path: Path, records: List[Dict[str, Any]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"לא נמצא הקובץ {INPUT_FILE}")
    data = load_json(INPUT_FILE)
    result = get_result_root(data)
    if "content" not in result:
        raise ValueError("לא נמצא שדה content בתוך analyzeResult")
    sections = build_sections(result, source_file=INPUT_FILE.name)
    records = flatten_for_jsonl(sections)
    save_json(OUTPUT_JSON, sections)
    save_jsonl(OUTPUT_JSONL, records)
    print(f"[OK] נשמר קובץ {OUTPUT_JSON.name}")
    print(f"[OK] נשמר קובץ {OUTPUT_JSONL.name}")
    print(f"[INFO] מספר סקשנים: {len(sections)}")
    print(f"[INFO] מספר רשומות JSONL: {len(records)}")
if __name__ == "__main__":
    main()
