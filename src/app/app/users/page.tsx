import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { formatError } from '../../../lib/errorUtils';
import { cleanUuid, shouldApplyUuidFilter } from '../../../lib/uuid';
import { Profile, getMyProfile, listDepartments, Department, updateUserProfile } from '../../../lib/dataAccess';
import { canManageUser, isDirector } from '../../../lib/permissions';
import ErrorState from '../../../components/app-state/AppErrorState';
import LoadingState from '../../../components/app-state/AppLoadingState';
import AppSubmitButton from '../../../components/app-state/AppSubmitButton';

export default function UsersPage() {
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Partial<Profile> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const myProfile = await getMyProfile();
      setCurrentUserProfile(myProfile);

      if (!canManageUser(myProfile.role)) {
        setError('Bạn không có quyền truy cập trang này');
        setLoading(false);
        return;
      }

      const depts = await listDepartments();
      setDepartments(depts);

      let query = supabase.from('profiles').select('user_id, full_name, function, role, department_id, manager_id, status, avatar_url, email').order('full_name');
      
      if (!isDirector(myProfile.role) && shouldApplyUuidFilter(myProfile.department_id)) {
         query = query.eq('department_id', myProfile.department_id);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setProfiles(data || []);
    } catch (err: any) {
      console.error(err);
      setError(formatError(err, 'Lỗi tải danh sách người dùng'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState title="Đang tải danh sách người dùng..." />;
  if (error && error.includes('quyền truy cập')) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <ErrorState title="Không có quyền truy cập" message={error} />
      </div>
    );
  }
  if (error) return <ErrorState title="Lỗi" message={error} onRetry={loadData} />;

  const handleEditRow = (p: Profile) => {
    setEditingProfileId(p.user_id);
    setEditingDraft({
      full_name: p.full_name,
      role: p.role || 'member',
      department_id: p.department_id || '',
      manager_id: p.manager_id || '',
      status: p.status || 'active',
      email: p.email || ''
    });
  };

  const handleSaveRow = async () => {
    if (!editingProfileId || !editingDraft) return;
    setIsSubmitting(true);
    try {
      if (currentUserProfile?.role === 'manager' && editingDraft.role === 'director') {
         throw new Error('Manager không được phép nâng quyền user thành Director');
      }

      await updateUserProfile(editingProfileId, {
        full_name: editingDraft.full_name,
        role: editingDraft.role,
        department_id: cleanUuid(editingDraft.department_id),
        manager_id: cleanUuid(editingDraft.manager_id),
        status: editingDraft.status
      });
      setEditingProfileId(null);
      setEditingDraft(null);
      loadData();
      alert('Đã cập nhật người dùng');
    } catch (err: any) {
      alert(formatError(err, 'Cập nhật thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const directorMode = isDirector(currentUserProfile?.role);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 xl:px-8 sm:px-6">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Quản lý người dùng
          </h2>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phân quyền</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phòng ban</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quản lý trực tiếp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profiles.map((p) => {
                const isEditing = editingProfileId === p.user_id;

                const roleDisplay = p.role === 'director' || p.role === 'admin' ? 'Director' :
                                   p.role === 'manager' || p.role === 'lead' ? 'Manager' :
                                   p.role === 'viewer' ? 'Viewer' : 'Member';
                const statusDisplay = p.status === 'inactive' ? 'Khóa' : 'Hoạt động';
                
                const deptName = departments.find(d => d.id === p.department_id)?.name || 'Trống';
                const managerName = profiles.find(mp => mp.user_id === p.manager_id)?.full_name || 'Trống';

                return (
                  <tr key={p.user_id} className={isEditing ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500"
                          value={editingDraft?.full_name || ''}
                          onChange={(e) => setEditingDraft(prev => ({...prev, full_name: e.target.value}))}
                        />
                      ) : p.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {p.email || <span className="text-gray-400 italic">Trống</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isEditing && (directorMode || currentUserProfile?.role === 'manager' || currentUserProfile?.role === 'lead') ? (
                        <select
                           className="border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500"
                           value={editingDraft?.role || 'member'}
                           onChange={(e) => setEditingDraft(prev => ({...prev, role: e.target.value}))}
                        >
                           {directorMode && <option value="director">Director</option>}
                           <option value="manager">Manager</option>
                           <option value="member">Member</option>
                           <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${p.role === 'director' || p.role === 'admin' ? 'bg-purple-100 text-purple-800' : p.role === 'manager' || p.role === 'lead' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                          {roleDisplay}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isEditing && (directorMode || currentUserProfile?.role === 'manager' || currentUserProfile?.role === 'lead') ? (
                        <select
                           className="border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500"
                           value={editingDraft?.department_id || ''}
                           onChange={(e) => setEditingDraft(prev => ({...prev, department_id: e.target.value}))}
                        >
                           <option value="">-- Trống --</option>
                           {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : deptName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       {isEditing ? (
                        <select
                           className="border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500"
                           value={editingDraft?.manager_id || ''}
                           onChange={(e) => setEditingDraft(prev => ({...prev, manager_id: e.target.value}))}
                        >
                           <option value="">-- Trống --</option>
                           {profiles.map(mp => <option key={mp.user_id} value={mp.user_id}>{mp.full_name}</option>)}
                        </select>
                      ) : managerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isEditing ? (
                         <select
                           className="border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500"
                           value={editingDraft?.status || 'active'}
                           onChange={(e) => setEditingDraft(prev => ({...prev, status: e.target.value}))}
                        >
                           <option value="active">Hoạt động</option>
                           <option value="inactive">Khóa</option>
                        </select>
                      ) : (
                         <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${p.status === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                           {statusDisplay}
                         </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                           <AppSubmitButton 
                             onClick={handleSaveRow} 
                             isLoading={isSubmitting} 
                             label="Lưu"
                             loadingLabel="Đang lưu..." 
                             className="px-2 py-1 text-xs" 
                           />
                           <button 
                             disabled={isSubmitting}
                             onClick={() => setEditingProfileId(null)} 
                             className="text-gray-600 hover:text-gray-900 bg-gray-100 px-2 py-1 rounded"
                           >
                             Hủy
                           </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleEditRow(p)} 
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
