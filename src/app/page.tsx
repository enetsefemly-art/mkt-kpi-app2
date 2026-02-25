import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../lib/authClient';

export default function RootPage() {
  const navigate = useNavigate();

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        navigate('/app/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 animate-pulse">Redirecting...</div>
    </div>
  );
}
