// dean/DeanLeaveApprovals.jsx - FIXED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanLeaveApprovals = ({ departments, fetchDeanData, setStats, profile }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  // Get the dean's user ID from profile
  const deanUserId = profile?.id || profile?.user_id || null;

  // Fetch leave requests pending Dean approval
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
          lecturer:lecturer_id (id, full_name, email, phone)
        `)
        .in('department_code', deptCodes)
        .in('status', ['approved_by_hod', 'approved_by_dean', 'approved', 'rejected_by_dean'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
      
      if (setStats) {
        const pending = (data || []).filter(r => r.status === 'approved_by_hod').length;
        setStats(prev => ({
          ...prev,
          pendingDeanLeave: pending,
          totalDeanLeave: data?.length || 0
        }));
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, setStats]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  // Dean Approves - FIXED: Use UUID for dean_approved_by
  const handleDeanApprove = async (id) => {
    try {
      const { data: leaveData } = await supabase
        .from('lecturer_leave_requests')
        .select('*')
        .eq('id', id)
        .single();

      // ✅ FIX: Use the dean's actual user ID (UUID) instead of string "dean"
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({
          status: 'approved_by_dean',
          dean_approved: true,
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: deanUserId, // ✅ This is now a UUID
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Notify lecturer
      await notifyLecturer(
        leaveData?.lecturer_email,
        '✅ Leave Request Approved by Dean',
        `Your leave request from ${leaveData?.start_date} to ${leaveData?.end_date} has been FULLY APPROVED by the Dean.`
      );

      alert('✅ Leave request fully approved by Dean!');
      setShowModal(false);
      setDeanNotes('');
      setRejectionReason('');
      await fetchLeaveRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      console.error('Error approving leave:', err);
      alert('Error approving leave: ' + err.message);
    }
  };

  // Dean Rejects - FIXED: Use proper UUID for dean fields
  const handleDeanReject = async (id) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { data: leaveData } = await supabase
        .from('lecturer_leave_requests')
        .select('*')
        .eq('id', id)
        .single();

      // ✅ FIX: Use the dean's actual user ID (UUID)
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({
          status: 'rejected_by_dean',
          dean_rejection_reason: rejectionReason,
          dean_rejected_at: new Date().toISOString(),
          dean_rejected_by: deanUserId, // ✅ This is now a UUID
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Notify lecturer
      await notifyLecturer(
        leaveData?.lecturer_email,
        '❌ Leave Request Rejected by Dean',
        `Your leave request from ${leaveData?.start_date} to ${leaveData?.end_date} was REJECTED by the Dean. Reason: ${rejectionReason}`
      );

      alert('❌ Leave request rejected by Dean (HOD approval overridden)');
      setShowModal(false);
      setDeanNotes('');
      setRejectionReason('');
      await fetchLeaveRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      console.error('Error rejecting leave:', err);
      alert('Error rejecting leave: ' + err.message);
    }
  };

  // Notify Lecturer
  const notifyLecturer = async (email, title, message) => {
    try {
      await supabase
        .from('notifications')
        .insert([{
          user_email: email,
          title: title,
          message: message,
          type: 'leave_update',
          is_read: false,
          created_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error notifying lecturer:', error);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((r) => {
      const matchFilter = filter === 'all' ||
        (filter === 'pending' && r.status === 'approved_by_hod') ||
        (filter === 'approved' && r.status === 'approved_by_dean') ||
        (filter === 'rejected' && r.status === 'rejected_by_dean');

      const matchSearch =
        r.lecturer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [leaveRequests, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return leaveRequests.filter(r => r.status === 'approved_by_hod').length;
  }, [leaveRequests]);

  const getStatusLabel = (status) => {
    const labels = {
      approved_by_hod: '⏳ Pending Dean',
      approved_by_dean: '✅ Approved by Dean',
      approved: '✅ Approved',
      rejected_by_dean: '❌ Rejected by Dean',
    };
    return labels[status] || status || 'Unknown';
  };

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📝 Dean Leave Approvals</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="dean-badge dean-badge-pending">{pendingCount} Pending Dean</span>
        </div>
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
        <button 
          onClick={fetchLeaveRequests} 
          className="dean-refresh-btn"
          style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No leave requests found</td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.lecturer?.full_name}</strong>
                      <br />
                      <small>{r.lecturer?.email}</small>
                    </td>
                    <td>{r.leave_type}</td>
                    <td>
                      {new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}
                      <br />
                      <small>{r.days} days</small>
                    </td>
                    <td>
                      <span className="dean-status dean-status-approved">
                        {r.status === 'approved_by_hod' ? '✅ HOD Approved' : r.status}
                      </span>
                    </td>
                    <td>
                      <span className={`dean-status ${
                        r.status === 'approved_by_dean' || r.status === 'approved' ? 'dean-status-approved' :
                        r.status === 'rejected_by_dean' ? 'dean-status-rejected' :
                        'dean-status-pending'
                      }`}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td>
                      {r.status === 'approved_by_hod' && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedLeave(r);
                              setShowModal(true);
                              setDeanNotes('');
                              setRejectionReason('');
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              setSelectedLeave(r);
                              setShowModal(true);
                              setDeanNotes('');
                              setRejectionReason('');
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

      {/* Dean Action Modal */}
      {showModal && selectedLeave && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📝 Dean Review - Leave Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-leave-details">
                <p><strong>Lecturer:</strong> {selectedLeave.lecturer?.full_name}</p>
                <p><strong>Department:</strong> {selectedLeave.department_code}</p>
                <p><strong>Type:</strong> {selectedLeave.leave_type}</p>
                <p><strong>Dates:</strong> {new Date(selectedLeave.start_date).toLocaleDateString()} - {new Date(selectedLeave.end_date).toLocaleDateString()}</p>
                <p><strong>Days:</strong> {selectedLeave.days}</p>
                <p><strong>Reason:</strong> {selectedLeave.reason}</p>
                <p><strong>HOD Status:</strong> {selectedLeave.status === 'approved_by_hod' ? '✅ HOD Approved' : selectedLeave.status}</p>
                {selectedLeave.hod_notes && (
                  <p><strong>HOD Notes:</strong> {selectedLeave.hod_notes}</p>
                )}
              </div>

              <div className="dean-form-group">
                <label>Dean's Notes</label>
                <textarea
                  value={deanNotes}
                  onChange={(e) => setDeanNotes(e.target.value)}
                  className="dean-textarea"
                  placeholder="Add your notes or feedback..."
                  rows={2}
                />
              </div>

              <div className="dean-form-group">
                <label>Rejection Reason (Required if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="dean-textarea"
                  placeholder="Provide reason if rejecting..."
                  rows={3}
                />
                <small style={{ color: '#d32f2f' }}>⚠️ Rejecting will override HOD's approval</small>
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-reject-btn" onClick={() => handleDeanReject(selectedLeave.id)}>❌ Reject</button>
              <button className="dean-approve-btn" onClick={() => handleDeanApprove(selectedLeave.id)}>✅ Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanLeaveApprovals;