// HODLeaveRequests.jsx - COMPLETE WITH DEAN APPROVAL FLOW
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../../services/supabase";

const HODLeaveRequests = ({ departmentCode, fetchHODData, setStats }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [hodNotes, setHodNotes] = useState('');
  
  const fetchCalledRef = useRef(false);
  const departmentRef = useRef(departmentCode);

  // Fetch leave requests
  const fetchLeaveRequests = useCallback(async () => {
    if (!departmentCode) {
      console.log('HODLeaveRequests: No department code provided');
      return;
    }

    if (fetchCalledRef.current) return;
    fetchCalledRef.current = true;

    setLoading(true);
    setError(null);
    
    try {
      console.log('HODLeaveRequests: Fetching for department:', departmentCode);

      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          *,
          lecturer:lecturer_id (
            id, 
            full_name, 
            email,
            profile_picture_url
          )
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('HODLeaveRequests: Found', data?.length || 0, 'requests');
      setLeaveRequests(data || []);
      
      if (setStats) {
        const pending = (data || []).filter(r => r.status === 'pending' || r.status === 'pending_hod').length;
        const hodApproved = (data || []).filter(r => r.status === 'approved_by_hod').length;
        setStats(prev => ({
          ...prev,
          pendingLeaveRequests: pending,
          hodApprovedLeave: hodApproved,
          totalLeaveRequests: data?.length || 0
        }));
      }

    } catch (err) {
      console.error('HODLeaveRequests: Error fetching leave requests:', err);
      setError(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
      setTimeout(() => { fetchCalledRef.current = false; }, 1000);
    }
  }, [departmentCode, setStats]);

  useEffect(() => {
    if (departmentCode && (departmentCode !== departmentRef.current || !fetchCalledRef.current)) {
      departmentRef.current = departmentCode;
      fetchCalledRef.current = false;
      fetchLeaveRequests();
    }
  }, [departmentCode, fetchLeaveRequests]);

  // HOD Approves - Moves to Dean for review
  const handleHODApprove = async (id) => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({ 
          status: 'approved_by_hod',
          approved_by: 'hod',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hod_notes: hodNotes || null,
          dean_approved: false,
          dean_approved_at: null,
          dean_approved_by: null,
          dean_rejection_reason: null,
          dean_rejected_at: null
        })
        .eq('id', id);

      if (error) throw error;
      
      const { data: leaveData } = await supabase
        .from('lecturer_leave_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (leaveData) {
        // Notify Dean
        await notifyDean(leaveData);
        
        // Notify Lecturer
        await notifyLecturer(
          leaveData.lecturer_email,
          '📋 HOD Approved - Waiting for Dean',
          `Your leave request from ${leaveData.start_date} to ${leaveData.end_date} has been approved by HOD and is now pending Dean's approval.`
        );
      }
      
      showToast('✅ Leave approved by HOD. Sent to Dean for final approval.', 'success');
      setShowModal(false);
      setSelectedLeave(null);
      setHodNotes('');
      fetchCalledRef.current = false;
      await fetchLeaveRequests();
      if (fetchHODData) await fetchHODData();
      
    } catch (err) {
      console.error('Error approving leave:', err);
      showToast('Error approving leave: ' + err.message, 'error');
    }
  };

  // HOD Rejects
  const handleHODReject = async () => {
    if (!rejectionReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    if (!selectedLeave?.id) return;

    try {
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({ 
          status: 'rejected_by_hod',
          rejection_reason: rejectionReason,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hod_notes: hodNotes || null
        })
        .eq('id', selectedLeave.id);

      if (error) throw error;
      
      await notifyLecturer(
        selectedLeave.lecturer_email,
        '❌ Leave Request Rejected by HOD',
        `Your leave request was rejected by HOD. Reason: ${rejectionReason}`
      );
      
      showToast('❌ Leave request rejected', 'warning');
      setShowModal(false);
      setSelectedLeave(null);
      setRejectionReason('');
      setHodNotes('');
      fetchCalledRef.current = false;
      await fetchLeaveRequests();
      if (fetchHODData) await fetchHODData();
      
    } catch (err) {
      console.error('Error rejecting leave:', err);
      showToast('Error rejecting leave: ' + err.message, 'error');
    }
  };

  // Notify Dean
  const notifyDean = async (leaveData) => {
    try {
      const { data: deanData } = await supabase
        .from('user_roles')
        .select('email, user_id')
        .eq('department_id', leaveData.department_id || '')
        .eq('role', 'dean')
        .single();

      if (deanData) {
        await supabase
          .from('notifications')
          .insert([{
            user_email: deanData.email,
            title: '📋 Leave Request Pending Your Approval',
            message: `${leaveData.lecturer_name || 'A lecturer'} has requested leave from ${leaveData.start_date} to ${leaveData.end_date}. HOD has approved. Please review.`,
            type: 'leave_pending_dean',
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: {
              leave_id: leaveData.id,
              lecturer_name: leaveData.lecturer_name,
              department_code: leaveData.department_code
            }
          }]);
      }
    } catch (error) {
      console.error('Error notifying dean:', error);
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

  // Toast helper
  const showToast = (message, type = 'info') => {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  };

  const filteredRequests = leaveRequests.filter((r) => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchSearch = 
      r.lecturer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.leave_type?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = leaveRequests.filter(r => r.status === 'pending' || r.status === 'pending_hod').length;
  const hodApprovedCount = leaveRequests.filter(r => r.status === 'approved_by_hod').length;

  const statusColors = {
    pending: 'hod-status-pending',
    pending_hod: 'hod-status-pending',
    approved_by_hod: 'hod-status-approved',
    approved_by_dean: 'hod-status-approved',
    approved: 'hod-status-approved',
    rejected: 'hod-status-rejected',
    rejected_by_hod: 'hod-status-rejected',
    rejected_by_dean: 'hod-status-rejected',
    cancelled: 'hod-status-cancelled',
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: '⏳ Pending',
      pending_hod: '⏳ Pending HOD',
      approved_by_hod: '📋 Approved by HOD (Pending Dean)',
      approved_by_dean: '✅ Approved by Dean',
      approved: '✅ Approved',
      rejected: '❌ Rejected',
      rejected_by_hod: '❌ Rejected by HOD',
      rejected_by_dean: '❌ Rejected by Dean',
      cancelled: '🔄 Cancelled',
    };
    return labels[status] || status || 'Unknown';
  };

  // ===== RENDER =====
  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📝 Leave Requests</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="hod-badge hod-badge-pending">{pendingCount} Pending</span>
          <span className="hod-badge hod-badge-approved">{hodApprovedCount} With Dean</span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => { fetchCalledRef.current = false; fetchLeaveRequests(); }} style={{ padding: '4px 12px', background: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      <div className="hod-filters">
        <input type="text" placeholder="Search by lecturer or reason..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="hod-search-input" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="hod-filter-select">
          <option value="all">All ({leaveRequests.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved_by_hod">With Dean ({hodApprovedCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected_by_hod">Rejected</option>
        </select>
        <button onClick={() => { fetchCalledRef.current = false; fetchLeaveRequests(); }} className="hod-refresh-btn" style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          🔄 Refresh
        </button>
      </div>

      <div className="hod-card">
        {loading ? (
          <div className="hod-loading">Loading leave requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📋</span>
            <p>No leave requests found</p>
          </div>
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
              {filteredRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {r.lecturer?.profile_picture_url ? (
                        <img src={r.lecturer.profile_picture_url} alt={r.lecturer?.full_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                          {r.lecturer?.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <strong>{r.lecturer?.full_name || 'Unknown'}</strong>
                        <br />
                        <small>{r.lecturer?.email || 'No email'}</small>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ textTransform: 'capitalize' }}>{r.leave_type?.replace('_', ' ') || 'N/A'}</span></td>
                  <td>
                    {r.start_date ? new Date(r.start_date).toLocaleDateString() : 'N/A'} → {r.end_date ? new Date(r.end_date).toLocaleDateString() : 'N/A'}
                    <br />
                    <small>{r.days || 0} days</small>
                  </td>
                  <td><div style={{ maxWidth: '150px', wordBreak: 'break-word' }}>{r.reason || 'No reason provided'}</div></td>
                  <td>
                    <span className={`hod-status ${statusColors[r.status] || ''}`}>
                      {getStatusLabel(r.status)}
                    </span>
                  </td>
                  <td>
                    {(r.status === 'pending' || r.status === 'pending_hod') && (
                      <div className="hod-action-buttons">
                        <button className="hod-approve-btn" onClick={() => { setSelectedLeave(r); setShowModal(true); setHodNotes(''); setRejectionReason(''); }}>
                          ✅ Approve
                        </button>
                        <button className="hod-reject-btn" onClick={() => { setSelectedLeave(r); setShowModal(true); }}>
                          ❌ Reject
                        </button>
                      </div>
                    )}
                    {r.status === 'approved_by_hod' && (
                      <span style={{ color: '#f57c00', fontWeight: '600' }}>⏳ Waiting for Dean</span>
                    )}
                    {r.status === 'approved_by_dean' || r.status === 'approved' && (
                      <span style={{ color: '#2e7d32', fontWeight: '600' }}>✅ Approved</span>
                    )}
                    {(r.status === 'rejected_by_hod' || r.status === 'rejected_by_dean' || r.status === 'rejected') && (
                      <span style={{ color: '#d32f2f', fontWeight: '600' }}>❌ Rejected</span>
                    )}
                    {r.status === 'cancelled' && (
                      <span style={{ color: '#666', fontWeight: '600' }}>🔄 Cancelled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* HOD Action Modal */}
      {showModal && selectedLeave && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📝 Review Leave Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div style={{ marginBottom: '16px' }}>
                <p><strong>Lecturer:</strong> {selectedLeave.lecturer?.full_name}</p>
                <p><strong>Type:</strong> {selectedLeave.leave_type}</p>
                <p><strong>Dates:</strong> {new Date(selectedLeave.start_date).toLocaleDateString()} - {new Date(selectedLeave.end_date).toLocaleDateString()}</p>
                <p><strong>Days:</strong> {selectedLeave.days}</p>
                <p><strong>Reason:</strong> {selectedLeave.reason}</p>
              </div>
              
              <div className="hod-form-group">
                <label>HOD Notes (Optional)</label>
                <textarea value={hodNotes} onChange={(e) => setHodNotes(e.target.value)} className="hod-textarea" placeholder="Add your notes..." rows={2} />
              </div>

              {selectedLeave.status === 'pending' && (
                <div className="hod-form-group">
                  <label>Rejection Reason (Required for rejection)</label>
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="hod-textarea" placeholder="Provide reason if rejecting..." rows={3} />
                </div>
              )}
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              {selectedLeave.status === 'pending' && (
                <>
                  <button className="hod-reject-btn" onClick={handleHODReject}>❌ Reject</button>
                  <button className="hod-approve-btn" onClick={() => handleHODApprove(selectedLeave.id)}>✅ Approve</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODLeaveRequests;