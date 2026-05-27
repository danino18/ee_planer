import { lazy, Suspense, useEffect, useState } from 'react'
import { parseShareHash } from './services/shareRouting'
import { AuthProvider } from './context/AuthContext'

const App = lazy(() => import('./App'));
const ShareModeWrapper = lazy(() => import('./components/ShareModeWrapper'));
const AdminGuard = lazy(() => import('./components/admin/AdminGuard').then((m) => ({ default: m.AdminGuard })));
const AdminPage = lazy(() => import('./components/admin/AdminPage').then((m) => ({ default: m.AdminPage })));

function parseRoute() {
  if (window.location.hash === '#/admin') return 'admin' as const;
  return parseShareHash();
}

export default function Root() {
  const [route, setRoute] = useState(() => parseRoute());

  useEffect(() => {
    function onHashChange() {
      setRoute(parseRoute());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={null}>
        {route === 'admin' ? (
          <AdminGuard><AdminPage /></AdminGuard>
        ) : route ? (
          <ShareModeWrapper shareId={route.shareId} />
        ) : (
          <App />
        )}
      </Suspense>
    </AuthProvider>
  );
}
