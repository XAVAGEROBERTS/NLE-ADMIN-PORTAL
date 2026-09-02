// dean/DeanQualityAssurance.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanQualityAssurance = ({ departments }) => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchChecklists = useCallback(async () => {
    if (deptCodes.length === 0) {
      setChecklists([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qa_checklists')
        .select('*')
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (err) {
      console.error('Error fetching QA checklists:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('qa_checklists')
        .update({
          status: 'approved',
          approved_by: 'dean',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ QA checklist approved!');
      await fetchChecklists();
    } catch (err) {
      alert('Error approving: ' + err.message);
    }
  };

  const filteredChecklists = useMemo(() => {
    return checklists.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.checklist_type?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [checklists, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return checklists.filter(c => c.status === 'pending' || c.status === 'in_progress').length;
  }, [checklists]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">✅ Quality Assurance & Accreditation</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search QA checklists..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({checklists.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading QA checklists...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Type</th>
                <th>Academic Year</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChecklists.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No QA checklists found
                  </td>
                </tr>
              ) : (
                filteredChecklists.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.department_code}</strong>
                    </td>
                    <td>
                      <span className="dean-badge">{c.checklist_type}</span>
                    </td>
                    <td>{c.academic_year}</td>
                    <td>Semester {c.semester}</td>
                    <td>
                      <span className={`dean-status ${
                        c.status === 'pending' ? 'dean-status-pending' :
                        c.status === 'in_progress' ? 'dean-status-in-progress' :
                        c.status === 'completed' ? 'dean-status-approved' :
                        'dean-status-approved'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      {c.status === 'completed' && (
                        <button
                          className="dean-approve-btn"
                          onClick={() => handleApprove(c.id)}
                        >
                          ✅ Approve
                        </button>
                      )}
                      {c.status === 'approved' && (
                        <span className="dean-approved-label">✅ Approved</span>
                      )}
                      <button
                        className="dean-review-btn"
                        onClick={() => {
                          setSelectedChecklist(c);
                          setShowModal(true);
                        }}
                        style={{ marginLeft: '4px' }}
                      >
                        📋 View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && selectedChecklist && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal dean-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📋 QA Checklist Details</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-qa-details">
                <p><strong>Department:</strong> {selectedChecklist.department_code}</p>
                <p><strong>Type:</strong> {selectedChecklist.checklist_type}</p>
                <p><strong>Academic Year:</strong> {selectedChecklist.academic_year}</p>
                <p><strong>Semester:</strong> {selectedChecklist.semester}</p>
                <p><strong>Status:</strong> {selectedChecklist.status}</p>
                {selectedChecklist.notes && (
                  <p><strong>Notes:</strong> {selectedChecklist.notes}</p>
                )}
                <p><strong>Items:</strong></p>
                <ul>
                  {selectedChecklist.items && Object.entries(selectedChecklist.items).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}:</strong> {value ? '✅' : '❌'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanQualityAssurance;