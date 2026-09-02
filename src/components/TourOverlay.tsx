import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingStore } from '../store/onboardingStore';
import { usePlanStore } from '../store/planStore';
import { BASIC_TOUR_STEPS, ADVANCED_TOUR_STEPS } from '../onboarding/tourSteps';

const SPOTLIGHT_PADDING = 8;
const TARGET_TIMEOUT_MS = 1000;
const DRAWER_OPEN_DELAY_MS = 220;
const MOBILE_BREAKPOINT = 768;

function resolveTourTarget(selector: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(selector);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

function isMobileViewport(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function TourOverlay() {
  const activeTourId = useOnboardingStore((s) => s.activeTourId);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const next = useOnboardingStore((s) => s.next);
  const back = useOnboardingStore((s) => s.back);
  const skip = useOnboardingStore((s) => s.skip);
  const finish = useOnboardingStore((s) => s.finish);
  const setMobileSidebarOpen = useOnboardingStore((s) => s.setMobileSidebarOpen);
  const trackId = usePlanStore((s) => s.trackId);

  const isActive = activeTourId !== null;
  const steps = activeTourId === 'advanced' ? ADVANCED_TOUR_STEPS : BASIC_TOUR_STEPS;
  const step = isActive ? steps[stepIndex] : undefined;
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Auto-advance once a track is chosen, for the track-selection step.
  useEffect(() => {
    if (!isActive || !step || step.advanceOn !== 'track-selected') return;
    if (trackId) next();
  }, [isActive, step, trackId, next]);

  // Coordinate the mobile sidebar drawer with steps that need it open.
  useEffect(() => {
    if (!isActive || !step) {
      setMobileSidebarOpen(false);
      return;
    }
    function update() {
      setMobileSidebarOpen(!!step?.mobileOpensDrawer && isMobileViewport());
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isActive, step, setMobileSidebarOpen]);

  // Locate and measure the current step's target element.
  useEffect(() => {
    if (!isActive || !step || !step.selector) return;

    let cancelled = false;
    let rafId = 0;
    const startedAt = performance.now();
    const needsDrawerWait = !!step.mobileOpensDrawer && isMobileViewport();

    function tick() {
      if (cancelled) return;
      const el = resolveTourTarget(step!.selector!);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        setRect(el.getBoundingClientRect());
        return;
      }
      if (performance.now() - startedAt > TARGET_TIMEOUT_MS) {
        if (step!.fallback !== 'describe') next();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    const timer = window.setTimeout(() => {
      setRect(null);
      tick();
    }, needsDrawerWait ? DRAWER_OPEN_DELAY_MS : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, [isActive, stepIndex, step, next]);

  // Re-measure on resize/scroll while a target is being tracked.
  useEffect(() => {
    if (!isActive || !step?.selector) return;
    function remeasure() {
      const el = resolveTourTarget(step!.selector!);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [isActive, step, stepIndex]);

  useEffect(() => {
    if (!isActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') skip();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isActive, skip]);

  if (!isActive || !step) return null;

  const totalSteps = steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const awaitingTrackSelection = step.advanceOn === 'track-selected';
  const effectiveRect = step.selector ? rect : null;

  const pad = SPOTLIGHT_PADDING;
  const bandStyle: React.CSSProperties = {
    position: 'fixed',
    background: 'rgba(0,0,0,0.6)',
    pointerEvents: 'auto',
    transition: 'all 200ms ease',
  };

  const cardWidth = Math.min(340, window.innerWidth - 32);
  const cardEstHeight = 230;
  const margin = 16;
  let cardTop: number;
  let cardLeft: number;
  if (effectiveRect) {
    const spaceBelow = window.innerHeight - effectiveRect.bottom;
    const spaceAbove = effectiveRect.top;
    cardTop = spaceBelow >= cardEstHeight + margin || spaceBelow >= spaceAbove
      ? effectiveRect.bottom + margin
      : effectiveRect.top - cardEstHeight - margin;
    cardTop = Math.min(Math.max(cardTop, margin), window.innerHeight - margin - cardEstHeight);
    cardLeft = effectiveRect.right - cardWidth;
    cardLeft = Math.min(Math.max(cardLeft, margin), window.innerWidth - cardWidth - margin);
  } else {
    cardTop = Math.max(margin, window.innerHeight / 2 - cardEstHeight / 2);
    cardLeft = Math.max(margin, window.innerWidth / 2 - cardWidth / 2);
  }

  function handleNext() {
    if (isLast) {
      finish();
    } else {
      next();
    }
  }

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[300]" style={{ pointerEvents: 'none' }} role="dialog" aria-modal="true">
      {effectiveRect ? (
        <>
          <div style={{ ...bandStyle, top: 0, left: 0, right: 0, height: Math.max(0, effectiveRect.top - pad) }} />
          <div style={{ ...bandStyle, top: effectiveRect.bottom + pad, left: 0, right: 0, bottom: 0 }} />
          <div style={{ ...bandStyle, top: effectiveRect.top - pad, height: effectiveRect.height + pad * 2, left: 0, width: Math.max(0, effectiveRect.left - pad) }} />
          <div style={{ ...bandStyle, top: effectiveRect.top - pad, height: effectiveRect.height + pad * 2, left: effectiveRect.right + pad, right: 0 }} />
          <div
            className="rounded-xl"
            style={{
              position: 'fixed',
              top: effectiveRect.top - pad,
              left: effectiveRect.left - pad,
              width: effectiveRect.width + pad * 2,
              height: effectiveRect.height + pad * 2,
              boxShadow: '0 0 0 3px rgba(59,130,246,0.9), 0 0 20px rgba(59,130,246,0.5)',
              pointerEvents: 'none',
              transition: 'all 200ms ease',
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60" style={{ pointerEvents: 'auto' }} />
      )}

      <div
        className="fixed bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-5"
        style={{ top: cardTop, left: cardLeft, width: cardWidth, pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-blue-500' : 'w-1.5 bg-gray-200 dark:bg-slate-700'}`}
            />
          ))}
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1.5">{step.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{step.body}</p>

        {awaitingTrackSelection ? (
          <div className="flex items-center justify-between">
            <button
              onClick={skip}
              className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              דלג על ההדרכה
            </button>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">בחרו מסלול כדי להמשיך ⟵</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={skip}
              className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              דלג על ההדרכה
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={back}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-slate-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  הקודם
                </button>
              )}
              <button
                onClick={handleNext}
                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
              >
                {isLast ? 'סיום' : 'הבא'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
