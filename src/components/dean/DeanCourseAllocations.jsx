// dean/DeanCourseAllocations.jsx - UPDATED (removes courses table update)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanCourseAllocations = ({ facultyId, departments, fetchDeanData, setStats }) => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchAllocations = useCallback(async () => {
    if (deptCodes.length === 0) {
      setAllocations([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_allocations')
        .select(`
          *,
          courses:course_id (course_code, course_name, credits),
          lecturers:lecturer_id (full_name, email)
        `)
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllocations(data || []);
    } catch (err) {
      console.error('Error fetching allocations:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // ✅ FIXED: REMOVED courses table update
  const handleApprove = async (id) => {
    try {
      const { error: updateError } = await supabase
        .from('course_allocations')
        .update({
          status: 'approved',
          approved_by: 'dean',
          approved_at: new Date().toISOString(),
          notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // ❌ REMOVED: Do NOT update courses table
      // await supabase
      //   .from('courses')
      //   .update({ lecturer_id: allocation.lecturer_id })
      //   .eq('id', allocation.course_id);

      alert('✅ Allocation approved successfully!');
      setShowModal(false);
      setDeanNotes('');
      await fetchAllocations();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error approving allocation: ' + err.message);
      console.error('Approve error:', err);
    }
  };

  // ✅ FIXED: Using correct column names
  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('course_allocations')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Allocation rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchAllocations();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting allocation: ' + err.message);
    }
  };

  // ✅ FIXED: Return to HOD
  const handleReturnToHOD = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide feedback for the HOD');
      return;
    }

    try {
      const { error } = await supabase
        .from('course_allocations')
        .update({
          status: 'pending',
          notes: deanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 Allocation returned to HOD for changes');
      setShowModal(false);
      setDeanNotes('');
      await fetchAllocations();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error returning allocation: ' + err.message);
    }
  };

  const filteredAllocations = allocations.filter((a) => {
    const matchFilter = filter === 'all' || a.status === filter;
    const matchSearch =
      a.courses?.course_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.courses?.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.lecturers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = allocations.filter(a => a.status === 'pending').length;
  const approvedCount = allocations.filter(a => a.status === 'approved').length;

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📚 Faculty Course Allocations</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search allocations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({allocations.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved ({approvedCount})</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="dean-refresh-btn" onClick={fetchAllocations}>
          🔄 Refresh
        </button>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading allocations...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Lecturer</th>
                <th>Department</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No allocations found
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.courses?.course_code}</strong>
                      <br />
                      <small>{a.courses?.course_name}</small>
                    </td>
                    <td>
                      {a.lecturers?.full_name}
                      <br />
                      <small>{a.lecturers?.email}</small>
                    </td>
                    <td>
                      <span className="dean-badge">{a.department_code}</span>
                    </td>
                    <td>
                      <span className={`dean-status ${
                        a.status === 'pending' ? 'dean-status-pending' :
                        a.status === 'approved' ? 'dean-status-approved' :
                        'dean-status-rejected'
                      }`}>
                        {a.status}
                      </span>
                      {a.notes && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          <small>Notes: {a.notes}</small>
                        </div>
                      )}
                      {a.rejection_reason && (
                        <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '4px' }}>
                          <small>Reason: {a.rejection_reason}</small>
                        </div>
                      )}
                    </td>
                    <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                      {a.status === 'pending' && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedAllocation(a);
                              setShowModal(true);
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              if (window.confirm('Reject this allocation?')) {
                                setSelectedAllocation(a);
                                const reason = prompt('Reason for rejection:');
                                if (reason) {
                                  setDeanNotes(reason);
                                  handleReject(a.id);
                                }
                              }
                            }}
                          >
                            ❌ Reject
                          </button>
                          <button
                            className="dean-return-btn"
                            onClick={() => {
                              setSelectedAllocation(a);
                              setShowModal(true);
                            }}
                          >
                            🔄 Return
                          </button>
                        </div>
                      )}
                      {a.status === 'approved' && (
                        <span className="dean-approved-label">✅ Approved</span>
                      )}
                      {a.status === 'rejected' && (
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

      {/* Modal */}
      {showModal && selectedAllocation && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📚 Review Allocation</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-allocation-details">
                <p><strong>Course:</strong> {selectedAllocation.courses?.course_code} - {selectedAllocation.courses?.course_name}</p>
                <p><strong>Lecturer:</strong> {selectedAllocation.lecturers?.full_name}</p>
                <p><strong>Department:</strong> {selectedAllocation.department_code}</p>
                <p><strong>Requested By:</strong> {selectedAllocation.requested_by || 'HOD'}</p>
                <p><strong>Requested At:</strong> {new Date(selectedAllocation.created_at).toLocaleString()}</p>
                {selectedAllocation.notes && (
                  <p><strong>HOD Notes:</strong> {selectedAllocation.notes}</p>
                )}
              </div>
              <div className="dean-form-group">
                <label>Dean's Notes / Feedback</label>
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
              <button className="dean-return-btn" onClick={() => handleReturnToHOD(selectedAllocation.id)}>
                🔄 Return to HOD
              </button>
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedAllocation.id)}>
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanCourseAllocations;