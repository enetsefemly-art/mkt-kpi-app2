import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../../lib/supabaseClient';
import { getMyProfile, getCurrentWorkspaceId, getWorkspacePasEnabled } from '../../../../lib/dataAccess';
import { getProblem } from '../../../../lib/pas/problemAccess';
import { createPattern } from '../../../../lib/pas/patternAccess';
import { canCreatePattern } from '../../../../lib/permissions';
import { formatError } from '../../../../lib/errorUtils';
import type { ManagerRating } from '../../../../lib/pas/types';

const RATINGS: ManagerRating[] = ['Hiệu quả cao', 'Trung bình', 'Thấp', 'Cần thêm evidence', 'Không còn khuyến nghị'];

export default function PatternNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const actionId = searchParams.get('action_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [prefill, setPrefill] = useState<{ problem_type_id?: string | null; root_cause_type_id?: string | null }>({});

  const [form, setForm] = useState({
    pattern_name: '', pattern_description: '', apply_when: '', do_not_apply_when: '',
    limitation_note: '', channel: '', metric_signal: '', manager_rating: '' as ManagerRating | '',
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate('/login'); return; }
        const profile = await getMyProfile();
        if (!canCreatePattern(profile.role)) { navigate('/app/library'); return; }
        const wsId = await getCurrentWorkspaceId(profile);
        const pasOn = await getWorkspacePasEnabled(wsId);
        if (!pasOn) { navigate('/app/dashboard'); return; }
        setWorkspaceId(wsId || '');

        if (!actionId) { setError('Thiếu action_id — Pattern phải tạo từ một hành động đã Pass.'); setLoading(false); return; }

        // Prefill từ action -> problem (loại vấn đề) + root cause (loại nguyên nhân)
        const { data: action } = await supabase.from('actions').select('problem_id, root_cause_id').eq('id', actionId).maybeSingle();
        if (action?.problem_id) {
          const prob = await getProblem(action.problem_id);
          let rcTypeId: string | null = null;
          if (action.root_cause_id) {
            const { data: rc } = await supabase.from('root_causes').select('root_cause_type_id').eq('id', action.root_cause_id).maybeSingle();
            rcTypeId = rc?.root_cause_type_id ?? null;
          }
          setPrefill({ problem_type_id: prob?.problem_type_id ?? null, root_cause_type_id: rcTypeId });
        }
      } catch (err: any) {
        setError(formatError(err, 'Lỗi tải form tạo pattern'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (submitting || !actionId) return;
    if (!form.pattern_name.trim() || !form.pattern_description.trim() || !form.apply_when.trim() || !form.do_not_apply_when.trim()) {
      setError('Tên, mô tả, "áp dụng khi", "không áp dụng khi" là bắt buộc'); return;
    }
    setSubmitting(true); setError(null);
    try {
      const pattern = await createPattern({
        workspace_id: workspaceId,
        source_action_id: actionId,
        pattern_name: form.pattern_name.trim(),
        pattern_description: form.pattern_description.trim(),
        apply_when: form.apply_when.trim(),
        do_not_apply_when: form.do_not_apply_when.trim(),
        limitation_note: form.limitation_note || null,
        channel: form.channel || null,
        metric_signal: form.metric_signal || null,
        manager_rating: form.manager_rating || null,
        problem_type_id: prefill.problem_type_id || null,
        root_cause_type_id: prefill.root_cause_type_id || null,
      });
      navigate(`/app/library/${pattern.id}`);
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tạo Solution Pattern'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <button onClick={() => navigate('/app/library')} className="text-indigo-600 hover:underline text-sm">← Thư viện</button>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Tạo Solution Pattern</h1>
        {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên pattern *</label>
          <input className="w-full border border-gray-300 rounded-md p-2" value={form.pattern_name} onChange={(e) => setForm({ ...form, pattern_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả giải pháp *</label>
          <textarea rows={3} className="w-full border border-gray-300 rounded-md p-2" value={form.pattern_description} onChange={(e) => setForm({ ...form, pattern_description: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng khi *</label>
          <textarea rows={2} className="w-full border border-gray-300 rounded-md p-2" value={form.apply_when} onChange={(e) => setForm({ ...form, apply_when: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">KHÔNG áp dụng khi *</label>
          <textarea rows={2} className="w-full border border-gray-300 rounded-md p-2" value={form.do_not_apply_when} onChange={(e) => setForm({ ...form, do_not_apply_when: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kênh (tùy chọn)</label>
            <input className="w-full border border-gray-300 rounded-md p-2" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đánh giá hiệu quả</label>
            <select className="w-full border border-gray-300 rounded-md p-2" value={form.manager_rating} onChange={(e) => setForm({ ...form, manager_rating: e.target.value as ManagerRating | '' })}>
              <option value="">— Chọn —</option>
              {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hạn chế / lưu ý (tùy chọn)</label>
          <textarea rows={2} className="w-full border border-gray-300 rounded-md p-2" value={form.limitation_note} onChange={(e) => setForm({ ...form, limitation_note: e.target.value })} />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={() => navigate('/app/library')} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Hủy</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Lưu vào Thư viện'}</button>
        </div>
      </div>
    </div>
  );
}
