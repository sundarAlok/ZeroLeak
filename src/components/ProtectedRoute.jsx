import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // or a loader
  if (!user) return <Navigate to="/" replace />;
  return children;
};

export default ProtectedRoute;
