"""
build_v6.py — builds the v6 strict course/tracks/rules dataset from Azure tables.
"""
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent
INPUT_AZURE  = BASE_DIR / "azure_layout_result.json"
INPUT_V4     = BASE_DIR / "processed_sections_v4.json"
INPUT_V5_RULES = BASE_DIR / "rules_clean_v5.json"

OUT_STRICT   = BASE_DIR / "courses_strict_v6.json"
OUT_REVIEW   = BASE_DIR / "courses_review_v6.json"
OUT_TRACKS   = BASE_DIR / "tracks_clean_v6.json"
OUT_RULES    = BASE_DIR / "rules_clean_v6.json"
OUT_QA       = BASE_DIR / "qa_report_v6.json"
OUT_PINECONE = BASE_DIR / "pinecone_records_v6.jsonl"

# ── constants ────────────────────────────────────────────────────────────────

COURSE_CODE_RE = re.compile(r"\b(0\d{7})\b")
POINTS_RE      = re.compile(r"^(\d+(?:\.\d+)?)$")
SEMESTER_RE    = re.compile(r"סמסטר\s+(\d+)")
PAGE_MARKER_RE = re.compile(r"---\s*עמוד \d+\s*---")

TRACK_PAGE_RANGES = {
    "המסלול להנדסת חשמל":                             (3,  7),
    "המסלול להנדסת חשמל ומתמטיקה":                    (8,  11),
    "המסלול להנדסת מחשבים ותוכנה":                    (11, 13),
    "המסלול להנדסת חשמל ופיזיקה":                     (14, 17),
    "מסלול משולב לתואר מוסמך למדעים בהנדסת חשמל ובפיזיקה": (17, 20),
    "המסלול להנדסת מחשבים":                           (21, 24),
    "מבנה הלימודים בתוכנית למצטיינים בדגש מחקרי":     (24, 24),
    "תכנית התמחות משנה בין פקולטית ברובוטיקה":        (24, 24),
}

# Column-header normalisation
HEADER_MAP = {
    "ה׳": "lecture_hours", "ה": "lecture_hours",
    "ת׳": "tutorial_hours", "ת": "tutorial_hours",
    "מ׳": "lab_hours",     "מ": "lab_hours",
    "פ׳": "project_hours", "פ": "project_hours",
    "נק׳": "points",       "נק": "points",
}

# ── helpers ──────────────────────────────────────────────────────────────────

def load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def clean_cell(text: str) -> str:
    text = re.sub(r":unselected:", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def parse_float(s: str) -> Optional[float]:
    s = s.strip().strip("*").strip()
    # Handle slash-separated ranges like "3.0/4.0" — take the first (lower) value
    if "/" in s:
        s = s.split("/")[0].strip()
    # Handle merged cells like "5.0 -" — try each whitespace-separated token
    parts = s.split()
    for p in parts:
        try:
            v = float(p)
            if 0 < v <= 30:
                return v
        except ValueError:
            pass
    return None

def rows_from_table(table: Dict) -> List[List[str]]:
    cells = table.get("cells", [])
    if not cells:
        return []
    rows_n = max((c.get("rowIndex", 0) for c in cells), default=-1) + 1
    cols_n = max((c.get("columnIndex", 0) for c in cells), default=-1) + 1
    grid = [[""] * cols_n for _ in range(rows_n)]
    for cell in cells:
        r = cell.get("rowIndex", 0)
        c = cell.get("columnIndex", 0)
        txt = clean_cell(cell.get("content", ""))
        if 0 <= r < rows_n and 0 <= c < cols_n:
            if grid[r][c]:
                grid[r][c] += " " + txt
            else:
                grid[r][c] = txt
    return grid

def table_pages(table: Dict) -> List[int]:
    return sorted({br["pageNumber"] for br in table.get("boundingRegions", []) if "pageNumber" in br})

def infer_tracks(pages: List[int]) -> List[str]:
    """
    Returns all tracks that have maximal page overlap with this table's pages.
    Usually returns one track, but returns multiple when a table sits exactly on
    a track boundary (e.g., page 11 is the last page of 'חשמל ומתמטיקה' and
    the first page of 'מחשבים ותוכנה').  In that case we duplicate the records
    so both tracks get the shared semesters.
    """
    pset = set(pages)
    scored: List[Tuple[int, str]] = []
    for track, (s, e) in TRACK_PAGE_RANGES.items():
        overlap = len(pset & set(range(s, e + 1)))
        if overlap > 0:
            scored.append((overlap, track))
    if not scored:
        return [list(TRACK_PAGE_RANGES.keys())[0]]   # fallback: first track
    best_overlap = max(o for o, _ in scored)
    return [t for o, t in scored if o == best_overlap]

# ── core: extract code+name+hours+points from a single row ───────────────────

def extract_code_name_from_cell(cell_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Code and name may be merged in one cell: '01040012 חדו״א 1ת׳'
    Returns (code, name) for the first found code.
    If the remaining text after removing the code is itself another course code,
    name is set to None (merged-cell case handled separately).
    """
    m = COURSE_CODE_RE.search(cell_text)
    if not m:
        return None, None
    code = m.group(1)
    name = cell_text.replace(code, "").strip(" -|")
    # Remove leading/trailing junk
    name = re.sub(r"^[\s\-|]*", "", name)
    name = re.sub(r"[\s\-|]*$", "", name)
    # If name looks like another course code, discard it
    if name and COURSE_CODE_RE.match(name.strip()):
        name = None
    if not name:
        name = None
    return code, name

def is_header_row(row: List[str]) -> bool:
    joined = " ".join(row)
    header_tokens = {"ה׳", "ת׳", "מ׳", "פ׳", "נק׳", "ה", "ת", "מ", "פ", "נק"}
    tokens_found = sum(1 for t in header_tokens if t in row)
    return tokens_found >= 2

def build_header_map(row: List[str]) -> Dict[int, str]:
    # Priority order: points first so that merged cells like "פ נק׳" map to points
    PRIORITY_TOKENS = [
        ("נק׳", "points"),
        ("נק",  "points"),
        ("ה׳",  "lecture_hours"),
        ("ה",   "lecture_hours"),
        ("ת׳",  "tutorial_hours"),
        ("ת",   "tutorial_hours"),
        ("מ׳",  "lab_hours"),
        ("מ",   "lab_hours"),
        ("פ׳",  "project_hours"),
        ("פ",   "project_hours"),
    ]
    hmap = {}
    for idx, cell in enumerate(row):
        c = clean_cell(cell)
        for token, field in PRIORITY_TOKENS:
            if token in c and field not in hmap.values():
                hmap[idx] = field
                break
    return hmap

# ── main table parser ─────────────────────────────────────────────────────────

def parse_all_tables(azure_result: Dict) -> List[Dict]:
    """
    Returns raw parsed course records from all Azure tables.
    Each record: track_title, semester, course_code, course_name,
                 lecture_hours, tutorial_hours, lab_hours, project_hours,
                 points, table_id, pages, raw_row, source
    """
    records: List[Dict] = []

    for t_idx, table in enumerate(azure_result.get("tables", []), start=1):
        rows = rows_from_table(table)
        if not rows:
            continue
        flat = " ".join(" ".join(r) for r in rows)
        # Only process tables that contain at least one course code
        if not COURSE_CODE_RE.search(flat):
            continue

        pages = table_pages(table)
        tracks_for_table = infer_tracks(pages)
        n_cols = table.get("columnCount", len(rows[0]) if rows else 0)
        wide_table = n_cols >= 10

        current_semester: Optional[int] = None
        header_map: Dict[int, str] = {}
        # For wide tables: which column side holds the semester (= mandatory) courses?
        # semester_side = "left"  → mandatory in left half, electives in right half
        # semester_side = "right" → mandatory in right half, electives in left half
        semester_side: Optional[str] = None

        for r_idx, row in enumerate(rows):
            row_str = " ".join(c for c in row if c)

            # ── semester marker ──────────────────────────────────────────────
            sem_m = SEMESTER_RE.search(row_str)
            if sem_m:
                current_semester = int(sem_m.group(1))
                # For wide tables: detect which column holds the semester header
                if wide_table and semester_side is None:
                    for col_idx, cell in enumerate(row):
                        if SEMESTER_RE.search(cell):
                            midpoint = n_cols // 2
                            semester_side = "left" if col_idx < midpoint else "right"
                            break
                if is_header_row(row):
                    header_map = build_header_map(row)
                continue

            # ── header row ───────────────────────────────────────────────────
            if is_header_row(row):
                header_map = build_header_map(row)
                continue

            # ── skip total / empty rows ──────────────────────────────────────
            if not COURSE_CODE_RE.search(row_str):
                continue

            # ── extract all codes from this row ──────────────────────────────
            row_records = parse_row_for_courses(
                row, row_str, header_map,
                n_cols=n_cols, semester_side=semester_side,
            )

            for rec_code, rec_name, rec_hrs, is_elective_side in row_records:
                lh, th, mh, ph, pts = rec_hrs
                # Elective-side codes in wide tables don't inherit current semester
                assigned_semester = None if is_elective_side else current_semester
                # Duplicate record for each track that claims this table
                for track in tracks_for_table:
                    record = {
                        "track_title":    track,
                        "semester":       assigned_semester,
                        "course_code":    rec_code,
                        "course_name":    rec_name,
                        "lecture_hours":  lh,
                        "tutorial_hours": th,
                        "lab_hours":      mh,
                        "project_hours":  ph,
                        "points":         pts,
                        "source":         "azure_table",
                        "table_id":       t_idx,
                        "pages":          pages,
                        "raw_row":        row_str,
                    }
                    records.append(record)

    return records


def parse_row_for_courses(
    row: List[str],
    row_str: str,
    header_map: Dict[int, str],
    n_cols: int = 0,
    semester_side: Optional[str] = None,
) -> List[Tuple[Optional[str], Optional[str], Tuple, bool]]:
    """
    Returns list of (code, name, (lh, th, mh, ph, pts), is_elective_side).
    is_elective_side=True → code is on the non-mandatory half, skip semester.

    semester_side: "left"  → mandatory is left half, right half is elective
                  "right" → mandatory is right half, left half is elective
                  None    → single-sided table

    Handles:
      - standard left-to-right: code | name | H | T | L | P | pts
      - standard right-to-left: pts | P | L | T | H | name+code
      - merged code+name in single cell
      - elective lists (2-column: code | name)
      - wide dual-column tables (>=10 cols)
    """
    results = []
    wide_table = semester_side is not None
    midpoint   = n_cols // 2 if wide_table else 0

    # Collect numeric values keyed by column index
    numeric_by_col: Dict[int, float] = {}
    for idx, cell in enumerate(row):
        v = parse_float(cell)
        if v is not None:
            numeric_by_col[idx] = v

    # Collect (code, name) pairs by scanning each cell
    code_cells: List[Tuple[int, str, Optional[str]]] = []  # (col_idx, code, name_in_cell)
    for idx, cell in enumerate(row):
        all_codes = COURSE_CODE_RE.findall(cell)
        if not all_codes:
            continue
        if len(all_codes) == 1:
            code, name = extract_code_name_from_cell(cell)
            if code:
                code_cells.append((idx, code, name))
        else:
            # Merged cell with multiple codes — each code gets no name from this cell
            for code in all_codes:
                code_cells.append((idx, code, None))

    if not code_cells:
        return []

    # For each found code, try to get name + numerical fields
    for col_idx, code, inline_name in code_cells:
        # is_elective_side: this code is on the non-mandatory half
        if not wide_table:
            is_elective_side = False
        elif semester_side == "right":
            # Mandatory on right → left half (col < midpoint) is elective
            is_elective_side = col_idx < midpoint
        else:
            # Mandatory on left → right half (col >= midpoint) is elective
            is_elective_side = col_idx >= midpoint

        # Name: inline first, then adjacent cells with Hebrew
        name = inline_name
        if not name:
            # Search in same "half" of the table for name
            if not wide_table:
                search_lo, search_hi = 0, len(row)
            elif is_elective_side and semester_side == "right":
                search_lo, search_hi = 0, midpoint
            elif is_elective_side and semester_side == "left":
                search_lo, search_hi = midpoint, len(row)
            else:
                search_lo, search_hi = 0, len(row)
            candidates = []
            for search_idx in range(max(search_lo, col_idx - 3), min(search_hi, col_idx + 4)):
                cell = row[search_idx].strip()
                if search_idx == col_idx:
                    continue
                if cell and re.search(r"[\u0590-\u05FF]", cell) and not COURSE_CODE_RE.search(cell):
                    if cell not in HEADER_MAP:
                        candidates.append((abs(search_idx - col_idx), search_idx, cell))
            if candidates:
                candidates.sort()
                name = candidates[0][2]

        # Numerical fields via header_map
        lh = th = mh = ph = pts = None
        has_header = bool(header_map)

        if wide_table and is_elective_side:
            # Elective side of wide table: no header map for this side.
            # Try to find a point value in nearby columns.
            search_range = range(0, midpoint) if semester_side == "right" else range(midpoint, len(row))
            pts_candidates = [parse_float(row[i]) for i in search_range
                              if i != col_idx and parse_float(row[i]) is not None]
            for v in pts_candidates:
                if 0.5 <= v <= 20:
                    pts = v
                    break

        elif has_header:
            # Use header map — no fallback to avoid mis-assigning lecture hrs as pts
            for field_col, field_name in header_map.items():
                if field_col < len(row):
                    raw_cell = row[field_col]
                    # Strip trailing junk like "5.0 -" → take first valid float
                    v = parse_float(raw_cell)
                    if v is not None:
                        if field_name == "lecture_hours":    lh  = v
                        elif field_name == "tutorial_hours": th  = v
                        elif field_name == "lab_hours":      mh  = v
                        elif field_name == "project_hours":  ph  = v
                        elif field_name == "points":         pts = v

        else:
            # No header map — conservative fallback only for small tables
            if len(row) <= 5:
                for v in numeric_by_col.values():
                    if 0.5 <= v <= 20:
                        pts = v
                        break

        results.append((code, name, (lh, th, mh, ph, pts), is_elective_side))

    return results


# ── strict acceptance filter ──────────────────────────────────────────────────

def is_valid_course_code(code: str) -> bool:
    """8-digit code starting with 0."""
    return bool(re.match(r"^0\d{7}$", code))

def split_strict_review(raw_records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """
    Applies strict acceptance rules.
    A course enters strict only if ALL are true:
      1. Valid 8-digit course code
      2. Non-empty course name
      3. Semester identified (integer >= 1)
      4. Points > 0
    Everything else goes to review with a reason list.
    """
    strict: List[Dict] = []
    review: List[Dict] = []

    # PE / sports courses may legitimately appear in multiple semesters (student choice).
    # All other courses are deduped per (track, code) — same course should not appear
    # twice under the same track in different semesters.
    PE_CODE_PREFIX = "0394"

    def dedup_key(rec: Dict) -> Tuple:
        code = rec.get("course_code") or ""
        if code.startswith(PE_CODE_PREFIX):
            # Keep each (track, semester, code) combination separately
            return (rec.get("track_title"), rec.get("semester"), code)
        # For all other courses: deduplicate across semesters per (track, code)
        return (rec.get("track_title"), code)

    def score_rec(rec: Dict) -> int:
        """Higher = better quality. Used to pick winner when deduplicating."""
        s = 0
        if rec.get("course_name"):   s += 2
        if rec.get("points"):        s += 3
        if rec.get("semester"):      s += 2
        if rec.get("lecture_hours"): s += 1
        return s

    # Dedup: table entries take priority; key = (track, code) for non-PE courses
    # Collect all, then deduplicate preferring azure_table over fallback
    keyed: Dict[Tuple, Dict] = {}
    for rec in raw_records:
        key = dedup_key(rec)
        existing = keyed.get(key)
        if existing is None:
            keyed[key] = rec
        else:
            # Prefer azure_table source
            if rec["source"] == "azure_table" and existing["source"] != "azure_table":
                keyed[key] = rec
            # If same source, prefer one with more fields filled
            elif rec["source"] == existing["source"]:
                if score_rec(rec) > score_rec(existing):
                    keyed[key] = rec

    for key, rec in keyed.items():
        reasons = []
        code = rec.get("course_code") or ""
        name = (rec.get("course_name") or "").strip()
        semester = rec.get("semester")
        points = rec.get("points")

        if not is_valid_course_code(code):
            reasons.append(f"invalid_code:{code!r}")
        if not name:
            reasons.append("missing_name")
        if semester is None:
            reasons.append("missing_semester")
        elif not isinstance(semester, int) or semester < 1:
            reasons.append(f"invalid_semester:{semester!r}")
        if points is None:
            reasons.append("missing_points")
        elif not isinstance(points, (int, float)) or points <= 0:
            reasons.append(f"invalid_points:{points!r}")

        if reasons:
            review_rec = dict(rec)
            review_rec["rejection_reasons"] = reasons
            review.append(review_rec)
        else:
            strict.append(rec)

    # Sort
    strict.sort(key=lambda x: (x.get("track_title") or "", x.get("semester") or 0, x.get("course_code") or ""))
    review.sort(key=lambda x: (x.get("track_title") or "", x.get("course_code") or ""))
    return strict, review


# ── tracks ────────────────────────────────────────────────────────────────────

def extract_tracks(v4_sections: List[Dict]) -> List[Dict]:
    tracks = []
    general = next((s for s in v4_sections if s.get("section_title") == "הסבר כללי על המסלולים השונים"), None)

    TRACK_TITLES = {
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
    }

    if general:
        for sub in general.get("subsections", []):
            title = sub.get("subsection_title", "").strip()
            if title in TRACK_TITLES:
                tracks.append({
                    "title":        title,
                    "content_type": sub.get("content_type", "subsection"),
                    "summary_text": sub.get("content_text", ""),
                    "page_range":   "1-2",
                    "source":       "processed_sections_v4",
                })

    for sec in v4_sections:
        if sec.get("section_title") == "הסבר כללי על המסלולים השונים":
            continue
        tracks.append({
            "title":        sec.get("section_title", ""),
            "content_type": "track_section",
            "summary_text": sec.get("content_text", ""),
            "page_range":   f"{sec.get('page_start')}-{sec.get('page_end')}",
            "source":       "processed_sections_v4",
        })

    # Dedup
    seen = set()
    out = []
    for t in tracks:
        k = (t["title"], t["content_type"], t["summary_text"][:80])
        if k not in seen:
            seen.add(k)
            out.append(t)
    return out


# ── Pinecone records ──────────────────────────────────────────────────────────

def build_pinecone(strict_courses: List[Dict], tracks: List[Dict], rules: List[Dict]) -> List[Dict]:
    records = []

    for i, t in enumerate(tracks, 1):
        text = (
            f"סוג רשומה: track_summary\n"
            f"כותרת: {t['title']}\n"
            f"סוג תוכן: {t['content_type']}\n"
            f"טווח עמודים: {t['page_range']}\n"
            f"תוכן:\n{t['summary_text']}"
        ).strip()
        records.append({
            "id": f"track-{i}",
            "text": text,
            "metadata": {
                "record_type":  "track_summary",
                "track_title":  t["title"],
                "content_type": t["content_type"],
                "page_range":   t["page_range"],
                "source":       t["source"],
                "language":     "he",
            },
        })

    for i, c in enumerate(strict_courses, 1):
        lines = [f"סוג רשומה: course"]
        if c.get("course_code"):  lines.append(f"קוד קורס: {c['course_code']}")
        if c.get("course_name"):  lines.append(f"שם קורס: {c['course_name']}")
        if c.get("track_title"):  lines.append(f"מסלול: {c['track_title']}")
        if c.get("semester"):     lines.append(f"סמסטר: {c['semester']}")
        if c.get("points") is not None:   lines.append(f"נקודות: {c['points']}")
        if c.get("lecture_hours") is not None:  lines.append(f"שעות הרצאה: {c['lecture_hours']}")
        if c.get("tutorial_hours") is not None: lines.append(f"שעות תרגיל: {c['tutorial_hours']}")
        if c.get("lab_hours") is not None:      lines.append(f"שעות מעבדה: {c['lab_hours']}")
        if c.get("project_hours") is not None:  lines.append(f"שעות פרויקט: {c['project_hours']}")
        lines.append(f"מקור: {c['source']}")
        lines.append(f"טקסט מקור: {c['raw_row']}")
        records.append({
            "id": f"course-{i}",
            "text": "\n".join(lines),
            "metadata": {
                "record_type":   "course",
                "track_title":   c.get("track_title"),
                "semester":      c.get("semester"),
                "course_code":   c.get("course_code"),
                "course_name":   c.get("course_name"),
                "points":        c.get("points"),
                "source":        c.get("source"),
                "language":      "he",
            },
        })

    for i, r in enumerate(rules, 1):
        text = (
            f"סוג רשומה: rule\n"
            f"מסלול: {r.get('track_title','')}\n"
            f"סוג כלל: {r.get('rule_type','')}\n"
            f"ערך מספרי: {r.get('value')}\n"
            f"תוכן:\n{r.get('text','')}"
        ).strip()
        records.append({
            "id": f"rule-{i}",
            "text": text,
            "metadata": {
                "record_type": "rule",
                "track_title": r.get("track_title"),
                "rule_type":   r.get("rule_type"),
                "value":       r.get("value"),
                "language":    "he",
            },
        })

    return records


# ── QA report ─────────────────────────────────────────────────────────────────

def build_qa(strict: List[Dict], review: List[Dict], tracks: List[Dict], rules: List[Dict]) -> Dict:
    # Counts per track
    per_track: Dict[str, int] = defaultdict(int)
    for c in strict:
        per_track[c.get("track_title") or "?"] += 1

    # Rejection breakdown
    rejection_counts: Dict[str, int] = defaultdict(int)
    for c in review:
        for r in c.get("rejection_reasons", []):
            key = r.split(":")[0]
            rejection_counts[key] += 1

    # Missing fields in strict
    missing_breakdown = {
        "lecture_hours":  sum(1 for c in strict if c.get("lecture_hours") is None),
        "tutorial_hours": sum(1 for c in strict if c.get("tutorial_hours") is None),
        "lab_hours":      sum(1 for c in strict if c.get("lab_hours") is None),
        "project_hours":  sum(1 for c in strict if c.get("project_hours") is None),
    }

    # Check for key courses
    strict_codes = {c["course_code"] for c in strict}
    key_courses = {
        "044101": "אלגברה א",  # note: 6-digit short form
        "01040012": "חדו״א 1ת׳",
        "00440102": "בטיחות במעבדות חשמל",
        "00440131": "אותות ומערכות",
        "00440137": "מעגלים אלקטרוניים",
    }
    key_course_check = {}
    for code, name in key_courses.items():
        # Check both 8-digit and possible variants
        found = code in strict_codes
        key_course_check[code] = {"expected_name": name, "found": found}

    return {
        "summary": {
            "courses_strict":   len(strict),
            "courses_review":   len(review),
            "tracks":           len(tracks),
            "rules":            len(rules),
            "unique_codes_strict": len({c["course_code"] for c in strict}),
        },
        "strict_courses_per_track": dict(per_track),
        "review_rejection_reasons": dict(rejection_counts),
        "strict_missing_hours_breakdown": missing_breakdown,
        "key_course_presence": key_course_check,
        "review_sample": review[:20],
    }


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("Loading inputs...")
    azure_data   = load_json(INPUT_AZURE)
    azure_result = azure_data.get("analyzeResult", azure_data)
    v4_sections  = load_json(INPUT_V4)
    rules_v5     = load_json(INPUT_V5_RULES)

    print("Parsing Azure tables...")
    raw_records = parse_all_tables(azure_result)
    print(f"  Raw records from tables: {len(raw_records)}")

    print("Applying strict filter...")
    strict, review = split_strict_review(raw_records)
    print(f"  Strict: {len(strict)}, Review: {len(review)}")

    print("Extracting tracks...")
    tracks = extract_tracks(v4_sections)
    print(f"  Tracks: {len(tracks)}")

    # Rules: reuse v5 (already good quality)
    rules = rules_v5
    print(f"  Rules (from v5): {len(rules)}")

    print("Building Pinecone records...")
    pinecone_records = build_pinecone(strict, tracks, rules)
    print(f"  Pinecone records: {len(pinecone_records)}")

    print("Building QA report...")
    qa = build_qa(strict, review, tracks, rules)

    print("Saving outputs...")
    def save_json(path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    save_json(OUT_STRICT,   strict)
    save_json(OUT_REVIEW,   review)
    save_json(OUT_TRACKS,   tracks)
    save_json(OUT_RULES,    rules)
    save_json(OUT_QA,       qa)

    with open(OUT_PINECONE, "w", encoding="utf-8") as f:
        for rec in pinecone_records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"\n[OK] courses_strict_v6.json  — {len(strict)} courses")
    print(f"[OK] courses_review_v6.json  — {len(review)} courses")
    print(f"[OK] tracks_clean_v6.json    — {len(tracks)} tracks")
    print(f"[OK] rules_clean_v6.json     — {len(rules)} rules")
    print(f"[OK] qa_report_v6.json")
    print(f"[OK] pinecone_records_v6.jsonl — {len(pinecone_records)} records")
    print("\n=== QA SUMMARY ===")
    print(json.dumps(qa["summary"], ensure_ascii=False, indent=2))
    print("\nCourses per track (strict):")
    for t, n in sorted(qa["strict_courses_per_track"].items()):
        print(f"  {t}: {n}")
    print("\nReview rejection reasons:")
    for r, n in sorted(qa["review_rejection_reasons"].items()):
        print(f"  {r}: {n}")
    print("\nKey course presence:")
    for code, info in qa["key_course_presence"].items():
        status = "✓" if info["found"] else "✗"
        print(f"  {status} {code} ({info['expected_name']})")


if __name__ == "__main__":
    main()
