import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { formatError } from '../../../lib/errorUtils';
import { Profile, getMyProfile, updateMyProfile, listDepartments, Department } from '../../../lib/dataAccess';
import LoadingState from '../../../components/app-state/AppLoadingState';
import AppSubmitButton from '../../../components/app-state/AppSubmitButton';

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Draft profile matching database state
  const [draft, setDraft] = useState({
     full_name: '',
     avatar_url: ''
  });

  // Password update
  const [pwd, setPwd] = useState({
     newPassword: '',
     confirmPassword: ''
  });

  useEffect(() => {
    async function load() {
      try {
        const [myProf, depts] = await Promise.all([
          getMyProfile(),
          listDepartments()
        ]);
        setProfile(myProf);
        setDepartments(depts);
        setDraft({
          full_name: myProf.full_name || '',
          avatar_url: myProf.avatar_url || ''
        });
      } catch (err: any) {
        setErrorMessage(formatError(err, 'Lỗi tải thông tin tài khoản'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!draft.full_name.trim()) throw new Error('Họ tên không được để trống');

      await updateMyProfile({
        full_name: draft.full_name,
        avatar_url: draft.avatar_url
      });
      setSuccessMessage('Cập nhật thông tin thành công');
    } catch (err: any) {
      setErrorMessage(formatError(err, 'Lỗi cập nhật cấu hình tài khoản'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (pwd.newPassword.length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
      if (pwd.newPassword !== pwd.confirmPassword) throw new Error('Mật khẩu xác nhận không khớp');

      const { error } = await supabase.auth.updateUser({
        password: pwd.newPassword
      });

      if (error) throw error;
      setSuccessMessage('Đổi mật khẩu thành công');
      setPwd({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setErrorMessage(formatError(err, 'Đổi mật khẩu thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState title="Đang tải cấu hình tải khoản..." />;

  const roleDisplay = profile?.role === 'director' || profile?.role === 'admin' ? 'Director' :
                      profile?.role === 'manager' || profile?.role === 'lead' ? 'Manager' :
                      profile?.role === 'viewer' ? 'Viewer' : 'Member';

  const deptName = departments.find(d => d.id === profile?.department_id)?.name || 'Chưa phân bổ';

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate mb-8">
        Tài khoản của tôi
      </h2>

      {successMessage && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Thông tin chung</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Các thông tin nội bộ bạn không thể tự chỉnh sửa.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
             <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Phân quyền</dt>
              <dd className="mt-1 text-sm text-gray-900">{roleDisplay}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Phòng ban</dt>
              <dd className="mt-1 text-sm text-gray-900">{deptName}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
              <dd className="mt-1 text-sm text-gray-900">{profile?.status === 'inactive' ? 'Khóa' : 'Hoạt động'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Email cấu hình</dt>
              <dd className="mt-1 text-sm text-gray-900">{profile?.email || 'Trống'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Thông tin cá nhân</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Cập nhật họ tên và hình ảnh hiển thị.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={draft.full_name}
                onChange={(e) => setDraft({...draft, full_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">URL Hình đại diện (Avatar)</label>
              <input
                type="url"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={draft.avatar_url}
                onChange={(e) => setDraft({...draft, avatar_url: e.target.value})}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            <div className="pt-2">
              <AppSubmitButton isLoading={isSubmitting} label="Cập nhật thông tin" loadingLabel="Đang lưu..." type="submit" />
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Mật khẩu</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Đổi mật khẩu truy cập hệ thống.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-gray-700">Mật khẩu mới</label>
              <input
                type="password"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={pwd.newPassword}
                onChange={(e) => setPwd({...pwd, newPassword: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={pwd.confirmPassword}
                onChange={(e) => setPwd({...pwd, confirmPassword: e.target.value})}
              />
            </div>
            <div className="pt-2">
              <AppSubmitButton isLoading={isSubmitting} label="Đổi mật khẩu" loadingLabel="Đang lưu..." type="submit" />
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
