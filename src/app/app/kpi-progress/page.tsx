"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getMyWorkspaceAndRole } from "../../../lib/dataAccess";

export default function KpiProgressPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [kpis, setKpis] = useState<any[]>([]);
  const [kpiItems, setKpiItems] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id || null;
        setCurrentUserId(userId);

        const { workspaceId, roleCode } = await getMyWorkspaceAndRole();
        setWorkspaceId(workspaceId);
        setRoleCode(roleCode);

        const { data: kpisData } = await supabase
          .from("kpis")
          .select("*")
          .eq("workspace_id", workspaceId);

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

        const profiles = profilesData || [];

        const now = new Date();
        const currentDay = now.getDate();
        const totalDays = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();

        // SAFE COMPUTE
        const safeItems = itemsData || [];

        const rowsTemp: any[] = [];

        safeItems.forEach((item: any) => {
          try {
            const kpi = safeKpis.find((k: any) => k.id === item.kpi_id);

            if (!kpi) return;

            const owner = profiles.find((p: any) => p.user_id === kpi.owner_id);
            const ownerName = owner?.full_name || "Unknown";

            const target = item.target ?? null;
            const actual = item.actual ?? null;
            const subWeight = item.sub_weight ?? 0;

            let targetToDate = null;
            if (target !== null) {
              if (item.target_mode === "fixed") {
                targetToDate = target;
              } else {
                targetToDate = target * (currentDay / totalDays);
              }
            }

            let rawRatio = null;
            if (targetToDate && targetToDate > 0 && actual !== null) {
              rawRatio = actual / targetToDate;
            }

            let normalizedRatio = null;
            if (rawRatio !== null) {
              if (rawRatio < 0.8) normalizedRatio = 0.8;
              else if (rawRatio > 1.2) normalizedRatio = 1.2;
              else normalizedRatio = rawRatio;
            }

            let scoreItem = null;
            if (normalizedRatio !== null) {
              scoreItem = normalizedRatio * subWeight;
            }

            rowsTemp.push({
              ownerId: kpi.owner_id,
              ownerName,
              kpiId: kpi.id,
              kpiTitle: kpi.title,
              itemId: item.id,
              itemTitle: item.item_title,
              target,
              targetToDate,
              actual,
              subWeight,
              rawRatio,
              normalizedRatio,
              scoreItem
            });

          } catch (err) {
            console.error("ROW COMPUTE ERROR", err);
          }
        });

        setRows(rowsTemp);

      } catch (err: any) {
        console.error(err);
        setLastError(err?.message || "Load failed");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const permittedRows = useMemo(() => {
    return rows.filter(r => {
      if (roleCode === "admin" || roleCode === "lead") return true;
      return r.ownerId === currentUserId;
    });
  }, [rows, roleCode, currentUserId]);

  const totalItems = permittedRows.length;
  const criticalCount = permittedRows.filter(r => r.rawRatio !== null && r.rawRatio < 0.8).length;
  const warningCount = permittedRows.filter(r => r.rawRatio !== null && r.rawRatio >= 0.8 && r.rawRatio < 1).length;
  const healthyCount = permittedRows.filter(r => r.rawRatio !== null && r.rawRatio >= 1).length;

  const uniqueOwners = Array.from(new Set(permittedRows.map(r => r.ownerName)));

  const filteredRows = permittedRows.filter(r => {
    if (ownerFilter === "all") return true;
    return r.ownerName === ownerFilter;
  });

  const groupedData = useMemo(() => {
    const ownerMap: Record<string, any> = {};

    filteredRows.forEach(row => {
      const oId = row.ownerId || "unknown";
      if (!ownerMap[oId]) {
         ownerMap[oId] = {
           ownerId: oId,
           ownerName: row.ownerName,
           kpis: {}
         }
      }
      
      const ownerObj = ownerMap[oId];
      if (!ownerObj.kpis[row.kpiId]) {
         ownerObj.kpis[row.kpiId] = {
           kpiId: row.kpiId,
           kpiTitle: row.kpiTitle,
           items: []
         }
      }

      ownerObj.kpis[row.kpiId].items.push(row);
    });

    const result = Object.values(ownerMap).map((o: any) => {
       const kpisArray = Object.values(o.kpis).map((k: any) => {
          let totalSubWeight = 0;
          let totalKpiScoreRaw = 0;

          k.items.forEach((item: any) => {
             if (item.subWeight !== null && item.subWeight !== undefined) {
               totalSubWeight += item.subWeight;
             }
             if (item.scoreItem !== null && item.scoreItem !== undefined) {
                totalKpiScoreRaw += item.scoreItem;
             }
          });

          let totalKpiScoreNormalized = null;
          if (totalSubWeight > 0) {
             totalKpiScoreNormalized = (totalKpiScoreRaw / totalSubWeight) * 100;
          }

          k.items.sort((a: any, b: any) => {
             if (a.rawRatio === null) return 1;
             if (b.rawRatio === null) return -1;
             return a.rawRatio - b.rawRatio;
          });

          return {
            ...k,
            totalSubWeight,
            totalKpiScoreRaw,
            totalKpiScoreNormalized
          }
       });

       kpisArray.sort((a: any, b: any) => a.kpiTitle.localeCompare(b.kpiTitle));

       return {
         ...o,
         kpis: kpisArray
       }
    });

    result.sort((a: any, b: any) => a.ownerName.localeCompare(b.ownerName));

    return result;
  }, [filteredRows]);

  const visibleOwnersCount = groupedData.length;
  const visibleKpisCount = groupedData.reduce((acc, owner) => acc + owner.kpis.length, 0);

  if (isLoading) {
    return <div className="p-6">Loading KPI Progress...</div>;
  }

  if (lastError) {
    return (
      <div className="p-6 text-red-500">
        ERROR: {lastError}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">KPI Progress</h1>

      <div className="mt-4 space-y-1 text-sm font-mono bg-gray-100 p-4 rounded">
        <div>workspaceId: {workspaceId}</div>
        <div>roleCode: {roleCode}</div>
        <div>currentUserId: {currentUserId}</div>
        <div>kpisCount: {kpis.length}</div>
        <div>kpiItemsCount: {kpiItems.length}</div>
        <div>rowsCount: {rows.length}</div>
        <div>visibleOwnersCount: {visibleOwnersCount}</div>
        <div>visibleKpisCount: {visibleKpisCount}</div>
        {lastError && <div className="text-red-500">lastError: {lastError}</div>}
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="p-4 border bg-white rounded shadow-sm">Total: {totalItems}</div>
        <div className="p-4 border bg-red-100 rounded shadow-sm">Critical: {criticalCount}</div>
        <div className="p-4 border bg-yellow-100 rounded shadow-sm">Warning: {warningCount}</div>
        <div className="p-4 border bg-green-100 rounded shadow-sm">Healthy: {healthyCount}</div>
      </div>

      <div className="mt-4">
        <select
          className="border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="all">All Owners</option>
          {uniqueOwners.map(o => (
            <option key={o as string} value={o as string}>{o as string}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-auto max-h-[600px] border border-gray-300 rounded">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm border-b border-gray-300">
            <tr>
              <th className="border-r border-gray-300 p-2 text-left">Item</th>
              <th className="border-r border-gray-300 p-2 text-left">Target</th>
              <th className="border-r border-gray-300 p-2 text-left">Target To Date</th>
              <th className="border-r border-gray-300 p-2 text-left">Actual</th>
              <th className="border-r border-gray-300 p-2 text-left">Subweight</th>
              <th className="border-r border-gray-300 p-2 text-left">Raw %</th>
              <th className="p-2 text-left">Score</th>
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center p-4">No data</td>
              </tr>
            )}
            {groupedData.map((owner: any) => (
              <React.Fragment key={owner.ownerId}>
                <tr className="bg-gray-300 border-b border-gray-400">
                  <td colSpan={7} className="p-3 font-bold uppercase text-gray-800 tracking-wider">
                    Owner: {owner.ownerName}
                  </td>
                </tr>
                {owner.kpis.map((kpi: any) => (
                  <React.Fragment key={kpi.kpiId}>
                    <tr className="bg-gray-200 border-b border-gray-300">
                      <td colSpan={7} className="p-2 pl-4">
                        <span className="font-semibold text-indigo-700 uppercase mr-4">KPI: {kpi.kpiTitle}</span>
                        <span className="font-mono text-xs text-gray-600 mr-2">Total Subweight: {kpi.totalSubWeight}%</span>
                        {kpi.totalSubWeight < 100 && (
                          <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded mr-2 border border-yellow-200">Subweight total below 100%</span>
                        )}
                        {kpi.totalSubWeight > 100 && (
                          <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded mr-2 border border-red-200">Subweight total exceeds 100%</span>
                        )}
                        <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                           Score: {kpi.totalKpiScoreNormalized !== null ? kpi.totalKpiScoreNormalized.toFixed(2) + "%" : "-"}
                        </span>
                      </td>
                    </tr>
                    {kpi.items.map((row: any) => {
                      let rowColor = "";
                      if (row.rawRatio !== null) {
                        if (row.rawRatio < 0.8) rowColor = "bg-red-50";
                        else if (row.rawRatio < 1) rowColor = "bg-yellow-50";
                        else rowColor = "bg-green-50";
                      }
                      return (
                        <tr key={row.itemId} className={`${rowColor} border-b border-gray-200 hover:bg-gray-100 transition-colors`}>
                          <td className="border-r border-gray-200 p-2 pl-6 font-medium text-gray-800">{row.itemTitle}</td>
                          <td className="border-r border-gray-200 p-2">{row.target ?? "-"}</td>
                          <td className="border-r border-gray-200 p-2">{row.targetToDate !== null ? row.targetToDate.toFixed(0) : "-"}</td>
                          <td className="border-r border-gray-200 p-2">{row.actual ?? "-"}</td>
                          <td className="border-r border-gray-200 p-2">{row.subWeight}%</td>
                          <td className="border-r border-gray-200 p-2 font-medium">{row.rawRatio !== null ? (row.rawRatio * 100).toFixed(1) + "%" : "-"}</td>
                          <td className="p-2 font-medium text-gray-700">{row.scoreItem !== null ? row.scoreItem.toFixed(2) : "-"}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
