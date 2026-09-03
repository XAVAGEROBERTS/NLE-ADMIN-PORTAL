// lecturer/LecturerExamResults.jsx - COMPLETE WITH APPROVAL RESUBMIT
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';

const LecturerExamResults = ({ profile, courses, showToast }) => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [itemType, setItemType] = useState('exams');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [gradingStudent, setGradingStudent] = useState(null);
  
  const isFetchingRef = useRef(false);
  const lastFetchedIdRef = useRef(null);
  const modalOpenRef = useRef(false);

  const lecturerId = profile?.id;

  // ===== GRADING SYSTEM (Same as Grading Manager) =====
  const getGradeFromMarks = (marks) => {
    if (!marks && marks !== 0) return 'N/A';
    const numericMarks = parseFloat(marks);
    if (isNaN(numericMarks)) return 'N/A';

    if (numericMarks >= 90) return 'A+';
    if (numericMarks >= 80) return 'A';
    if (numericMarks >= 75) return 'B+';
    if (numericMarks >= 70) return 'B';
    if (numericMarks >= 65) return 'C+';
    if (numericMarks >= 60) return 'C';
    if (numericMarks >= 55) return 'D+';
    if (numericMarks >= 50) return 'D';
    return 'F';
  };

  const getGradePoints = (grade) => {
    if (!grade) return 0.0;
    const gradeMap = {
      'A+': 5.0,
      'A': 5.0,
      'B+': 4.5,
      'B': 4.0,
      'C+': 3.5,
      'C': 3.0,
      'D+': 2.5,
      'D': 2.0,
      'F': 0.0
    };
    const points = gradeMap[grade.toUpperCase()];
    return points !== undefined ? points : 0.0;
  };

  const calculatePercentage = (marks, totalMarks = 100) => {
    if (!marks && marks !== 0) return 0;
    const numericMarks = parseFloat(marks);
    if (isNaN(numericMarks)) return 0;
    return Math.round((numericMarks / totalMarks) * 100);
  };

  const getGradeInfo = (marks, totalMarks = 100) => {
    const percentage = calculatePercentage(marks, totalMarks);
    const grade = getGradeFromMarks(percentage);
    const gradePoints = getGradePoints(grade);
    const isPassed = grade !== 'F';
    return { percentage, grade, gradePoints, isPassed };
  };

  // ===== FETCH ITEMS (EXAMS & ASSIGNMENTS) =====
  const fetchItems = useCallback(async () => {
    if (!lecturerId || !courses || courses.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const courseIds = selectedCourse ? [selectedCourse] : courses.map(c => c.id);
      let data = [];

      if (itemType === 'exams') {
        const { data: exams, error } = await supabase
          .from('examinations')
          .select(`
            *,
            courses:course_id (id, course_code, course_name, department_code)
          `)
          .in('course_id', courseIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = exams || [];
      } else {
        const { data: assignments, error } = await supabase
          .from('assignments')
          .select(`
            *,
            courses:course_id (id, course_code, course_name, department_code)
          `)
          .in('course_id', courseIds)
          .eq('lecturer_id', lecturerId)
          .neq('status', 'draft')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = assignments || [];
      }

      // Get approval status
      const itemIds = data?.map(e => e.id) || [];
      let approvalMap = {};
      
      if (itemIds.length > 0) {
        const { data: approvals } = await supabase
          .from('exam_results_approvals')
          .select('id, exam_id, status, hod_notes, dean_notes, rejection_reason')
          .in('exam_id', itemIds);

        approvals?.forEach(a => {
          approvalMap[a.exam_id] = a;
        });
      }

      // Process items
      const processedItems = data.map(item => ({
        ...item,
        approval: approvalMap[item.id] || { status: 'draft' },
        item_type: itemType === 'exams' ? 'exam' : 'assignment',
        max_marks: item.total_marks || 100
      }));

      setItems(processedItems);
    } catch (err) {
      console.error('Error fetching items:', err);
      showToast('Error loading: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [lecturerId, courses, selectedCourse, itemType, showToast]);

  // ===== FETCH STUDENTS =====
  const fetchItemStudents = useCallback(async (item) => {
    if (!item?.course_id) {
      showToast('Error: No course associated', 'error');
      return;
    }

    if (isFetchingRef.current) {
      console.log('⏳ Already fetching, skipping...');
      return;
    }

    if (lastFetchedIdRef.current === item?.id && modalOpenRef.current) {
      console.log('📌 Already fetched item:', item?.id, 'and modal is open, skipping...');
      return;
    }

    console.log('📚 Fetching students for:', item?.id, itemType);
    isFetchingRef.current = true;
    lastFetchedIdRef.current = item?.id;
    setModalLoading(true);

    try {
      // Get enrolled students
      const { data: enrolled, error: enrollError } = await supabase
        .from('student_courses')
        .select('student_id')
        .eq('course_id', item.course_id)
        .eq('status', 'enrolled');

      if (enrollError) {
        console.error('Enroll error:', enrollError);
        showToast('Error fetching enrolled students', 'error');
        isFetchingRef.current = false;
        lastFetchedIdRef.current = null;
        setModalLoading(false);
        return;
      }

      const studentIds = enrolled?.map(sc => sc.student_id) || [];

      if (studentIds.length === 0) {
        showToast(`⚠️ No students enrolled in ${item.courses?.course_code || 'this course'}`, 'info');
        setModalLoading(false);
        isFetchingRef.current = false;
        lastFetchedIdRef.current = null;
        return;
      }

      // Get student details
      const { data: studentDetails, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, student_id, email, department_code')
        .in('id', studentIds);

      if (studentError) throw studentError;

      const studentList = studentDetails?.map(s => ({
        id: s.id,
        full_name: s.full_name || 'Unknown Student',
        student_id: s.student_id || 'N/A',
        email: s.email || 'N/A',
        department: s.department_code || 'N/A'
      })) || [];

      // Get existing submissions/grades
      let existingSubmissions = [];

      if (itemType === 'exams') {
        const { data: examSubmissions, error: subError } = await supabase
          .from('exam_submissions')
          .select('id, student_id, total_marks_obtained, grade, grade_points, percentage, feedback, status, submitted_at')
          .eq('exam_id', item.id);

        if (!subError && examSubmissions) {
          existingSubmissions = examSubmissions.map(s => ({
            id: s.id,
            student_id: s.student_id,
            marks_obtained: s.total_marks_obtained,
            grade: s.grade || '',
            grade_points: s.grade_points || 0,
            percentage: s.percentage || 0,
            is_passed: s.total_marks_obtained !== null && s.total_marks_obtained !== undefined,
            status: s.status || 'submitted',
            submitted_at: s.submitted_at,
            has_submitted: true
          }));
        }
      } else {
        const { data: assignmentSubs, error: subError } = await supabase
          .from('assignment_submissions')
          .select('id, student_id, marks_obtained, feedback, status, submission_date')
          .eq('assignment_id', item.id);

        if (!subError && assignmentSubs) {
          existingSubmissions = assignmentSubs.map(s => ({
            id: s.id,
            student_id: s.student_id,
            marks_obtained: s.marks_obtained,
            grade: '',
            grade_points: 0,
            percentage: s.marks_obtained !== null ? calculatePercentage(s.marks_obtained, item.total_marks || 100) : 0,
            is_passed: s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained >= (item.total_marks || 100) * 0.5,
            status: s.status || 'submitted',
            submitted_at: s.submission_date,
            has_submitted: true
          }));
        }
      }

      console.log('📊 Existing submissions:', existingSubmissions);

      // Build marks map
      const marksMap = {};
      const totalMarks = item.max_marks || 100;

      studentList.forEach(s => {
        const existing = existingSubmissions?.find(m => m.student_id === s.id);
        const hasSubmitted = !!existing?.has_submitted;
        const isGraded = hasSubmitted && existing?.marks_obtained !== null && existing?.marks_obtained !== undefined;

        let grade = existing?.grade || '';
        let gradePoints = existing?.grade_points || 0;
        let percentage = existing?.percentage || 0;
        let isPassed = existing?.is_passed || false;
        let marksValue = existing?.marks_obtained || '';

        if (isGraded) {
          if (!grade || grade === '') {
            const gradeInfo = getGradeInfo(marksValue, totalMarks);
            grade = gradeInfo.grade;
            gradePoints = gradeInfo.gradePoints;
            percentage = gradeInfo.percentage;
            isPassed = gradeInfo.isPassed;
          }
        }

        let submissionStatus = 'not_submitted';
        if (hasSubmitted) {
          if (isGraded) {
            submissionStatus = 'graded';
          } else {
            submissionStatus = 'submitted';
          }
        }

        marksMap[s.id] = {
          marks: isGraded ? marksValue : '',
          grade: grade,
          grade_points: gradePoints,
          percentage: percentage,
          is_passed: isPassed,
          is_graded: isGraded,
          has_submitted: hasSubmitted,
          submission_status: submissionStatus,
          feedback: existing?.feedback || '',
          status: existing?.status || 'not_submitted',
          submission_date: existing?.submitted_at || null,
          submission_id: existing?.id || null
        };
      });

      const gradedCount = Object.values(marksMap).filter(m => m.is_graded).length;
      const submittedCount = Object.values(marksMap).filter(m => m.has_submitted).length;
      const totalCount = studentList.length;
      const allGraded = gradedCount === totalCount && totalCount > 0;

      console.log('✅ Students:', totalCount, 'Graded:', gradedCount, 'Submitted:', submittedCount);

      // Update state
      setStudents(studentList);
      setMarks(marksMap);
      setApprovalStatus(item.approval || { status: 'draft' });
      setSelectedItem({
        ...item,
        allGraded,
        gradedCount,
        totalCount,
        submittedCount,
        notSubmittedCount: totalCount - submittedCount
      });
      
      modalOpenRef.current = true;
      setShowModal(true);
      isFetchingRef.current = false;

    } catch (err) {
      console.error('❌ Error fetching students:', err);
      showToast('Error loading students: ' + err.message, 'error');
      isFetchingRef.current = false;
      lastFetchedIdRef.current = null;
    } finally {
      setModalLoading(false);
    }
  }, [itemType, showToast]);

  // ===== GRADE INDIVIDUAL STUDENT =====
  const handleGradeStudent = async (studentId) => {
    if (!selectedItem) {
      showToast('No item selected', 'error');
      return;
    }

    const markData = marks[studentId];
    if (!markData) {
      showToast('Student data not found', 'error');
      return;
    }

    if (!markData.marks || markData.marks === '') {
      showToast('Please enter marks before grading', 'error');
      return;
    }

    if (!markData.has_submitted) {
      showToast('❌ Student has not submitted. Cannot grade.', 'error');
      return;
    }

    const numMarks = parseFloat(markData.marks);
    const maxMarks = selectedItem.max_marks || 100;

    if (isNaN(numMarks) || numMarks < 0 || numMarks > maxMarks) {
      showToast(`Please enter a valid mark between 0 and ${maxMarks}`, 'error');
      return;
    }

    if (savingGrade) {
      showToast('Please wait, saving in progress...', 'info');
      return;
    }

    setGradingStudent(studentId);
    setSavingGrade(true);
    
    try {
      const gradeInfo = getGradeInfo(numMarks, maxMarks);
      const now = new Date().toISOString();

      console.log('📝 Grading student:', studentId, 'with', numMarks, 'marks');
      console.log('📊 Grade info:', gradeInfo);

      if (itemType === 'exams') {
        const { error } = await supabase
          .from('exam_submissions')
          .update({
            total_marks_obtained: numMarks,
            grade: gradeInfo.grade,
            grade_points: gradeInfo.gradePoints,
            percentage: gradeInfo.percentage,
            feedback: markData.feedback || '',
            status: 'graded',
            graded_by: lecturerId,
            graded_at: now
          })
          .eq('id', markData.submission_id);

        if (error) {
          console.error('Error updating exam grade:', error);
          showToast('Error updating exam grade: ' + error.message, 'error');
          setSavingGrade(false);
          setGradingStudent(null);
          return;
        }
        console.log('✅ Exam grade updated in exam_submissions table');
      } else {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            marks_obtained: numMarks,
            feedback: markData.feedback || '',
            status: 'graded',
            graded_by: lecturerId,
            graded_at: now
          })
          .eq('id', markData.submission_id);

        if (error) {
          console.error('Error updating assignment grade:', error);
          showToast('Error updating assignment grade: ' + error.message, 'error');
          setSavingGrade(false);
          setGradingStudent(null);
          return;
        }
        console.log('✅ Assignment grade updated in assignment_submissions table');
      }

      // Update local state
      setMarks(prev => {
        const updated = {
          ...prev,
          [studentId]: {
            ...prev[studentId],
            marks: numMarks,
            grade: gradeInfo.grade,
            grade_points: gradeInfo.gradePoints,
            percentage: gradeInfo.percentage,
            is_passed: gradeInfo.isPassed,
            is_graded: true,
            has_submitted: true,
            submission_status: 'graded',
            status: 'graded',
            feedback: markData.feedback || ''
          }
        };
        return updated;
      });

      // Update counts
      const totalGraded = Object.values(marks).filter(m => m.is_graded).length + 1;
      const totalStudents = students.length;
      
      setSelectedItem(prev => ({
        ...prev,
        gradedCount: totalGraded,
        allGraded: totalGraded === totalStudents
      }));

      const studentName = students.find(s => s.id === studentId)?.full_name || 'Student';
      showToast(`✅ ${studentName} graded successfully!`, 'success');

    } catch (err) {
      console.error('❌ Error saving grade:', err);
      showToast('Error saving grade: ' + err.message, 'error');
    } finally {
      setSavingGrade(false);
      setGradingStudent(null);
    }
  };

  // ===== GET STUDENT NAME =====
  const getStudentName = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student?.full_name || 'Student';
  };

  // ===== SUBMIT FOR APPROVAL =====
// ===== SUBMIT FOR APPROVAL - FIXED WITH BETTER ERROR HANDLING =====
const handleSubmitForApproval = async () => {
  if (!selectedItem) {
    showToast('No item selected', 'error');
    return;
  }

  const gradedCount = Object.values(marks).filter(m => m.is_graded).length;
  
  if (gradedCount === 0) {
    showToast('⚠️ Please grade at least one student before submitting for approval.', 'error');
    return;
  }

  setSubmitting(true);
  try {
    const totalStudents = students.length;
    const gradedStudents = Object.values(marks).filter(m => m.is_graded);
    const totalMarks = gradedStudents.reduce((sum, s) => sum + parseFloat(s.marks || 0), 0);
    const averageScore = gradedStudents.length > 0 ? totalMarks / gradedStudents.length : 0;

    // Log what we're about to insert
    console.log('📤 Attempting to submit to exam_results_approvals...');
    console.log('📊 Data:', {
      exam_id: selectedItem.id,
      course_id: selectedItem.course_id,
      department_code: selectedItem.courses?.department_code || '',
      total_students: totalStudents,
      graded_students: gradedStudents.length,
      ungraded_students: totalStudents - gradedStudents.length,
      average_score: averageScore,
      status: 'submitted',
      submitted_by: lecturerId,
      submitted_at: new Date().toISOString(),
    });

    // Try to check if table exists first
    const { data: tableCheck, error: tableError } = await supabase
      .from('exam_results_approvals')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Table check failed:', tableError);
      showToast('Database table error: ' + tableError.message, 'error');
      setSubmitting(false);
      return;
    }

    // Build minimal approval data - only essential fields
    const approvalData = {
      exam_id: selectedItem.id,
      course_id: selectedItem.course_id || null,
      department_code: selectedItem.courses?.department_code || '',
      status: 'submitted',
      submitted_by: lecturerId,
      submitted_at: new Date().toISOString(),
    };

    // Try to add optional fields only if they might exist
    try {
      approvalData.total_students = totalStudents;
      approvalData.graded_students = gradedStudents.length;
      approvalData.ungraded_students = totalStudents - gradedStudents.length;
      approvalData.average_score = averageScore;
      approvalData.academic_year = '2024/2025';
      approvalData.semester = 1;
      approvalData.updated_at = new Date().toISOString();
    } catch (e) {
      console.warn('⚠️ Could not add optional fields:', e);
    }

    let result;
    if (selectedItem.approval?.id) {
      // Update existing record
      console.log('🔄 Updating existing approval record:', selectedItem.approval.id);
      result = await supabase
        .from('exam_results_approvals')
        .update(approvalData)
        .eq('id', selectedItem.approval.id)
        .select();
    } else {
      // Insert new record
      console.log('➕ Inserting new approval record');
      result = await supabase
        .from('exam_results_approvals')
        .insert([approvalData])
        .select();
    }

    if (result.error) {
      console.error('❌ Error submitting:', result.error);
      console.error('❌ Error details:', {
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        code: result.error.code
      });
      showToast('Error submitting: ' + result.error.message, 'error');
      setSubmitting(false);
      return;
    }

    console.log('✅ Successfully submitted:', result.data);
    showToast(`✅ Results submitted for HOD approval! (${gradedStudents.length} students graded)`, 'success');
    handleCloseModal();
    await fetchItems();
  } catch (err) {
    console.error('❌ Error submitting:', err);
    showToast('Error submitting: ' + err.message, 'error');
  } finally {
    setSubmitting(false);
  }
};
  // ===== RESUBMIT FOR APPROVAL =====
  const handleResubmitForApproval = async () => {
    if (!selectedItem) return;

    if (!window.confirm('Are you sure you want to resubmit these results for approval?')) return;

    setSubmitting(true);
    try {
      const totalStudents = students.length;
      const gradedStudents = Object.values(marks).filter(m => m.is_graded);
      const totalMarks = gradedStudents.reduce((sum, s) => sum + parseFloat(s.marks || 0), 0);
      const averageScore = gradedStudents.length > 0 ? totalMarks / gradedStudents.length : 0;

      const approvalData = {
        exam_id: selectedItem.id,
        course_id: selectedItem.course_id,
        department_code: selectedItem.courses?.department_code || '',
        academic_year: '2024/2025',
        semester: 1,
        total_students: totalStudents,
        graded_students: gradedStudents.length,
        ungraded_students: totalStudents - gradedStudents.length,
        average_score: averageScore,
        status: 'submitted',
        submitted_by: lecturerId,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let result;
      if (selectedItem.approval?.id) {
        // Update existing record
        result = await supabase
          .from('exam_results_approvals')
          .update(approvalData)
          .eq('id', selectedItem.approval.id);
      } else {
        // Insert new record
        result = await supabase
          .from('exam_results_approvals')
          .insert([approvalData]);
      }

      if (result.error) {
        console.error('❌ Error resubmitting:', result.error);
        showToast('Error resubmitting: ' + result.error.message, 'error');
        setSubmitting(false);
        return;
      }

      console.log('✅ Successfully resubmitted:', result.data);
      showToast('✅ Results resubmitted for approval!', 'success');
      handleCloseModal();
      await fetchItems();
    } catch (err) {
      console.error('❌ Error resubmitting:', err);
      showToast('Error resubmitting: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== WITHDRAW SUBMISSION =====
  const handleWithdraw = async () => {
    if (!selectedItem) return;

    if (!window.confirm('Are you sure you want to withdraw this submission?')) return;

    setSubmitting(true);
    try {
      await supabase
        .from('exam_results_approvals')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('exam_id', selectedItem.id);

      showToast('📝 Submission withdrawn', 'success');
      handleCloseModal();
      await fetchItems();
    } catch (err) {
      console.error('Error withdrawing:', err);
      showToast('Error withdrawing: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CLEAR GRADE =====
  const handleClearGrade = async (studentId) => {
    if (!selectedItem) return;
    
    if (!window.confirm(`Clear grade for ${getStudentName(studentId)}?`)) return;

    try {
      const markData = marks[studentId];
      if (!markData || !markData.submission_id) {
        showToast('No submission found to clear', 'error');
        return;
      }

      if (itemType === 'exams') {
        const { error } = await supabase
          .from('exam_submissions')
          .update({
            total_marks_obtained: null,
            grade: null,
            grade_points: null,
            percentage: null,
            status: 'submitted',
            graded_by: null,
            graded_at: null
          })
          .eq('id', markData.submission_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            marks_obtained: null,
            status: 'submitted',
            graded_by: null,
            graded_at: null
          })
          .eq('id', markData.submission_id);

        if (error) throw error;
      }

      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          marks: '',
          grade: '',
          grade_points: 0,
          percentage: 0,
          is_passed: false,
          is_graded: false,
          submission_status: 'submitted',
          status: 'submitted'
        }
      }));

      setSelectedItem(prev => ({
        ...prev,
        gradedCount: Math.max((prev?.gradedCount || 0) - 1, 0),
        allGraded: false
      }));

      showToast(`Grade cleared for ${getStudentName(studentId)}`, 'success');
    } catch (err) {
      console.error('Error clearing grade:', err);
      showToast('Error clearing grade: ' + err.message, 'error');
    }
  };

  // ===== CLOSE MODAL =====
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setStudents([]);
    setMarks({});
    modalOpenRef.current = false;
    isFetchingRef.current = false;
    lastFetchedIdRef.current = null;
    setGradingStudent(null);
  };

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ===== STATUS BADGE =====
  const getStatusBadge = (status) => {
    const map = {
      draft: { label: '📝 Draft', color: '#666', bg: '#f5f5f5' },
      submitted: { label: '⏳ With HOD', color: '#e65100', bg: '#fff3e0' },
      approved_by_hod: { label: '📋 HOD Approved', color: '#1565c0', bg: '#e3f2fd' },
      approved_by_dean: { label: '✅ Dean Approved', color: '#2e7d32', bg: '#e8f5e9' },
      rejected: { label: '❌ Rejected', color: '#c62828', bg: '#ffebee' },
    };
    return map[status] || map.draft;
  };

  const getSubmissionStatusDisplay = (markData) => {
    if (markData.is_graded) {
      return { label: '✅ Graded', color: '#2e7d32', bg: '#e8f5e9' };
    } else if (markData.has_submitted) {
      return { label: '📤 Submitted', color: '#f57c00', bg: '#fff3e0' };
    } else {
      return { label: '⬜ Not Submitted', color: '#999', bg: '#f5f5f5' };
    }
  };

  const filteredItems = items.filter(item => {
    if (filterStatus === 'all') return true;
    return item.approval?.status === filterStatus;
  });

  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>📝 Results Submission</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f0f0f0', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => {
                setItemType('exams');
                setItems([]);
                handleCloseModal();
              }}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '6px',
                background: itemType === 'exams' ? '#1976d2' : 'transparent',
                color: itemType === 'exams' ? 'white' : '#555',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              📋 Exams
            </button>
            <button
              onClick={() => {
                setItemType('assignments');
                setItems([]);
                handleCloseModal();
              }}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '6px',
                background: itemType === 'assignments' ? '#1976d2' : 'transparent',
                color: itemType === 'assignments' ? 'white' : '#555',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              📝 Assignments
            </button>
          </div>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'white'
            }}
          >
            <option value="">📚 All Courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'white'
            }}
          >
            <option value="all">📋 All</option>
            <option value="draft">📝 Draft</option>
            <option value="submitted">⏳ With HOD</option>
            <option value="approved_by_hod">📋 HOD Approved</option>
            <option value="approved_by_dean">✅ Dean Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>

          <button className="lecturer-refresh-btn" onClick={fetchItems} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading {itemType}...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📭</span>
          <h3>No {itemType === 'exams' ? 'Exams' : 'Assignments'} Available</h3>
          <p style={{ color: '#666' }}>You don't have any {itemType} to submit results for.</p>
        </div>
      ) : (
        <div className="lecturer-courses-grid">
          {filteredItems.map((item) => {
            const statusInfo = getStatusBadge(item.approval?.status || 'draft');

            return (
              <div key={item.id} className="lecturer-course-card">
                <div className="lecturer-course-header">
                  <h3>{item.courses?.course_code}</h3>
                  <span className="lecturer-dept-badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    {item.courses?.department_code}
                  </span>
                </div>
                <h4>{item.title || 'Untitled'}</h4>
                <div className="lecturer-course-details">
                  <span>📅 {itemType === 'exams'
                    ? new Date(item.start_time).toLocaleDateString()
                    : new Date(item.due_date || item.created_at).toLocaleDateString()}
                  </span>
                  <span>📝 {itemType === 'exams' ? item.exam_type : 'Assignment'}</span>
                  <span>📊 {item.max_marks || 100} marks</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: statusInfo.bg,
                    color: statusInfo.color
                  }}>
                    {statusInfo.label}
                  </span>
                </div>
                <button
                  className="lecturer-primary-btn"
                  onClick={() => {
                    isFetchingRef.current = false;
                    lastFetchedIdRef.current = null;
                    modalOpenRef.current = false;
                    fetchItemStudents(item);
                  }}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '10px',
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {item.approval?.status === 'approved_by_hod' || item.approval?.status === 'approved_by_dean'
                    ? '👁️ View Results'
                    : '📝 Grade & Submit'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Grade & Submit Modal */}
      {showModal && selectedItem && (
        <div className="lecturer-modal-overlay" onClick={() => !submitting && !savingGrade && handleCloseModal()}>
          <div className="lecturer-modal" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="lecturer-modal-header">
              <h3>
                📝 Grade {itemType === 'exams' ? 'Exam' : 'Assignment'} - {selectedItem.courses?.course_code}
              </h3>
              <button onClick={handleCloseModal} disabled={submitting || savingGrade}>✕</button>
            </div>
            <div className="lecturer-modal-body">
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p><strong>{selectedItem.title}</strong></p>
                  <p><strong>Course:</strong> {selectedItem.courses?.course_name}</p>
                  <p><strong>Total Marks:</strong> {selectedItem.max_marks || 100}</p>
                  <p><strong>Students:</strong> {selectedItem.totalCount || students.length}</p>
                  <p><strong>Graded:</strong> <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{selectedItem.gradedCount || 0}</span> / {selectedItem.totalCount || students.length}</p>
                  <p><strong>Submitted:</strong> <span style={{ color: '#f57c00', fontWeight: 'bold' }}>{selectedItem.submittedCount || 0}</span> / {selectedItem.totalCount || students.length}</p>
                </div>
                {selectedItem.allGraded !== undefined && (
                  <div style={{ padding: '8px 16px', borderRadius: '8px', background: selectedItem.allGraded ? '#e8f5e9' : '#fff3e0' }}>
                    <span style={{ color: selectedItem.allGraded ? '#2e7d32' : '#e65100', fontWeight: '600' }}>
                      {selectedItem.allGraded ? '✅ All Students Graded' : `⚠️ ${(selectedItem.totalCount || 0) - (selectedItem.gradedCount || 0)} Not Graded`}
                    </span>
                  </div>
                )}
              </div>

              {students.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                  <span style={{ fontSize: '36px', display: 'block' }}>📭</span>
                  <p>No students enrolled in this course</p>
                </div>
              ) : (
                <div className="lecturer-table-container">
                  <table className="lecturer-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Marks ({selectedItem.max_marks || 100})</th>
                        <th>%</th>
                        <th>Grade</th>
                        <th>GP</th>
                        <th>Submission Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, index) => {
                        const markData = marks[s.id] || {
                          marks: '',
                          grade: '',
                          grade_points: 0,
                          percentage: 0,
                          is_passed: false,
                          is_graded: false,
                          has_submitted: false,
                          submission_status: 'not_submitted'
                        };
                        const isReadOnly = approvalStatus?.status === 'approved_by_hod' ||
                          approvalStatus?.status === 'approved_by_dean';
                        const isGrading = gradingStudent === s.id;
                        const canGrade = markData.has_submitted && !markData.is_graded;

                        const submissionStatus = getSubmissionStatusDisplay(markData);

                        return (
                          <tr key={s.id} style={{
                            background: markData.is_graded ? '#e8f5e9' :
                                     markData.has_submitted ? '#fff3e0' : 'transparent'
                          }}>
                            <td>{index + 1}</td>
                            <td>{s.student_id}</td>
                            <td>
                              <strong>{s.full_name}</strong>
                              <br />
                              <small style={{ color: '#999' }}>{s.email}</small>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={markData.marks}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMarks(prev => ({
                                    ...prev,
                                    [s.id]: {
                                      ...prev[s.id],
                                      marks: val
                                    }
                                  }));
                                }}
                                disabled={isReadOnly || savingGrade || !markData.has_submitted}
                                style={{
                                  width: '80px',
                                  padding: '4px 8px',
                                  border: markData.is_graded ? '2px solid #4caf50' :
                                         markData.has_submitted ? '2px solid #ff9800' : '1px solid #ddd',
                                  borderRadius: '4px',
                                  background: isReadOnly ? '#f5f5f5' : 
                                            !markData.has_submitted ? '#f5f5f5' : 'white'
                                }}
                                min="0"
                                max={selectedItem.max_marks || 100}
                                placeholder={markData.has_submitted ? "Enter marks" : "No submission"}
                              />
                            </td>
                            <td>
                              <span style={{ fontWeight: '600', color: markData.percentage >= 50 ? '#2e7d32' : '#c62828' }}>
                                {markData.percentage || 0}%
                              </span>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 'bold',
                                color: markData.grade === 'F' ? '#c62828' :
                                  markData.grade && markData.grade.includes('A') ? '#2e7d32' : '#1565c0'
                              }}>
                                {markData.grade || '-'}
                              </span>
                            </td>
                            <td>{markData.grade_points || 0}</td>
                            <td>
                              <span style={{
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: submissionStatus.bg,
                                color: submissionStatus.color
                              }}>
                                {submissionStatus.label}
                              </span>
                            </td>
                            <td>
                              {canGrade && !isReadOnly && (
                                <button
                                  className="lecturer-grade-btn"
                                  onClick={() => handleGradeStudent(s.id)}
                                  disabled={savingGrade || isGrading || !markData.marks}
                                  style={{
                                    padding: '4px 12px',
                                    background: (savingGrade || isGrading || !markData.marks) ? '#ccc' : '#4caf50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: (savingGrade || isGrading || !markData.marks) ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}
                                >
                                  {isGrading ? '⏳...' : '📝 Grade'}
                                </button>
                              )}
                              {markData.is_graded && !isReadOnly && (
                                <button
                                  className="lecturer-danger-btn"
                                  onClick={() => handleClearGrade(s.id)}
                                  disabled={savingGrade}
                                  style={{
                                    padding: '4px 12px',
                                    background: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: savingGrade ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    marginLeft: '4px'
                                  }}
                                >
                                  ✕ Clear
                                </button>
                              )}
                              {!markData.has_submitted && (
                                <span style={{ color: '#999', fontSize: '11px' }}>🚫 No submission</span>
                              )}
                              {isReadOnly && (
                                <span style={{ color: '#999', fontSize: '11px' }}>🔒</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                        <td colSpan="3">Summary</td>
                        <td>
                          Avg: {students.length > 0 ?
                            (students.reduce((sum, s) => sum + parseFloat(marks[s.id]?.marks || 0), 0) / students.length).toFixed(1) : 0}
                        </td>
                        <td colSpan="5">
                          {students.filter(s => marks[s.id]?.is_graded).length} Graded /
                          {students.filter(s => marks[s.id]?.has_submitted).length} Submitted /
                          {students.filter(s => !marks[s.id]?.has_submitted).length} Not Submitted
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="lecturer-modal-actions">
              <button
                className="lecturer-cancel-btn"
                onClick={handleCloseModal}
                disabled={submitting || savingGrade}
              >
                Close
              </button>
              
              {/* Withdraw button */}
              {approvalStatus?.status === 'submitted' && (
                <button
                  onClick={handleWithdraw}
                  disabled={submitting || savingGrade}
                  style={{
                    padding: '10px 24px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: (submitting || savingGrade) ? 'not-allowed' : 'pointer'
                  }}
                >
                  📤 Withdraw
                </button>
              )}
              
              {/* Submit for Approval button */}
              {(approvalStatus?.status === 'draft' ||
                approvalStatus?.status === 'rejected' ||
                !approvalStatus?.status) && (
                <button
                  className="lecturer-confirm-btn"
                  onClick={handleSubmitForApproval}
                  disabled={submitting || savingGrade || students.length === 0}
                  style={{
                    padding: '10px 24px',
                    background: (submitting || savingGrade || students.length === 0) ? '#ccc' : '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: (submitting || savingGrade || students.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Submitting...' : '📤 Submit for Approval'}
                </button>
              )}

              {/* Resubmit for Approval button - Shows when rejected or already submitted */}
              {(approvalStatus?.status === 'rejected' || approvalStatus?.status === 'submitted') && (
                <button
                  onClick={handleResubmitForApproval}
                  disabled={submitting || savingGrade}
                  style={{
                    padding: '10px 24px',
                    background: '#6f42c1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: (submitting || savingGrade) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Resubmitting...' : '🔄 Resubmit for Approval'}
                </button>
              )}
              
              {/* Status indicators */}
              {approvalStatus?.status === 'approved_by_hod' && (
                <span style={{ padding: '10px 20px', background: '#fff3e0', color: '#e65100', borderRadius: '6px', fontWeight: '600' }}>
                  ⏳ Waiting for Dean
                </span>
              )}
              {approvalStatus?.status === 'approved_by_dean' && (
                <span style={{ padding: '10px 20px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', fontWeight: '600' }}>
                  ✅ Dean Approved
                </span>
              )}
              {approvalStatus?.status === 'rejected' && (
                <span style={{ padding: '10px 20px', background: '#ffebee', color: '#c62828', borderRadius: '6px', fontWeight: '600' }}>
                  ❌ Rejected - Please fix and resubmit
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerExamResults;