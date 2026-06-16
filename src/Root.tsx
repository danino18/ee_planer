import { lazy, Suspense, useEffect, useState } from 'react'
import { parseShareHash } from './services/shareRouting'
import { AuthProvider } from './context/AuthContext'
import { usePlanStore } from './store/planStore'

const App = lazy(() => import('./App'));
const ShareModeWrapper = lazy(() => import('./components/ShareModeWrapper'));

function DarkModeSync() {
  const darkMode = usePlanStore((s) => s.darkMode);
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode === 'dark') {
      html.classList.add('dark');
      return;
    }
    if (darkMode === 'light') {
      html.classList.remove('dark');
      return;
    }
    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e: { matches: boolean }) => {
      if (e.matches) html.classList.add('dark');
      else html.classList.remove('dark');
    };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [darkMode]);
  return null;
}

export default function Root() {
  const [shareRoute, setShareRoute] = useState(() => parseShareHash());

  useEffect(() => {
    function onHashChange() {
      setShareRoute(parseShareHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <AuthProvider>
      <DarkModeSync />
      <Suspense fallback={null}>
        {shareRoute ? <ShareModeWrapper shareId={shareRoute.shareId} /> : <App />}
      </Suspense>
    </AuthProvider>
  );
}
