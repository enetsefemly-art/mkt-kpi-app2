import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { getMyProfile, getCurrentWorkspaceId, getWorkspacePasEnabled } from '../../../lib/dataAccess';
import { listPatterns } from '../../../lib/pas/patternAccess';
import { listProblemTypes } from '../../../lib/pas/taxonomyAccess';
import { formatError } from '../../../lib/errorUtils';
import type { SolutionPattern, ProblemType } from '../../../lib/pas/types';

export default function LibraryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<SolutionPattern[]>([]);
  const [problemTypes, setProblemTypes] = useState<ProblemType[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [ptFilter, setPtFilter] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/login'); return; }
      const profile = await getMyProfile();
      const wsId = await getCurrentWorkspaceId(profile);
      const pasOn = await getWorkspacePasEnabled(wsId);
      if (!pasOn) { navigate('/app/dashboard'); return; }
      setWorkspaceId(wsId || '');
      const [pats, types] = await Promise.all([
        listPatterns(wsId || '', { keyword: keyword || undefined, problemTypeId: ptFilter || undefined }),
        listProblemTypes(wsId || ''),
      ]);
      setPatterns(pats);
      setProblemTypes(types);
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tải thư viện'));
    } finally {
      setLoading(false);
    }
  };

  const ptName = (id?: string | null) => problemTypes.find((t) => t.id === id)?.type_name || '';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-2xl font-bold text-gray-900">Thư viện Giải pháp</h1>
      {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}

      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">Tìm kiếm</label>
          <input className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="Tên / mô tả pattern" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') loadData(); }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Loại vấn đề</label>
          <select className="border border-gray-300 rounded-md p-2 text-sm" value={ptFilter} onChange={(e) => setPtFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {problemTypes.map((t) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
          </select>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">Tìm</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patterns.map((p) => (
          <div key={p.id} onClick={() => navigate(`/app/library/${p.id}`)} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-indigo-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{p.pattern_name}</h3>
              {p.manager_rating && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{p.manager_rating}</span>}
            </div>
            <p className="text-sm text-gray-600 mt-2 line-clamp-3">{p.pattern_description}</p>
            {p.problem_type_id && <p className="text-xs text-gray-400 mt-2">{ptName(p.problem_type_id)}</p>}
          </div>
        ))}
        {patterns.length === 0 && <p className="text-sm text-gray-500">Chưa có giải pháp nào trong thư viện.</p>}
      </div>
    </div>
  );
}
