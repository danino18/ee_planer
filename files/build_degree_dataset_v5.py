import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent
INPUT_AZURE = BASE_DIR / "azure_layout_result.json"
INPUT_V4 = BASE_DIR / "processed_sections_v4.json"

OUTPUT_TRACKS = BASE_DIR / "tracks_clean_v5.json"
OUTPUT_COURSES = BASE_DIR / "courses_clean_v5.json"
OUTPUT_RULES = BASE_DIR / "rules_clean_v5.json"
OUTPUT_PINECONE = BASE_DIR / "pinecone_records_v5.jsonl"
OUTPUT_QA = BASE_DIR / "qa_report_v5.json"

COURSE_CODE_RE = re.compile(r"\b0\d{7}\b")
NUM_RE = re.compile(r"(?<!\d)(\d+(?:\.\d+)?)(?!\d)")
SEMESTER_RE = re.compile(r"סמסטר\s+(\d+)")
PAGE_MARKER_RE = re.compile(r"--- עמוד \d+ ---")
HEB_LETTER_RE = re.compile(r"[\u0590-\u05FF]")

TRACK_PAGE_RANGES = {
    "המסלול להנדסת חשמל": (3, 7),
    "המסלול להנדסת חשמל ומתמטיקה": (8, 11),
    "המסלול להנדסת מחשבים ותוכנה": (11, 13),
    "המסלול להנדסת חשמל ופיזיקה": (14, 17),
    "מסלול משולב לתואר מוסמך למדעים בהנדסת חשמל ובפיזיקה": (17, 20),
    "המסלול להנדסת מחשבים": (21, 24),
    "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי": (24, 24),
    "תכנית התמחות משנה בין פקולטית ברובוטיקה": (24, 24),
}

def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace(":unselected:", "")
    text = PAGE_MARKER_RE.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def normalize_track_title(title: str) -> str:
    title = clean_text(title)
    mapping = {
        "המסלול בהנדסת חשמל": "המסלול להנדסת חשמל",
        "המגמה בהנדסת חשמל ומתמטיקה": "המסלול להנדסת חשמל ומתמטיקה",
        "המסלול בהנדסת מחשבים ותוכנה": "המסלול להנדסת מחשבים ותוכנה",
        "המסלול בהנדסת מחשבים": "המסלול להנדסת מחשבים",
    }
    return mapping.get(title, title)

def result_root(data: Dict[str, Any]) -> Dict[str, Any]:
    return data.get("analyzeResult", data)

def rows_from_table(table: Dict[str, Any]) -> List[List[str]]:
    cells = table.get("cells", [])
    if not cells:
        return []
    rows = max((c.get("rowIndex", 0) for c in cells), default=-1) + 1
    cols = max((c.get("columnIndex", 0) for c in cells), default=-1) + 1
    grid = [["" for _ in range(cols)] for _ in range(rows)]
    for cell in cells:
        r = cell.get("rowIndex", 0)
        c = cell.get("columnIndex", 0)
        txt = clean_text(cell.get("content", ""))
        if 0 <= r < rows and 0 <= c < cols:
            if grid[r][c]:
                grid[r][c] += " " + txt
            else:
                grid[r][c] = txt
    return grid

def pages_for_table(table: Dict[str, Any]) -> List[int]:
    pages = sorted({br.get("pageNumber") for br in table.get("boundingRegions", []) if br.get("pageNumber") is not None})
    return pages

def row_has_course_code(row: List[str]) -> bool:
    return bool(COURSE_CODE_RE.search(" ".join(row)))

def row_is_header(row: List[str]) -> bool:
    joined = " ".join(row)
    markers = ["ה׳", "ת׳", "מ׳", "פ׳", "נק׳", "ה", "ת", "מ", "פ", "נק"]
    count = sum(1 for m in markers if m in joined)
    return count >= 2

def normalize_header_cell(cell: str) -> Optional[str]:
    cell = clean_text(cell)
    if cell in {"ה׳", "ה"}:
        return "lecture_hours"
    if cell in {"ת׳", "ת"}:
        return "tutorial_hours"
    if cell in {"מ׳", "מ"}:
        return "lab_hours"
    if cell in {"פ׳", "פ"}:
        return "project_hours"
    if "נק" in cell:
        return "points"
    return None

def parse_float(s: str) -> Optional[float]:
    s = clean_text(s)
    if not s:
        return None
    m = re.fullmatch(r"\d+(?:\.\d+)?", s)
    if m:
        try:
            return float(s)
        except Exception:
            return None
    return None

def extract_code_and_name(row: List[str]) -> Tuple[Optional[str], Optional[str]]:
    joined = " | ".join([clean_text(x) for x in row if clean_text(x)])
    code_match = COURSE_CODE_RE.search(joined)
    if not code_match:
        return None, None
    code = code_match.group(0)

    # Best name candidate: text in same cell as the code
    same_cell_name = None
    for cell in row:
        cell_c = clean_text(cell)
        if code in cell_c:
            candidate = cell_c.replace(code, "").strip(" -|")
            if candidate and HEB_LETTER_RE.search(candidate):
                same_cell_name = candidate
                break

    if same_cell_name:
        return code, same_cell_name

    # Fallback: gather nearby Hebrew text from row
    parts = []
    for cell in row:
        cell_c = clean_text(cell)
        if cell_c == code:
            continue
        if HEB_LETTER_RE.search(cell_c) and not re.fullmatch(r"[\d.\-*]+", cell_c):
            parts.append(cell_c)
    name = " ".join(parts).strip()
    if name:
        return code, name
    return code, None

def table_contains_semester_info(rows: List[List[str]]) -> bool:
    joined = "\n".join(" | ".join(r) for r in rows)
    return bool(SEMESTER_RE.search(joined)) or any(row_is_header(r) for r in rows)

def infer_track_from_pages(track_ranges: Dict[str, Tuple[int, int]], pages: List[int]) -> Optional[str]:
    if not pages:
        return None
    best = None
    best_overlap = -1
    page_set = set(pages)
    for track, (start, end) in track_ranges.items():
        overlap = len(page_set & set(range(start, end + 1)))
        if overlap > best_overlap:
            best_overlap = overlap
            best = track
    return best

def parse_course_tables(azure_result: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    courses: List[Dict[str, Any]] = []
    qa: List[Dict[str, Any]] = []

    tables = azure_result.get("tables", [])
    for t_idx, table in enumerate(tables, start=1):
        rows = rows_from_table(table)
        if not rows:
            continue
        if not table_contains_semester_info(rows):
            continue

        table_pages = pages_for_table(table)
        track = infer_track_from_pages(TRACK_PAGE_RANGES, table_pages)
        current_semester = None
        current_header_map: Dict[int, str] = {}

        for r_idx, row in enumerate(rows):
            row_clean = [clean_text(x) for x in row]
            row_joined = " | ".join([x for x in row_clean if x])

            sem_match = SEMESTER_RE.search(row_joined)
            if sem_match:
                current_semester = int(sem_match.group(1))
                # sometimes next row is the header row
                continue

            if row_is_header(row_clean):
                header_map = {}
                for idx, cell in enumerate(row_clean):
                    norm = normalize_header_cell(cell)
                    if norm:
                        header_map[idx] = norm
                if header_map:
                    current_header_map = header_map
                continue

            code, name = extract_code_and_name(row_clean)
            if not code:
                # rows like "מקצועות מעבדה מתוך רשימה" or broken OCR rows
                if current_semester and HEB_LETTER_RE.search(row_joined) and "מקצועות מעבדה" in row_joined:
                    qa.append({
                        "issue": "non_course_requirement_row_in_semester_table",
                        "table_id": t_idx,
                        "pages": table_pages,
                        "track": track,
                        "semester": current_semester,
                        "row_index": r_idx,
                        "row_text": row_joined,
                    })
                continue

            lecture_hours = tutorial_hours = lab_hours = project_hours = points = None
            for idx, cell in enumerate(row_clean):
                if idx in current_header_map:
                    val = parse_float(cell)
                    field = current_header_map[idx]
                    if val is not None:
                        if field == "lecture_hours":
                            lecture_hours = val
                        elif field == "tutorial_hours":
                            tutorial_hours = val
                        elif field == "lab_hours":
                            lab_hours = val
                        elif field == "project_hours":
                            project_hours = val
                        elif field == "points":
                            points = val

            record = {
                "track_title": track,
                "semester": current_semester,
                "course_code": code,
                "course_name": name,
                "lecture_hours": lecture_hours,
                "tutorial_hours": tutorial_hours,
                "lab_hours": lab_hours,
                "project_hours": project_hours,
                "points": points,
                "source": "azure_table",
                "table_id": t_idx,
                "pages": table_pages,
                "raw_row": row_joined,
                "confidence": "high" if (code and name and current_semester is not None) else "medium",
            }
            courses.append(record)

            if name is None or current_semester is None:
                qa.append({
                    "issue": "incomplete_course_row",
                    "table_id": t_idx,
                    "pages": table_pages,
                    "track": track,
                    "row_index": r_idx,
                    "row_text": row_joined,
                    "parsed": record,
                })

    return courses, qa

def parse_semester_text_fallback(v4_sections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    courses: List[Dict[str, Any]] = []
    qa: List[Dict[str, Any]] = []

    for section in v4_sections:
        track = section.get("section_title")
        for sub in section.get("subsections", []):
            title = clean_text(sub.get("subsection_title", ""))
            content = clean_text(sub.get("content_text", ""))

            sem_match = SEMESTER_RE.search(title) or SEMESTER_RE.search(content.splitlines()[0] if content else "")
            if not sem_match:
                continue
            semester = int(sem_match.group(1))

            lines = [clean_text(x) for x in content.splitlines() if clean_text(x)]
            # Use line-based extraction: lines that contain a course code
            for idx, line in enumerate(lines):
                code_match = COURSE_CODE_RE.search(line)
                if not code_match:
                    continue
                code = code_match.group(0)
                name = line.replace(code, "").strip(" -|")
                if not name:
                    # fallback to next non-numeric line
                    for j in range(idx + 1, min(idx + 4, len(lines))):
                        if HEB_LETTER_RE.search(lines[j]) and not COURSE_CODE_RE.search(lines[j]):
                            name = lines[j]
                            break

                # nearby points: first numeric-looking token in next 4 lines
                points = None
                for j in range(idx + 1, min(idx + 5, len(lines))):
                    maybe = parse_float(lines[j])
                    if maybe is not None and 0 < maybe <= 20:
                        points = maybe
                        break

                record = {
                    "track_title": track,
                    "semester": semester,
                    "course_code": code,
                    "course_name": name or None,
                    "lecture_hours": None,
                    "tutorial_hours": None,
                    "lab_hours": None,
                    "project_hours": None,
                    "points": points,
                    "source": "v4_semester_fallback",
                    "table_id": None,
                    "pages": list(range(section.get("page_start", 0), section.get("page_end", 0) + 1)),
                    "raw_row": line,
                    "confidence": "medium" if name else "low",
                }
                courses.append(record)

                if not name:
                    qa.append({
                        "issue": "fallback_course_without_name",
                        "track": track,
                        "semester": semester,
                        "raw_row": line,
                        "subsection_title": title,
                    })

    return courses, qa

def dedupe_courses(primary: List[Dict[str, Any]], fallback: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    out = []
    qa = []
    seen = set()

    # Keep primary first
    for c in primary:
        key = (c.get("track_title"), c.get("semester"), c.get("course_code"))
        if key in seen:
            qa.append({"issue": "duplicate_primary_course", "course": c})
            continue
        seen.add(key)
        out.append(c)

    for c in fallback:
        key = (c.get("track_title"), c.get("semester"), c.get("course_code"))
        if key in seen:
            continue
        seen.add(key)
        out.append(c)

    # sort
    out.sort(key=lambda x: (
        x.get("track_title") or "",
        x.get("semester") or 999,
        x.get("course_code") or "",
    ))
    return out, qa

def extract_track_summaries(v4_sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tracks = []
    general_section = None
    for s in v4_sections:
        if s.get("section_title") == "הסבר כללי על המסלולים השונים":
            general_section = s
            break

    if general_section:
        for sub in general_section.get("subsections", []):
            title = clean_text(sub.get("subsection_title", ""))
            content = clean_text(sub.get("content_text", ""))
            ctype = sub.get("content_type")
            if title in {
                "המסלול להנדסת חשמל",
                "המסלול להנדסת חשמל ומתמטיקה",
                "המסלול להנדסת מחשבים ותוכנה",
                "המסלול להנדסת חשמל ופיזיקה",
                "המסלול להנדסת מחשבים",
                "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי",
                "העשרה במתמטיקה",
                "תארים נוספים",
                "לימודים לקראת תואר ראשון נוסף הכולל תעודת הוראה",
                "סטודנטים מצטיינים",
                "תאור היחידה",
            }:
                tracks.append({
                    "title": normalize_track_title(title),
                    "content_type": ctype,
                    "summary_text": content,
                    "page_range": "1-2",
                    "source": "processed_sections_v4",
                })

    # add per-track section content summaries
    for s in v4_sections:
        if s.get("section_title") == "הסבר כללי על המסלולים השונים":
            continue
        title = normalize_track_title(s.get("section_title", ""))
        tracks.append({
            "title": title,
            "content_type": "track_section",
            "summary_text": clean_text(s.get("content_text", "")),
            "page_range": f"{s.get('page_start')}-{s.get('page_end')}",
            "source": "processed_sections_v4",
        })

    # dedupe by (title, content_type, summary)
    deduped = []
    seen = set()
    for t in tracks:
        key = (t["title"], t["content_type"], t["summary_text"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(t)
    return deduped

def extract_rules(v4_sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rules = []

    def add_rule(track_title: str, rule_type: str, text: str, value: Optional[float] = None, extra: Optional[Dict[str, Any]] = None):
        rec = {
            "track_title": normalize_track_title(track_title),
            "rule_type": rule_type,
            "text": clean_text(text),
            "value": value,
        }
        if extra:
            rec.update(extra)
        rules.append(rec)

    for s in v4_sections:
        track = normalize_track_title(s.get("section_title", ""))
        section_text = clean_text(s.get("content_text", ""))

        m = re.search(r"יש לצבור\s+([0-9]+(?:\.[0-9]+)?)\s+נק", section_text)
        if m:
            add_rule(track, "total_degree_points", m.group(0), float(m.group(1)))

        m = re.search(r"מקצועות חובה:\s*([0-9]+(?:\.[0-9]+)?)", section_text)
        if m:
            add_rule(track, "required_points", m.group(0), float(m.group(1)))

        m = re.search(r"מקצועות בחירה פקולטיים:\s*(?:לפחות\s*)?([0-9]+(?:\.[0-9]+)?)", section_text)
        if m:
            add_rule(track, "faculty_elective_points", m.group(0), float(m.group(1)))

        m = re.search(r"מקצועות בחירה כלל[-–]?טכניונית:\s*([0-9]+(?:\.[0-9]+)?)", section_text)
        if m:
            add_rule(track, "general_elective_points", m.group(0), float(m.group(1)))

        m = re.search(r"יש להשלים לפחות\s+([^\n]+?)\s+קבוצות התמחות", section_text)
        if m:
            add_rule(track, "specialization_groups_requirement", m.group(0), None, {"groups_text": clean_text(m.group(1))})

        for sub in s.get("subsections", []):
            title = clean_text(sub.get("subsection_title", ""))
            content = clean_text(sub.get("content_text", ""))

            if title.startswith("פטורים"):
                add_rule(track, "exemptions", content)

            if title == "סטודנטים מצטיינים":
                for avg in re.finditer(r"ממוצע מצטבר של\s+([0-9]+)", content):
                    add_rule(track, "honors_average_threshold", avg.group(0), float(avg.group(1)))
                for pts in re.finditer(r"צברו(?: למעלה מ[- ]| מעל )\s*([0-9]+)\s*נק", content):
                    add_rule(track, "honors_points_threshold", pts.group(0), float(pts.group(1)))

            if title == "העשרה במתמטיקה":
                add_rule(track, "math_enrichment", content)

            if title == "תארים נוספים":
                add_rule(track, "additional_degree_option", content)

            if title == "לימודים לקראת תואר ראשון נוסף הכולל תעודת הוראה":
                add_rule(track, "teaching_certificate_option", content)

            # extract specialization rules from electives blocks
            if "קבוצות התמחות" in content or "קבוצת התמחות" in content:
                add_rule(track, "specialization_rule_block", content)

    # dedupe
    deduped = []
    seen = set()
    for r in rules:
        key = (r["track_title"], r["rule_type"], r["text"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    return deduped

def build_pinecone_records(tracks: List[Dict[str, Any]], courses: List[Dict[str, Any]], rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    records = []

    for i, t in enumerate(tracks, start=1):
        text = f"""סוג רשומה: track_summary
כותרת: {t['title']}
סוג תוכן: {t['content_type']}
טווח עמודים: {t['page_range']}
תוכן:
{t['summary_text']}""".strip()

        records.append({
            "id": f"track-{i}",
            "text": text,
            "metadata": {
                "record_type": "track_summary",
                "track_title": t["title"],
                "content_type": t["content_type"],
                "page_range": t["page_range"],
                "source": t["source"],
                "language": "he",
            }
        })

    for i, c in enumerate(courses, start=1):
        fields = []
        if c.get("course_code"): fields.append(f"קוד קורס: {c['course_code']}")
        if c.get("course_name"): fields.append(f"שם קורס: {c['course_name']}")
        if c.get("track_title"): fields.append(f"מסלול: {c['track_title']}")
        if c.get("semester") is not None: fields.append(f"סמסטר: {c['semester']}")
        if c.get("lecture_hours") is not None: fields.append(f"שעות הרצאה: {c['lecture_hours']}")
        if c.get("tutorial_hours") is not None: fields.append(f"שעות תרגיל: {c['tutorial_hours']}")
        if c.get("lab_hours") is not None: fields.append(f"שעות מעבדה: {c['lab_hours']}")
        if c.get("project_hours") is not None: fields.append(f"שעות פרויקט: {c['project_hours']}")
        if c.get("points") is not None: fields.append(f"נקודות: {c['points']}")
        fields.append(f"מקור: {c['source']}")
        fields.append(f"ביטחון חילוץ: {c['confidence']}")
        fields.append(f"טקסט מקור: {c['raw_row']}")

        text = "סוג רשומה: course\n" + "\n".join(fields)

        records.append({
            "id": f"course-{i}",
            "text": text,
            "metadata": {
                "record_type": "course",
                "track_title": c.get("track_title"),
                "semester": c.get("semester"),
                "course_code": c.get("course_code"),
                "course_name": c.get("course_name"),
                "points": c.get("points"),
                "source": c.get("source"),
                "confidence": c.get("confidence"),
                "language": "he",
            }
        })

    for i, r in enumerate(rules, start=1):
        text = f"""סוג רשומה: rule
מסלול: {r['track_title']}
סוג כלל: {r['rule_type']}
ערך מספרי: {r.get('value')}
תוכן:
{r['text']}""".strip()

        records.append({
            "id": f"rule-{i}",
            "text": text,
            "metadata": {
                "record_type": "rule",
                "track_title": r["track_title"],
                "rule_type": r["rule_type"],
                "value": r.get("value"),
                "language": "he",
            }
        })

    return records

def main() -> None:
    if not INPUT_AZURE.exists():
        raise FileNotFoundError(f"לא נמצא {INPUT_AZURE}")
    if not INPUT_V4.exists():
        raise FileNotFoundError(f"לא נמצא {INPUT_V4}")

    azure_data = load_json(INPUT_AZURE)
    azure_result = result_root(azure_data)
    v4_sections = load_json(INPUT_V4)

    tracks = extract_track_summaries(v4_sections)
    table_courses, qa_table = parse_course_tables(azure_result)
    fallback_courses, qa_fallback = parse_semester_text_fallback(v4_sections)
    courses, qa_dedupe = dedupe_courses(table_courses, fallback_courses)
    rules = extract_rules(v4_sections)
    pinecone_records = build_pinecone_records(tracks, courses, rules)

    qa = {
        "summary": {
            "tracks": len(tracks),
            "courses_from_tables": len(table_courses),
            "courses_from_fallback": len(fallback_courses),
            "courses_final": len(courses),
            "rules": len(rules),
            "pinecone_records": len(pinecone_records),
        },
        "table_issues": qa_table,
        "fallback_issues": qa_fallback,
        "dedupe_issues": qa_dedupe,
        "courses_missing_points": [c for c in courses if c.get("points") is None],
        "courses_missing_name": [c for c in courses if not c.get("course_name")],
        "courses_low_confidence": [c for c in courses if c.get("confidence") == "low"],
    }

    with open(OUTPUT_TRACKS, "w", encoding="utf-8") as f:
        json.dump(tracks, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_COURSES, "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_RULES, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_QA, "w", encoding="utf-8") as f:
        json.dump(qa, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_PINECONE, "w", encoding="utf-8") as f:
        for rec in pinecone_records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"[OK] {OUTPUT_TRACKS.name}")
    print(f"[OK] {OUTPUT_COURSES.name}")
    print(f"[OK] {OUTPUT_RULES.name}")
    print(f"[OK] {OUTPUT_QA.name}")
    print(f"[OK] {OUTPUT_PINECONE.name}")
    print(f"[INFO] tracks={len(tracks)} courses_final={len(courses)} rules={len(rules)} pinecone_records={len(pinecone_records)}")

if __name__ == "__main__":
    main()
