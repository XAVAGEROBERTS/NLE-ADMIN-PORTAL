// HODComplaints.jsx - With View feature
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODComplaints = ({ departmentCode, fetchHODData, setStats }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [actionType, setActionType] = useState('view'); // view | resolve | reject | escalate
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [departmentCode]);

  const fetchComplaints = async () => {
    if (!departmentCode) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_complaints')
        .select(`
          *,
          students:student_id (id, full_name, student_id, email, program_code, year_of_study)
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!responseText.trim()) {
      alert('Please provide a response');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'resolved',
          response: responseText,
          responded_by: 'hod',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint?.id);

      if (error) throw error;

      await notifyStudent(
        selectedComplaint?.students?.email,
        '✅ Complaint Resolved',
        `Your complaint "${selectedComplaint?.title}" has been resolved.\n\nResponse: ${responseText}`
      );

      alert('✅ Complaint resolved!');
      closeModal();
      await fetchComplaints();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!responseText.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'rejected',
          response: responseText,
          responded_by: 'hod',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint?.id);

      if (error) throw error;

      await notifyStudent(
        selectedComplaint?.students?.email,
        '❌ Complaint Rejected',
        `Your complaint "${selectedComplaint?.title}" has been rejected.\n\nReason: ${responseText}`
      );

      alert('❌ Complaint rejected');
      closeModal();
      await fetchComplaints();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEscalate = async () => {
    if (!responseText.trim()) {
      alert('Please provide escalation reason');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'escalated',
          response: responseText,
          responded_by: 'hod',
          responded_at: new Date().toISOString(),
          escalated_by: 'hod',
          escalated_at: new Date().toISOString(),
          escalated_reason: responseText,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint?.id);

      if (error) throw error;

      await notifyDean(
        selectedComplaint,
        '📋 Complaint Escalated to Dean',
        `A complaint has been escalated by HOD for your review.\n\nStudent: ${selectedComplaint?.students?.full_name}\nTitle: ${selectedComplaint?.title}\nHOD Notes: ${responseText}`
      );

      await notifyStudent(
        selectedComplaint?.students?.email,
        '⬆️ Complaint Escalated to Dean',
        `Your complaint "${selectedComplaint?.title}" has been escalated to the Dean for review.\n\nHOD Notes: ${responseText}`
      );

      alert('⬆️ Complaint escalated to Dean!');
      closeModal();
      await fetchComplaints();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      console.error('Error escalating:', err);
      alert('Error escalating: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setResponseText('');
    setSelectedComplaint(null);
    setActionType('view');
  };

  const openModal = (complaint, type) => {
    setSelectedComplaint(complaint);
    setActionType(type);
    setResponseText('');
    setShowModal(true);
  };

  // ─── Notifications ─────────────────────────────────────────────────────
  const notifyStudent = async (email, title, message) => {
    try {
      await supabase
        .from('notifications')
        .insert([{
          user_email: email,
          title: title,
          message: message,
          type: 'complaint_update',
          is_read: false,
          created_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error notifying student:', error);
    }
  };

  const notifyDean = async (complaint, title, message) => {
    try {
      const { data: deanData } = await supabase
        .from('user_roles')
        .select('email')
        .eq('role', 'dean')
        .eq('faculty_id', complaint.faculty_id || '')
        .single();

      if (deanData) {
        await supabase
          .from('notifications')
          .insert([{
            user_email: deanData.email,
            title: title,
            message: message,
            type: 'complaint_escalated',
            is_read: false,
            created_at: new Date().toISOString(),
            metadata: {
              complaint_id: complaint.id,
              student_name: complaint.students?.full_name,
              department_code: complaint.department_code
            }
          }]);
      }
    } catch (error) {
      console.error('Error notifying dean:', error);
    }
  };

  // ─── Filtering ────────────────────────────────────────────────────────
  const filteredComplaints = complaints.filter((c) => {
    let matchFilter = true;
    if (filter === 'pending') {
      matchFilter = c.status === 'pending' || c.status === 'in_review' || c.status === 'sent_back';
    } else if (filter === 'escalated') {
      matchFilter = c.status === 'escalated' || c.status === 'dean_review';
    } else if (filter !== 'all') {
      matchFilter = c.status === filter;
    }

    const matchSearch =
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.students?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.students?.student_id?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchFilter && matchSearch;
  });

  const pendingCount = complaints.filter(c => 
    c.status === 'pending' || c.status === 'in_review' || c.status === 'sent_back'
  ).length;
  
  const escalatedCount = complaints.filter(c => 
    c.status === 'escalated' || c.status === 'dean_review'
  ).length;

  // ─── Helpers ───────────────────────────────────────────────────────────
  const getStatusLabel = (status) => {
    const labels = {
      pending: '⏳ Pending',
      in_review: '🔄 In Review',
      resolved: '✅ Resolved by HOD',
      rejected: '❌ Rejected by HOD',
      escalated: '⬆️ Escalated to Dean',
      dean_review: '📋 Dean Reviewing',
      dean_resolved: '✅ Resolved by Dean',
      dean_rejected: '❌ Rejected by Dean',
      sent_back: '🔄 Sent Back by Dean',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    if (status === 'pending' || status === 'in_review' || status === 'sent_back') return 'hod-status-pending';
    if (status === 'resolved' || status === 'dean_resolved') return 'hod-status-approved';
    if (status === 'rejected' || status === 'dean_rejected') return 'hod-status-rejected';
    if (status === 'escalated' || status === 'dean_review') return 'hod-status-in-progress';
    return 'hod-status-pending';
  };

  const getCategoryLabel = (cat) => {
    const map = {
      academic: '📚 Academic',
      administrative: '📋 Administrative',
      lecturer: '👨‍🏫 Lecturer',
      facility: '🏢 Facility',
      other: '📝 Other',
    };
    return map[cat] || cat;
  };

  const canAct = (status) => {
    return status === 'pending' || status === 'in_review' || status === 'sent_back';
  };

  return (
    <div className="hod-section">
      {/* Header */}
      <div className="hod-section-header">
        <h2 className="hod-section-title">💬 Student Complaints</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className="hod-badge hod-badge-pending">⏳ Pending: {pendingCount}</span>
          <span className="hod-badge hod-badge-in-progress">⬆️ With Dean: {escalatedCount}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="hod-filters" style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search complaints..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white' }}
        >
          <option value="all">All ({complaints.length})</option>
          <option value="pending">⏳ Pending / Sent Back ({pendingCount})</option>
          <option value="escalated">⬆️ Escalated ({escalatedCount})</option>
          <option value="resolved">✅ Resolved</option>
          <option value="rejected">❌ Rejected</option>
          <option value="sent_back">🔄 Sent Back</option>
        </select>
        <button
          onClick={fetchComplaints}
          className="hod-refresh-btn"
          style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Table */}
      <div className="hod-card">
        {loading ? (
          <div className="hod-loading" style={{ textAlign: 'center', padding: '40px' }}>Loading complaints...</div>
        ) : (
          <table className="hod-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Student</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No complaints found</td>
                </tr>
              ) : (
                filteredComplaints.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{c.students?.full_name}</strong>
                      <br />
                      <small style={{ color: '#666' }}>
                        {c.students?.student_id}
                        {c.students?.year_of_study ? ` • Y${c.students.year_of_study}` : ''}
                      </small>
                    </td>
                    <td style={{ padding: '10px' }}>{c.title}</td>
                    <td style={{ padding: '10px' }}>
                      <span className="hod-badge">{getCategoryLabel(c.category)}</span>
                    </td>
                    <td style={{ padding: '10px' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px' }}>
                      <span className={`hod-status ${getStatusClass(c.status)}`}>
                        {getStatusLabel(c.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Always show View */}
                        <button
                          onClick={() => openModal(c, 'view')}
                          style={{
                            padding: '4px 10px',
                            background: '#607d8b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          👁 View
                        </button>

                        {/* Action buttons only when actionable */}
                        {canAct(c.status) && (
                          <>
                            <button
                              onClick={() => openModal(c, 'resolve')}
                              style={{
                                padding: '4px 10px',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ✅ Resolve
                            </button>
                            <button
                              onClick={() => openModal(c, 'reject')}
                              style={{
                                padding: '4px 10px',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ❌ Reject
                            </button>
                            <button
                              onClick={() => openModal(c, 'escalate')}
                              style={{
                                padding: '4px 10px',
                                background: '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ⬆️ Escalate
                            </button>
                          </>
                        )}

                        {/* Status labels when no action is possible */}
                        {c.status === 'escalated' && (
                          <span style={{ color: '#e65100', fontWeight: '600', fontSize: '12px' }}>⏳ With Dean</span>
                        )}
                        {c.status === 'resolved' && (
                          <span style={{ color: '#2e7d32', fontWeight: '600', fontSize: '12px' }}>✅ Resolved</span>
                        )}
                        {c.status === 'rejected' && (
                          <span style={{ color: '#c62828', fontWeight: '600', fontSize: '12px' }}>❌ Rejected</span>
                        )}
                        {c.status === 'dean_resolved' && (
                          <span style={{ color: '#2e7d32', fontWeight: '600', fontSize: '12px' }}>✅ Dean Resolved</span>
                        )}
                        {c.status === 'dean_rejected' && (
                          <span style={{ color: '#c62828', fontWeight: '600', fontSize: '12px' }}>❌ Dean Rejected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Modal (View / Resolve / Reject / Escalate) ─────────────────── */}
      {showModal && selectedComplaint && (
        <div
          className="hod-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => !processing && closeModal()}
        >
          <div
            className="hod-modal"
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '580px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>
                {actionType === 'view'      && '👁 Complaint Details'}
                {actionType === 'resolve'  && '✅ Resolve Complaint'}
                {actionType === 'reject'   && '❌ Reject Complaint'}
                {actionType === 'escalate' && '⬆️ Escalate to Dean'}
              </h3>
              <button
                onClick={closeModal}
                disabled={processing}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Complaint Details (always shown) */}
            <div style={{ marginBottom: '20px', fontSize: '14px', lineHeight: 1.6 }}>
              <p><strong>Student:</strong> {selectedComplaint.students?.full_name} ({selectedComplaint.students?.student_id})</p>
              <p><strong>Program:</strong> {selectedComplaint.students?.program_code || '—'}
                {selectedComplaint.students?.year_of_study ? ` • Year ${selectedComplaint.students.year_of_study}` : ''}
              </p>
              <p><strong>Category:</strong> {getCategoryLabel(selectedComplaint.category)}</p>
              <p><strong>Title:</strong> {selectedComplaint.title}</p>
              <p><strong>Submitted:</strong> {new Date(selectedComplaint.created_at).toLocaleString()}</p>
              <p><strong>Status:</strong> {getStatusLabel(selectedComplaint.status)}</p>

              <p style={{ marginTop: '12px' }}><strong>Description:</strong></p>
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                {selectedComplaint.description}
              </div>

              {/* Dean's send-back reason */}
              {selectedComplaint.status === 'sent_back' && selectedComplaint.sent_back_reason && (
                <div style={{
                  marginTop: '12px',
                  background: '#fff3e0',
                  padding: '12px',
                  borderRadius: '6px',
                  borderLeft: '4px solid #ff9800'
                }}>
                  <strong>📌 Dean’s Send-Back Reason:</strong>
                  <p style={{ margin: '6px 0 0' }}>{selectedComplaint.sent_back_reason}</p>
                </div>
              )}

              {/* Previous response */}
              {selectedComplaint.response && (
                <div style={{
                  marginTop: '12px',
                  background: '#e3f2fd',
                  padding: '12px',
                  borderRadius: '6px'
                }}>
                  <strong>Previous Response / Notes:</strong>
                  <p style={{ margin: '6px 0 0' }}>{selectedComplaint.response}</p>
                  {selectedComplaint.responded_by && (
                    <small style={{ color: '#666' }}>
                      — by {selectedComplaint.responded_by.toUpperCase()}
                      {selectedComplaint.responded_at && ` on ${new Date(selectedComplaint.responded_at).toLocaleString()}`}
                    </small>
                  )}
                </div>
              )}
            </div>

            {/* Action form (only when not just viewing) */}
            {actionType !== 'view' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px' }}>
                  {actionType === 'resolve'  && 'Your Response *'}
                  {actionType === 'reject'   && 'Rejection Reason *'}
                  {actionType === 'escalate' && 'Escalation Reason *'}
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  disabled={processing}
                  placeholder={
                    actionType === 'resolve'
                      ? 'Provide your response to resolve this complaint...'
                      : actionType === 'reject'
                      ? 'Provide the reason for rejection...'
                      : 'Explain why this needs to be escalated to the Dean...'
                  }
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            )}

            {/* Footer buttons */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              borderTop: '1px solid #eee',
              paddingTop: '16px'
            }}>
              <button
                onClick={closeModal}
                disabled={processing}
                style={{
                  padding: '8px 18px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {actionType === 'view' ? 'Close' : 'Cancel'}
              </button>

              {actionType === 'resolve' && (
                <button
                  onClick={handleResolve}
                  disabled={processing || !responseText.trim()}
                  style={{
                    padding: '8px 18px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: processing || !responseText.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !responseText.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '✅ Confirm Resolve'}
                </button>
              )}

              {actionType === 'reject' && (
                <button
                  onClick={handleReject}
                  disabled={processing || !responseText.trim()}
                  style={{
                    padding: '8px 18px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: processing || !responseText.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !responseText.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '❌ Confirm Reject'}
                </button>
              )}

              {actionType === 'escalate' && (
                <button
                  onClick={handleEscalate}
                  disabled={processing || !responseText.trim()}
                  style={{
                    padding: '8px 18px',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: processing || !responseText.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !responseText.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '⬆️ Confirm Escalate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODComplaints;