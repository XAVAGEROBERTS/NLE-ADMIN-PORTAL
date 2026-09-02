// dean/DeanCurriculum.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanCurriculum = ({ departments, fetchDeanData, setStats }) => {
  const [curriculumChanges, setCurriculumChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchCurriculumChanges = useCallback(async () => {
    if (deptCodes.length === 0) {
      setCurriculumChanges([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('curriculum_changes')
        .select('*')
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCurriculumChanges(data || []);
    } catch (err) {
      console.error('Error fetching curriculum changes:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchCurriculumChanges();
  }, [fetchCurriculumChanges]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('curriculum_changes')
        .update({
          status: 'approved',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'dean',
          dean_notes: deanNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Curriculum change approved!');
      setShowModal(false);
      setDeanNotes('');
      await fetchCurriculumChanges();
      if (fetchDeanData) await fetchDeanData();
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
        .from('curriculum_changes')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Curriculum change rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchCurriculumChanges();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting: ' + err.message);
    }
  };

  const handleReturnToHOD = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide feedback for the HOD');
      return;
    }

    try {
      const { error } = await supabase
        .from('curriculum_changes')
        .update({
          status: 'needs_revision',
          dean_notes: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 Curriculum change returned to HOD for revision');
      setShowModal(false);
      setDeanNotes('');
      await fetchCurriculumChanges();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error returning: ' + err.message);
    }
  };

  const filteredChanges = useMemo(() => {
    return curriculumChanges.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [curriculumChanges, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return curriculumChanges.filter(c => c.status === 'pending_dean' || c.status === 'pending').length;
  }, [curriculumChanges]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📋 Curriculum & Programme Approval</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search curriculum changes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({curriculumChanges.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_revision">Needs Revision</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading curriculum changes...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No curriculum changes found
                  </td>
                </tr>
              ) : (
                filteredChanges.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.title}</strong>
                      <br />
                      <small>{c.change_type}</small>
                    </td>
                    <td>
                      <span className="dean-badge">{c.change_type}</span>
                    </td>
                    <td>{c.department_code}</td>
                    <td>
                      <span className={`dean-status ${
                        c.status === 'pending' || c.status === 'pending_dean' ? 'dean-status-pending' :
                        c.status === 'approved' ? 'dean-status-approved' :
                        c.status === 'rejected' ? 'dean-status-rejected' :
                        'dean-status-in-progress'
                      }`}>
                        {c.status === 'pending_dean' ? 'Pending Dean' : c.status}
                      </span>
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      {(c.status === 'pending' || c.status === 'pending_dean') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedChange(c);
                              setShowModal(true);
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              setSelectedChange(c);
                              setShowModal(true);
                            }}
                          >
                            ❌ Reject
                          </button>
                          <button
                            className="dean-return-btn"
                            onClick={() => {
                              setSelectedChange(c);
                              setShowModal(true);
                            }}
                          >
                            🔄 Return
                          </button>
                        </div>
                      )}
                      {c.status === 'approved' && (
                        <span className="dean-approved-label">✅ Approved</span>
                      )}
                      {c.status === 'rejected' && (
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

      {showModal && selectedChange && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📋 Review Curriculum Change</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-curriculum-details">
                <p><strong>Title:</strong> {selectedChange.title}</p>
                <p><strong>Type:</strong> {selectedChange.change_type}</p>
                <p><strong>Department:</strong> {selectedChange.department_code}</p>
                <p><strong>Description:</strong></p>
                <p>{selectedChange.description}</p>
                {selectedChange.proposed_changes && (
                  <p><strong>Proposed Changes:</strong> {selectedChange.proposed_changes}</p>
                )}
                {selectedChange.justification && (
                  <p><strong>Justification:</strong> {selectedChange.justification}</p>
                )}
                {selectedChange.hod_notes && (
                  <p><strong>HOD Notes:</strong> {selectedChange.hod_notes}</p>
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
              <button className="dean-return-btn" onClick={() => handleReturnToHOD(selectedChange.id)}>
                🔄 Return to HOD
              </button>
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedChange.id)}>
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanCurriculum;