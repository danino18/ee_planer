import { createContext, useContext } from 'react';
import type { ShareDoc } from '../types/share';

export interface ShareModeContextValue {
  shareId: string;
  canEdit: boolean;
  share: ShareDoc;
  /** True when the logged-in user is the share owner. Owners use normal cloud sync. */
  isOwner: boolean;
}

export const ShareModeContext = createContext<ShareModeContextValue | null>(null);

export function useShareMode(): ShareModeContextValue | null {
  return useContext(ShareModeContext);
}
