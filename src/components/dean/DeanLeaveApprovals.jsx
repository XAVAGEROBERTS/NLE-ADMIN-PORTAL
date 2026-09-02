// dean/DeanLeaveApprovals.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanLeaveApprovals = ({ departments, fetchDeanData, setStats }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchLeaveRequests = useCallback(async () => {
    if (deptCodes.length === 0) {
      setLeaveRequests([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          *,
          lecturers:lecturer_id (id, full_name, email, phone)
        `)
        .in('department_code', deptCodes)
        .in('status', ['approved', 'pending_dean'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({
          status: 'approved_by_dean',
          dean_approved_by: 'dean',
          dean_approved_at: new Date().toISOString(),
          dean_notes: deanNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Leave request approved by Dean!');
      setShowModal(false);
      setDeanNotes('');
      await fetchLeaveRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error approving leave: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({
          status: 'rejected_by_dean',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Leave request rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchLeaveRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting leave: ' + err.message);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((r) => {
      const matchFilter = filter === 'all' ||
        (filter === 'pending' && r.status === 'approved') ||
        (filter === 'approved' && r.status === 'approved_by_dean') ||
        (filter === 'rejected' && r.status === 'rejected_by_dean');

      const matchSearch =
        r.lecturers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [leaveRequests, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return leaveRequests.filter(r => r.status === 'approved' || r.status === 'pending_dean').length;
  }, [leaveRequests]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📝 Faculty Leave Approvals</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search requests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({leaveRequests.length})</option>
          <option value="pending">Pending Dean ({pendingCount})</option>
          <option value="approved">Approved by Dean</option>
          <option value="rejected">Rejected by Dean</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading leave requests...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Lecturer</th>
                <th>Type</th>
                <th>Date Range</th>
                <th>HOD Status</th>
                <th>Dean Status</th>
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
                    <td>
                      <span className="dean-status dean-status-approved">
                        {r.status === 'approved' ? '✅ HOD Approved' : r.status}
                      </span>
                    </td>
                    <td>
                      <span className={`dean-status ${
                        r.status === 'approved_by_dean' ? 'dean-status-approved' :
                        r.status === 'rejected_by_dean' ? 'dean-status-rejected' :
                        'dean-status-pending'
                      }`}>
                        {r.status === 'approved' ? 'Pending Dean' :
                         r.status === 'approved_by_dean' ? 'Approved by Dean' :
                         r.status === 'rejected_by_dean' ? 'Rejected by Dean' :
                         r.status}
                      </span>
                    </td>
                    <td>
                      {(r.status === 'approved' || r.status === 'pending_dean') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedLeave(r);
                              setShowModal(true);
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              setSelectedLeave(r);
                              setShowModal(true);
                            }}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'approved_by_dean' && (
                        <span className="dean-approved-label">✅ Dean Approved</span>
                      )}
                      {r.status === 'rejected_by_dean' && (
                        <span className="dean-rejected-label">❌ Dean Rejected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedLeave && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📝 Review Leave Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-leave-details">
                <p><strong>Lecturer:</strong> {selectedLeave.lecturers?.full_name}</p>
                <p><strong>Type:</strong> {selectedLeave.leave_type}</p>
                <p><strong>Dates:</strong> {new Date(selectedLeave.start_date).toLocaleDateString()} - {new Date(selectedLeave.end_date).toLocaleDateString()}</p>
                <p><strong>Days:</strong> {selectedLeave.days}</p>
                <p><strong>Reason:</strong> {selectedLeave.reason}</p>
                <p><strong>HOD Status:</strong> {selectedLeave.status}</p>
              </div>
              <div className="dean-form-group">
                <label>Dean's Notes</label>
                <textarea
                  value={deanNotes}
                  onChange={(e) => setDeanNotes(e.target.value)}
                  className="dean-textarea"
                  placeholder="Add your notes or feedback..."
                  rows={3}
                />
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedLeave.id)}>
                ✅ Approve
              </button>
              <button className="dean-reject-btn" onClick={() => handleReject(selectedLeave.id)}>
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanLeaveApprovals;