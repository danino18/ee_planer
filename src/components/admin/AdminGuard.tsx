import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

export function AdminGuard({ children }: Props) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    user.getIdTokenResult().then((result) => {
      setIsAdmin(result.claims['admin'] === true);
    });
  }, [user]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow border border-red-200 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">גישה נדחתה</p>
          <p className="text-gray-600 text-sm mb-4">נדרשות הרשאות מנהל.</p>
          <a href="#" className="text-blue-600 text-sm hover:underline">חזרה לאפליקציה</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
