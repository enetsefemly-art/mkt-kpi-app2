"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMyWorkspaceAndRole, listProducts, getKpiDetail } from '../../../../lib/dataAccess';
import { calcItemScore } from '../../../../lib/kpiMath';
import { validateSubWeightTotal } from '../../../../lib/kpiProgress';
import { supabase } from '../../../../lib/supabaseClient';
import { logActivity } from '../../../../lib/activityLogger';
import { deleteEntity } from '../../../../lib/deleteActions';
import AppSubmitButton from '../../../../components/app-state/AppSubmitButton';
import { validateKpiItemForm } from '../../../../lib/validation';
import { formatError } from '../../../../lib/errorUtils';

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
}

interface Profile {
  user_id: string;
  full_name: string;
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
  
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

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

      const detail = await getKpiDetail(kpiId!);
      setKpi(detail.kpi);
      setItems(detail.items);
      setOwnerProfile(detail.ownerProfile);
      
      const kpiWorkspaceId = detail.kpi.workspace_id;
      setWorkspaceId(kpiWorkspaceId);

      // Fetch role specifically for this KPI's workspace
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role_code')
        .eq('user_id', session.user.id)
        .eq('workspace_id', kpiWorkspaceId)
        .maybeSingle();
        
      const fetchedRole = roleData?.role_code || null;
      setRoleCode(fetchedRole);

      const productsData = await listProducts(kpiWorkspaceId);
      setProducts(productsData);
      
      const fullProductsMap = new Map(productsData.map((p: any) => [p.id, p]));
      detail.productsMap.forEach((val, key) => fullProductsMap.set(key, val));
      setProductsMap(fullProductsMap);

    } catch (err: any) {
      console.error('Error loading KPI detail:', err);
      setFetchError(formatError(err, 'Failed to load KPI'));
    } finally {
      setLoading(false);
    }
  };

  const kpiOwnerId = kpi?.owner_id ?? null;
  const isOwner = currentUserId !== null && currentUserId === kpiOwnerId;
  const normalizedRole = (roleCode || '').trim().toLowerCase();
  const canManageAll = ['admin', 'lead', 'workspace_admin', 'owner'].includes(normalizedRole);
  const canAddItem = canManageAll;
  const canEditAllFields = canManageAll;
  const canEditLimitedFields = !canManageAll && isOwner;
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
        product_id: newItem.product_id,
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
      setLastError(formatError(err, 'Failed to add item'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    setUpdateError(null);
    try {
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      ));
    } catch (err: any) {
      console.error('Error updating item locally:', err);
    }
  };

  const saveItemUpdate = async (itemId: string, field: string, value: any) => {
    console.log("save item update", itemId, field, value);
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUpdateError(null);
    try {
      const currentItem = items.find(i => i.id === itemId);
      if (!currentItem) throw new Error("Item not found");

      const updatedItemData = {
        ...currentItem,
        [field]: value
      };

      const validation = validateKpiItemForm(updatedItemData, kpi?.kpi_type || 'revenue');
      if (!validation.valid) {
        setUpdateError(validation.errors.join(", "));
        loadData(); // Revert local state
        return;
      }

      let updatePayload: any = { kpi_id: currentItem.kpi_id };

      if (canEditAllFields) {
        updatePayload = {
          ...updatePayload,
          product_id: field === 'product_id' ? value : currentItem.product_id,
          item_title: field === 'item_title' ? value : currentItem.item_title,
          sub_weight: field === 'sub_weight' ? value : currentItem.sub_weight,
          target: field === 'target' ? value : currentItem.target,
          actual: field === 'actual' ? value : currentItem.actual,
          manual_progress: field === 'manual_progress' ? value : currentItem.manual_progress,
          direction: field === 'direction' ? value : currentItem.direction,
          target_mode: field === 'target_mode' ? value : currentItem.target_mode,
          note: field === 'note' ? value : currentItem.note
        };
      } else if (canEditLimitedFields) {
        if (['actual', 'manual_progress', 'note'].includes(field)) {
          updatePayload = {
            ...updatePayload,
            actual: field === 'actual' ? value : currentItem.actual,
            manual_progress: field === 'manual_progress' ? value : currentItem.manual_progress,
            note: field === 'note' ? value : currentItem.note
          };
        } else {
          throw new Error("You do not have permission to edit this KPI item field.");
        }
      } else {
         throw new Error("You do not have permission to edit this KPI item.");
      }

      const beforeItem = { ...currentItem };

      const { data: updatedItem, error } = await supabase
        .from('kpi_items')
        .update(updatePayload)
        .eq('id', itemId)
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
            before: beforeItem,
            after: updatedItem
          }
        });
      }
      
      loadData();
    } catch (err: any) {
      console.error('Error updating item:', err);
      setUpdateError(formatError(err, 'Update failed'));
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!workspaceId) return;
    if (!window.confirm("Are you sure you want to delete this KPI Item?")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setUpdateError(null);
    try {
      await deleteEntity('kpi_items', itemId, workspaceId, "KPI Item");
      loadData();
    } catch (err: any) {
      console.error('Error deleting item:', err);
      setUpdateError(formatError(err, 'Failed to delete item'));
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

  const totalWeightedScore = itemsWithScore.reduce((sum, item) => sum + item.score.weightedScore, 0);
  const subWeightValidation = validateSubWeightTotal(items);

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-gray-800 text-green-400 p-4 rounded-md font-mono text-xs mb-4 overflow-x-auto">
        <div className="font-bold border-b border-gray-700 mb-2 pb-1">DEBUG PANEL</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>currentUserId: <span className="text-white">{currentUserId}</span></div>
          <div>roleCode: <span className="text-white">{roleCode}</span></div>
          <div>routeKpiId: <span className="text-white">{kpiId}</span></div>
          <div>loadedKpiId: <span className="text-white">{kpi?.id}</span></div>
          <div>kpiOwnerId: <span className="text-white">{kpiOwnerId}</span></div>
          <div>isOwner: <span className={isOwner ? "text-green-300 font-bold" : "text-gray-400"}>{String(isOwner)}</span></div>
          <div>canManageAll: <span className={canManageAll ? "text-green-300 font-bold" : "text-gray-400"}>{String(canManageAll)}</span></div>
          <div>canAddItem: <span className={canAddItem ? "text-green-300 font-bold" : "text-gray-400"}>{String(canAddItem)}</span></div>
          <div>canEditAllFields: <span className={canEditAllFields ? "text-green-300 font-bold" : "text-gray-400"}>{String(canEditAllFields)}</span></div>
          <div>canEditLimitedFields: <span className={canEditLimitedFields ? "text-green-300 font-bold" : "text-gray-400"}>{String(canEditLimitedFields)}</span></div>
          <div>canEditItem: <span className={canEditItem ? "text-green-300 font-bold" : "text-gray-400"}>{String(canEditItem)}</span></div>
          <div>itemsCount: <span className="text-white">{items.length}</span></div>
          <div>subWeightTotal: <span className="text-white">{subWeightValidation.total}</span></div>
          <div className="col-span-2">subWeightMessage: <span className="text-white">{subWeightValidation.message || "null"}</span></div>
          {fetchError && <div className="col-span-2 text-red-400">fetchError: {fetchError}</div>}
          {updateError && <div className="col-span-2 text-red-400 font-bold bg-red-900/20 p-1 rounded">updateError: {updateError}</div>}
          {lastError && <div className="col-span-2 text-red-400 font-bold bg-red-900/20 p-1 rounded">lastError: {lastError}</div>}
        </div>
      </div>

      <button onClick={() => navigate('/app/kpis')} className="text-indigo-600 hover:underline flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to KPIs
      </button>

      {fetchError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center">
          <h2 className="text-lg font-bold mb-2">KPI not found or no permission</h2>
          <p>{fetchError}</p>
        </div>
      ) : kpi ? (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{kpi.title}</h1>
                  {canEditAllFields ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Full access</span>
                  ) : canEditLimitedFields ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Owner limited edit</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Read only</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Owner:</span>
                    <span className="text-gray-900">{ownerProfile?.full_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Type:</span>
                    <span className="capitalize bg-gray-100 px-2 py-0.5 rounded text-gray-800">{kpi.kpi_type}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Weight:</span>
                    <span className="text-gray-900">{kpi.weight}%</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Unit:</span>
                    <span className="text-gray-900">{kpi.unit}</span>
                  </div>
                </div>
                {kpi.description && (
                  <div className="mt-4 text-sm text-gray-700">
                    <span className="font-medium">Description:</span> {kpi.description}
                  </div>
                )}
                {subWeightValidation.message && (
                  <div className={`mt-4 text-sm p-3 rounded-md border ${subWeightValidation.isOver ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <span className="font-medium">Warning:</span> {subWeightValidation.message}
                  </div>
                )}
                {subWeightValidation.isExact && (
                  <div className="mt-4 text-sm p-3 rounded-md border bg-green-50 text-green-700 border-green-200">
                    Subweight total = 100%
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">KPI Items List</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Mode</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Sub Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Actual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Manual Prog.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                    {normalizedRole === 'admin' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemsWithScore.map((item) => {
                    const product = productsMap.get(item.product_id);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          {canEditAllFields ? (
                            <select
                              className="w-full border border-gray-200 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.product_id}
                              onChange={e => saveItemUpdate(item.id, 'product_id', e.target.value)}
                            >
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          ) : (
                            <div className="text-sm font-bold text-gray-900">{product?.name || 'Unknown Product'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {canEditAllFields ? (
                            <input 
                              className="text-sm text-gray-900 border border-gray-200 rounded p-1 w-full focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.item_title}
                              onChange={e => handleUpdateItem(item.id, 'item_title', e.target.value)}
                              onBlur={e => saveItemUpdate(item.id, 'item_title', e.target.value)}
                            />
                          ) : (
                            <div className="text-sm text-gray-900">{item.item_title}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {canEditAllFields ? (
                            <select
                              className="w-full border border-gray-200 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.target_mode || 'cumulative'}
                              onChange={e => saveItemUpdate(item.id, 'target_mode', e.target.value)}
                            >
                              <option value="cumulative">Cumulative</option>
                              <option value="fixed">Fixed</option>
                            </select>
                          ) : (
                            <div className="text-sm text-gray-500 capitalize">{item.target_mode || 'cumulative'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {canEditAllFields ? (
                            <select
                              className="w-full border border-gray-200 rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.direction}
                              onChange={e => saveItemUpdate(item.id, 'direction', e.target.value)}
                            >
                              <option value="higher_better">Higher Better</option>
                              <option value="lower_better">Lower Better</option>
                            </select>
                          ) : (
                            <div className="text-sm text-gray-500">{item.direction === 'higher_better' ? 'Higher Better' : 'Lower Better'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {canEditAllFields ? (
                            <div className="flex items-center">
                              <input
                                type="number"
                                className="w-16 border border-gray-200 rounded p-1 text-center focus:ring-indigo-500 focus:border-indigo-500"
                                value={item.sub_weight}
                                onChange={e => handleUpdateItem(item.id, 'sub_weight', Number(e.target.value))}
                                onBlur={e => saveItemUpdate(item.id, 'sub_weight', Number(e.target.value))}
                              />
                              <span className="ml-1">%</span>
                            </div>
                          ) : (
                            <span>{item.sub_weight}%</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {canEditAllFields ? (
                            <input
                              type="number"
                              className="w-20 border border-gray-200 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.target || 0}
                              onChange={e => handleUpdateItem(item.id, 'target', Number(e.target.value))}
                              onBlur={e => saveItemUpdate(item.id, 'target', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.target}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {canEditAllFields || canEditLimitedFields ? (
                            <input
                              type="number"
                              className="w-20 border border-gray-200 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.actual || 0}
                              onChange={e => handleUpdateItem(item.id, 'actual', Number(e.target.value))}
                              onBlur={e => saveItemUpdate(item.id, 'actual', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.actual}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {canEditAllFields || canEditLimitedFields ? (
                            <input
                              type="number"
                              step="0.05"
                              max="1"
                              min="0"
                              className="w-20 border border-gray-200 rounded p-1 text-right focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.manual_progress || 0}
                              onChange={e => handleUpdateItem(item.id, 'manual_progress', Number(e.target.value))}
                              onBlur={e => saveItemUpdate(item.id, 'manual_progress', Number(e.target.value))}
                            />
                          ) : (
                            <span>{item.manual_progress}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                          {item.score.weightedScore.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {canEditAllFields || canEditLimitedFields ? (
                            <input
                              type="text"
                              className="w-full border border-gray-200 rounded p-1 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                              value={item.note || ''}
                              onChange={e => handleUpdateItem(item.id, 'note', e.target.value)}
                              onBlur={e => saveItemUpdate(item.id, 'note', e.target.value)}
                              placeholder="Add note..."
                            />
                          ) : (
                            <span className="truncate max-w-xs block" title={item.note || ''}>{item.note}</span>
                          )}
                        </td>
                        {normalizedRole === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={isSubmitting}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {itemsWithScore.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <p className="font-medium text-gray-900">No KPI items yet. Add KPI item below.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex justify-between items-center">
             <div className="text-lg text-indigo-800 font-semibold">Total Score</div>
             <div className="text-3xl font-bold text-indigo-700">{totalWeightedScore.toFixed(2)}</div>
          </div>

          {canAddItem && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add KPI Item</h3>
              
              {formErrors.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
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
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <p className="mt-1 text-sm text-red-700">{lastError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={newItem.product_id}
                      onChange={e => setNewItem({...newItem, product_id: e.target.value})}
                    >
                      <option value="">Select Product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                    </select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item Title</label>
                    <input
                      required
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.item_title}
                      onChange={e => setNewItem({...newItem, item_title: e.target.value})}
                      placeholder="e.g. Sales Channel A"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sub Weight (%)</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Target</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.target}
                      onChange={e => setNewItem({...newItem, target: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.actual}
                      onChange={e => setNewItem({...newItem, actual: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Manual Progress (0-1)</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Target Mode</label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.target_mode}
                      onChange={e => setNewItem({...newItem, target_mode: e.target.value})}
                    >
                      <option value="cumulative">Cumulative</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
                    <select
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.direction}
                      onChange={e => setNewItem({...newItem, direction: e.target.value})}
                    >
                      <option value="higher_better">Higher Better</option>
                      <option value="lower_better">Lower Better</option>
                    </select>
                  </div>
                  
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
                    <input
                      className="w-full border border-gray-300 rounded-md p-2 text-sm"
                      value={newItem.note}
                      onChange={e => setNewItem({...newItem, note: e.target.value})}
                      placeholder="Optional note"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <AppSubmitButton
                    label="Add Item"
                    loadingLabel="Saving..."
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
        !loading && !fetchError && <div className="p-8 text-center text-gray-500">KPI not found.</div>
      )}
    </div>
  );
}
