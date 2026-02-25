import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [status, setStatus] = useState<string>('Checking...');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'Signed in' : 'Signed out');
    });
  }, []);

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
