import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, signOut } from '../../lib/authClient';
import { uiText } from '../../lib/uiText';
import { getMyProfile, Profile, getCurrentWorkspaceId, getWorkspacePasEnabled } from '../../lib/dataAccess';
import { canManageUser, canManageTaxonomy } from '../../lib/permissions';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [profileErrorState, setProfileErrorState] = useState<string | null>(null);
  const [pasEnabled, setPasEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (!session) {
          navigate('/login', { replace: true });
        } else {
          setUserEmail(session.user.email || null);
          try {
            const profile = await getMyProfile();
            setUserProfile(profile);
            try {
              const wsId = await getCurrentWorkspaceId(profile);
              setPasEnabled(await getWorkspacePasEnabled(wsId));
            } catch {
              setPasEnabled(false); // không chặn app nếu đọc cờ lỗi
            }
            setLoading(false);
          } catch (profileErr: any) {
             // KHÔNG fake role 'director' nữa. Hiện màn hình lỗi để user thử lại / đăng xuất.
             setProfileErrorState(profileErr?.message || 'Không tải được hồ sơ người dùng.');
             setLoading(false);
          }
        }
      } catch (err) {
        // Redirect to login if session check fails to avoid crashing app previews
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

  if (profileErrorState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900">Không tải được hồ sơ người dùng</h2>
        <p className="text-sm text-gray-600 max-w-md">{profileErrorState}</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Thử lại
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Đăng xuất
          </button>
        </div>
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
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
            onClick={() => navigate('/app/kpi-updates')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.kpiUpdates}
          </div>
          <div
            onClick={() => navigate('/app/initiatives')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.initiatives}
          </div>
          {pasEnabled && (
            <div
              onClick={() => navigate('/app/problems')}
              className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
            >
              Vấn đề (PAS)
            </div>
          )}
          {pasEnabled && (
            <div
              onClick={() => navigate('/app/library')}
              className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
            >
              Thư viện giải pháp
            </div>
          )}
          {pasEnabled && canManageTaxonomy(userProfile?.role) && (
            <div
              onClick={() => navigate('/app/pas-taxonomy')}
              className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
            >
              Danh mục PAS
            </div>
          )}
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
            onClick={() => navigate('/app/review')}
            className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            {uiText.navigation.review}
          </div>
          {canManageUser(userProfile?.role) && (
            <div 
              onClick={() => navigate('/app/users')}
              className="px-4 py-2 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
            >
              Quản lý người dùng
            </div>
          )}
        </nav>

        <div className="p-4 border-t bg-gray-50">
          <div 
            onClick={() => navigate('/app/account')}
            className="text-sm font-medium text-gray-900 truncate mb-2 cursor-pointer hover:text-indigo-600"
            title="Tài khoản của tôi"
          >
            {userProfile?.full_name || userEmail}
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
