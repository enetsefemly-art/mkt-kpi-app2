"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { shouldApplyUuidFilter } from "../../../lib/uuid";
import { getCurrentWorkspaceId } from "../../../lib/dataAccess";

// Define a clamp function
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const getCurrentMonthKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

export default function KpiProgressPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [kpis, setKpis] = useState<any[]>([]);
  const [kpiItems, setKpiItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Debug states
  const [debugOwnersCount, setDebugOwnersCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id || null;
        setCurrentUserId(userId);
        
        let wsId = '';
        let rc = 'viewer';
        if (userId) {
          const { data: myProfile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
          rc = myProfile?.role || 'viewer';
          wsId = await getCurrentWorkspaceId(myProfile, null) || '';
        }

        setWorkspaceId(wsId);
        setRoleCode(rc);

        // Fetch KPIs for the specific month
        const { data: kpisData } = await supabase
          .from("kpis")
          .select("*")
          .match(shouldApplyUuidFilter(wsId) ? { workspace_id: wsId } : {})
          .eq("month_key", monthKey);

        const safeKpis = kpisData || [];
        setKpis(safeKpis);

        const kpiIds = safeKpis.map((k: any) => k.id);

        let itemsData: any[] = [];
        if (kpiIds.length > 0) {
          const { data } = await supabase
            .from("kpi_items")
            .select("*")
            .in("kpi_id", kpiIds);
          
          itemsData = data || [];
          setKpiItems(itemsData);
        } else {
          setKpiItems([]);
        }

        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, function");

        setProfiles(profilesData || []);

      } catch (err: any) {
        console.error(err);
        setLastError(err?.message || "Load failed");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [monthKey]);

  // Compute Data Structure
  const groupedData = useMemo(() => {
    const isAdminOrLead = roleCode === "admin" || roleCode === "lead";

    // 1. Filter KPIs based on permissions
    const permittedKpis = kpis.filter(k => {
      if (isAdminOrLead) return true;
      return k.owner_id === currentUserId; // member or viewer sees only their own
    });

    const now = new Date();
    const currentDay = now.getDate();
    // Approximate remaining days or use real month days
    const [yStr, mStr] = monthKey.split('-');
    const totalDays = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();

    // owner -> kpis -> items
    const ownerMap: Record<string, any> = {};

    permittedKpis.forEach(kpi => {
      // Find owner profile
      const ownerProfile = profiles.find(p => p.user_id === kpi.owner_id);
      const ownerName = ownerProfile?.full_name || "Unknown";

      if (!ownerMap[kpi.owner_id]) {
        ownerMap[kpi.owner_id] = {
          ownerId: kpi.owner_id,
          ownerName: ownerName,
          totalPersonScore: 0,
          kpis: []
        };
      }

      const kpiItemsForThis = kpiItems.filter(item => item.kpi_id === kpi.id);
      
      let kpiCompletionScore = 0;
      let totalSubWeight = 0;
      let sumActual = 0;
      let sumTargetToDate = 0;

      const processedItems = kpiItemsForThis.map(item => {
        const target = item.target ?? null;
        const actual = item.actual ?? null;
        const subWeight = item.sub_weight ?? 0;
        totalSubWeight += subWeight;

        let targetToDate = null;
        if (target !== null) {
          if (item.target_mode === "fixed") {
            targetToDate = target;
          } else {
            // Safe currentDay, if they look at past month, it might be 100% implicitly, but let's just use currentDay / totalDays unless month is past
            // If monthKey is not current month, we probably should handle it differently. But for now, user didn't specify, so let's just do (currentDay / totalDays) or 1?
            // Actually, we can check if monthKey < currentMonth, then ratio=1
            const currentMonthKey = getCurrentMonthKey();
            if (monthKey < currentMonthKey) {
                targetToDate = target;
            } else if (monthKey > currentMonthKey) {
                targetToDate = 0;
            } else {
                targetToDate = target * (currentDay / totalDays);
            }
          }
        }

        let rawRatio = null;
        if (targetToDate && targetToDate > 0 && actual !== null) {
          rawRatio = actual / targetToDate;
        } else if ((!targetToDate || targetToDate === 0) && actual && actual > 0) {
            // if targetToDate is 0 but actual is > 0, ratio is essentially > 120% ? Let's use 1.2
            rawRatio = 1.2;
        }

        let normalizedRatio = null;
        if (rawRatio !== null) {
          normalizedRatio = clamp(rawRatio, 0.8, 1.2);
        }

        if (actual !== null) sumActual += actual;
        if (targetToDate !== null) sumTargetToDate += targetToDate;

        return {
          itemTitle: item.item_title,
          target,
          targetToDate,
          actual,
          subWeight,
          rawRatio,
          normalizedRatio,
          scoreItem: normalizedRatio // As per new spec
        };
      });

      const kpiScoreMethod = kpi.kpi_score_method || "weighted_item_score";

      if (kpiScoreMethod === "aggregate_ratio") {
        let kpiRawRatio = 0;
        if (sumTargetToDate > 0) {
          kpiRawRatio = sumActual / sumTargetToDate;
        } else if (sumActual > 0) {
          kpiRawRatio = 1.2;
        }
        const kpiNormalizedRatio = clamp(kpiRawRatio, 0.8, 1.2);
        kpiCompletionScore = kpiNormalizedRatio * 100;
      } else {
        // weighted_item_score
        let sumWeightedItems = 0;
        processedItems.forEach(pi => {
          if (pi.normalizedRatio !== null) {
            sumWeightedItems += (pi.normalizedRatio * pi.subWeight);
          }
        });
        kpiCompletionScore = sumWeightedItems;
      }

      const kpiWeight = kpi.weight ?? 0;
      const weightedKpiScore = (kpiCompletionScore / 100) * kpiWeight;

      ownerMap[kpi.owner_id].kpis.push({
        kpiId: kpi.id,
        kpiTitle: kpi.title,
        monthKey: kpi.month_key,
        kpiScoreMethod,
        kpiCompletionScore,
        kpiWeight,
        weightedKpiScore,
        totalSubWeight,
        items: processedItems
      });

      ownerMap[kpi.owner_id].totalPersonScore += weightedKpiScore;
    });

    const ownersArray = Object.values(ownerMap);
    ownersArray.sort((a,b) => a.ownerName.localeCompare(b.ownerName));
    return ownersArray;
  }, [kpis, kpiItems, profiles, currentUserId, roleCode, monthKey]);

  // Derive counts and filters
  useEffect(() => {
    setDebugOwnersCount(groupedData.length);
  }, [groupedData]);

  const uniqueOwners = Array.from(new Set(groupedData.map(o => o.ownerName)));

  // For summary cards, we count across all *items* belonging to *permitted* KPIs
  const allPermittedItems = groupedData.flatMap(o => o.kpis.flatMap((k: any) => k.items));
  const totalItems = allPermittedItems.length;
  const criticalCount = allPermittedItems.filter(i => i.rawRatio !== null && i.rawRatio < 0.8).length;
  const warningCount = allPermittedItems.filter(i => i.rawRatio !== null && i.rawRatio >= 0.8 && i.rawRatio < 1).length;
  const healthyCount = allPermittedItems.filter(i => i.rawRatio !== null && i.rawRatio >= 1).length;

  const displayData = useMemo(() => {
    if (ownerFilter === "all") return groupedData;
    return groupedData.filter(o => o.ownerName === ownerFilter);
  }, [groupedData, ownerFilter]);

  if (isLoading) {
    return <div className="p-6">Loading KPI Progress...</div>;
  }

  return (
    <div className="p-6 pb-20">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Tiến độ KPI</h1>

      {/* FILTERS */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tháng</label>
          <input 
            type="month" 
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="border border-gray-300 rounded p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Người phụ trách</label>
          <select
            className="border border-gray-300 rounded p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="all">Tất cả</option>
            {uniqueOwners.map(o => (
              <option key={o as string} value={o as string}>{o as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tổng số Hạng mục</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-2">Nghiêm trọng (&lt;80%)</p>
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-100 flex flex-col justify-between">
          <p className="text-xs font-medium text-yellow-600 uppercase tracking-wider mb-2">Cảnh báo (80-100%)</p>
          <p className="text-2xl font-bold text-yellow-700">{warningCount}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-100 flex flex-col justify-between">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-2">An toàn (&ge;100%)</p>
          <p className="text-2xl font-bold text-green-700">{healthyCount}</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-auto max-h-[70vh]">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm border-b border-gray-300">
            <tr>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700">Tên Hạng mục</th>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700 w-24">Mục tiêu</th>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700 w-24 text-right">Mục tiêu đến hiện tại</th>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700 w-24 text-right">Đạt được</th>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700 w-24 text-right">Tỷ trọng (%)</th>
              <th className="p-3 border-r border-gray-300 font-semibold text-gray-700 w-24 text-right">Tỷ lệ thô (%)</th>
              <th className="p-3 font-semibold text-gray-700 w-24 text-right">Điểm hệ số</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 italic">Không tìm thấy dữ liệu</td>
              </tr>
            ) : (
              displayData.map((owner) => (
                <React.Fragment key={owner.ownerId}>
                  {/* Owner Row */}
                  <tr className="bg-gray-800 text-white">
                    <td colSpan={5} className="p-3 font-bold uppercase tracking-wider">
                      Người phụ trách: {owner.ownerName}
                    </td>
                    <td colSpan={2} className="p-3 font-bold text-right text-green-300">
                      Tổng điểm KPI cá nhân: {owner.totalPersonScore.toFixed(2)}
                    </td>
                  </tr>

                  {owner.kpis.map((kpi: any) => (
                    <React.Fragment key={kpi.kpiId}>
                      {/* KPI ROW */}
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        <td colSpan={7} className="p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-indigo-900 border-r border-indigo-200 pr-4">{kpi.kpiTitle}</span>
                              <span className="text-xs font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{kpi.monthKey}</span>
                              {kpi.kpiScoreMethod === 'aggregate_ratio' ? (
                                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded">Tổng Tỷ lệ</span>
                              ) : (
                                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Trung bình trọng số</span>
                              )}
                              {kpi.totalSubWeight !== 100 && (
                                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                                  Cảnh báo: Tổng Tỷ trọng đang là {kpi.totalSubWeight}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium">
                              <div className="flex flex-col text-right">
                                <span className="text-gray-500">Tỷ trọng KPI</span>
                                <span className="text-gray-800">{kpi.kpiWeight}%</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-gray-500">Điểm Thành phần</span>
                                <span className="text-gray-800 font-bold">{kpi.kpiCompletionScore.toFixed(2)}</span>
                              </div>
                              <div className="flex flex-col text-right bg-indigo-100 px-3 py-1 rounded">
                                <span className="text-indigo-600 uppercase" style={{ fontSize: '10px' }}>Điểm Trọng số</span>
                                <span className="text-indigo-900 font-bold text-sm">{kpi.weightedKpiScore.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ITEM ROWS */}
                      {kpi.items.map((item: any, idx: number) => {
                        let bgClass = "bg-white hover:bg-gray-50";
                        if (item.rawRatio !== null) {
                          if (item.rawRatio < 0.8) bgClass = "bg-red-50 hover:bg-red-100";
                          else if (item.rawRatio < 1) bgClass = "bg-yellow-50 hover:bg-yellow-100";
                          else bgClass = "bg-green-50 hover:bg-green-100";
                        }

                        return (
                          <tr key={idx} className={`border-b border-gray-200 transition-colors ${bgClass}`}>
                            <td className="p-3 border-r border-gray-200 pl-8 font-medium text-gray-800">
                              {item.itemTitle}
                            </td>
                            <td className="p-3 border-r border-gray-200">
                              {item.target ?? "-"}
                            </td>
                            <td className="p-3 border-r border-gray-200 text-right">
                              {item.targetToDate !== null ? item.targetToDate.toFixed(1) : "-"}
                            </td>
                            <td className="p-3 border-r border-gray-200 text-right font-medium">
                              {item.actual ?? "-"}
                            </td>
                            <td className="p-3 border-r border-gray-200 text-right text-gray-500">
                              {item.subWeight}%
                            </td>
                            <td className="p-3 border-r border-gray-200 text-right font-bold">
                              {item.rawRatio !== null ? (item.rawRatio * 100).toFixed(1) + "%" : "-"}
                            </td>
                            <td className="p-3 text-right font-semibold text-indigo-600">
                              {item.scoreItem !== null ? item.scoreItem.toFixed(2) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
