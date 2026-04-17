import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../lib/authClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { formatError } from '../lib/errorUtils';

export default function RootPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
      return;
    }

    getSession().then((session) => {
      if (session) {
        navigate('/app/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }).catch((err) => {
      console.error("Session fetch error:", err);
      setError(formatError(err, "Failed to connect to Supabase."));
    });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl max-w-md w-full border border-red-200">
          <h2 className="text-lg font-bold mb-2">Connection Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 animate-pulse">Redirecting...</div>
    </div>
  );
}
