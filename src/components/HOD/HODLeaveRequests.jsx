// HODLeaveRequests.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODLeaveRequests = ({ departmentCode, fetchHODData, setStats }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchLeaveRequests();
  }, [departmentCode]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          *,
          lecturers:lecturer_id (id, full_name, email)
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({ 
          status: 'approved',
          approved_by: 'hod',
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchLeaveRequests();
      await fetchHODData();
    } catch (err) {
      alert('Error approving leave: ' + err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason,
          rejected_at: new Date().toISOString()
        })
        .eq('id', selectedLeave?.id);

      if (error) throw error;
      await fetchLeaveRequests();
      await fetchHODData();
      setShowModal(false);
      setSelectedLeave(null);
      setRejectionReason('');
    } catch (err) {
      alert('Error rejecting leave: ' + err.message);
    }
  };

  const filteredRequests = leaveRequests.filter((r) => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchSearch = 
      r.lecturers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

  const statusColors = {
    pending: 'hod-status-pending',
    approved: 'hod-status-approved',
    rejected: 'hod-status-rejected',
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📝 Leave Requests</h2>
        <span className="hod-badge hod-badge-pending">{pendingCount} pending</span>
      </div>

      <div className="hod-filters">
        <input
          type="text"
          placeholder="Search requests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All ({leaveRequests.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="hod-card">
        {loading ? (
          <div className="hod-loading">Loading leave requests...</div>
        ) : (
          <table className="hod-table">
            <thead>
              <tr>
                <th>Lecturer</th>
                <th>Type</th>
                <th>Date Range</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.lecturers?.full_name}</strong>
                      <br />
                      <small>{r.lecturers?.email}</small>
                    </td>
                    <td>{r.leave_type}</td>
                    <td>
                      {new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}
                      <br />
                      <small>{r.days} days</small>
                    </td>
                    <td>{r.reason}</td>
                    <td>
                      <span className={`hod-status ${statusColors[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="hod-action-buttons">
                          <button 
                            className="hod-approve-btn"
                            onClick={() => handleApprove(r.id)}
                          >
                            ✅ Approve
                          </button>
                          <button 
                            className="hod-reject-btn"
                            onClick={() => {
                              setSelectedLeave(r);
                              setShowModal(true);
                            }}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <span className="hod-approved-label">✓ Approved</span>
                      )}
                      {r.status === 'rejected' && (
                        <span className="hod-rejected-label">✗ Rejected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejection Modal */}
      {showModal && selectedLeave && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>Reject Leave Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <p>
                Rejecting leave request from <strong>{selectedLeave.lecturers?.full_name}</strong>
              </p>
              <div className="hod-form-group">
                <label>Reason for Rejection</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="hod-textarea"
                  placeholder="Please provide a reason for rejecting this leave request..."
                  rows={4}
                />
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="hod-reject-btn" onClick={handleReject}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODLeaveRequests;