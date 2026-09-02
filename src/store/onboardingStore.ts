import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  // Persisted
  hasCompletedOnboarding: boolean;
  // Ephemeral — NOT persisted
  isActive: boolean;
  stepIndex: number;
  mobileSidebarOpen: boolean;

  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      isActive: false,
      stepIndex: 0,
      mobileSidebarOpen: false,

      start: () => set({ isActive: true, stepIndex: 0 }),
      next: () => set((state) => ({ stepIndex: state.stepIndex + 1 })),
      back: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1) })),
      skip: () => set({ isActive: false, mobileSidebarOpen: false, hasCompletedOnboarding: true }),
      finish: () => set({ isActive: false, mobileSidebarOpen: false, hasCompletedOnboarding: true }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    }),
    {
      name: 'technion-ee-planner-onboarding',
      partialize: (state) => ({ hasCompletedOnboarding: state.hasCompletedOnboarding }),
    }
  )
);
