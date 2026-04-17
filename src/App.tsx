/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootPage from './app/page';
import LoginPage from './app/login/page';
import AppLayout from './app/app/layout';
import DashboardPage from './app/app/dashboard/page';
import KpiListPage from './app/app/kpis/page';
import KpiDetailPage from './app/app/kpis/[kpiId]/page';
import KpiProgressPage from './app/app/kpi-progress/page';
import InitiativesPage from './app/app/initiatives/page';
import InitiativeDetailPage from './app/app/initiatives/[initiativeId]/page';
import ReviewPage from './app/app/review/page';
import ActivityPage from './app/app/activity/page';
import AlertsPage from './app/app/alerts/page';
import NotificationsPage from './app/app/notifications/page';
import DigestsPage from './app/app/digests/page';
import Health from './pages/Health';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/health" element={<Health />} />
        
        {/* Protected App Routes */}
        <Route path="/app/dashboard" element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        } />
        <Route path="/app/kpis" element={
          <AppLayout>
            <KpiListPage />
          </AppLayout>
        } />
        <Route path="/app/kpis/:kpiId" element={
          <AppLayout>
            <KpiDetailPage />
          </AppLayout>
        } />
        <Route path="/app/kpi-progress" element={
          <AppLayout>
            <KpiProgressPage />
          </AppLayout>
        } />
        <Route path="/app/initiatives" element={
          <AppLayout>
            <InitiativesPage />
          </AppLayout>
        } />
        <Route path="/app/initiatives/:initiativeId" element={
          <AppLayout>
            <InitiativeDetailPage />
          </AppLayout>
        } />
        <Route path="/app/review" element={
          <AppLayout>
            <ReviewPage />
          </AppLayout>
        } />
        <Route path="/app/activity" element={
          <AppLayout>
            <ActivityPage />
          </AppLayout>
        } />
        <Route path="/app/alerts" element={
          <AppLayout>
            <AlertsPage />
          </AppLayout>
        } />
        <Route path="/app/notifications" element={
          <AppLayout>
            <NotificationsPage />
          </AppLayout>
        } />
        <Route path="/app/digests" element={
          <AppLayout>
            <DigestsPage />
          </AppLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
