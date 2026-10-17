import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { useAuth } from './useAuth.js';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ResidentView from './pages/ResidentView.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  const { user, token } = useAuth();

  return (
    <>
      <Toaster
        position="top-right"
        containerStyle={{ top: 60 }}
        toastOptions={{
          duration: 2000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '12px 16px',
          },
          success: {
            style: { background: '#27ae60' },
          },
          error: {
            style: { background: '#e74c3c' },
            iconTheme: {
              primary: '#fff',
              secondary: '#e74c3c',
            },
          },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button
                    className="toast-close-btn"
                    onClick={() => toast.dismiss(t.id)}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>
      <Routes>
        {/* Публичен route – login */}
        <Route
          path="/login"
          element={
            token && user
              ? <Navigate to={user.role === 'admin' ? '/admin' : '/resident'} replace />
              : <Login />
          }
        />

        {/* Защитен – само админ */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Защитен – живущ */}
        <Route
          path="/resident"
          element={
            <ProtectedRoute requireResident>
              <ResidentView />
            </ProtectedRoute>
          }
        />

        {/* Root – пренасочване според състоянието */}
        <Route
          path="/"
          element={
            token && user
              ? <Navigate to={user.role === 'admin' ? '/admin' : '/resident'} replace />
              : <Navigate to="/login" replace />
          }
        />

        {/* Всичко друго → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}