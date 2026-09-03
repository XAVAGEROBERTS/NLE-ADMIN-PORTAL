// HOD/HODExamResultsApproval.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const HODExamResultsApproval = ({ departmentCode, courses, fetchHODData, setStats }) => {
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [hodNotes, setHodNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [examMarks, setExamMarks] = useState([]);
  const [examStats, setExamStats] = useState({});

  useEffect(() => {
    fetchExamResults();
  }, [departmentCode]);

  const fetchExamResults = async () => {
    if (!departmentCode) return;

    setLoading(true);
    try {
      console.log('🔍 HOD - Fetching exam results for department:', departmentCode);
      
      // SIMPLIFIED QUERY - No joins, just get the approval records
      const { data, error } = await supabase
        .from('exam_results_approvals')
        .select('*')
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching exam results:', error);
        throw error;
      }

      console.log('📋 HOD - Raw exam results:', data?.length || 0);

      if (!data || data.length === 0) {
        console.log('ℹ️ No exam results found');
        setExamResults([]);
        setLoading(false);
        return;
      }

      // Fetch related data separately
      const examIds = [...new Set(data.map(r => r.exam_id).filter(Boolean))];
      const courseIds = [...new Set(data.map(r => r.course_id).filter(Boolean))];

      console.log('📊 Exam IDs:', examIds);
      console.log('📊 Course IDs:', courseIds);

      // Fetch exams
      let examsMap = {};
      if (examIds.length > 0) {
        const { data: exams, error: examsError } = await supabase
          .from('examinations')
          .select('id, title, exam_type, total_marks, start_time, end_time')
          .in('id', examIds);
        
        if (examsError) {
          console.warn('⚠️ Error fetching exams:', examsError);
        } else if (exams) {
          exams.forEach(e => { examsMap[e.id] = e; });
          console.log('✅ Exams fetched:', exams.length);
        }
      }

      // Fetch courses
      let coursesMap = {};
      if (courseIds.length > 0) {
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('id, course_code, course_name, credits')
          .in('id', courseIds);
        
        if (coursesError) {
          console.warn('⚠️ Error fetching courses:', coursesError);
        } else if (coursesData) {
          coursesData.forEach(c => { coursesMap[c.id] = c; });
          console.log('✅ Courses fetched:', coursesData.length);
        }
      }

      // Combine data
      const processedResults = data.map(r => ({
        ...r,
        examinations: examsMap[r.exam_id] || { 
          id: r.exam_id, 
          title: 'Unknown Exam', 
          exam_type: 'N/A', 
          total_marks: 100 
        },
        courses: coursesMap[r.course_id] || { 
          id: r.course_id, 
          course_code: 'N/A', 
          course_name: 'Unknown Course' 
        },
        lecturer: { full_name: 'Lecturer' }
      }));

      console.log('✅ HOD - Processed results:', processedResults.length);
      setExamResults(processedResults);
    } catch (err) {
      console.error('❌ Error fetching exam results:', err);
    } finally {
      setLoading(false);
    }
  };

  // View marks for an exam - Uses exam_submissions table
  const viewMarks = async (exam) => {
    setSelectedExam(exam);
    
    try {
      console.log('📊 HOD - Viewing marks for exam:', exam.exam_id);
      
      // Fetch from exam_submissions table (same as LecturerExamResults)
      const { data: submissions, error: marksError } = await supabase
        .from('exam_submissions')
        .select(`
          id,
          student_id,
          total_marks_obtained,
          grade,
          grade_points,
          percentage,
          feedback,
          status,
          submitted_at,
          graded_at
        `)
        .eq('exam_id', exam.exam_id)
        .eq('status', 'graded')
        .order('total_marks_obtained', { ascending: false });

      if (marksError) {
        console.error('❌ Error fetching exam submissions:', marksError);
        throw marksError;
      }

      console.log('📊 HOD - Found submissions:', submissions?.length || 0);

      // Get student details for these submissions
      const studentIds = [...new Set((submissions || []).map(s => s.student_id).filter(Boolean))];
      let studentsMap = {};
      
      if (studentIds.length > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, full_name, student_id, email')
          .in('id', studentIds);
        
        if (!studentsError && students) {
          students.forEach(s => { studentsMap[s.id] = s; });
        }
      }

      // Process marks data
      const processedMarks = (submissions || []).map(s => ({
        id: s.id,
        student_id: s.student_id,
        students: studentsMap[s.student_id] || { 
          full_name: 'Unknown Student', 
          student_id: 'N/A', 
          email: 'N/A' 
        },
        marks_obtained: s.total_marks_obtained || 0,
        grade: s.grade || '-',
        grade_points: s.grade_points || 0,
        percentage: s.percentage || 0,
        is_passed: s.grade !== 'F' && s.total_marks_obtained !== null && s.total_marks_obtained !== undefined,
        feedback: s.feedback || '',
        status: s.status,
        submitted_at: s.submitted_at,
        graded_at: s.graded_at
      }));

      // Calculate stats
      const total = processedMarks.length;
      const passed = processedMarks.filter(m => m.is_passed).length;
      const failed = total - passed;
      const marksArray = processedMarks.map(m => m.marks_obtained).filter(m => m !== null && m !== undefined && !isNaN(m));
      const avgMarks = marksArray.length > 0 ? marksArray.reduce((sum, m) => sum + m, 0) / marksArray.length : 0;
      const highest = marksArray.length > 0 ? Math.max(...marksArray) : 0;
      const lowest = marksArray.length > 0 ? Math.min(...marksArray) : 0;

      setExamMarks(processedMarks);
      setExamStats({
        total,
        passed,
        failed,
        avgMarks: avgMarks.toFixed(2),
        highest,
        lowest,
        averageScore: exam.average_score
      });
      setShowMarksModal(true);
    } catch (err) {
      console.error('❌ Error fetching marks:', err);
      alert('Error loading marks: ' + err.message);
    }
  };

  // HOD Approves - sends to Dean
  const handleApprove = async (id) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('exam_results_approvals')
        .update({
          status: 'approved_by_hod',
          hod_approved_at: new Date().toISOString(),
          hod_approved_by: 'hod',
          hod_notes: hodNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Exam results approved! Sent to Dean for final approval.');
      setShowModal(false);
      setHodNotes('');
      await fetchExamResults();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      console.error('Error approving:', err);
      alert('Error approving results: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // HOD Rejects
  const handleReject = async (id) => {
    if (!hodNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('exam_results_approvals')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: hodNotes,
          hod_notes: hodNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Exam results rejected');
      setShowModal(false);
      setHodNotes('');
      await fetchExamResults();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      console.error('Error rejecting:', err);
      alert('Error rejecting results: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredResults = examResults.filter((r) => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchSearch =
      r.courses?.course_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.courses?.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.examinations?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = examResults.filter(r => r.status === 'submitted').length;
  const hodApprovedCount = examResults.filter(r => r.status === 'approved_by_hod').length;
  const rejectedCount = examResults.filter(r => r.status === 'rejected').length;
  const deanApprovedCount = examResults.filter(r => r.status === 'approved_by_dean').length;

  const getStatusLabel = (status) => {
    const labels = {
      draft: '📝 Draft',
      submitted: '⏳ Submitted - Pending HOD',
      approved_by_hod: '📋 HOD Approved (Waiting Dean)',
      approved_by_dean: '✅ Dean Approved',
      rejected: '❌ Rejected',
    };
    return labels[status] || status || 'Unknown';
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📝 Exam Results Approval</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 12px', background: '#fff3e0', color: '#e65100', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
            ⏳ Pending: {pendingCount}
          </span>
          <span style={{ padding: '4px 12px', background: '#e3f2fd', color: '#1565c0', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
            📋 With Dean: {hodApprovedCount}
          </span>
          <span style={{ padding: '4px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
            ✅ Dean Approved: {deanApprovedCount}
          </span>
          <span style={{ padding: '4px 12px', background: '#ffebee', color: '#c62828', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
            ❌ Rejected: {rejectedCount}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by course or exam..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white' }}
        >
          <option value="all">📋 All ({examResults.length})</option>
          <option value="submitted">⏳ Pending HOD ({pendingCount})</option>
          <option value="approved_by_hod">📋 With Dean ({hodApprovedCount})</option>
          <option value="approved_by_dean">✅ Dean Approved ({deanApprovedCount})</option>
          <option value="rejected">❌ Rejected ({rejectedCount})</option>
        </select>
        <button
          onClick={fetchExamResults}
          style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      <div className="hod-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="lecturer-spinner"></div>
            <p>Loading exam results...</p>
          </div>
        ) : examResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📭</span>
            <p>No exam results found for your department</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Exam</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Course</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Students</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Avg Score</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px' }}>
                    <strong>{r.examinations?.title || 'N/A'}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{r.examinations?.exam_type || 'N/A'}</small>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <strong>{r.courses?.course_code || 'N/A'}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{r.courses?.course_name || 'N/A'}</small>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: '#f3e5f5',
                      color: '#6a1b9a'
                    }}>
                      {r.department_code || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <strong>{r.total_students || 0}</strong>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: (r.average_score || 0) >= 60 ? '#e8f5e9' : '#fff3e0',
                      color: (r.average_score || 0) >= 60 ? '#2e7d32' : '#e65100',
                      fontWeight: '600'
                    }}>
                      {r.average_score ? r.average_score.toFixed(1) : '-'}%
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: r.status === 'submitted' ? '#fff3e0' :
                                r.status === 'approved_by_hod' ? '#e3f2fd' :
                                r.status === 'approved_by_dean' ? '#e8f5e9' :
                                r.status === 'rejected' ? '#ffebee' : '#f5f5f5',
                      color: r.status === 'submitted' ? '#e65100' :
                             r.status === 'approved_by_hod' ? '#1565c0' :
                             r.status === 'approved_by_dean' ? '#2e7d32' :
                             r.status === 'rejected' ? '#c62828' : '#666'
                    }}>
                      {getStatusLabel(r.status)}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => viewMarks(r)}
                        style={{
                          padding: '4px 12px',
                          background: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        👁️ View Marks
                      </button>
                      {(r.status === 'submitted') && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedExam(r);
                              setShowModal(true);
                              setHodNotes('');
                            }}
                            style={{
                              padding: '4px 12px',
                              background: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExam(r);
                              setShowModal(true);
                              setHodNotes('');
                            }}
                            style={{
                              padding: '4px 12px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {r.status === 'approved_by_hod' && (
                        <span style={{ color: '#f57c00', fontWeight: '600' }}>⏳ Waiting for Dean</span>
                      )}
                      {r.status === 'approved_by_dean' && (
                        <span style={{ color: '#2e7d32', fontWeight: '600' }}>✅ Dean Approved</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* HOD Action Modal */}
      {showModal && selectedExam && (
        <div
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
          onClick={() => !processing && setShowModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '550px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📝 Review Exam Results</h3>
              <button onClick={() => setShowModal(false)} disabled={processing} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p><strong>Exam:</strong> {selectedExam.examinations?.title || 'N/A'}</p>
              <p><strong>Course:</strong> {selectedExam.courses?.course_code} - {selectedExam.courses?.course_name}</p>
              <p><strong>Department:</strong> {selectedExam.department_code}</p>
              <p><strong>Academic Year:</strong> {selectedExam.academic_year}</p>
              <p><strong>Semester:</strong> {selectedExam.semester}</p>
              <p><strong>Students:</strong> {selectedExam.total_students}</p>
              <p><strong>Average Score:</strong> {selectedExam.average_score?.toFixed(2)}%</p>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>
                HOD Notes (Required for Rejection)
              </label>
              <textarea
                value={hodNotes}
                onChange={(e) => setHodNotes(e.target.value)}
                placeholder="Add your notes or rejection reason..."
                rows={4}
                disabled={processing}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={processing}
                style={{ padding: '8px 20px', background: '#e0e0e0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedExam.id)}
                disabled={processing || !hodNotes.trim()}
                style={{
                  padding: '8px 20px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: processing || !hodNotes.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleApprove(selectedExam.id)}
                disabled={processing}
                style={{
                  padding: '8px 20px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                ✅ Approve & Send to Dean
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Marks Modal */}
      {showMarksModal && selectedExam && (
        <div
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
          onClick={() => setShowMarksModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📊 Exam Marks - {selectedExam.courses?.course_code}</h3>
              <button onClick={() => setShowMarksModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{examStats.total || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Graded Students</div>
              </div>
              <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1565c0' }}>{examStats.passed || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Passed</div>
              </div>
              <div style={{ background: '#ffebee', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828' }}>{examStats.failed || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Failed</div>
              </div>
              <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6a1b9a' }}>{examStats.avgMarks || 0}%</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Average</div>
              </div>
              <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100' }}>{examStats.highest || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Highest</div>
              </div>
              <div style={{ background: '#e0f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00838f' }}>{examStats.lowest || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Lowest</div>
              </div>
            </div>

            {/* Marks Table */}
            {examMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
                <p>No graded submissions found for this exam</p>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Student ID</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Marks</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>%</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Grade</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>GP</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examMarks.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px' }}>{m.students?.student_id || 'N/A'}</td>
                        <td style={{ padding: '8px' }}>{m.students?.full_name || 'Unknown'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{m.marks_obtained || 0}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{m.percentage || 0}%</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: m.grade === 'F' ? '#c62828' : '#2e7d32' }}>{m.grade || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{m.grade_points || 0}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {m.is_passed ? (
                            <span style={{ color: '#2e7d32' }}>✅ Pass</span>
                          ) : (
                            <span style={{ color: '#c62828' }}>❌ Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
              <button
                onClick={() => setShowMarksModal(false)}
                style={{ padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODExamResultsApproval;