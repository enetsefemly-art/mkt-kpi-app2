import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../../lib/supabaseClient';
import {
  getMyProfile,
  getCurrentWorkspaceId,
  getWorkspacePasEnabled,
  listDepartments,
  listProfilesInWorkspace,
  Department,
  Profile,
} from '../../../../lib/dataAccess';
import { listProblemTypes } from '../../../../lib/pas/taxonomyAccess';
import { createProblem } from '../../../../lib/pas/problemAccess';
import { canCreateProblem } from '../../../../lib/permissions';
import { formatError } from '../../../../lib/errorUtils';
import type { ProblemType, Severity } from '../../../../lib/pas/types';

const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export default function ProblemNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillKpiId = searchParams.get('kpi_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [problemTypes, setProblemTypes] = useState<ProblemType[]>([]);

  const [form, setForm] = useState({
    problem_title: '',
    problem_description: '',
    problem_type_id: '',
    severity: 'Medium' as Severity,
    problem_owner_id: '',
    department_id: '',
    expected_resolve_date: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { navigate('/login'); return; }

        const profile = await getMyProfile();
        if (!canCreateProblem(profile.role)) { navigate('/app/problems'); return; }

        const wsId = await getCurrentWorkspaceId(profile);
        const pasOn = await getWorkspacePasEnabled(wsId);
        if (!pasOn) { navigate('/app/dashboard'); return; }
        setWorkspaceId(wsId || '');

        const [depts, profs, types] = await Promise.all([
          listDepartments(),
          listProfilesInWorkspace(wsId || ''),
          listProblemTypes(wsId || ''),
        ]);
        setDepartments(depts);
        setProfiles(profs);
        setProblemTypes(types);

        // default: owner = current user, department = owner's department
        setForm((f) => ({
          ...f,
          problem_owner_id: profile.user_id,
          department_id: profile.department_id || '',
        }));
      } catch (err: any) {
        setError(formatError(err, 'Lỗi tải form tạo vấn đề'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.problem_title.trim()) errs.push('Tiêu đề không được để trống');
    if (!form.problem_description.trim()) errs.push('Mô tả không được để trống');
    if (!form.problem_owner_id) errs.push('Phải chọn người phụ trách');
    if (!form.department_id) errs.push('Phải chọn phòng ban');
    return errs;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const errs = validate();
    if (errs.length) { setFormErrors(errs); return; }
    setFormErrors([]);
    setSubmitting(true);
    setError(null);

    try {
      const problem = await createProblem({
        workspace_id: workspaceId,
        department_id: form.department_id,
        problem_owner_id: form.problem_owner_id,
        problem_title: form.problem_title.trim(),
        problem_description: form.problem_description.trim(),
        problem_type_id: form.problem_type_id || null,
        severity: form.severity,
        related_kpi_id: prefillKpiId || null,
        expected_resolve_date: form.expected_resolve_date || null,
      });
      navigate(`/app/problems/${problem.id}`);
    } catch (err: any) {
      setError(formatError(err, 'Lỗi tạo vấn đề'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <button onClick={() => navigate('/app/problems')} className="text-indigo-600 hover:underline text-sm">
        ← Quay lại danh sách
      </button>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Tạo Vấn đề mới</h1>
        {prefillKpiId && (
          <p className="text-xs text-indigo-600 mb-4">Đã liên kết với KPI được chọn.</p>
        )}

        {formErrors.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <ul className="text-sm text-red-700 list-disc list-inside">
              {formErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
            <input
              className="w-full border border-gray-300 rounded-md p-2"
              value={form.problem_title}
              onChange={(e) => setForm({ ...form, problem_title: e.target.value })}
              placeholder="VD: CPL chiến dịch Facebook tăng 30% tuần này"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả / bằng chứng *</label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-md p-2"
              value={form.problem_description}
              onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại vấn đề (tùy chọn)</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={form.problem_type_id}
                onChange={(e) => setForm({ ...form, problem_type_id: e.target.value })}
              >
                <option value="">— Chọn loại —</option>
                {problemTypes.map((t) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
              >
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách *</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={form.problem_owner_id}
                onChange={(e) => setForm({ ...form, problem_owner_id: e.target.value })}
              >
                <option value="">— Chọn —</option>
                {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban *</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              >
                <option value="">— Chọn —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày dự kiến xử lý xong (tùy chọn)</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md p-2"
                value={form.expected_resolve_date}
                onChange={(e) => setForm({ ...form, expected_resolve_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => navigate('/app/problems')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : 'Tạo Vấn đề'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
