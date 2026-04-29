import { useEffect, useState } from 'react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { SharedPlanView } from './components/SharedPlanView'
import { parseShareHash } from './services/shareRouting'

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
      <AuthProvider>
        <SharedPlanView shareId={shareRoute.shareId} />
      </AuthProvider>
    );
  }

  return <App />;
}
