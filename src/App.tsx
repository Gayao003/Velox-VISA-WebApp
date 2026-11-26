import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './core/ui/toast';
import { ProtectedRoute } from './core/auth/ProtectedRoute';
import { AppLayout } from './core/layout/AppLayout';
import { LoginView } from './views/LoginView';
import { DsrListView } from './views/DsrListView';
import { RegistriesView } from './views/RegistriesView';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dsr" replace />} />
              <Route path="/dsr" element={<DsrListView />} />
              <Route path="/registries" element={<RegistriesView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dsr" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
