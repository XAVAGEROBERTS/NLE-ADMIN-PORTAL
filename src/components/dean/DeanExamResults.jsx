// dean/DeanExamResults.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanExamResults = ({ departments, fetchDeanData, setStats }) => {
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchExamResults = useCallback(async () => {
    if (deptCodes.length === 0) {
      setExamResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exam_results_approvals')
        .select(`
          *,
          examinations:exam_id (id, title, exam_type, total_marks, start_time),
          courses:course_id (course_code, course_name)
        `)
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExamResults(data || []);
    } catch (err) {
      console.error('Error fetching exam results:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchExamResults();
  }, [fetchExamResults]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('exam_results_approvals')
        .update({
          status: 'approved_by_dean',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'dean',
          dean_notes: deanNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Exam results approved by Dean!');
      setShowModal(false);
      setDeanNotes('');
      await fetchExamResults();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error approving results: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_results_approvals')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Exam results rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchExamResults();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting results: ' + err.message);
    }
  };

  const handleReturnToHOD = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide feedback for the HOD');
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_results_approvals')
        .update({
          status: 'pending',
          dean_notes: deanNotes,
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 Results returned to HOD for revision');
      setShowModal(false);
      setDeanNotes('');
      await fetchExamResults();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error returning results: ' + err.message);
    }
  };

  const filteredResults = useMemo(() => {
    return examResults.filter((r) => {
      const matchFilter = filter === 'all' || r.status === filter;
      const matchSearch =
        r.courses?.course_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.courses?.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.examinations?.title?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [examResults, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return examResults.filter(r => r.status === 'pending' || r.status === 'approved_by_hod').length;
  }, [examResults]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📝 Exam Results Approval</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search results..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({examResults.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved_by_hod">HOD Approved</option>
          <option value="approved_by_dean">Dean Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="dean-card">
        {loading ? (
          <div className="dean-loading">Loading exam results...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Course</th>
                <th>Department</th>
                <th>Academic Year</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No exam results found
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.examinations?.title}</strong>
                      <br />
                      <small>{r.examinations?.exam_type}</small>
                    </td>
                    <td>
                      {r.courses?.course_code}
                      <br />
                      <small>{r.courses?.course_name}</small>
                    </td>
                    <td>
                      <span className="dean-badge">{r.department_code}</span>
                    </td>
                    <td>{r.academic_year}</td>
                    <td>
                      <span className={`dean-status ${
                        r.status === 'pending' ? 'dean-status-pending' :
                        r.status === 'approved_by_hod' ? 'dean-status-in-progress' :
                        r.status === 'approved_by_dean' ? 'dean-status-approved' :
                        'dean-status-rejected'
                      }`}>
                        {r.status === 'approved_by_hod' ? 'HOD Approved' :
                         r.status === 'approved_by_dean' ? 'Dean Approved' :
                         r.status}
                      </span>
                    </td>
                    <td>
                      {(r.status === 'pending' || r.status === 'approved_by_hod') && (
                        <div className="dean-action-buttons">
                          <button
                            className="dean-approve-btn"
                            onClick={() => {
                              setSelectedExam(r);
                              setShowModal(true);
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="dean-reject-btn"
                            onClick={() => {
                              setSelectedExam(r);
                              setShowModal(true);
                            }}
                          >
                            ❌ Reject
                          </button>
                          <button
                            className="dean-return-btn"
                            onClick={() => {
                              setSelectedExam(r);
                              setShowModal(true);
                            }}
                          >
                            🔄 Return
                          </button>
                        </div>
                      )}
                      {r.status === 'approved_by_dean' && (
                        <span className="dean-approved-label">✅ Dean Approved</span>
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

      {showModal && selectedExam && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📝 Review Exam Results</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-exam-details">
                <p><strong>Exam:</strong> {selectedExam.examinations?.title}</p>
                <p><strong>Course:</strong> {selectedExam.courses?.course_code} - {selectedExam.courses?.course_name}</p>
                <p><strong>Department:</strong> {selectedExam.department_code}</p>
                <p><strong>Academic Year:</strong> {selectedExam.academic_year}</p>
                <p><strong>Semester:</strong> {selectedExam.semester}</p>
                <p><strong>Current Status:</strong> {selectedExam.status}</p>
                {selectedExam.hod_notes && (
                  <p><strong>HOD Notes:</strong> {selectedExam.hod_notes}</p>
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
              <button className="dean-return-btn" onClick={() => handleReturnToHOD(selectedExam.id)}>
                🔄 Return to HOD
              </button>
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedExam.id)}>
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanExamResults;