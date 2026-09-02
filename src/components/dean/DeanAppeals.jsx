// dean/DeanAppeals.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanAppeals = ({ departments, fetchDeanData, setStats }) => {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [deanResponse, setDeanResponse] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

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
          students:student_id (id, full_name, student_id, email)
        `)
        .in('department_code', deptCodes)
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

  const handleResolve = async (id) => {
    if (!deanResponse.trim()) {
      alert('Please provide a response');
      return;
    }

    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'resolved_by_dean',
          response: deanResponse,
          responded_by: 'dean',
          responded_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Appeal resolved successfully!');
      setShowModal(false);
      setDeanResponse('');
      await fetchAppeals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error resolving appeal: ' + err.message);
    }
  };

  const handleEscalate = async (id) => {
    if (!deanResponse.trim()) {
      alert('Please provide notes for escalation');
      return;
    }

    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({
          status: 'escalated',
          response: deanResponse,
          responded_by: 'dean',
          responded_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 Appeal escalated to higher authority');
      setShowModal(false);
      setDeanResponse('');
      await fetchAppeals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error escalating appeal: ' + err.message);
    }
  };

  const filteredAppeals = useMemo(() => {
    return appeals.filter((a) => {
      const matchFilter = filter === 'all' ||
        (filter === 'pending' && a.status === 'pending_dean') ||
        (filter === 'resolved' && a.status === 'resolved_by_dean') ||
        (filter === 'escalated' && a.status === 'escalated');

      const matchSearch =
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.students?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [appeals, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return appeals.filter(a => a.status === 'pending_dean' || a.status === 'pending').length;
  }, [appeals]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">💬 Faculty Appeals & Complaints</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search appeals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({appeals.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading appeals...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Title</th>
                <th>Category</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppeals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No appeals found
                  </td>
                </tr>
              ) : (
                filteredAppeals.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.students?.full_name}</strong>
                      <br />
                      <small>{a.students?.student_id}</small>
                    </td>
                    <td>{a.title}</td>
                    <td>
                      <span className="dean-badge">{a.category}</span>
                    </td>
                    <td>{a.department_code}</td>
                    <td>
                      <span className={`dean-status ${
                        a.status === 'pending_dean' || a.status === 'pending' ? 'dean-status-pending' :
                        a.status === 'resolved_by_dean' ? 'dean-status-approved' :
                        a.status === 'escalated' ? 'dean-status-in-progress' :
                        'dean-status-rejected'
                      }`}>
                        {a.status === 'pending_dean' ? 'Pending Dean' :
                         a.status === 'resolved_by_dean' ? 'Resolved by Dean' :
                         a.status === 'escalated' ? 'Escalated' :
                         a.status}
                      </span>
                    </td>
                    <td>
                      {(a.status === 'pending_dean' || a.status === 'pending') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedAppeal(a);
                              setShowModal(true);
                            }}
                          >
                            💬 Respond
                          </button>
                          <button
                            className="dean-warning-btn"
                            onClick={() => {
                              setSelectedAppeal(a);
                              setShowModal(true);
                            }}
                          >
                            🔄 Escalate
                          </button>
                        </div>
                      )}
                      {a.status === 'resolved_by_dean' && (
                        <span className="dean-approved-label">✅ Resolved</span>
                      )}
                      {a.status === 'escalated' && (
                        <span className="dean-warning-label">🔄 Escalated</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedAppeal && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>💬 Review Appeal</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-appeal-details">
                <p><strong>Student:</strong> {selectedAppeal.students?.full_name}</p>
                <p><strong>Title:</strong> {selectedAppeal.title}</p>
                <p><strong>Category:</strong> {selectedAppeal.category}</p>
                <p><strong>Department:</strong> {selectedAppeal.department_code}</p>
                <p><strong>Description:</strong></p>
                <p className="dean-appeal-description">{selectedAppeal.description}</p>
                {selectedAppeal.response && (
                  <p><strong>Previous Response:</strong> {selectedAppeal.response}</p>
                )}
              </div>
              <div className="dean-form-group">
                <label>Dean's Response</label>
                <textarea
                  value={deanResponse}
                  onChange={(e) => setDeanResponse(e.target.value)}
                  className="dean-textarea"
                  placeholder="Provide your response..."
                  rows={4}
                />
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-warning-btn" onClick={() => handleEscalate(selectedAppeal.id)}>
                🔄 Escalate
              </button>
              <button className="dean-approve-btn" onClick={() => handleResolve(selectedAppeal.id)}>
                ✅ Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanAppeals;