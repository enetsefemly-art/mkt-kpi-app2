import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getSession } from '../../../lib/authClient';

export default function DashboardPage() {
  const [email, setEmail] = useState<string>('');
  const [productCount, setProductCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
    });

    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        setError(error.message);
      } else {
        setProductCount(count);
      }
    };
    fetchCount();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Welcome back!</h2>
        <p className="text-gray-600">
          Logged in as: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Total Products
          </h3>
          {error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : (
            <div className="text-3xl font-bold text-indigo-600">
              {productCount !== null ? productCount : '...'}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">RLS Permission Check</p>
        </div>
      </div>
    </div>
  );
}
