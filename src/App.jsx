import { Routes, Route, Navigate } from 'react-router-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from 'react';

// Protected Route wrapper component
const AdminProtectedRoute = ({ children }) => {
  const { isAdmin, loading } = useAdminAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  // Capacitor back button handling
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp();
      }
    });

    return () => {
      backButtonListener.remove();
    };
  }, []);

  return (
    <Router>
      <AdminAuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<AdminLogin />} />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            } 
          />
          
          <Route 
            path="/lectures" 
            element={
              <AdminProtectedRoute>
                <div style={{ padding: '20px' }}>
                  <h1>Lectures</h1>
                  <p>Lectures management page - coming soon</p>
                </div>
              </AdminProtectedRoute>
            } 
          />
          
          <Route 
            path="/materials" 
            element={
              <AdminProtectedRoute>
                <div style={{ padding: '20px' }}>
                  <h1>Materials</h1>
                  <p>Course materials page - coming soon</p>
                </div>
              </AdminProtectedRoute>
            } 
          />
          
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;