import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPassword, getSession } from '../../lib/authClient';
import AppSubmitButton from '../../components/app-state/AppSubmitButton';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { formatError } from '../../lib/errorUtils';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
      return;
    }

    getSession().then((session) => {
      if (session) {
        navigate('/app/dashboard', { replace: true });
      }
    }).catch((err) => {
      console.error("Session fetch error:", err);
      setError(formatError(err, "Failed to connect to Supabase."));
    });
  }, [navigate]);

  const handleLogin = async () => {
    console.log("login clicked");
    if (!isSupabaseConfigured) {
      setLastError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
      return;
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setLastError(null);

    try {
      await signInWithPassword(email, password);
      console.log("login success");
      navigate('/app/dashboard');
    } catch (err: any) {
      console.error(err);
      setLastError(formatError(err, 'Failed to sign in'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          {lastError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
              {lastError}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <AppSubmitButton
              label="Sign in"
              loadingLabel="Signing in..."
              isLoading={isSubmitting}
              className="w-full"
              disabled={!isSupabaseConfigured}
              onClick={handleLogin}
              type="button"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
