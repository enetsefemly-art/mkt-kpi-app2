"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMyWorkspaceAndRole, listProducts, getKpiDetail, updateKpi, listProfilesInWorkspace, getMyProfile } from '../../../../lib/dataAccess';
import { calcItemScore } from '../../../../lib/kpiMath';
import { validateSubWeightTotal } from '../../../../lib/kpiProgress';
import { supabase } from '../../../../lib/supabaseClient';
import { logActivity } from '../../../../lib/activityLogger';
import { deleteEntity } from '../../../../lib/deleteActions';
import AppSubmitButton from '../../../../components/app-state/AppSubmitButton';
import { validateKpiItemForm, validateKpiForm } from '../../../../lib/validation';
import { formatError } from '../../../../lib/errorUtils';
import { cleanUuid, shouldApplyUuidFilter } from '../../../../lib/uuid';
import { canCreateKPIItem, canEditKPIItem, canDeleteKPIItem, canEditKPI, canDeleteKPI, isDirector, canViewUser } from '../../../../lib/permissions';

interface Product {
  id: string;
  name: string;
  code: string;
}

interface KpiItem {
  id: string;
  kpi_id: string;
  product_id: string;
  item_title: string;
  sub_weight: number;
  target: number | null;
  actual: number | null;
  manual_progress: number | null;
  direction: string;
  target_mode: string;
  note: string | null;
  score?: any;
}

interface KpiDetail {
  id: string;
  title: string;
  kpi_type: string;
  weight: number;
  unit: string;
  owner_id: string;
  workspace_id: string;
  description: string | null;
  month_key?: string;
  kpi_score_method?: string;
  department_id?: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  department_id?: string;
}

export default function KpiDetailPage() {
  const { kpiId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  const [kpi, setKpi] = useState<KpiDetail | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<KpiItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, Product>>(new Map());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  
  const [isEditingKpi, setIsEditingKpi] = useState(false);
  const [editKpiData, setEditKpiData] = useState<any>({});
  const [kpiUpdateErrors, setKpiUpdateErrors] = useState<string[]>([]);
  
  const location = useLocation();
  
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [itemErrors, setItemErrors] = useState<string[]>([]);
  const [itemLastError, setItemLastError] = useState<string | null>(null);
  const [itemSubmitting, setItemSubmitting] = useState(false);

  const [newItem, setNewItem] = useState({
    product_id: '',
    item_title: '',
    sub_weight: 100,
    target: 0,
    actual: 0,
    manual_progress: 0,
    direction: 'higher_better',
    target_mode: 'cumulative',
    note: ''
  });

  useEffect(() => {
    if (kpiId) loadData();
  }, [kpiId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) {
        navigate('/login');
        return;
      }
      setCurrentUserId(session.user.id);
      
      const myProf = await getMyProfile();
      setMyProfile(myProf);

      const detail = await getKpiDetail(kpiId!);
      setKpi(detail.kpi);
      setItems(detail.items);
      setOwnerProfile(detail.ownerProfile);
      
      const kpiWorkspaceId = detail.kpi.workspace_id;
      setWorkspaceId(kpiWorkspaceId);

      // Fetch role specifically for this KPI's workspace
      const userRoleQuery: any = {};
      if (shouldApplyUuidFilter(session.user.id)) userRoleQuery.user_id = session.user.id;
      if (shouldApplyUuidFilter(kpiWorkspaceId)) userRoleQuery.workspace_id = kpiWorkspaceId;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role_code')
        .match(userRoleQuery)
        .maybeSingle();
        
      const fetchedRole = roleData?.role_code || null;
      setRoleCode(fetchedRole);

      const productsData = await listProducts(kpiWorkspaceId);
      setProducts(productsData);
      
      const fullProductsMap = new Map(productsData.map((p: any) => [p.id, p]));
      detail.productsMap.forEach((val, key) => fullProductsMap.set(key, val));
      setProductsMap(fullProductsMap);

      const profilesData = await listProfilesInWorkspace(kpiWorkspaceId);
      setProfiles(profilesData);

      const searchParams = new URLSearchParams(location.search);
      // Wait, isEditing should be checked using canEditKPI
      if (searchParams.get('mode') === 'edit' && canEditKPI(myProf.role, myProf.department_id, detail.kpi.department_id)) {
        setIsEditingKpi(true);
        setEditKpiData({
          title: detail.kpi.title,
          owner_id: detail.kpi.owner_id,
          unit: detail.kpi.unit,
          weight: detail.kpi.weight,
          description: detail.kpi.description || '',
          month_key: detail.kpi.month_key || '',
          kpi_score_method: detail.kpi.kpi_score_method || 'weighted_item_score'
        });
      }

    } catch (err: any) {
      console.error('Error loading KPI detail:', err);
      setFetchError(formatError(err, 'Lỗi tải KPI'));
    } finally {
      setLoading(false);
    }
  };

  const kpiOwnerId = kpi?.owner_id ?? null;
  const isOwner = currentUserId !== null && currentUserId === kpiOwnerId;
  const targetDeptId = kpi?.department_id || ownerProfile?.department_id;
  
  const canManageAll = canEditKPI(myProfile?.role, myProfile?.department_id, targetDeptId);
  const canAddItem = canCreateKPIItem(myProfile, kpi);
  const canDeleteItem = canDeleteKPIItem(myProfile, null, kpi);
  
  const itemPerms = canEditKPIItem(myProfile, null, kpi);
  const canEditAllFields = itemPerms.canEditAll;
  
  // owner item update specific fields: actual, manual_progress, note which is handled inside UI and submission
  const canEditLimitedFields = itemPerms.canEditActual && !itemPerms.canEditAll;
  const canEditItem = canEditAllFields || canEditLimitedFields;

  const handleAddKpiItem = async () => {
    console.log("add KPI item clicked");
    if (!kpiId || !workspaceId) return;
    
    if (isSubmitting) return;

    const validation = validateKpiItemForm(newItem, kpi?.kpi_type || 'revenue');
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);

    setIsSubmitting(true);
    setFetchError(null);
    setLastError(null);

    try {
      const payload: any = {
        kpi_id: kpiId,
        product_id: cleanUuid(newItem.product_id),
        item_title: newItem.item_title,
        sub_weight: newItem.sub_weight,
        direction: newItem.direction,
        target_mode: newItem.target_mode,
        note: newItem.note,
        target: newItem.target,
        actual: newItem.actual,
        manual_progress: newItem.manual_progress
      };

      const { data: newItemData, error } = await supabase
        .from('kpi_items')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      console.log("add KPI item success", newItemData);

      await logActivity({
        workspaceId,
        entityType: "kpi_item",
        entityId: newItemData.id,
        action: "create",
        detail: payload
      });
      
      setNewItem({
        product_id: '',
        item_title: '',
        sub_weight: 100,
        target: 0,
        actual: 0,
        manual_progress: 0,
        direction: 'higher_better',
        target_mode: 'cumulative',
        note: ''
      });
      loadData();
    } catch (err: any) {
      console.error('Error adding item:', err);
      setLastError(formatError(err, 'Thêm thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItemMode = (item: any) => {
    setEditingItemId(item.id);
    setEditingDraft({ ...item });
    setItemErrors([]);
    setItemLastError(null);
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingDraft(null);
    setItemErrors([]);
    setItemLastError(null);
  };

  const handleDraftUpdate = (field: string, value: any) => {
    if (!editingDraft) return;
    setEditingDraft((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSaveItemEdit = async () => {
    if (itemSubmitting || !editingItemId || !editingDraft) return;

    setItemSubmitting(true);
    setItemErrors([]);
    setItemLastError(null);

    try {
      const currentItem = items.find(i => i.id === editingItemId);
      if (!currentItem) throw new Error("Không tìm thấy item");

      const validation = validateKpiItemForm(editingDraft, kpi?.kpi_type || 'revenue');
      if (!validation.valid) {
        setItemErrors(validation.errors);
        setItemSubmitting(false);
        return;
      }

      let updatePayload: any = {};

      if (canEditAllFields) {
        updatePayload = {
          product_id: cleanUuid(editingDraft.product_id),
          item_title: editingDraft.item_title,
          sub_weight: editingDraft.sub_weight,
          target: editingDraft.target,
          actual: editingDraft.actual,
          manual_progress: editingDraft.manual_progress,
          direction: editingDraft.direction,
          target_mode: editingDraft.target_mode,
          note: editingDraft.note
        };
      } else if (canEditLimitedFields) {
        updatePayload = {
          actual: editingDraft.actual,
          manual_progress: editingDraft.manual_progress,
          note: editingDraft.note
        };
      } else {
        throw new Error("Bạn không có quyền chỉnh sửa item này.");
      }

      const { data: updatedItem, error } = await supabase
        .from('kpi_items')
        .update(updatePayload)
        .eq('id', editingItemId)
        .select()
        .single();

      if (error) throw error;

      if (workspaceId) {
        await logActivity({
          workspaceId,
          entityType: "kpi_item",
          entityId: updatedItem.id,
          action: "update",
          detail: {
            before: currentItem,
            after: updatedItem
          }
        });
      }
      
      setEditingItemId(null);
      setEditingDraft(null);
      loadData();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật item:', err);
      setItemLastError(formatError(err, 'Lưu thất bại'));
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleUpdateKpi = async () => {
    if (isSubmitting || !workspaceId || !kpiId) return;

    const validation = validateKpiForm(editKpiData);
    if (!validation.valid) {
      setKpiUpdateErrors(validation.errors);
      return;
    }
    setKpiUpdateErrors([]);
    setIsSubmitting(true);
    setLastError(null);

    try {
      await updateKpi(kpiId, editKpiData);
      
      await logActivity({
        workspaceId,
        entityType: "kpi",
        entityId: kpiId,
        action: "update",
        detail: { mode: "inline_edit", ...editKpiData }
      });
      
      await loadData();
      setIsEditingKpi(false);
      
      // Update URL to remove mode=edit without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url);

    } catch (err: any) {
      console.error('Error updating KPI:', err);
      setLastError(formatError(err, 'Lỗi cập nhật KPI'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!workspaceId) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa hạng mục này?")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setUpdateError(null);
    try {
      await deleteEntity('kpi_items', itemId, workspaceId, "KPI Item");
      loadData();
    } catch (err: any) {
      console.error('Error deleting item:', err);
      setUpdateError(formatError(err, 'Lỗi xóa hạng mục'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  const itemsWithScore = items.map((item) => {
    const score = calcItemScore({
      kpiType: kpi?.kpi_type || 'revenue',
      direction: item.direction,
      target: item.target,
      actual: item.actual,
      manualProgress: item.manual_progress,
      kpiWeight: kpi?.weight || 0,
      subWeight: item.sub_weight
    });
    return { ...item, score };
  });

  // Calculate KPI Completion Score based on method
  let kpiCompletionScore = 0;
  const kpiScoreMethod = kpi?.kpi_score_method || 'weighted_item_score';

  if (kpiScoreMethod === 'aggregate_ratio') {
    let sumActual = 0;
    let sumTargetToDate = 0;

    // We assume current month's logic simply uses target if we do not know the context context or we use `actual/target` generally
    itemsWithScore.forEach(item => {
      sumActual += item.actual || 0;
      sumTargetToDate += item.target || 0;
    });

    let kpiRawRatio = 0;
    if (sumTargetToDate > 0) {
      kpiRawRatio = sumActual / sumTargetToDate;
    } else if (sumActual > 0) {
      kpiRawRatio = 1.2;
    }
    const kpiNormalizedRatio = Math.min(Math.max(kpiRawRatio, 0.8), 1.2);
    kpiCompletionScore = kpiNormalizedRatio * 100;

  } else {
    // weighted_item_score
    itemsWithScore.forEach(item => {
      kpiCompletionScore += item.score.cappedRatio * (item.sub_weight || 0);
    });
  }

  const subWeightValidation = validateSubWeightTotal(items);


  return (
    <div className="space-y-6 pb-10">
      <button onClick={() => navigate('/app/kpis')} className="text-indigo-600 hover:underline flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Quay lại danh sách KPI
      </button>

      {fetchError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center">
          <h2 className="text-lg font-bold mb-2">Không tìm thấy KPI hoặc không có quyền truy cập</h2>
          <p>{fetchError}</p>
        </div>
      ) : isEditingKpi ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-200">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Chỉnh sửa thông tin KPI</h2>
          
          {kpiUpdateErrors.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <ul className="text-sm text-red-700 list-disc list-inside">
                {kpiUpdateErrors.map((err, idx) => <li key={idx}>{err}</li>)}
              </ul>
            </div>
          )}
          {lastError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 text-sm text-red-700">
              {lastError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên KPI</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.title || ''}
                onChange={e => setEditKpiData({...editKpiData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người phụ trách</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.owner_id || ''}
                onChange={e => setEditKpiData({...editKpiData, owner_id: e.target.value})}
              >
                <option value="">Chọn nhân sự</option>
                {profiles.filter(p => canViewUser(myProfile?.role, myProfile?.department_id, p.department_id)).map(p => (
                  <option key={p.user_id} value={p.user_id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị đo lường</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.unit || ''}
                onChange={e => setEditKpiData({...editKpiData, unit: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trọng số (%)</label>
              <input
                type="number"
                min="0" max="100"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.weight || 100}
                onChange={e => setEditKpiData({...editKpiData, weight: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tháng (YYYY-MM)</label>
              <input
                type="month"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.month_key || ''}
                onChange={e => setEditKpiData({...editKpiData, month_key: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cách tính điểm</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={editKpiData.kpi_score_method || 'weighted_item_score'}
                onChange={e => setEditKpiData({...editKpiData, kpi_score_method: e.target.value})}
              >
                <option value="aggregate_ratio">Tổng Tỷ lệ</option>
                <option value="weighted_item_score">Trung bình trọng số</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả thêm</label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                value={editKpiData.description || ''}
                onChange={e => setEditKpiData({...editKpiData, description: e.target.value})}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsEditingKpi(false);
                const url = new URL(window.location.href);
                url.searchParams.delete('mode');
                window.history.replaceState({}, '', url);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <AppSubmitButton 
              label="Lưu thay đổi" 
              loadingLabel="Đang lưu..."
              isLoading={isSubmitting}
              onClick={handleUpdateKpi}
              type="button" 
            />
          </div>
        </div>
      ) : kpi ? (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{kpi.title}</h1>
                    {canEditAllFields ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Toàn quyền sửa</span>
                    ) : canEditLimitedFields ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Giới hạn sửa hiệu suất</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Chỉ xem</span>
                    )}
                  </div>
                  {canManageAll && (
                    <button
                      onClick={() => {
                        setIsEditingKpi(true);
                        setEditKpiData({
                          title: kpi.title,
                          owner_id: kpi.owner_id,
                          unit: kpi.unit,
                          weight: kpi.weight,
                          description: kpi.description || '',
                          month_key: kpi.month_key || '',
                          kpi_score_method: kpi.kpi_score_method || 'weighted_item_score'
                        });
                        const url = new URL(window.location.href);
                        url.searchParams.set('mode', 'edit');
                        window.history.replaceState({}, '', url);
                      }}
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 text-sm font-medium transition-colors"
                    >
                      Chỉnh sửa KPI
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Người phụ trách:</span>
                    <span className="text-gray-900">{ownerProfile?.full_name || 'Không rõ'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Trọng số:</span>
                    <span className="text-gray-900">{kpi.weight}%</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Đơn vị:</span>
                    <span className="text-gray-900">{kpi.unit}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Tháng:</span>
                    <span className="bg-indigo-100 px-2 py-0.5 rounded text-indigo-800 font-mono text-xs">{kpi.month_key}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Cách tính điểm:</span>
                    <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                       {kpi.kpi_score_method === 'aggregate_ratio' ? 'Tổng Tỉ lệ' : 'Trung bình trọng số'}
                    </span>
                  </div>
                </div>
                {kpi.description && (
                  <div className="mt-4 text-sm text-gray-700">
                    <span className="font-medium">Mô tả:</span> {kpi.description}
                  </div>
                )}
                {subWeightValidation.message && (
                  <div className={`mt-4 text-sm p-3 rounded-md border ${subWeightValidation.isOver ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <span className="font-medium">Cảnh báo:</span> {subWeightValidation.message}
                  </div>
                )}
                {subWeightValidation.isExact && (
                  <div className="mt-4 text-sm p-3 rounded-md border bg-green-50 text-green-700 border-green-200">
                    Tổng trọng số con = 100%
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Chi tiết các hạng mục KPI</h3>
            </div>
            
            {(itemErrors.length > 0 || itemLastError) && (
              <div className="m-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Lỗi khi lưu KPI:</h3>
                    {itemLastError && <p className="mt-1 text-sm text-red-700">{itemLastError}</p>}
                    <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                      {itemErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên hạng mục</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chế độ mục tiêu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hướng KPI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Trọng số con</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Mục tiêu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Hiện tại</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Tiến độ tay</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Điểm số</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ghi chú</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemsWithScore.map((item) => {
                    const product = productsMap.get(item.product_id);
                    const isEditing = editingItemId === item.id;
                    const draft = isEditing ? editingDraft : item;

                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`}>
                        <td className="px-6 py-4">
                          {isEditing && canEditAllFields ? (
                            <select
                              className="w-full border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.product_id}
                              onChange={e => handleDraftUpdate('product_id', e.target.value)}
                            >
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          ) : (
                            <div className="text-sm font-bold text-gray-900">{product?.name || 'Không xác định'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing && canEditAllFields ? (
                            <input 
                              className="text-sm text-gray-900 border border-gray-300 rounded p-1 w-full focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.item_title}
                              onChange={e => handleDraftUpdate('item_title', e.target.value)}
                            />
                          ) : (
                            <div className="text-sm text-gray-900">{item.item_title}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing && canEditAllFields ? (
                            <select
                              className="w-full border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.target_mode || 'cumulative'}
                              onChange={e => handleDraftUpdate('target_mode', e.target.value)}
                            >
                              <option value="cumulative">Cộng dồn</option>
                              <option value="fixed">Cố định</option>
                            </select>
                          ) : (
                            <div className="text-sm text-gray-500 capitalize">{item.target_mode === 'fixed' ? 'Cố định' : 'Cộng dồn'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing && canEditAllFields ? (
                            <select
                              className="w-full border border-gray-300 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.direction}
                              onChange={e => handleDraftUpdate('direction', e.target.value)}
                            >
                              <option value="higher_better">Càng cao càng tốt</option>
                              <option value="lower_better">Càng thấp càng tốt</option>
                            </select>
                          ) : (
                            <div className="text-sm text-gray-500">{item.direction === 'higher_better' ? 'Càng cao càng tốt' : 'Càng thấp càng tốt'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isEditing && canEditAllFields ? (
                            <div className="flex items-center">
                              <input
                                type="number"
                                className="w-16 border border-gray-300 rounded p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                                value={draft.sub_weight}
                                onChange={e => handleDraftUpdate('sub_weight', Number(e.target.value))}
                              />
                              <span className="ml-1">%</span>
                            </div>
                          ) : (
                            <span>{item.sub_weight}%</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isEditing && canEditAllFields ? (
                            <input
                              type="number"
                              className="w-20 border border-gray-300 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.target || 0}
                              onChange={e => handleDraftUpdate('target', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.target}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isEditing && (canEditAllFields || canEditLimitedFields) ? (
                            <input
                              type="number"
                              className="w-20 border border-gray-300 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.actual || 0}
                              onChange={e => handleDraftUpdate('actual', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.actual}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isEditing && (canEditAllFields || canEditLimitedFields) ? (
                            <input
                              type="number"
                              step="0.05"
                              max="1"
                              min="0"
                              className="w-20 border border-gray-300 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.manual_progress || 0}
                              onChange={e => handleDraftUpdate('manual_progress', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.manual_progress}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                          {item.score.weightedScore.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isEditing && (canEditAllFields || canEditLimitedFields) ? (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded p-1 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                              value={draft.note || ''}
                              onChange={e => handleDraftUpdate('note', e.target.value)}
                              placeholder="Ghi chú..."
                            />
                          ) : (
                            <span className="truncate max-w-xs block" title={item.note || ''}>{item.note}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          {isEditing ? (
                            <div className="flex flex-col gap-2 opacity-100">
                              <button
                                type="button"
                                disabled={itemSubmitting}
                                onClick={handleSaveItemEdit}
                                className="text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                disabled={itemSubmitting}
                                onClick={handleCancelEditItem}
                                className="text-gray-700 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {canEditItem && (
                                <button
                                  type="button"
                                  onClick={() => handleEditItemMode(item)}
                                  disabled={!!editingItemId}
                                  className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  Chỉnh sửa
                                </button>
                              )}
                              {canDeleteItem && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={isSubmitting || !!editingItemId}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {itemsWithScore.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <p className="font-medium text-gray-900">Chưa có hạng mục KPI nào. Thêm hạng mục bên dưới.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex justify-between items-center">
             <div className="text-lg text-indigo-800 font-semibold">Điểm hoàn thành KPI</div>
             <div className="text-3xl font-bold text-indigo-700">{kpiCompletionScore.toFixed(2)}</div>
          </div>

          {canAddItem && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Thêm Hạng mục KPI</h3>
              
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sản phẩm</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={newItem.product_id}
                      onChange={e => setNewItem({...newItem, product_id: e.target.value})}
                    >
                      <option value="">Chọn sản phẩm...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                    </select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tên hạng mục</label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.item_title}
                      onChange={e => setNewItem({...newItem, item_title: e.target.value})}
                      placeholder="Ví dụ: Kênh đại lý A"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Trọng số con (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.sub_weight}
                      onChange={e => setNewItem({...newItem, sub_weight: Number(e.target.value)})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mục tiêu</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.target}
                      onChange={e => setNewItem({...newItem, target: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hiện tại</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.actual}
                      onChange={e => setNewItem({...newItem, actual: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tiến độ tay (0-1)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.manual_progress}
                      onChange={e => setNewItem({...newItem, manual_progress: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Chế độ mục tiêu</label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.target_mode}
                      onChange={e => setNewItem({...newItem, target_mode: e.target.value})}
                    >
                      <option value="cumulative">Cộng dồn</option>
                      <option value="fixed">Cố định</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hướng thiết lập</label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.direction}
                      onChange={e => setNewItem({...newItem, direction: e.target.value})}
                    >
                      <option value="higher_better">Càng cao càng tốt</option>
                      <option value="lower_better">Càng thấp càng tốt</option>
                    </select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
                    <input
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.note}
                      onChange={e => setNewItem({...newItem, note: e.target.value})}
                      placeholder="Ghi chú thêm"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <AppSubmitButton
                    label="Thêm hạng mục"
                    loadingLabel="Đang lưu..."
                    isLoading={isSubmitting}
                    onClick={handleAddKpiItem}
                    type="button"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        !loading && !fetchError && <div className="p-8 text-center text-gray-500">Không tìm thấy KPI.</div>
      )}
    </div>
  );
}
