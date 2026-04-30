import { lazy, Suspense, useEffect, useState } from 'react'
import { parseShareHash } from './services/shareRouting'

const App = lazy(() => import('./App'));
const ShareModeWrapper = lazy(() => import('./components/ShareModeWrapper'));

export default function Root() {
  const [shareRoute, setShareRoute] = useState(() => parseShareHash());

  useEffect(() => {
    function onHashChange() {
      setShareRoute(parseShareHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (shareRoute) {
    return (
      <Suspense fallback={null}>
        <ShareModeWrapper shareId={shareRoute.shareId} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
