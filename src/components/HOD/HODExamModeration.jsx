// HODExamModeration.jsx - Fixed Version
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const HODExamModeration = ({ departmentCode, courses }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [moderationNotes, setModerationNotes] = useState('');
  const [moderationStatus, setModerationStatus] = useState('approved');
  const [moderations, setModerations] = useState({});

  useEffect(() => {
    fetchExams();
    fetchModerations();
  }, [departmentCode]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const courseIds = courses.map(c => c.id);
      if (courseIds.length === 0) {
        setExams([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('examinations')
        .select(`
          *,
          courses:course_id (course_code, course_name)
        `)
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchModerations = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_moderations')
        .select('*')
        .eq('department_code', departmentCode);

      if (error) throw error;

      // Create a map of exam_id -> moderation
      const modMap = {};
      (data || []).forEach(m => {
        modMap[m.exam_id] = m;
      });
      setModerations(modMap);
    } catch (err) {
      console.error('Error fetching moderations:', err);
    }
  };

  const handleModerate = async () => {
    if (!moderationNotes.trim()) {
      alert('Please provide moderation notes');
      return;
    }

    try {
      // Check if moderation already exists
      const existing = moderations[selectedExam?.id];

      if (existing) {
        // Update existing moderation
        const { error } = await supabase
          .from('exam_moderations')
          .update({
            moderation_status: moderationStatus,
            moderation_notes: moderationNotes,
            moderated_by: 'hod',
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new moderation
        const { error } = await supabase
          .from('exam_moderations')
          .insert([{
            exam_id: selectedExam.id,
            department_code: departmentCode,
            moderation_status: moderationStatus,
            moderation_notes: moderationNotes,
            moderated_by: 'hod',
            moderated_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      alert('✅ Exam moderated successfully!');
      await fetchModerations();
      await fetchExams();
      setShowModal(false);
      setSelectedExam(null);
      setModerationNotes('');
      setModerationStatus('approved');
    } catch (err) {
      alert('Error moderating exam: ' + err.message);
    }
  };

  const getModerationStatus = (examId) => {
    const mod = moderations[examId];
    return mod?.moderation_status || 'pending';
  };

  const getModerationNotes = (examId) => {
    const mod = moderations[examId];
    return mod?.moderation_notes || '';
  };

  const filteredExams = exams.filter((e) => {
    const status = getModerationStatus(e.id);
    const matchFilter = filter === 'all' || status === filter;
    const matchSearch = 
      e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.courses?.course_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = exams.filter(e => getModerationStatus(e.id) === 'pending').length;

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📝 Exam Moderation</h2>
        <span className="hod-badge hod-badge-pending">{pendingCount} pending</span>
      </div>

      <div className="hod-filters">
        <input
          type="text"
          placeholder="Search exams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All ({exams.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_revision">Needs Revision</option>
        </select>
      </div>

      <div className="hod-card">
        {loading ? (
          <div className="hod-loading">Loading exams...</div>
        ) : (
          <table className="hod-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Course</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No exams found
                  </td>
                </tr>
              ) : (
                filteredExams.map((e) => {
                  const status = getModerationStatus(e.id);
                  const notes = getModerationNotes(e.id);
                  
                  return (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.title}</strong>
                        <br />
                        <small>{e.total_marks} marks</small>
                      </td>
                      <td>
                        {e.courses?.course_code}
                        <br />
                        <small>{e.courses?.course_name}</small>
                      </td>
                      <td>
                        <span className="hod-badge">{e.exam_type}</span>
                      </td>
                      <td>{new Date(e.start_time).toLocaleDateString()}</td>
                      <td>
                        <span className={`hod-status ${
                          status === 'pending' ? 'hod-status-pending' :
                          status === 'approved' ? 'hod-status-approved' :
                          status === 'rejected' ? 'hod-status-rejected' : 
                          'hod-status-in-progress'
                        }`}>
                          {status}
                        </span>
                        {notes && (
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            <small>{notes}</small>
                          </div>
                        )}
                      </td>
                      <td>
                        <button 
                          className="hod-primary-btn"
                          onClick={() => {
                            setSelectedExam(e);
                            const existing = moderations[e.id];
                            if (existing) {
                              setModerationStatus(existing.moderation_status || 'pending');
                              setModerationNotes(existing.moderation_notes || '');
                            } else {
                              setModerationStatus('approved');
                              setModerationNotes('');
                            }
                            setShowModal(true);
                          }}
                        >
                          {status === 'pending' ? '📝 Moderate' : '✏️ Edit'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Moderation Modal */}
      {showModal && selectedExam && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📝 Moderate Exam</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-exam-details">
                <p><strong>Title:</strong> {selectedExam.title}</p>
                <p><strong>Course:</strong> {selectedExam.courses?.course_code} - {selectedExam.courses?.course_name}</p>
                <p><strong>Type:</strong> {selectedExam.exam_type}</p>
                <p><strong>Total Marks:</strong> {selectedExam.total_marks}</p>
                <p><strong>Duration:</strong> {selectedExam.duration_minutes} minutes</p>
              </div>
              <div className="hod-form-group">
                <label>Moderation Status</label>
                <select
                  value={moderationStatus}
                  onChange={(e) => setModerationStatus(e.target.value)}
                  className="hod-select"
                >
                  <option value="approved">✅ Approve</option>
                  <option value="rejected">❌ Reject</option>
                  <option value="needs_revision">🔄 Needs Revision</option>
                </select>
              </div>
              <div className="hod-form-group">
                <label>Moderation Notes</label>
                <textarea
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  className="hod-textarea"
                  placeholder="Provide feedback on the exam..."
                  rows={4}
                />
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="hod-save-btn" onClick={handleModerate}>
                Submit Moderation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODExamModeration;