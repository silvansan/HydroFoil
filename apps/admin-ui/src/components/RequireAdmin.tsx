import React from 'react';
import { Navigate } from 'react-router-dom';
import { canManageUsers, useAuth } from '../auth/AuthContext';
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!canManageUsers(user?.role)) {
    return <Navigate to="/system-status" replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;
