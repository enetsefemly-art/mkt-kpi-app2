import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getMyProfile, getCurrentWorkspaceId, getWorkspacePasEnabled } from '../../../../lib/dataAccess';
import { getPattern, softDeletePattern } from '../../../../lib/pas/patternAccess';
import { canCreatePattern } from '../../../../lib/permissions';
import { formatError } from '../../../../lib/errorUtils';
import type { SolutionPattern } from '../../../../lib/pas/types';

export default function PatternDetailPage() {
  const { patternId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pattern, setPattern] = useState<SolutionPattern | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate('/login'); return; }
        const profile = await getMyProfile();
        const wsId = await getCurrentWorkspaceId(profile);
        const pasOn = await getWorkspacePasEnabled(wsId);
        if (!pasOn) { navigate('/app/dashboard'); return; }
        setWorkspaceId(wsId || '');
        setCanManage(canCreatePattern(profile.role));
        const p = await getPattern(patternId!);
        if (!p) { setError('Không tìm thấy pattern'); } else { setPattern(p); }
      } catch (err: any) {
        setError(formatError(err, 'Lỗi tải pattern'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternId]);

  const handleDelete = async () => {
    if (!pattern) return;
    if (!window.confirm('Xóa pattern này khỏi thư viện?')) return;
    try {
      await softDeletePattern(pattern.id, workspaceId);
      navigate('/app/library');
    } catch (err: any) { setError(formatError(err, 'Lỗi xóa pattern')); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (!pattern) return <div className="p-8 text-center text-gray-500">{error || 'Không tìm thấy.'}</div>;

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? <div className="text-sm"><span className="font-medium text-gray-700">{label}:</span> <span className="text-gray-900 whitespace-pre-wrap">{value}</span></div> : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <button onClick={() => navigate('/app/library')} className="text-indigo-600 hover:underline text-sm">← Thư viện</button>
      {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{pattern.pattern_name}</h1>
          {pattern.manager_rating && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{pattern.manager_rating}</span>}
        </div>
        <Row label="Mô tả" value={pattern.pattern_description} />
        <Row label="Áp dụng khi" value={pattern.apply_when} />
        <Row label="KHÔNG áp dụng khi" value={pattern.do_not_apply_when} />
        <Row label="Kênh" value={pattern.channel} />
        <Row label="Tín hiệu chỉ số" value={pattern.metric_signal} />
        <Row label="Hạn chế / lưu ý" value={pattern.limitation_note} />
        <div className="text-xs text-gray-400 pt-2">Tạo lúc {new Date(pattern.created_at).toLocaleString('vi-VN')}</div>
        {canManage && (
          <div className="pt-2">
            <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">Xóa khỏi thư viện</button>
          </div>
        )}
      </div>
    </div>
  );
}
