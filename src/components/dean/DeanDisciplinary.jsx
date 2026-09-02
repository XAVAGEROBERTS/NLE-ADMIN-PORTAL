// dean/DeanDisciplinary.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanDisciplinary = ({ departments }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [hearingNotes, setHearingNotes] = useState('');
  const [decision, setDecision] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchDisciplinaryCases = useCallback(async () => {
    if (deptCodes.length === 0) {
      setCases([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('disciplinary_cases')
        .select('*')
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error('Error fetching disciplinary cases:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchDisciplinaryCases();
  }, [fetchDisciplinaryCases]);

  const handleResolve = async (id) => {
    if (!decision.trim()) {
      alert('Please provide a decision');
      return;
    }

    try {
      const { error } = await supabase
        .from('disciplinary_cases')
        .update({
          status: 'resolved',
          decision: decision,
          hearing_notes: hearingNotes || null,
          resolved_at: new Date().toISOString(),
          resolved_by: 'dean',
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Case resolved!');
      setShowModal(false);
      setHearingNotes('');
      setDecision('');
      await fetchDisciplinaryCases();
    } catch (err) {
      alert('Error resolving case: ' + err.message);
    }
  };

  const handleDismiss = async (id) => {
    if (!window.confirm('Dismiss this case?')) return;

    try {
      const { error } = await supabase
        .from('disciplinary_cases')
        .update({
          status: 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: 'dean',
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Case dismissed');
      await fetchDisciplinaryCases();
    } catch (err) {
      alert('Error dismissing case: ' + err.message);
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [cases, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return cases.filter(c => c.status === 'pending' || c.status === 'investigating' || c.status === 'hearing_scheduled').length;
  }, [cases]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">⚖️ Disciplinary Cases</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Active</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search cases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({cases.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="investigating">Investigating</option>
          <option value="hearing_scheduled">Hearing Scheduled</option>
          <option value="pending_decision">Pending Decision</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading disciplinary cases...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Title</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                    No disciplinary cases found
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.case_number}</strong></td>
                    <td>{c.title}</td>
                    <td>
                      <span className="dean-badge">{c.case_type}</span>
                    </td>
                    <td>{c.department_code}</td>
                    <td>
                      <span className={`dean-status ${
                        c.status === 'pending' ? 'dean-status-pending' :
                        c.status === 'investigating' ? 'dean-status-in-progress' :
                        c.status === 'hearing_scheduled' ? 'dean-status-in-progress' :
                        c.status === 'pending_decision' ? 'dean-status-pending' :
                        c.status === 'resolved' ? 'dean-status-approved' :
                        'dean-status-rejected'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      {(c.status === 'pending' || c.status === 'investigating' || c.status === 'hearing_scheduled' || c.status === 'pending_decision') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedCase(c);
                              setShowModal(true);
                            }}
                          >
                            ⚖️ Resolve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => handleDismiss(c.id)}
                          >
                            ❌ Dismiss
                          </button>
                        </div>
                      )}
                      {c.status === 'resolved' && (
                        <span className="dean-approved-label">✅ Resolved</span>
                      )}
                      {c.status === 'dismissed' && (
                        <span className="dean-rejected-label">❌ Dismissed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedCase && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal dean-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>⚖️ Review Disciplinary Case</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-case-details">
                <p><strong>Case #:</strong> {selectedCase.case_number}</p>
                <p><strong>Title:</strong> {selectedCase.title}</p>
                <p><strong>Type:</strong> {selectedCase.case_type}</p>
                <p><strong>Department:</strong> {selectedCase.department_code}</p>
                <p><strong>Description:</strong></p>
                <p>{selectedCase.description}</p>
                {selectedCase.hearing_date && (
                  <p><strong>Hearing Date:</strong> {new Date(selectedCase.hearing_date).toLocaleString()}</p>
                )}
              </div>
              <div className="dean-form-group">
                <label>Hearing Notes</label>
                <textarea
                  value={hearingNotes}
                  onChange={(e) => setHearingNotes(e.target.value)}
                  className="dean-textarea"
                  placeholder="Add hearing notes..."
                  rows={3}
                />
              </div>
              <div className="dean-form-group">
                <label>Decision</label>
                <textarea
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="dean-textarea"
                  placeholder="Enter the decision..."
                  rows={3}
                />
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-approve-btn" onClick={() => handleResolve(selectedCase.id)}>
                ✅ Resolve Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanDisciplinary;