import { Navigate } from 'react-router-dom';
import { useAuth } from '../useAuth.js';

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireResident = false,
}) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/resident" replace />;
  }

  if (requireResident && user.role !== 'resident') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}