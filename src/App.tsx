/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootPage from './app/page';
import LoginPage from './app/login/page';
import AppLayout from './app/app/layout';
import DashboardPage from './app/app/dashboard/page';
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
      </Routes>
    </BrowserRouter>
  );
}
