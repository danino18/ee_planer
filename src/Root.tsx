import { lazy, Suspense, useEffect, useState } from 'react'
import { parseShareHash } from './services/shareRouting'

const App = lazy(() => import('./App'));

const SharedPlanView = lazy(async () => {
  const [{ AuthProvider }, mod] = await Promise.all([
    import('./context/AuthContext'),
    import('./components/SharedPlanView'),
  ]);
  return {
    default: function WrappedSharedPlanView({ shareId }: { shareId: string }) {
      return (
        <AuthProvider>
          <mod.SharedPlanView shareId={shareId} />
        </AuthProvider>
      );
    },
  };
});

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
    <Suspense fallback={null}>
      {shareRoute ? <SharedPlanView shareId={shareRoute.shareId} /> : <App />}
    </Suspense>
  );
}
