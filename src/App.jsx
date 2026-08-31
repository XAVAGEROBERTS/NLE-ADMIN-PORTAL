// App.jsx - FIXED for Lecturer
import { Routes, Route, Navigate } from 'react-router-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import DeanDashboard from './components/DeanDashboard';
import HODDashboard from './components/HODDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from 'react';

// Protected Route wrapper component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdminAuth();
  
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
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Role-Based Dashboard Router
const RoleBasedDashboard = () => {
  const { role } = useAdminAuth();
  
  console.log('🎯 RoleBasedDashboard - Current role:', role);
  
  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'dean':
      return <DeanDashboard />;
    case 'hod':
      return <HODDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'lecturer':
      // Lecturer can use AdminDashboard (it has lecturer support built-in)
      return <AdminDashboard />;
    default:
      return <AdminDashboard />;
  }
};

function App() {
  // Capacitor back button handling - FIXED
  useEffect(() => {
    let backButtonListener = null;
    
    try {
      backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          CapacitorApp.minimizeApp();
        }
      });
    } catch (err) {
      console.warn('Capacitor not available:', err);
    }

    return () => {
      if (backButtonListener) {
        try {
          if (typeof backButtonListener.remove === 'function') {
            backButtonListener.remove();
          }
        } catch (err) {
          console.warn('Error removing back button listener:', err);
        }
      }
    };
  }, []);

  return (
    <Router>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <RoleBasedDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;