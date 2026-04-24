"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../../lib/supabaseClient";
import { getMyWorkspaceAndRole, listProfilesInWorkspace, Profile } from "../../../../lib/dataAccess";
import { logActivity } from "../../../../lib/activityLogger";
import { deleteEntity } from "../../../../lib/deleteActions";
import AppSubmitButton from "../../../../components/app-state/AppSubmitButton";
import { validateTaskForm } from "../../../../lib/validation";
import { formatError } from "../../../../lib/errorUtils";

// Types
interface Initiative {
  id: string;
  workspace_id: string;
  owner_id: string;
  product_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  month_key: string;
  created_at: string;
}

interface Task {
  id: string;
  workspace_id: string;
  initiative_id: string;
  title: string;
  owner_id: string;
  due_date: string | null;
  status: string;
  blocker_reason: string | null;
  created_at: string;
}

export default function Page({ params }: { params?: { initiativeId: string } }) {
  const routerParams = useParams<{ initiativeId: string }>();
  const initiativeId = params?.initiativeId || routerParams.initiativeId;
  const navigate = useNavigate();

  // Global State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  
  // Data State
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  // Create Task Form State
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskOwnerId, setNewTaskOwnerId] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("not_started");
  const [newTaskBlockerReason, setNewTaskBlockerReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Edit Task State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadData = async () => {
    if (!initiativeId) {
      setLastError("No initiative ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLastError(null);

      // 1. Auth
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Not authenticated");
      setCurrentUser(session.user);

      // 2. Workspace & Role
      const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
      setWorkspaceId(wsId);
      setRoleCode(role);

      // 3. Owners
      const profs = await listProfilesInWorkspace(wsId);
      setOwners(profs);

      // 4. Initiative
      const { data: initData, error: initError } = await supabase
        .from("initiatives")
        .select("*")
        .eq("id", initiativeId)
        .single();
      
      if (initError) throw initError;
      setInitiative(initData);

      // 5. Tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("initiative_id", initiativeId)
        .order("due_date", { ascending: true });
      
      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

    } catch (err: any) {
      console.error("Load error:", err);
      setLastError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initiativeId]);

  // Handlers
  const handleCreateTask = async () => {
    console.log("create task clicked");
    if (!initiative || !workspaceId) return;

    if (isSubmitting) return;

    const validation = validateTaskForm({
      title: newTaskTitle,
      owner_id: newTaskOwnerId,
      due_date: newTaskDueDate,
      status: newTaskStatus,
      blocker_reason: newTaskBlockerReason
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);

    setIsSubmitting(true);
    setLastError(null);

    try {

      const payload = {
        workspace_id: workspaceId,
        initiative_id: initiative.id,
        title: newTaskTitle,
        owner_id: newTaskOwnerId,
        due_date: newTaskDueDate || null,
        status: newTaskStatus,
        blocker_reason: newTaskStatus === "blocked" ? newTaskBlockerReason : null
      };

      const { data: newTask, error } = await supabase.from("tasks").insert(payload).select().single();
      if (error) throw error;

      await logActivity({
        workspaceId,
        entityType: "task",
        entityId: newTask.id,
        action: "create",
        detail: {
          initiative_id: newTask.initiative_id,
          title: newTask.title,
          owner_id: newTask.owner_id,
          due_date: newTask.due_date,
          status: newTask.status,
          blocker_reason: newTask.blocker_reason
        }
      });

      // Reset form
      setNewTaskTitle("");
      setNewTaskOwnerId("");
      setNewTaskDueDate("");
      setNewTaskStatus("not_started");
      setNewTaskBlockerReason("");
      setShowCreateTask(false);

      // Reload tasks
      loadData();
    } catch (err: any) {
      console.error("Create task error:", err);
      setLastError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      owner_id: task.owner_id,
      due_date: task.due_date || "",
      status: task.status,
      blocker_reason: task.blocker_reason || ""
    });
    setSaveError(null);
  };

  const handleCloseModal = () => {
    setEditingTask(null);
    setEditForm({});
    setSaveError(null);
  };

  const handleSaveTask = async () => {
    console.log("save task clicked");
    if (!editingTask || !currentUser) return;

    if (isSubmitting) return;

    const validation = validateTaskForm({
      title: editForm.title ?? editingTask.title,
      owner_id: editForm.owner_id ?? editingTask.owner_id,
      due_date: editForm.due_date ?? editingTask.due_date ?? "",
      status: editForm.status ?? editingTask.status,
      blocker_reason: editForm.blocker_reason ?? editingTask.blocker_reason
    });

    if (!validation.valid) {
      setSaveError(validation.errors.join(", "));
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    try {
      const isAdminOrLead = roleCode === "admin" || roleCode === "lead";
      const isOwner = editingTask.owner_id === currentUser.id;

      let updates: any = {};

      if (isAdminOrLead) {
        updates = {
          title: editForm.title,
          owner_id: editForm.owner_id,
          due_date: editForm.due_date || null,
          status: editForm.status,
          blocker_reason: editForm.status === "blocked" ? editForm.blocker_reason : null
        };
      } else if (isOwner) {
        updates = {
          status: editForm.status,
          blocker_reason: editForm.status === "blocked" ? editForm.blocker_reason : null
        };
      } else {
        throw new Error("You do not have permission to edit this task.");
      }

      const { data: updatedTask, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editingTask.id)
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        workspaceId: workspaceId!,
        entityType: "task",
        entityId: updatedTask.id,
        action: "update",
        detail: {
          before: editingTask,
          after: updatedTask
        }
      });

      handleCloseModal();
      loadData();
    } catch (err: any) {
      console.error("Save task error:", err);
      setSaveError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!workspaceId) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa Nhiệm vụ này?")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setLastError(null);

    try {
      await deleteEntity('tasks', taskId, workspaceId, "Nhiệm vụ");
      loadData();
    } catch (err: any) {
      console.error("Delete task error:", err);
      setLastError(formatError(err, "Lỗi khi xóa nhiệm vụ"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdminOrLead = roleCode === "admin" || roleCode === "lead";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <button onClick={() => navigate('/app/initiatives')} className="text-indigo-600 hover:underline flex items-center">
        &larr; Quay lại quản lý Dự án
      </button>

      {/* Main Content */}
      {!initiative ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          Không tìm thấy dự án hoặc bạn không có quyền truy cập.
        </div>
      ) : (
        <>
          {/* Initiative Header */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">{initiative.title}</h1>
            <p className="text-gray-600 mt-2">{initiative.description || "Không có mô tả."}</p>
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span className={`px-2 py-1 rounded font-medium capitalize
                ${initiative.priority === 'high' ? 'bg-red-100 text-red-800' : 
                  initiative.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-green-100 text-green-800'}`}>
                Đầu việc: {initiative.priority === 'high' ? 'Cao' : initiative.priority === 'medium' ? 'Trung bình' : 'Thấp'}
              </span>
              <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                Tháng: <strong>{initiative.month_key}</strong>
              </span>
            </div>
          </div>

          {/* Create Task Form (Admin/Lead only) */}
          {isAdminOrLead && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Tạo Nhiệm vụ mới</h2>
                <button
                  onClick={() => setShowCreateTask(!showCreateTask)}
                  className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-100"
                >
                  {showCreateTask ? "Hủy" : "+ Thêm Nhiệm vụ"}
                </button>
              </div>

              {showCreateTask && (
                <div className="space-y-4 animate-fade-in">
                  {formErrors.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                      <div className="flex">
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Vui lòng sửa các lỗi sau:</h3>
                          <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                            {formErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Tiêu đề nhiệm vụ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Người phụ trách</label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={newTaskOwnerId}
                        onChange={e => setNewTaskOwnerId(e.target.value)}
                      >
                        <option value="" disabled>Chọn người phụ trách</option>
                        {owners.map(p => (
                          <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ngày đến hạn</label>
                      <input
                        type="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={newTaskDueDate}
                        onChange={e => setNewTaskDueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={newTaskStatus}
                        onChange={e => setNewTaskStatus(e.target.value)}
                      >
                        <option value="not_started">Chưa bắt đầu</option>
                        <option value="in_progress">Đang thực hiện</option>
                        <option value="done">Hoàn thành</option>
                        <option value="blocked">Đang bị chặn</option>
                      </select>
                    </div>
                    {newTaskStatus === "blocked" && (
                      <div className="col-span-1 md:col-span-3">
                        <label className="block text-sm font-medium text-red-700">Lý do bị chặn *</label>
                        <input
                          type="text"
                          required
                          className="mt-1 block w-full border border-red-300 rounded-md shadow-sm p-2"
                          value={newTaskBlockerReason}
                          onChange={e => setNewTaskBlockerReason(e.target.value)}
                          placeholder="Nguyên nhân bị chặn là gì?"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <AppSubmitButton
                      label="Lưu"
                      loadingLabel="Đang lưu..."
                      isLoading={isSubmitting}
                      onClick={handleCreateTask}
                      type="button"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks List */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Danh sách Nhiệm vụ</h3>
            </div>
            
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500 italic">Không có dữ liệu</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiêu đề</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người phụ trách</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hạn chót</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lý do chặn</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tasks.map(task => {
                      const isOwner = currentUser?.id === task.owner_id;
                      const canEdit = isAdminOrLead || isOwner;
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                      const isBlocked = task.status === 'blocked';
                      const ownerProfile = owners.find(o => o.user_id === task.owner_id);
                      
                      return (
                        <tr key={task.id} className={`hover:bg-gray-50 ${isBlocked ? 'bg-red-50' : ''}`}>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                            {task.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ownerProfile?.full_name || task.owner_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}>
                              {task.due_date || "-"}
                            </span>
                            {isOverdue && <span className="ml-2 text-xs text-red-600 font-semibold">Quá hạn</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${task.status === 'done' ? 'bg-green-100 text-green-800' : 
                                task.status === 'blocked' ? 'bg-red-100 text-red-800' : 
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                                'bg-gray-100 text-gray-800'}`}>
                              {task.status === 'done' ? 'Hoàn thành' : 
                               task.status === 'blocked' ? 'Đang bị chặn' : 
                               task.status === 'in_progress' ? 'Đang thực hiện' : 
                               'Chưa bắt đầu'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-red-600 italic">
                            {task.blocker_reason || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex gap-2 justify-end">
                              {canEdit && (
                                <button 
                                  onClick={() => handleEditClick(task)}
                                  className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded px-3 py-1 hover:bg-indigo-50"
                                >
                                  Chỉnh sửa
                                </button>
                              )}
                              {roleCode === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={isSubmitting}
                                  className="text-red-500 hover:text-red-700 border border-red-100 rounded px-3 py-1 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Chỉnh sửa Nhiệm vụ</h3>
            
            {saveError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="space-y-4">
              {/* Title: Admin/Lead only */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                <input
                  type="text"
                  required
                  disabled={!isAdminOrLead}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editForm.title || ""}
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                />
              </div>

              {/* Owner ID: Admin/Lead only */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Người phụ trách</label>
                <select
                  required
                  disabled={!isAdminOrLead}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editForm.owner_id || ""}
                  onChange={e => setEditForm({...editForm, owner_id: e.target.value})}
                >
                  <option value="" disabled>Chọn người phụ trách</option>
                  {owners.map(p => (
                    <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Due Date: Admin/Lead only */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Ngày đến hạn</label>
                <input
                  type="date"
                  disabled={!isAdminOrLead}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editForm.due_date || ""}
                  onChange={e => setEditForm({...editForm, due_date: e.target.value})}
                />
              </div>

              {/* Status: All (if owner/admin) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={editForm.status || "not_started"}
                  onChange={e => setEditForm({...editForm, status: e.target.value})}
                >
                  <option value="not_started">Chưa bắt đầu</option>
                  <option value="in_progress">Đang thực hiện</option>
                  <option value="done">Hoàn thành</option>
                  <option value="blocked">Đang bị chặn</option>
                </select>
              </div>

              {/* Blocker Reason: Required if blocked */}
              {editForm.status === "blocked" && (
                <div>
                  <label className="block text-sm font-medium text-red-700">Lý do bị chặn *</label>
                  <textarea
                    required
                    className="mt-1 block w-full border border-red-300 rounded-md shadow-sm p-2"
                    value={editForm.blocker_reason || ""}
                    onChange={e => setEditForm({...editForm, blocker_reason: e.target.value})}
                    placeholder="Giải thích lý do bị chặn..."
                  />
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Hủy
                </button>
                <AppSubmitButton
                  label="Lưu"
                  loadingLabel="Đang lưu..."
                  isLoading={isSubmitting}
                  onClick={handleSaveTask}
                  type="button"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
