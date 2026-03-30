import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginButton() {
  const { user, loading, error, clearError, signInWithGoogle, signInWithMicrosoft, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState<'google' | 'microsoft' | null>(null);

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.photoURL && (
          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-gray-200" />
        )}
        <span className="text-sm text-gray-700 hidden sm:block max-w-[120px] truncate">
          {user.displayName ?? user.email}
        </span>
        <span className="text-xs text-green-600 font-medium hidden sm:block">☁ מסונכרן</span>
        <button
          onClick={signOut}
          className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg transition-colors"
        >
          יציאה
        </button>
      </div>
    );
  }

  async function handleGoogle() {
    setSigningIn('google');
    clearError();
    await signInWithGoogle();
    setSigningIn(null);
  }

  async function handleMicrosoft() {
    setSigningIn('microsoft');
    clearError();
    await signInWithMicrosoft();
    setSigningIn(null);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={signingIn !== null}
          className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-blue-400 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingIn === 'google' ? (
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Google
        </button>

        {/* Microsoft / Outlook */}
        <button
          onClick={handleMicrosoft}
          disabled={signingIn !== null}
          className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-blue-400 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingIn === 'microsoft' ? (
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
          )}
          Outlook
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 max-w-[260px]">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600 font-bold shrink-0">✕</button>
        </div>
      )}
    </div>
  );
}
