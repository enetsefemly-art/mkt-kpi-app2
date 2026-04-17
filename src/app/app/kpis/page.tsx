import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyWorkspaceAndRole, listKpis, listProducts, listProfilesInWorkspace, createKpi, Profile, Kpi } from '../../../lib/dataAccess';
import { supabase } from '../../../lib/supabaseClient';
import { logActivity } from '../../../lib/activityLogger';
import { deleteEntity } from '../../../lib/deleteActions';
import AppLoadingState from '../../../components/app-state/AppLoadingState';
import AppErrorState from '../../../components/app-state/AppErrorState';
import AppEmptyState from '../../../components/app-state/AppEmptyState';
import AppSubmitButton from '../../../components/app-state/AppSubmitButton';
import { validateKpiForm } from '../../../lib/validation';
import { formatError } from '../../../lib/errorUtils';

export default function KpiListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [allKpis, setAllKpis] = useState<Kpi[]>([]);
  const [displayedKpis, setDisplayedKpis] = useState<Kpi[]>([]);
  
  const [products, setProducts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Form state
  const [showCreate, setShowCreate] = useState(false);
  const [newKpi, setNewKpi] = useState({
    title: '',
    owner_id: '',
    kpi_type: 'revenue',
    unit: '',
    weight: 100,
    period: 'monthly'
  });

  useEffect(() => {
    loadData();
  }, []);

  // Effect to filter KPIs when viewMode, filterProduct, or allKpis changes
  useEffect(() => {
    if (!currentUserId) return;

    let filtered = allKpis;

    // 1. Filter by View Mode
    if (viewMode === 'mine') {
      filtered = filtered.filter(k => k.owner_id === currentUserId);
    }

    if (filterProduct !== 'all') {
      // Placeholder: In a real app, we'd filter here.
    }

    setDisplayedKpis(filtered);
  }, [viewMode, filterProduct, allKpis, currentUserId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Get User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUserId(user.id);

      // 2. Get Workspace & Role
      const wsRole = await getMyWorkspaceAndRole();
      setWorkspaceId(wsRole.workspaceId);
      setRole(wsRole.roleCode);

      // Set default view mode based on role
      if (wsRole.roleCode === 'admin' || wsRole.roleCode === 'lead') {
        setViewMode('all');
      } else {
        setViewMode('mine');
      }

      // 3. Fetch Data
      const [kpisData, productsData, profilesData] = await Promise.all([
        listKpis(wsRole.workspaceId),
        listProducts(wsRole.workspaceId),
        listProfilesInWorkspace(wsRole.workspaceId)
      ]);

      setAllKpis(kpisData);
      setProducts(productsData);
      setProfiles(profilesData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(formatError(err, 'Failed to load KPI data'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKpi = async () => {
    console.log("create KPI clicked");
    if (!workspaceId) return;
    
    if (isSubmitting) return;

    const validation = validateKpiForm(newKpi);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);

    setIsSubmitting(true);
    setError(null);
    setLastError(null);

    try {
      const data = await createKpi({
        ...newKpi,
        workspace_id: workspaceId,
        is_active: true
      });

      console.log("KPI created", data);

      await logActivity({
        workspaceId,
        entityType: "kpi",
        entityId: data.id,
        action: "create",
        detail: {
          title: data.title,
          owner_id: data.owner_id,
          kpi_type: data.kpi_type,
          weight: data.weight
        }
      });

      setShowCreate(false);
      setNewKpi({
        title: '',
        owner_id: '',
        kpi_type: 'revenue',
        unit: '',
        weight: 100,
        period: 'monthly'
      });
      
      await loadData();
      
      // Redirect to detail page
      navigate(`/app/kpis/${data.id}`);
    } catch (err: any) {
      console.error('Error creating KPI:', err);
      setLastError(formatError(err, "Create KPI failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKpi = async (e: React.MouseEvent, kpiId: string) => {
    e.stopPropagation();
    if (!workspaceId || !currentUserId) return;
    
    if (!window.confirm("Are you sure you want to delete this KPI?")) return;
    
    console.log("kpi delete clicked");
    setIsSubmitting(true);
    setLastError(null);
    try {
      await deleteEntity('kpis', kpiId, workspaceId, "KPI");
      await loadData();
    } catch(err: any) {
      console.error('Error deleting KPI:', err);
      setLastError(formatError(err, 'Error deleting KPI'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <AppLoadingState />;

  if (error && !allKpis.length) {
    return <AppErrorState message={error} onRetry={loadData} />;
  }

  const canCreate = role === 'admin' || role === 'lead';
  const myKpisCount = allKpis.filter(k => k.owner_id === currentUserId).length;

  return (
    <div className="space-y-6">
      {/* Debug Panel (Dev Only) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="bg-gray-800 text-green-400 p-4 rounded-md font-mono text-xs mb-4 overflow-x-auto">
          <div>DEBUG INFO:</div>
          <div>User ID: {currentUserId}</div>
          <div>Workspace: {workspaceId}</div>
          <div>Role: {role}</div>
          <div>Total KPIs Fetched: {allKpis.length}</div>
          <div>My KPIs Count: {myKpisCount}</div>
          <div>View Mode: {viewMode}</div>
          {error && <div className="text-red-400 mt-2">Error: {error}</div>}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">KPIs</h1>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button
              onClick={() => setViewMode('mine')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'mine' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My KPIs
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'all' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All KPIs
            </button>
          </div>

          {canCreate && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              {showCreate ? 'Cancel' : 'Create KPI'}
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">New KPI</h2>
          
          {profiles.length === 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    No owners found. Please check if users are assigned to this workspace in 'user_roles' and have 'profiles'.
                  </p>
                </div>
              </div>
            </div>
          )}

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newKpi.title}
                  onChange={e => setNewKpi({...newKpi, title: e.target.value})}
                  placeholder="e.g. Q1 Revenue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <select
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newKpi.owner_id}
                  onChange={e => setNewKpi({...newKpi, owner_id: e.target.value})}
                >
                  <option value="">Select Owner</option>
                  {profiles.map(p => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name} {p.function ? `(${p.function})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newKpi.kpi_type}
                  onChange={e => setNewKpi({...newKpi, kpi_type: e.target.value})}
                >
                  <option value="revenue">Revenue</option>
                  <option value="lead">Lead</option>
                  <option value="rate">Rate</option>
                  <option value="cost">Cost</option>
                  <option value="strategic">Strategic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newKpi.unit}
                  onChange={e => setNewKpi({...newKpi, unit: e.target.value})}
                  placeholder="e.g. USD, Leads, %"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Weight (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newKpi.weight}
                  onChange={e => setNewKpi({...newKpi, weight: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <AppSubmitButton
                label="Save KPI"
                loadingLabel="Saving..."
                isLoading={isSubmitting}
                disabled={profiles.length === 0}
                className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                onClick={handleCreateKpi}
                type="button"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <span className="text-sm font-medium text-gray-700">Filter by Product:</span>
        <select
          className="border border-gray-300 rounded-md p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
        >
          <option value="all">All Products</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedKpis.map(kpi => (
              <tr 
                key={kpi.id} 
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/app/kpis/${kpi.id}`)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{kpi.title}</div>
                  <div className="text-xs text-gray-500">{kpi.unit}</div>
                  {/* Debug Preview */}
                  <div className="mt-1 text-[10px] text-gray-400 font-mono">
                    <div>ID: {kpi.id}</div>
                    <div>URL: /app/kpis/{kpi.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{kpi.owner_name}</div>
                  <div className="text-xs text-gray-500">{kpi.owner_function}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${kpi.kpi_type === 'revenue' ? 'bg-green-100 text-green-800' : 
                      kpi.kpi_type === 'cost' ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                    {kpi.kpi_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {kpi.weight}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {kpi.item_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent row click from firing twice
                        navigate(`/app/kpis/${kpi.id}`);
                      }}
                      className="border border-indigo-200 rounded px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                    >
                      View
                    </button>
                    {role === 'admin' && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteKpi(e, kpi.id)}
                        disabled={isSubmitting}
                        className="border border-red-100 rounded px-3 py-1 text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Empty State: No KPIs at all */}
            {allKpis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="font-medium text-gray-900">No KPIs in workspace.</p>
                    <p className="mt-1">Ask an admin to create KPIs for you.</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty State: Has KPIs but none match filter */}
            {allKpis.length > 0 && displayedKpis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  <p>No KPIs found matching your filter.</p>
                  {viewMode === 'mine' && (
                    <button 
                      onClick={() => setViewMode('all')}
                      className="mt-2 text-indigo-600 hover:underline"
                    >
                      View All KPIs
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
