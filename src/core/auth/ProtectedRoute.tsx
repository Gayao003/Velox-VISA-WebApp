import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from './authService';

export const ProtectedRoute: React.FC = () => {
  const [isAuth, setIsAuth] = useState(() => authService.isAuthenticated());

  useEffect(() => {
    return authService.subscribe((session) => {
      setIsAuth(Boolean(session?.user));
    });
  }, []);

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
