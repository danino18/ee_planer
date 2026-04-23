import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileSidebarDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      id="sidebar-drawer"
      className={`md:hidden fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* panel — slides in from the RTL start (right) edge */}
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute top-0 bottom-0 right-0 w-[85vw] max-w-xs bg-gray-50 shadow-2xl overflow-y-auto transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 bg-gray-50 flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">תפריט</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
            aria-label="סגור"
          >✕</button>
        </div>
        <div className="p-3 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
