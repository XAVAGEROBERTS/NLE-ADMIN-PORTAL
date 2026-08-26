import { Routes, Route, Navigate } from 'react-router-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from 'react';

// Protected Route wrapper component - FIXED for all roles
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, isLecturer, isFinance, loading, profile } = useAdminAuth();
  
  console.log('🔒 ProtectedRoute check:', { isAuthenticated, isAdmin, isLecturer, isFinance, loading, profile });
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }
  
  // Check if user is authenticated (admin, lecturer, or finance)
  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // User is authenticated, render children
  console.log('✅ Authenticated, rendering protected content');
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
      // Fixed: Check if remove exists before calling
      if (backButtonListener && typeof backButtonListener.remove === 'function') {
        backButtonListener.remove();
      }
    };
  }, []);

  return (
    <Router>
      <AdminAuthProvider>
        <Routes>
          {/* Public route - login page */}
          <Route path="/login" element={<AdminLogin />} />
          
          {/* Protected routes - accessible by Admin, Lecturer, and Finance */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/lectures" 
            element={
              <ProtectedRoute>
                <div style={{ padding: '20px' }}>
                  <h1>Lectures</h1>
                  <p>Lectures management page - coming soon</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/materials" 
            element={
              <ProtectedRoute>
                <div style={{ padding: '20px' }}>
                  <h1>Materials</h1>
                  <p>Course materials page - coming soon</p>
                </div>
              </ProtectedRoute>
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