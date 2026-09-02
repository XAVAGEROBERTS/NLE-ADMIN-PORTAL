// src/components/admin/DashboardTab.jsx
import React from 'react';
import './DashboardTab.css';

const DashboardTab = ({ stats, deans, hods, financeOfficers, initializeDashboard, loading, setNewUser, setShowUserModal }) => {
  return (
    <div className="dashboard-tab">
      <div className="welcome-section">
        <div>
          <h2>Welcome, System Administrator! 👑</h2>
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
        <button onClick={initializeDashboard} disabled={loading.dashboard} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <h3>{stats.totalStudents.toLocaleString()}</h3>
          <p>Total Students</p>
          <span className="stat-subtext">Active Enrollments</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👨‍🏫</div>
          <h3>{stats.totalLecturers}</h3>
          <p>Lecturers</p>
          <span className="stat-subtext">Active Faculty</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👨‍🎓</div>
          <h3>{deans.length}</h3>
          <p>Deans</p>
          <span className="stat-subtext">Faculty Deans</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <h3>{hods.length}</h3>
          <p>HODs</p>
          <span className="stat-subtext">Department Heads</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <h3>{financeOfficers.length}</h3>
          <p>Finance Officers</p>
          <span className="stat-subtext">Finance Team</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <h3>{stats.totalCourses}</h3>
          <p>Active Courses</p>
          <span className="stat-subtext">Current Offerings</span>
        </div>
      </div>

      <div className="actions-section">
        <h3>⚡ Quick Actions</h3>
        <div className="actions-grid">
          <button className="action-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "student" })); setShowUserModal(true); }}>
            <span className="action-icon">👤</span>
            <span>Add Student</span>
            <small>New student enrollment</small>
          </button>
          <button className="action-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "lecturer" })); setShowUserModal(true); }}>
            <span className="action-icon">👨‍🏫</span>
            <span>Add Lecturer</span>
            <small>New lecturer hire</small>
          </button>
          <button className="action-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "dean" })); setShowUserModal(true); }}>
            <span className="action-icon">👨‍🎓</span>
            <span>Add Dean</span>
            <small>Faculty dean appointment</small>
          </button>
          <button className="action-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "hod" })); setShowUserModal(true); }}>
            <span className="action-icon">🏢</span>
            <span>Add HOD</span>
            <small>Department head appointment</small>
          </button>
          <button className="action-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "finance" })); setShowUserModal(true); }}>
            <span className="action-icon">💰</span>
            <span>Add Finance Officer</span>
            <small>New finance officer</small>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;