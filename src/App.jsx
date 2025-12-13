import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider } from './context/AdminAuthContext'
import AdminLogin from './components/AdminLogin'
import AdminDashboard from './components/AdminDashboard'
import AdminProtectedRoute from './components/AdminProtectedRoute'

function App() {
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
          
          {/* Temporary placeholder routes - add these files later */}
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
  )
}

export default App