// dean/DeanAppeals.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanAppeals = ({ departments, fetchDeanData, setStats, facultyId }) => {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending'); // default to actionable items
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [deanResponse, setDeanResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionType, setActionType] = useState('view'); // view | resolve | reject | send_back
  const [facultyDepartments, setFacultyDepartments] = useState([]);

  // ─── Faculty departments ───────────────────────────────────────────────
  useEffect(() => {
    const fetchFacultyDepartments = async () => {
      if (!facultyId) return;
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('department_code, department_name, id')
          .eq('faculty_id', facultyId);
        if (error) throw error;
        setFacultyDepartments(data || []);
      } catch (err) {
        console.error('Error fetching faculty departments:', err);
      }
    };
    fetchFacultyDepartments();
  }, [facultyId]);

  const deptCodes = useMemo(() => {
    if (departments?.length) {
      return departments.map(d => d.department_code).filter(Boolean);
    }
    return facultyDepartments.map(d => d.department_code).filter(Boolean);
  }, [departments, facultyDepartments]);

  // ─── Fetch ONLY escalated + already-handled-by-dean complaints ─────────
  const fetchAppeals = useCallback(async () => {
    if (deptCodes.length === 0) {
      setAppeals([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_complaints')
        .select(`
          *,
          students:student_id (
            id,
            full_name,
            student_id,
            email,
            program_code,
            year_of_study
          )
        `)
        .in('department_code', deptCodes)
        .in('status', ['escalated', 'dean_resolved', 'dean_rejected', 'sent_back'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppeals(data || []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  // ─── Notifications ─────────────────────────────────────────────────────
  const notifyStudent = async (email, title, message) => {
    if (!email) return;
    try {
      await supabase.from('notifications').insert([{
        user_email: email,
        title,
        message,
        type: 'complaint_update',
        is_read: false,
        created_at: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('Notification error:', err);
    }
  };

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleResolve = async (id) => {
    if (!deanResponse.trim()) {
      alert('Please provide a resolution decision');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'dean_resolved',
          response: deanResponse,
          responded_by: 'dean',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await notifyStudent(
        selectedAppeal?.students?.email,
        '✅ Complaint Resolved by Dean',
        `Your complaint "${selectedAppeal?.title}" has been RESOLVED by the Dean.\n\nDecision: ${deanResponse}`
      );

      alert('Complaint resolved by Dean');
      closeModal();
      await fetchAppeals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id) => {
    if (!deanResponse.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'dean_rejected',
          response: deanResponse,
          responded_by: 'dean',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      await notifyStudent(
        selectedAppeal?.students?.email,
        '❌ Complaint Rejected by Dean',
        `Your complaint "${selectedAppeal?.title}" has been REJECTED by the Dean.\n\nReason: ${deanResponse}`
      );

      alert('Complaint rejected by Dean');
      closeModal();
      await fetchAppeals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Send back to HOD (no further escalation possible)
  const handleSendBack = async (id) => {
    if (!deanResponse.trim()) {
      alert('Please provide a reason for sending back to HOD');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'sent_back',
          sent_back_reason: deanResponse,
          responded_by: 'dean',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Optional: notify HOD via your existing notification system
      alert('Complaint sent back to HOD');
      closeModal();
      await fetchAppeals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAppeal(null);
    setDeanResponse('');
    setActionType('view');
  };

  const openModal = (appeal, type) => {
    setSelectedAppeal(appeal);
    setActionType(type);
    setDeanResponse('');
    setShowModal(true);
  };

  // ─── Filtering & counts ────────────────────────────────────────────────
  const filteredAppeals = useMemo(() => {
    return appeals.filter((a) => {
      let matchFilter = true;
      if (filter === 'pending') matchFilter = a.status === 'escalated';
      else if (filter === 'resolved') matchFilter = a.status === 'dean_resolved';
      else if (filter === 'rejected') matchFilter = a.status === 'dean_rejected';
      else if (filter === 'sent_back') matchFilter = a.status === 'sent_back';
      // 'all' keeps everything

      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        a.students?.full_name?.toLowerCase().includes(term) ||
        a.students?.student_id?.toLowerCase().includes(term) ||
        a.title?.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term) ||
        a.category?.toLowerCase().includes(term) ||
        a.department_code?.toLowerCase().includes(term);

      return matchFilter && matchSearch;
    });
  }, [appeals, filter, searchTerm]);

  const pendingCount   = useMemo(() => appeals.filter(a => a.status === 'escalated').length, [appeals]);
  const resolvedCount  = useMemo(() => appeals.filter(a => a.status === 'dean_resolved').length, [appeals]);
  const rejectedCount  = useMemo(() => appeals.filter(a => a.status === 'dean_rejected').length, [appeals]);
  const sentBackCount  = useMemo(() => appeals.filter(a => a.status === 'sent_back').length, [appeals]);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const getStatusLabel = (status) => {
    const map = {
      escalated:     '⏳ Pending Dean Review',
      dean_resolved: '✅ Resolved by Dean',
      dean_rejected: '❌ Rejected by Dean',
      sent_back:     '↩️ Sent Back to HOD',
    };
    return map[status] || status;
  };

  const getStatusStyle = (status) => {
    const styles = {
      escalated:     { bg: '#fff3e0', color: '#e65100' },
      dean_resolved: { bg: '#e8f5e9', color: '#2e7d32' },
      dean_rejected: { bg: '#ffebee', color: '#c62828' },
      sent_back:     { bg: '#e3f2fd', color: '#1565c0' },
    };
    return styles[status] || { bg: '#f5f5f5', color: '#666' };
  };

  const getCategoryLabel = (cat) => {
    const map = {
      academic:       '📚 Academic',
      administrative: '📋 Administrative',
      lecturer:       '👨‍🏫 Lecturer',
      facility:       '🏢 Facility',
      other:          '📝 Other',
    };
    return map[cat] || cat;
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="dean-section">
      {/* Header + badges */}
      <div className="dean-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 className="dean-section-title" style={{ margin: 0 }}>💬 Faculty Appeals & Complaints</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="dean-badge" style={{ background: '#fff3e0', color: '#e65100', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ⏳ Pending: {pendingCount}
          </span>
          <span className="dean-badge" style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ✅ Resolved: {resolvedCount}
          </span>
          <span className="dean-badge" style={{ background: '#ffebee', color: '#c62828', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ❌ Rejected: {rejectedCount}
          </span>
          <span className="dean-badge" style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ↩️ Sent Back: {sentBackCount}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search student, title, department..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white' }}
        >
          <option value="all">📋 All ({appeals.length})</option>
          <option value="pending">⏳ Pending Dean ({pendingCount})</option>
          <option value="resolved">✅ Resolved ({resolvedCount})</option>
          <option value="rejected">❌ Rejected ({rejectedCount})</option>
          <option value="sent_back">↩️ Sent Back ({sentBackCount})</option>
        </select>
        <button
          onClick={fetchAppeals}
          style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Table */}
      <div className="dean-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading appeals...</div>
        ) : filteredAppeals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p>No complaints match the current filter</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Student</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Title</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Category</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Department</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppeals.map(a => {
                const canAct = a.status === 'escalated';
                const statusStyle = getStatusStyle(a.status);

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 10 }}>
                      <strong>{a.students?.full_name || 'Unknown'}</strong>
                      <br />
                      <small style={{ color: '#666' }}>
                        {a.students?.student_id || '—'}
                        {a.students?.year_of_study ? ` • Y${a.students.year_of_study}` : ''}
                      </small>
                    </td>
                    <td style={{ padding: 10, maxWidth: 220 }}>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <small style={{ color: '#888' }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </small>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 12, fontSize: 12,
                        background: '#e3f2fd', color: '#1565c0'
                      }}>
                        {getCategoryLabel(a.category)}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: '#f3e5f5', color: '#6a1b9a'
                      }}>
                        {a.department_code || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: statusStyle.bg, color: statusStyle.color
                      }}>
                        {getStatusLabel(a.status)}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Always allow View */}
                        <button
                          onClick={() => openModal(a, 'view')}
                          style={{
                            padding: '4px 10px', background: '#607d8b', color: 'white',
                            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12
                          }}
                        >
                          👁 View
                        </button>

                        {canAct && (
                          <>
                            <button
                              onClick={() => openModal(a, 'resolve')}
                              style={{
                                padding: '4px 10px', background: '#4caf50', color: 'white',
                                border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600
                              }}
                            >
                              ✅ Resolve
                            </button>
                            <button
                              onClick={() => openModal(a, 'reject')}
                              style={{
                                padding: '4px 10px', background: '#f44336', color: 'white',
                                border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600
                              }}
                            >
                              ❌ Reject
                            </button>
                            <button
                              onClick={() => openModal(a, 'send_back')}
                              style={{
                                padding: '4px 10px', background: '#ff9800', color: 'white',
                                border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600
                              }}
                            >
                              ↩️ Send Back
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Modal ─────────────────────────────────────────────────────── */}
      {showModal && selectedAppeal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20
          }}
          onClick={() => !processing && closeModal()}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, maxWidth: 580, width: '100%',
              padding: 24, maxHeight: '90vh', overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {actionType === 'view'      && '👁 Complaint Details'}
                {actionType === 'resolve'  && '✅ Resolve Complaint'}
                {actionType === 'reject'   && '❌ Reject Complaint'}
                {actionType === 'send_back'&& '↩️ Send Back to HOD'}
              </h3>
              <button
                onClick={closeModal}
                disabled={processing}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Details */}
            <div style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              <p><strong>Student:</strong> {selectedAppeal.students?.full_name} ({selectedAppeal.students?.student_id})</p>
              <p><strong>Department:</strong> {selectedAppeal.department_code}</p>
              <p><strong>Category:</strong> {getCategoryLabel(selectedAppeal.category)}</p>
              <p><strong>Title:</strong> {selectedAppeal.title}</p>
              <p><strong>Submitted:</strong> {new Date(selectedAppeal.created_at).toLocaleString()}</p>
              <p><strong>Status:</strong> {getStatusLabel(selectedAppeal.status)}</p>

              <p style={{ marginTop: 12 }}><strong>Description:</strong></p>
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                {selectedAppeal.description}
              </div>

              {selectedAppeal.response && (
                <div style={{ marginTop: 12, background: '#fff8e1', padding: 12, borderRadius: 6 }}>
                  <strong>Previous Response / HOD Notes:</strong>
                  <p style={{ margin: '6px 0 0' }}>{selectedAppeal.response}</p>
                </div>
              )}

              {selectedAppeal.sent_back_reason && (
                <div style={{ marginTop: 12, background: '#e3f2fd', padding: 12, borderRadius: 6 }}>
                  <strong>Send-back Reason:</strong>
                  <p style={{ margin: '6px 0 0' }}>{selectedAppeal.sent_back_reason}</p>
                </div>
              )}
            </div>

            {/* Action form (only when not just viewing) */}
            {actionType !== 'view' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                  {actionType === 'resolve'   && 'Resolution Decision *'}
                  {actionType === 'reject'    && 'Rejection Reason *'}
                  {actionType === 'send_back' && 'Reason for sending back to HOD *'}
                </label>
                <textarea
                  value={deanResponse}
                  onChange={e => setDeanResponse(e.target.value)}
                  rows={4}
                  disabled={processing}
                  placeholder={
                    actionType === 'resolve'
                      ? 'Explain your final decision and any actions to be taken...'
                      : actionType === 'reject'
                      ? 'Explain why the complaint is being rejected...'
                      : 'Explain what the HOD needs to address or clarify...'
                  }
                  style={{
                    width: '100%', padding: 10, border: '1px solid #ddd',
                    borderRadius: 6, resize: 'vertical', fontFamily: 'inherit'
                  }}
                />
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 16 }}>
              <button
                onClick={closeModal}
                disabled={processing}
                style={{ padding: '8px 18px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                {actionType === 'view' ? 'Close' : 'Cancel'}
              </button>

              {actionType === 'resolve' && (
                <button
                  onClick={() => handleResolve(selectedAppeal.id)}
                  disabled={processing || !deanResponse.trim()}
                  style={{
                    padding: '8px 18px', background: '#4caf50', color: 'white',
                    border: 'none', borderRadius: 6, fontWeight: 600,
                    cursor: processing || !deanResponse.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !deanResponse.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '✅ Confirm Resolve'}
                </button>
              )}

              {actionType === 'reject' && (
                <button
                  onClick={() => handleReject(selectedAppeal.id)}
                  disabled={processing || !deanResponse.trim()}
                  style={{
                    padding: '8px 18px', background: '#f44336', color: 'white',
                    border: 'none', borderRadius: 6, fontWeight: 600,
                    cursor: processing || !deanResponse.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !deanResponse.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '❌ Confirm Reject'}
                </button>
              )}

              {actionType === 'send_back' && (
                <button
                  onClick={() => handleSendBack(selectedAppeal.id)}
                  disabled={processing || !deanResponse.trim()}
                  style={{
                    padding: '8px 18px', background: '#ff9800', color: 'white',
                    border: 'none', borderRadius: 6, fontWeight: 600,
                    cursor: processing || !deanResponse.trim() ? 'not-allowed' : 'pointer',
                    opacity: processing || !deanResponse.trim() ? 0.6 : 1
                  }}
                >
                  {processing ? 'Saving…' : '↩️ Confirm Send Back'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanAppeals;