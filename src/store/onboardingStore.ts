import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TourId = 'basic' | 'advanced';

interface OnboardingState {
  // Persisted
  hasCompletedOnboarding: boolean;
  // Ephemeral — NOT persisted
  activeTourId: TourId | null;
  stepIndex: number;
  mobileSidebarOpen: boolean;

  start: (tourId?: TourId) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      activeTourId: null,
      stepIndex: 0,
      mobileSidebarOpen: false,

      start: (tourId = 'basic') => set({ activeTourId: tourId, stepIndex: 0 }),
      next: () => set((state) => ({ stepIndex: state.stepIndex + 1 })),
      back: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1) })),
      skip: () => set({
        activeTourId: null,
        mobileSidebarOpen: false,
        hasCompletedOnboarding: get().activeTourId === 'basic' ? true : get().hasCompletedOnboarding,
      }),
      finish: () => set({
        activeTourId: null,
        mobileSidebarOpen: false,
        hasCompletedOnboarding: get().activeTourId === 'basic' ? true : get().hasCompletedOnboarding,
      }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    }),
    {
      name: 'technion-ee-planner-onboarding',
      partialize: (state) => ({ hasCompletedOnboarding: state.hasCompletedOnboarding }),
    }
  )
);
