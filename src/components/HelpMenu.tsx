import { useEffect, useRef, useState } from 'react';
import { useOnboardingStore, type TourId } from '../store/onboardingStore';

const MENU_ITEMS = [
  {
    key: 'basic' as TourId,
    label: 'הדרכה בסיסית',
    icon: '🎓',
    description: 'סיור על השימוש הכללי במערכת',
  },
  {
    key: 'advanced' as TourId,
    label: 'הדרכה מתקדמת',
    icon: '⚙️',
    description: 'פיצ׳רים למשתמשים מנוסים',
  },
];

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const start = useOnboardingStore((s) => s.start);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleSelect(tourId: TourId) {
    setOpen(false);
    start(tourId);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm border w-8 h-8 flex items-center justify-center rounded-lg transition-colors font-bold"
        style={{ color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.2)' }}
        title="הדרכה"
        aria-label="הדרכה"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl min-w-max"
          style={{ background: '#1e3a5f', border: '1px solid rgba(147,197,253,0.25)' }}
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleSelect(item.key)}
              className="flex items-center gap-3 w-full text-right px-4 py-3 transition-colors hover:bg-white/10"
              style={{ color: 'rgba(147,197,253,0.9)' }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs opacity-60">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
