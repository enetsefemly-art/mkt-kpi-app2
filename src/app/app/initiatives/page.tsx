"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { 
  getMyWorkspaceAndRole, 
  listProducts, 
  listProfilesInWorkspace, 
  Profile 
} from "../../../lib/dataAccess";
import { listInitiatives, createInitiative, Initiative } from "../../../lib/initiativeAccess";
import { logActivity } from "../../../lib/activityLogger";
import { deleteEntity } from "../../../lib/deleteActions";
import AppSubmitButton from "../../../components/app-state/AppSubmitButton";
import { validateInitiativeForm } from "../../../lib/validation";
import { formatError } from "../../../lib/errorUtils";

// Types
interface Product {
  id: string;
  code: string;
  name: string;
}

export default function InitiativesPage() {
  const navigate = useNavigate();

  // --- Global State ---
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // --- Data State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  
  // --- UI State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createStatus, setCreateStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  
  // --- Filter State ---
  const [monthKeyFilter, setMonthKeyFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [productIdFilter, setProductIdFilter] = useState<string>("");

  // --- Form State ---
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formMonthKey, setFormMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [formProductId, setFormProductId] = useState("");
  const [formOwnerId, setFormOwnerId] = useState("");

  // --- 1. Initial Load: User, Workspace, Products, Owners ---
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        setError(null);
        setLastError(null);

        // A. Auth
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Not authenticated");
        const user = session.user;
        setCurrentUser(user);

        // B. Workspace & Role
        const { workspaceId: wsId, roleCode: role } = await getMyWorkspaceAndRole();
        setWorkspaceId(wsId);
        setRoleCode(role);

        // C. Products & Owners
        const [prods, profs] = await Promise.all([
          listProducts(wsId),
          listProfilesInWorkspace(wsId)
        ]);
        
        setProducts(prods);
        setOwners(profs);

        // Set default owner to current user if exists in list
        if (profs.some(p => p.user_id === user.id)) {
          setFormOwnerId(user.id);
        } else if (profs.length > 0) {
          setFormOwnerId(profs[0].user_id);
        }

      } catch (err: any) {
        console.error("Init error:", err);
        setError(formatError(err));
        setLastError(formatError(err));
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  // --- 2. Fetch Initiatives (Depend on Workspace & Month) ---
  useEffect(() => {
    if (!workspaceId) return;

    async function fetchInitiatives() {
      try {
        setLastError(null);
        const data = await listInitiatives(workspaceId!, monthKeyFilter, productIdFilter || undefined);
        setInitiatives(data);
      } catch (err: any) {
        console.error("Fetch initiatives error:", err);
        setError(formatError(err));
        setLastError(formatError(err));
      }
    }

    fetchInitiatives();
  }, [workspaceId, monthKeyFilter, productIdFilter, createStatus]); // Reload on create success

  // --- Handlers ---

  const handleCreateInitiative = async () => {
    console.log("create initiative clicked");
    if (!workspaceId) return;

    if (isSubmitting) return;

    const validation = validateInitiativeForm({
      title: formTitle,
      owner_id: formOwnerId,
      month_key: formMonthKey
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);

    setIsSubmitting(true);
    setError(null);
    setLastError(null);

    try {
      const payload = {
        workspace_id: workspaceId,
        owner_id: formOwnerId,
        product_id: formProductId === "" ? null : formProductId,
        title: formTitle,
        description: formDescription,
        priority: formPriority,
        month_key: formMonthKey
      };

      const newInitiative = await createInitiative(payload);

      // Audit Log
      await logActivity({
        workspaceId,
        entityType: "initiative",
        entityId: newInitiative.id,
        action: "create",
        detail: {
          title: newInitiative.title,
          owner_id: newInitiative.owner_id,
          product_id: newInitiative.product_id,
          priority: newInitiative.priority,
          month_key: newInitiative.month_key
        }
      });

      // Success
      setCreateStatus("success");
      setFormTitle("");
      setFormDescription("");
      // Keep priority, month, owner as is for convenience
      
      // Reload list
      const data = await listInitiatives(workspaceId, monthKeyFilter, productIdFilter || undefined);
      setInitiatives(data);

      // Reset status after a moment
      setTimeout(() => setCreateStatus("idle"), 2000);

    } catch (err: any) {
      console.error("Create error:", err);
      setLastError(formatError(err, "Create initiative failed"));
      setCreateStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInitiative = async (e: React.MouseEvent, initiativeId: string) => {
    e.stopPropagation();
    if (!workspaceId) return;

    if (!window.confirm("Bạn có chắc chắn muốn xóa Dự án này?")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setLastError(null);

    try {
      await deleteEntity('initiatives', initiativeId, workspaceId, "Dự án");
      // Reload list
      const data = await listInitiatives(workspaceId, monthKeyFilter, productIdFilter || undefined);
      setInitiatives(data);
    } catch (err: any) {
      console.error("Delete error:", err);
      setLastError(formatError(err, "Lỗi khi xóa Dự án"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = roleCode === 'admin' || roleCode === 'lead';

  // --- Render ---
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900">Quản lý Dự án</h1>

      {/* Loading State */}
      {loading && <div className="text-gray-500">Đang tải dữ liệu...</div>}

      {/* Create Form */}
      {canCreate && !loading && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Tạo Dự án mới</h2>
          
          {owners.length === 0 && (
            <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
              Cảnh báo: Không tìm thấy người phụ trách. Vui lòng kiểm tra cấu hình người dùng.
            </div>
          )}

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

          {lastError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Lỗi</h3>
                  <p className="mt-1 text-sm text-red-700">{lastError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Tiêu đề</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="VD: Chiến dịch Marketing Q1"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Mô tả</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Month Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Tháng</label>
                <input
                  type="month"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formMonthKey}
                  onChange={e => setFormMonthKey(e.target.value)}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Độ ưu tiên</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                >
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>

              {/* Product Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Sản phẩm</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formProductId}
                  onChange={e => setFormProductId(e.target.value)}
                >
                  <option value="">Tất cả / Không phân loại</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Người phụ trách *</label>
                <select
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={formOwnerId}
                  onChange={e => setFormOwnerId(e.target.value)}
                >
                  <option value="" disabled>Chọn người phụ trách</option>
                  {owners.map(p => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name} {p.function ? `- ${p.function}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2 items-center gap-4">
              <AppSubmitButton
                label="Lưu"
                loadingLabel="Đang lưu..."
                isLoading={isSubmitting}
                onClick={handleCreateInitiative}
                type="button"
              />
            </div>
            
            {createStatus === "success" && (
              <div className="text-green-600 text-sm text-right">Tạo thành công!</div>
            )}
          </div>
        </div>
      )}

      {/* List Section */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">Tháng hiển thị</label>
              <input
                type="month"
                className="mt-1 block w-40 border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                value={monthKeyFilter}
                onChange={e => setMonthKeyFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">Lọc theo Sản phẩm</label>
              <select
                className="mt-1 block w-40 border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                value={productIdFilter}
                onChange={e => setProductIdFilter(e.target.value)}
              >
                <option value="">Tất cả sản phẩm</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Hiển thị {initiatives.length} kết quả
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Độ ưu tiên</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người phụ trách</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                {roleCode === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initiatives.length === 0 ? (
                <tr>
                  <td colSpan={roleCode === 'admin' ? 7 : 6} className="px-6 py-8 text-center text-gray-500 italic">
                    Không tìm thấy dự án nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                initiatives.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => navigate(`/app/initiatives/${item.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.product_name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${item.priority === 'high' ? 'bg-red-100 text-red-800' : 
                          item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'}`}>
                        {item.priority === 'high' ? 'Cao' : item.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.owner_name}
                      {item.owner_function && <span className="text-xs text-gray-400 block">{item.owner_function}</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.overdue_count || 0) > 0 && (
                        <span className="text-red-600 font-bold mr-2">{item.overdue_count} Quá hạn</span>
                      )}
                      {(item.blocked_count || 0) > 0 && (
                        <span className="text-orange-600 font-bold">{item.blocked_count} Bị chặn</span>
                      )}
                      {!(item.overdue_count || 0) && !(item.blocked_count || 0) && (
                        <span className="text-green-600">Bình thường</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    {roleCode === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteInitiative(e, item.id)}
                          disabled={isSubmitting}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors disabled:opacity-50"
                        >
                          Xóa
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
