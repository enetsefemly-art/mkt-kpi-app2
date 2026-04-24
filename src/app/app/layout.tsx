import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, signOut } from '../../lib/authClient';
import { uiText } from '../../lib/uiText';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (!session) {
          navigate('/login', { replace: true });
        } else {
          setUserEmail(session.user.email || null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        navigate('/login', { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-indigo-600">KPI App</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <div 
            onClick={() => navigate('/app/dashboard')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.dashboard}
          </div>
          <div 
            onClick={() => navigate('/app/kpis')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.kpis}
          </div>
          <div 
            onClick={() => navigate('/app/kpi-progress')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.kpiProgress}
          </div>
          <div 
            onClick={() => navigate('/app/initiatives')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.initiatives}
          </div>
          <div 
            onClick={() => navigate('/app/alerts')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.alerts}
          </div>
          <div 
            onClick={() => navigate('/app/notifications')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.notifications}
          </div>
          <div 
            onClick={() => navigate('/app/digests')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.digests}
          </div>
          <div 
            onClick={() => navigate('/app/review')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.review}
          </div>
          <div 
            onClick={() => navigate('/app/activity')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.activity}
          </div>
        </nav>

        <div className="p-4 border-t bg-gray-50">
          <div className="text-sm font-medium text-gray-900 truncate mb-2">
            {userEmail}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center text-sm text-red-600 hover:text-red-800 font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {uiText.navigation.logout}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
