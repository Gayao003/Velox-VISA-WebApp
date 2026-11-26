import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './core/ui/toast';
import { ProtectedRoute } from './core/auth/ProtectedRoute';
import { AppLayout } from './core/layout/AppLayout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { ShiftDepositsView } from './views/ShiftDepositsView';
import { ShiftCollectionsView } from './views/ShiftCollectionsView';
import { BankPickupsView } from './views/BankPickupsView';
import { VdsRegistryView } from './views/VdsRegistryView';
import { DsrFuelSalesView } from './views/DsrFuelSalesView';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/shift-deposits" element={<ShiftDepositsView />} />
              <Route path="/shift-collections" element={<ShiftCollectionsView />} />
              <Route path="/bank-pickups" element={<BankPickupsView />} />
              <Route path="/vds-registry" element={<VdsRegistryView />} />
              <Route path="/dsr-fuel-sales" element={<DsrFuelSalesView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
