import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const FinanceDashboard = ({ profile, signOut }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [searchTerm]); // Re-fetch on search change

  const fetchStudents = async () => {
    setLoading(true);
    let query = supabase
      .from('students')
      .select('id, student_id, full_name, email, program, academic_year')
      .order('full_name', { ascending: true });

    if (searchTerm.trim()) {
      query = query.or(
        `full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching students:', error);
      alert('Failed to load students');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  const fetchStudentFinance = async (studentId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching records:', error);
      alert('Failed to load financial records');
    } else {
      setFinancialRecords(data || []);
    }
    setLoading(false);
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setActiveTab('finance');
    fetchStudentFinance(student.id);
  };

  const handleUpdatePaymentStatus = async (recordId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;

    const updates = {
      status: newStatus,
    };
    if (newStatus === 'paid') {
      updates.payment_date = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'pending') {
      updates.payment_date = null;
    }

    const { error } = await supabase
      .from('financial_records')
      .update(updates)
      .eq('id', recordId);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      alert('Status updated successfully!');
      fetchStudentFinance(selectedStudent.id);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    signOut();
    setShowLogoutConfirm(false);
    // Optional: navigate to login after logout
    // navigate('/login');
  };

  // Calculations
  const totalBilled = financialRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = financialRecords
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);
  const outstanding = totalBilled - totalPaid;

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo">FINANCE OFFICER PORTAL</h1>
            <p className="tagline">Student Financial Management System</p>
          </div>
          <div className="user-section">
            <div className="user-info">
              <div className="avatar finance">F</div>
              <div>
                <p className="user-name">{profile?.full_name || 'Finance Officer'}</p>
                <p className="user-role">
                  <span className="role-badge finance">FINANCE OFFICER</span>
                </p>
              </div>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button
          className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>
        <button
          className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`}
          onClick={() => setActiveTab('finance')}
          disabled={!selectedStudent}
        >
          💰 Student Finance
        </button>
        <button
          className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📊 Reports
        </button>
      </nav>

      <main className="dashboard-main">
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'students' && !loading && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>Student List ({students.length} students)</h2>
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            {students.length === 0 ? (
              <p>No students found.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Program</th>
                      <th>Academic Year</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.student_id}</strong></td>
                        <td>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td>{s.program}</td>
                        <td>{s.academic_year}</td>
                        <td>
                          <button
                            className="action-btn view"
                            onClick={() => handleViewStudent(s)}
                          >
                            View Finance
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && selectedStudent && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>
                Financial Records — {selectedStudent.full_name} ({selectedStudent.student_id})
              </h2>
              <button
                className="back-button"
                onClick={() => {
                  setSelectedStudent(null);
                  setActiveTab('students');
                }}
              >
                ← Back to Students
              </button>
            </div>

            <div className="financial-summary">
              <div className="stat-card">
                <h3>Total Billed</h3>
                <p className="amount">${totalBilled.toFixed(2)}</p>
              </div>
              <div className="stat-card success">
                <h3>Total Paid</h3>
                <p className="amount success">${totalPaid.toFixed(2)}</p>
              </div>
              <div className={`stat-card ${outstanding > 0 ? 'warning' : 'success'}`}>
                <h3>Outstanding Balance</h3>
                <p className={`amount ${outstanding > 0 ? 'warning' : 'success'}`}>
                  ${outstanding.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="table-container">
              {financialRecords.length === 0 ? (
                <p>No financial records found for this student.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Receipt #</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.payment_date
                            ? new Date(record.payment_date).toLocaleDateString()
                            : new Date(record.created_at).toLocaleDateString()}
                        </td>
                        <td>{record.description}</td>
                        <td>${record.amount.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge ${record.status}`}>
                            {record.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{record.receipt_number || '—'}</td>
                        <td>
                          {record.status === 'pending' && (
                            <button
                              className="action-btn success small"
                              onClick={() => handleUpdatePaymentStatus(record.id, 'paid')}
                            >
                              Mark Paid
                            </button>
                          )}
                          {record.status === 'paid' && (
                            <button
                              className="action-btn warning small"
                              onClick={() => handleUpdatePaymentStatus(record.id, 'pending')}
                            >
                              Revert
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="tab-content">
            <h2>Financial Reports</h2>
            <div className="coming-soon">
              <p>📈 Detailed reports coming soon:</p>
              <ul>
                <li>Revenue by Program</li>
                <li>Overdue Payments Summary</li>
                <li>Monthly/Yearly Trends</li>
                <li>Export to PDF/Excel</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button className="action-btn warning" onClick={confirmLogout}>
                Yes, Logout
              </button>
              <button className="action-btn" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;