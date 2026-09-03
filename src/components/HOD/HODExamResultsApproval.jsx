// HOD/HODExamResultsApproval.jsx - WITH SEPARATE SECTIONS FOR EXAMS AND ASSIGNMENTS
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const HODExamResultsApproval = ({ departmentCode, courses, fetchHODData, setStats }) => {
  const [examResults, setExamResults] = useState([]);
  const [assignmentResults, setAssignmentResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [hodNotes, setHodNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [itemMarks, setItemMarks] = useState([]);
  const [itemStats, setItemStats] = useState({});
  const [itemType, setItemType] = useState('exam');

  useEffect(() => {
    fetchAllResults();
  }, [departmentCode]);

  // ===== FETCH EXAM RESULTS =====
  const fetchExamResults = async () => {
    if (!departmentCode) return [];

    try {
      console.log('📋 HOD - Fetching exam results for department:', departmentCode);
      
      const { data, error } = await supabase
        .from('exam_results_approvals')
        .select('*')
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching exam results:', error);
        return [];
      }

      console.log('📋 Exam results found:', data?.length || 0);

      if (!data || data.length === 0) return [];

      // Fetch exam details
      const examIds = [...new Set(data.map(r => r.exam_id).filter(Boolean))];
      const courseIds = [...new Set(data.map(r => r.course_id).filter(Boolean))];

      let examsMap = {};
      let coursesMap = {};

      if (examIds.length > 0) {
        const { data: exams } = await supabase
          .from('examinations')
          .select('id, title, exam_type, total_marks, start_time, end_time')
          .in('id', examIds);
        if (exams) exams.forEach(e => { examsMap[e.id] = e; });
      }

      if (courseIds.length > 0) {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, course_code, course_name, credits')
          .in('id', courseIds);
        if (coursesData) coursesData.forEach(c => { coursesMap[c.id] = c; });
      }

      return data.map(r => ({
        ...r,
        examinations: examsMap[r.exam_id] || { id: r.exam_id, title: 'Unknown Exam', exam_type: 'N/A', total_marks: 100 },
        courses: coursesMap[r.course_id] || { id: r.course_id, course_code: 'N/A', course_name: 'Unknown Course' },
        result_type: 'exam'
      }));
    } catch (err) {
      console.error('❌ Error in fetchExamResults:', err);
      return [];
    }
  };

  // ===== FETCH ASSIGNMENT RESULTS =====
  const fetchAssignmentResults = async () => {
    if (!departmentCode) return [];

    try {
      console.log('📋 HOD - Fetching assignment results for department:', departmentCode);
      
      const { data, error } = await supabase
        .from('assignment_results_approvals')
        .select('*')
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching assignment results:', error);
        return [];
      }

      console.log('📋 Assignment results found:', data?.length || 0);

      if (!data || data.length === 0) return [];

      // Fetch assignment details
      const assignmentIds = [...new Set(data.map(r => r.assignment_id).filter(Boolean))];
      const courseIds = [...new Set(data.map(r => r.course_id).filter(Boolean))];

      let assignmentsMap = {};
      let coursesMap = {};

      if (assignmentIds.length > 0) {
        const { data: assignments } = await supabase
          .from('assignments')
          .select('id, title, total_marks, due_date, status')
          .in('id', assignmentIds);
        if (assignments) assignments.forEach(a => { assignmentsMap[a.id] = a; });
      }

      if (courseIds.length > 0) {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, course_code, course_name, credits')
          .in('id', courseIds);
        if (coursesData) coursesData.forEach(c => { coursesMap[c.id] = c; });
      }

      return data.map(r => ({
        ...r,
        assignments: assignmentsMap[r.assignment_id] || { id: r.assignment_id, title: 'Unknown Assignment', total_marks: 100 },
        courses: coursesMap[r.course_id] || { id: r.course_id, course_code: 'N/A', course_name: 'Unknown Course' },
        result_type: 'assignment'
      }));
    } catch (err) {
      console.error('❌ Error in fetchAssignmentResults:', err);
      return [];
    }
  };

  // ===== FETCH ALL RESULTS =====
  const fetchAllResults = async () => {
    if (!departmentCode) return;

    setLoading(true);
    try {
      console.log('🔍 HOD - Fetching all results for department:', departmentCode);
      
      const [exams, assignments] = await Promise.all([
        fetchExamResults(),
        fetchAssignmentResults()
      ]);

      setExamResults(exams);
      setAssignmentResults(assignments);

      // Update stats if callback provided
      if (setStats) {
        const allItems = [...exams, ...assignments];
        const pending = allItems.filter(r => r.status === 'submitted').length;
        const hodApproved = allItems.filter(r => r.status === 'approved_by_hod').length;
        const deanApproved = allItems.filter(r => r.status === 'approved_by_dean').length;
        const rejected = allItems.filter(r => r.status === 'rejected').length;
        
        setStats({
          pending,
          hodApproved,
          deanApproved,
          rejected,
          total: allItems.length,
          examCount: exams.length,
          assignmentCount: assignments.length
        });
      }

      console.log('✅ Exams:', exams.length, 'Assignments:', assignments.length);
    } catch (err) {
      console.error('❌ Error fetching all results:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== VIEW MARKS (Handles both exam and assignment) =====
  const viewMarks = async (item) => {
    setSelectedItem(item);
    setItemType(item.result_type);
    
    try {
      console.log(`📊 HOD - Viewing marks for ${item.result_type}:`, item.exam_id || item.assignment_id);
      
      let submissions = [];
      let tableName = '';
      let idField = '';

      if (item.result_type === 'exam') {
        tableName = 'exam_submissions';
        idField = 'exam_id';
        const { data, error } = await supabase
          .from(tableName)
          .select('id, student_id, total_marks_obtained, grade, grade_points, percentage, feedback, status, submitted_at, graded_at')
          .eq(idField, item.exam_id)
          .eq('status', 'graded')
          .order('total_marks_obtained', { ascending: false });
        
        if (error) throw error;
        submissions = data || [];
      } else {
        tableName = 'assignment_submissions';
        idField = 'assignment_id';
        const { data, error } = await supabase
          .from(tableName)
          .select('id, student_id, marks_obtained, feedback, status, submission_date')
          .eq(idField, item.assignment_id)
          .eq('status', 'graded')
          .order('marks_obtained', { ascending: false });
        
        if (error) throw error;
        submissions = data || [];
      }

      console.log('📊 Submissions found:', submissions.length);

      // Get student details
      const studentIds = [...new Set(submissions.map(s => s.student_id).filter(Boolean))];
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
      const totalMarks = item.examinations?.total_marks || item.assignments?.total_marks || 100;
      
      const processedMarks = submissions.map(s => {
        const marksObtained = s.total_marks_obtained || s.marks_obtained || 0;
        const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
        const isPassed = percentage >= 50;
        const grade = s.grade || (isPassed ? 'Pass' : 'Fail');

        return {
          id: s.id,
          student_id: s.student_id,
          students: studentsMap[s.student_id] || { 
            full_name: 'Unknown Student', 
            student_id: 'N/A', 
            email: 'N/A' 
          },
          marks_obtained: marksObtained,
          grade: grade,
          grade_points: s.grade_points || 0,
          percentage: percentage,
          is_passed: isPassed,
          feedback: s.feedback || '',
          status: s.status,
          submitted_at: s.submitted_at || s.submission_date,
          graded_at: s.graded_at
        };
      });

      // Calculate stats
      const total = processedMarks.length;
      const passed = processedMarks.filter(m => m.is_passed).length;
      const failed = total - passed;
      const marksArray = processedMarks.map(m => m.marks_obtained).filter(m => m !== null && m !== undefined && !isNaN(m));
      const avgMarks = marksArray.length > 0 ? marksArray.reduce((sum, m) => sum + m, 0) / marksArray.length : 0;
      const highest = marksArray.length > 0 ? Math.max(...marksArray) : 0;
      const lowest = marksArray.length > 0 ? Math.min(...marksArray) : 0;

      setItemMarks(processedMarks);
      setItemStats({
        total,
        passed,
        failed,
        avgMarks: avgMarks.toFixed(2),
        highest,
        lowest,
        averageScore: item.average_score
      });
      setShowMarksModal(true);
    } catch (err) {
      console.error('❌ Error fetching marks:', err);
      alert('Error loading marks: ' + err.message);
    }
  };

  // ===== HOD APPROVE =====
  const handleApprove = async (id, resultType) => {
    setProcessing(true);
    try {
      const table = resultType === 'exam' ? 'exam_results_approvals' : 'assignment_results_approvals';
      
      const { error } = await supabase
        .from(table)
        .update({
          status: 'approved_by_hod',
          hod_approved_at: new Date().toISOString(),
          hod_approved_by: 'hod',
          hod_notes: hodNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Results approved! Sent to Dean for final approval.');
      setShowModal(false);
      setHodNotes('');
      await fetchAllResults();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      console.error('Error approving:', err);
      alert('Error approving results: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ===== HOD REJECT =====
  const handleReject = async (id, resultType) => {
    if (!hodNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const table = resultType === 'exam' ? 'exam_results_approvals' : 'assignment_results_approvals';
      
      const { error } = await supabase
        .from(table)
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: hodNotes,
          hod_notes: hodNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Results rejected');
      setShowModal(false);
      setHodNotes('');
      await fetchAllResults();
      if (fetchHODData) await fetchHODData();
    } catch (err) {
      console.error('Error rejecting:', err);
      alert('Error rejecting results: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ===== RENDER TABLE ROW =====
  const renderResultRow = (r, index, type) => {
    const item = r.examinations || r.assignments || {};
    const title = item.title || 'N/A';
    const totalMarks = item.total_marks || 100;

    return (
      <tr key={`${type}-${r.id}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
        <td style={{ padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '700',
              background: type === 'exam' ? '#e3f2fd' : '#f3e5f5',
              color: type === 'exam' ? '#1565c0' : '#6a1b9a'
            }}>
              {type === 'exam' ? '📋 EXAM' : '📝 ASSIGNMENT'}
            </span>
            <strong>{title}</strong>
          </div>
          <br />
          <small style={{ color: '#666' }}>
            {type === 'exam' ? item.exam_type || 'N/A' : 'Assignment'}
          </small>
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
          <br />
          <small style={{ color: '#666' }}>Graded: {r.graded_students || 0}</small>
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
                    setSelectedItem(r);
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
                    setSelectedItem(r);
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
    );
  };

  // ===== HELPER FUNCTIONS =====
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

  // ===== FILTER RESULTS =====
  const filterResults = (results) => {
    return results.filter((r) => {
      const item = r.examinations || r.assignments || {};
      const title = item.title || '';
      const courseCode = r.courses?.course_code || '';
      const courseName = r.courses?.course_name || '';
      
      const matchFilter = filter === 'all' || r.status === filter;
      const matchSearch = 
        courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  };

  // ===== COUNTS =====
  const allItems = [...examResults, ...assignmentResults];
  const pendingCount = allItems.filter(r => r.status === 'submitted').length;
  const hodApprovedCount = allItems.filter(r => r.status === 'approved_by_hod').length;
  const rejectedCount = allItems.filter(r => r.status === 'rejected').length;
  const deanApprovedCount = allItems.filter(r => r.status === 'approved_by_dean').length;

  const filteredExams = filterResults(examResults);
  const filteredAssignments = filterResults(assignmentResults);

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📝 Results Approval</h2>
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by course or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px' }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white' }}
        >
          <option value="all">📋 All Status ({allItems.length})</option>
          <option value="submitted">⏳ Pending HOD ({pendingCount})</option>
          <option value="approved_by_hod">📋 With Dean ({hodApprovedCount})</option>
          <option value="approved_by_dean">✅ Dean Approved ({deanApprovedCount})</option>
          <option value="rejected">❌ Rejected ({rejectedCount})</option>
        </select>
        <button
          onClick={fetchAllResults}
          style={{ padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Results Table */}
      <div className="hod-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="lecturer-spinner"></div>
            <p>Loading results...</p>
          </div>
        ) : allItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📭</span>
            <p>No results found for your department</p>
          </div>
        ) : (
          <div>
            {/* EXAM RESULTS SECTION */}
            {filteredExams.length > 0 && (
              <>
                <div style={{ 
                  background: '#e3f2fd', 
                  padding: '8px 16px', 
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ margin: 0, color: '#1565c0' }}>
                    📋 EXAM RESULTS ({filteredExams.length})
                  </h4>
                  <span style={{ fontSize: '12px', color: '#1565c0' }}>
                    {filteredExams.filter(r => r.status === 'submitted').length} pending
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ background: '#e8eaf6' }}>
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
                    {filteredExams.map((r) => renderResultRow(r, r.id, 'exam'))}
                  </tbody>
                </table>
              </>
            )}


            {/* ASSIGNMENT RESULTS SECTION */}
            {filteredAssignments.length > 0 && (
              <>
                <div style={{ 
                  background: '#f3e5f5', 
                  padding: '8px 16px', 
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ margin: 0, color: '#6a1b9a' }}>
                    📝 ASSIGNMENT RESULTS ({filteredAssignments.length})
                  </h4>
                  <span style={{ fontSize: '12px', color: '#6a1b9a' }}>
                    {filteredAssignments.filter(r => r.status === 'submitted').length} pending
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3e5f5' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Assignment</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Course</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Department</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Students</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Avg Score</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((r) => renderResultRow(r, r.id, 'assignment'))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>

      {/* HOD Action Modal */}
      {showModal && selectedItem && (
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
              <h3 style={{ margin: 0 }}>
                {selectedItem.result_type === 'exam' ? '📋 Review Exam Results' : '📝 Review Assignment Results'}
              </h3>
              <button onClick={() => setShowModal(false)} disabled={processing} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p>
                <strong>Type:</strong>{' '}
                <span style={{
                  padding: '2px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: selectedItem.result_type === 'exam' ? '#e3f2fd' : '#f3e5f5',
                  color: selectedItem.result_type === 'exam' ? '#1565c0' : '#6a1b9a'
                }}>
                  {selectedItem.result_type === 'exam' ? 'EXAM' : 'ASSIGNMENT'}
                </span>
              </p>
              <p><strong>Title:</strong> {selectedItem.examinations?.title || selectedItem.assignments?.title || 'N/A'}</p>
              <p><strong>Course:</strong> {selectedItem.courses?.course_code} - {selectedItem.courses?.course_name}</p>
              <p><strong>Department:</strong> {selectedItem.department_code}</p>
              <p><strong>Academic Year:</strong> {selectedItem.academic_year}</p>
              <p><strong>Semester:</strong> {selectedItem.semester}</p>
              <p><strong>Students:</strong> {selectedItem.total_students} (Graded: {selectedItem.graded_students})</p>
              <p><strong>Average Score:</strong> {selectedItem.average_score?.toFixed(2)}%</p>
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
                onClick={() => handleReject(selectedItem.id, selectedItem.result_type)}
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
                onClick={() => handleApprove(selectedItem.id, selectedItem.result_type)}
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
      {showMarksModal && selectedItem && (
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
              <h3 style={{ margin: 0 }}>
                📊 {selectedItem.result_type === 'exam' ? 'Exam' : 'Assignment'} Marks - {selectedItem.courses?.course_code}
              </h3>
              <button onClick={() => setShowMarksModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{itemStats.total || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Graded</div>
              </div>
              <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1565c0' }}>{itemStats.passed || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Passed</div>
              </div>
              <div style={{ background: '#ffebee', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828' }}>{itemStats.failed || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Failed</div>
              </div>
              <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6a1b9a' }}>{itemStats.avgMarks || 0}%</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Average</div>
              </div>
              <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100' }}>{itemStats.highest || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Highest</div>
              </div>
              <div style={{ background: '#e0f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00838f' }}>{itemStats.lowest || 0}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Lowest</div>
              </div>
            </div>

            {/* Marks Table */}
            {itemMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
                <p>No graded submissions found</p>
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
                      <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemMarks.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px' }}>{m.students?.student_id || 'N/A'}</td>
                        <td style={{ padding: '8px' }}>{m.students?.full_name || 'Unknown'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{m.marks_obtained || 0}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{m.percentage || 0}%</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: m.grade === 'F' ? '#c62828' : '#2e7d32' }}>{m.grade || '-'}</td>
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