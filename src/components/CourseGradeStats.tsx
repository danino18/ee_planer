import { useMemo, useState } from 'react';
import { useGradeStatistics } from '../services/gradeStatistics';
import { resolveStatistic } from '../domain/gradeStatistics/select';
import { formatSemester } from '../domain/gradeStatistics/semester';
import type { GradeCategory } from '../domain/gradeStatistics/types';

const CATEGORY_LABELS: Record<GradeCategory, string> = {
  Finals: 'ציון סופי',
  Final_A: 'סופי מועד א׳',
  Final_B: 'סופי מועד ב׳',
  Final_C: 'סופי מועד ג׳',
  Exam_A: 'בחינה מועד א׳',
  Exam_B: 'בחינה מועד ב׳',
  Exam_C: 'בחינה מועד ג׳',
};

function formatGrade(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface Props {
  courseId: string;
}

export function CourseGradeStats({ courseId }: Props) {
  const { data, status } = useGradeStatistics();
  const [selected, setSelected] = useState<string>('general');

  const records = data?.index.get(courseId);
  const semesters = useMemo(
    () => (records ? [...records].map((r) => r.semester).sort((a, b) => (a < b ? 1 : -1)) : []),
    [records],
  );
  const stat = useMemo(() => resolveStatistic(records, selected), [records, selected]);

  if (status === 'loading') {
    return (
      <div className="mb-4 border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">ציונים היסטוריים</p>
        <p className="text-xs text-gray-400 italic">טוען…</p>
      </div>
    );
  }
  // Dataset failed to load, or this course simply has no histogram data.
  if (status === 'unavailable' || !records || records.length === 0) {
    return (
      <div className="mb-4 border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">ציונים היסטוריים</p>
        <p className="text-xs text-gray-400 italic">אין נתוני ציונים</p>
      </div>
    );
  }

  const hasValues = stat && (stat.average !== null || stat.median !== null);

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p
          className="text-xs font-semibold text-gray-700"
          title="נתוני ציונים היסטוריים מ-CheeseFork. הזמינות משתנה לפי מקצוע וסמסטר, וההבדלים בין מועדי בחינה אפשריים. אין לראות בערכים הבטחה לקושי הקורס או לציון עתידי."
        >
          ציונים היסטוריים ⓘ
        </p>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          dir="rtl"
          aria-label="בחר סמסטר לציונים"
          className="text-xs border border-gray-200 rounded-md px-2 py-1 cursor-pointer focus:border-blue-400 outline-none"
        >
          <option value="general">כללי</option>
          <option value="latest">האחרון הזמין</option>
          {semesters.map((s) => <option key={s} value={s}>{formatSemester(s)}</option>)}
        </select>
      </div>

      {!hasValues ? (
        <p className="text-xs text-gray-400 italic">אין נתוני ציונים לסמסטר זה</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
              <div className="text-xs text-gray-500">{stat.kind === 'general' ? 'ממוצע כללי' : 'ממוצע'}</div>
              <div className="text-sm font-bold text-gray-800">{stat.average !== null ? formatGrade(stat.average) : '—'}</div>
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
              <div className="text-xs text-gray-500">{stat.kind === 'general' ? 'חציון כללי' : 'חציון'}</div>
              <div className="text-sm font-bold text-gray-800">{stat.median !== null ? formatGrade(stat.median) : '—'}</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1.5 flex flex-wrap gap-x-2">
            {stat.kind === 'general' ? (
              <>
                <span>מבוסס על {stat.semesterCount} סמסטרים</span>
                {stat.students !== null && <span>· {stat.students} נבחנים בממוצע</span>}
              </>
            ) : (
              <>
                {stat.semester && <span>{formatSemester(stat.semester)}</span>}
                {stat.category && <span>· {CATEGORY_LABELS[stat.category]}</span>}
                {stat.students !== null && <span>· {stat.students} נבחנים</span>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
