// dean/DeanPostgraduate.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanPostgraduate = ({ departments }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchRequests = useCallback(async () => {
    if (deptCodes.length === 0) {
      setRequests([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('postgraduate_requests')
        .select(`
          *,
          students:student_id (id, full_name, student_id, email)
        `)
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching postgraduate requests:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('postgraduate_requests')
        .update({
          status: 'approved',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'dean',
          dean_notes: deanNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Postgraduate request approved!');
      setShowModal(false);
      setDeanNotes('');
      await fetchRequests();
    } catch (err) {
      alert('Error approving: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('postgraduate_requests')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Request rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchRequests();
    } catch (err) {
      alert('Error rejecting: ' + err.message);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchFilter = filter === 'all' || r.status === filter;
      const matchSearch =
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.students?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [requests, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return requests.filter(r => r.status === 'pending_dean' || r.status === 'pending').length;
  }, [requests]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">🎯 Postgraduate & Research Oversight</h2>
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
          <option value="all">All ({requests.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_revision">Needs Revision</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading postgraduate requests...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Title</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                    No postgraduate requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.students?.full_name || 'N/A'}</strong>
                      <br />
                      <small>{r.students?.student_id}</small>
                    </td>
                    <td>{r.title}</td>
                    <td>
                      <span className="dean-badge">{r.request_type}</span>
                    </td>
                    <td>{r.department_code}</td>
                    <td>
                      <span className={`dean-status ${
                        r.status === 'pending' || r.status === 'pending_dean' ? 'dean-status-pending' :
                        r.status === 'approved' ? 'dean-status-approved' :
                        r.status === 'rejected' ? 'dean-status-rejected' :
                        'dean-status-in-progress'
                      }`}>
                        {r.status === 'pending_dean' ? 'Pending Dean' : r.status}
                      </span>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      {(r.status === 'pending' || r.status === 'pending_dean') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedRequest(r);
                              setShowModal(true);
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              setSelectedRequest(r);
                              setShowModal(true);
                            }}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <span className="dean-approved-label">✅ Approved</span>
                      )}
                      {r.status === 'rejected' && (
                        <span className="dean-rejected-label">❌ Rejected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedRequest && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>🎯 Review Postgraduate Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-request-details">
                <p><strong>Student:</strong> {selectedRequest.students?.full_name}</p>
                <p><strong>Title:</strong> {selectedRequest.title}</p>
                <p><strong>Type:</strong> {selectedRequest.request_type}</p>
                <p><strong>Department:</strong> {selectedRequest.department_code}</p>
                <p><strong>Description:</strong></p>
                <p>{selectedRequest.description}</p>
                {selectedRequest.hod_notes && (
                  <p><strong>HOD Notes:</strong> {selectedRequest.hod_notes}</p>
                )}
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
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedRequest.id)}>
                ✅ Approve
              </button>
              <button className="dean-reject-btn" onClick={() => handleReject(selectedRequest.id)}>
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanPostgraduate;