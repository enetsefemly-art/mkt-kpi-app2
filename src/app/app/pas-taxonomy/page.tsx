import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { getMyProfile, getCurrentWorkspaceId, getWorkspacePasEnabled } from '../../../lib/dataAccess';
import { canManageTaxonomy } from '../../../lib/permissions';
import { formatError } from '../../../lib/errorUtils';
import type { ProblemType, RootCauseType } from '../../../lib/pas/types';
import {
  listProblemTypesManage, createProblemType, updateProblemType, softDeleteProblemType,
  listRootCauseTypesManage, createRootCauseType, updateRootCauseType, softDeleteRootCauseType,
} from '../../../lib/pas/taxonomyAccess';

export default function PasTaxonomyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');

  const [problemTypes, setProblemTypes] = useState<ProblemType[]>([]);
  const [rootCauseTypes, setRootCauseTypes] = useState<RootCauseType[]>([]);
  const [newPt, setNewPt] = useState({ name: '', group: '' });
  const [newRct, setNewRct] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate('/login'); return; }
        const profile = await getMyProfile();
        if (!canManageTaxonomy(profile.role)) { navigate('/app/problems'); return; }
        const wsId = await getCurrentWorkspaceId(profile);
        const pasOn = await getWorkspacePasEnabled(wsId);
        if (!pasOn) { navigate('/app/dashboard'); return; }
        setWorkspaceId(wsId || '');
        await reload(wsId || '');
      } catch (err: any) {
        setError(formatError(err, 'Lỗi tải danh mục'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async (wsId: string) => {
    const [pts, rcts] = await Promise.all([listProblemTypesManage(wsId), listRootCauseTypesManage(wsId)]);
    setProblemTypes(pts);
    setRootCauseTypes(rcts);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await fn(); await reload(workspaceId); }
    catch (err: any) { setError(formatError(err, 'Lỗi thao tác danh mục')); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const renderRow = (id: string, name: string, onDelete: () => void, onSaveName: (n: string) => void) => (
    <div key={id} className="flex items-center justify-between py-2 border-b border-gray-100">
      {editId === id ? (
        <>
          <input className="flex-1 border border-gray-300 rounded-md p-1 text-sm mr-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <button onClick={() => run(async () => { onSaveName(editName); setEditId(null); })} disabled={busy} className="text-xs text-indigo-600 hover:underline mr-3">Lưu</button>
          <button onClick={() => setEditId(null)} className="text-xs text-gray-500 hover:underline">Hủy</button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-900">{name}</span>
          <div className="flex gap-3">
            <button onClick={() => { setEditId(id); setEditName(name); }} className="text-xs text-indigo-600 hover:underline">Sửa</button>
            <button onClick={() => { if (window.confirm('Xóa mục này?')) run(async () => onDelete()); }} className="text-xs text-red-600 hover:underline">Xóa</button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <button onClick={() => navigate('/app/problems')} className="text-indigo-600 hover:underline text-sm">← Quay lại danh sách vấn đề</button>
      <h1 className="text-2xl font-bold text-gray-900">Quản lý Danh mục PAS</h1>
      {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}

      {/* Problem Types */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Loại vấn đề</h2>
        <div className="mb-4 flex gap-2">
          <input className="flex-1 border border-gray-300 rounded-md p-2 text-sm" placeholder="Tên loại vấn đề mới" value={newPt.name} onChange={(e) => setNewPt({ ...newPt, name: e.target.value })} />
          <input className="w-40 border border-gray-300 rounded-md p-2 text-sm" placeholder="Nhóm (tùy chọn)" value={newPt.group} onChange={(e) => setNewPt({ ...newPt, group: e.target.value })} />
          <button onClick={() => { if (!newPt.name.trim()) return; run(async () => { await createProblemType(workspaceId, { type_name: newPt.name.trim(), type_group: newPt.group.trim() || null }); setNewPt({ name: '', group: '' }); }); }} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Thêm</button>
        </div>
        {problemTypes.map((t) => renderRow(t.id, t.type_name, () => softDeleteProblemType(t.id), (n) => updateProblemType(t.id, { type_name: n })))}
        {problemTypes.length === 0 && <p className="text-sm text-gray-500">Chưa có loại vấn đề.</p>}
      </div>

      {/* Root Cause Types */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Loại nguyên nhân</h2>
        <div className="mb-4 flex gap-2">
          <input className="flex-1 border border-gray-300 rounded-md p-2 text-sm" placeholder="Tên loại nguyên nhân mới" value={newRct} onChange={(e) => setNewRct(e.target.value)} />
          <button onClick={() => { if (!newRct.trim()) return; run(async () => { await createRootCauseType(workspaceId, { type_name: newRct.trim() }); setNewRct(''); }); }} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50">Thêm</button>
        </div>
        {rootCauseTypes.map((t) => renderRow(t.id, t.type_name, () => softDeleteRootCauseType(t.id), (n) => updateRootCauseType(t.id, { type_name: n })))}
        {rootCauseTypes.length === 0 && <p className="text-sm text-gray-500">Chưa có loại nguyên nhân.</p>}
      </div>
    </div>
  );
}
