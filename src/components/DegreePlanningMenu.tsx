import { useEffect, useRef, useState } from 'react';

interface Props {
  onInitializeRecommended: () => void;
  onPlanFromScratch: () => void;
  readOnly?: boolean;
}

const MENU_ITEMS = [
  {
    key: 'recommended',
    label: 'אתחול תכנית מומלצת',
    icon: '✨',
    description: 'מלא את הסמסטרים לפי המסלול',
  },
  {
    key: 'scratch',
    label: 'תכנון מאפס',
    icon: '🗑️',
    description: 'אפס את כל הקורסים',
  },
] as const;

export function DegreePlanningMenu({ onInitializeRecommended, onPlanFromScratch, readOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (readOnly) return null;

  function handleSelect(key: typeof MENU_ITEMS[number]['key']) {
    setOpen(false);
    if (key === 'recommended') onInitializeRecommended();
    else if (key === 'scratch') onPlanFromScratch();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm border px-3 py-1.5 rounded-lg transition-colors"
        style={{ color: 'rgba(147,197,253,0.9)', borderColor: 'rgba(147,197,253,0.3)' }}
        title="אתחול מערכת"
      >
        <span className="hidden sm:inline">אתחול מערכת </span>▾
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
