import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getPublicEnv } from '../lib/env';

export default function Home() {
  const [status, setStatus] = useState<string>('Checking...');
  const { url } = getPublicEnv();

  useEffect(() => {
    if (!url) {
      setStatus('Error: Missing Env Vars');
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'Signed in' : 'Signed out');
    }).catch(err => {
      console.error('Supabase error:', err);
      setStatus('Error connecting to Supabase');
    });
  }, [url]);

  if (!url) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-700 mb-4">
            Missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
          <p className="text-sm text-gray-500">
            Please add these Environment Variables in your Vercel Project Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">KPI App Running</h1>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm font-medium text-gray-700">
          <div className={`w-2 h-2 rounded-full ${status === 'Signed in' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {status}
        </div>
      </div>
    </div>
  );
}
