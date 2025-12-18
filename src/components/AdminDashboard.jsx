// AdminDashboard.jsx - COMPLETE VERSION WITH ALL MODALS
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import DepartmentAssignmentModal from './DepartmentAssignmentModal';
import { useLecturerDepartments } from '../hooks/useLecturerDepartments';
import './AdminDashboardStyles.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, isLecturer, loading: authLoading } = useAdminAuth();
  
  // Department hook
  const { 
    departments: allowedDepartments, 
    departmentCodes,
    loading: deptLoading,
    hasAccess
  } = useLecturerDepartments(isLecturer ? profile?.id : null);

  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState({ dashboard: true });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Statistics state
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    totalAssignments: 0,
    totalExams: 0,
    totalFinancialRecords: 0,
    totalLectures: 0,
    pendingExams: 0,
    pendingAssignments: 0,
    pendingPayments: 0,
    attendanceRate: 0,
    // Lecturer specific stats
    myAssignments: 0,
    pendingGrading: 0,
    gradedSubmissions: 0,
    lateSubmissions: 0,
    averageGrade: 0,
    submissionRate: 0
  });

  // Data states
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // ASSIGNMENT MANAGEMENT STATES
  const [myAssignments, setMyAssignments] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [gradeForm, setGradeForm] = useState({});
  const [bulkGrading, setBulkGrading] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);

  // Modals and forms
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedLecturerForDept, setSelectedLecturerForDept] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAssignmentUploadModal, setShowAssignmentUploadModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [showLectureDetailsModal, setShowLectureDetailsModal] = useState(false);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedFinanceRecord, setSelectedFinanceRecord] = useState(null);

  // Form states
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'student',
    program: '',
    year_of_study: 1,
    department: '',
    specialization: '',
    google_meet_link: ''
  });

  const [newCourse, setNewCourse] = useState({
    course_code: '',
    course_name: '',
    description: '',
    credits: 3,
    year: 1,
    semester: 1,
    program: '',
    faculty: '',
    department: '',
    department_code: '',
    is_core: true
  });

  const [newAssignment, setNewAssignment] = useState({
    course_id: '',
    title: '',
    description: '',
    instructions: '',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    submission_type: 'file',
    max_file_size: 10,
    allowed_formats: ['pdf', 'doc', 'docx', 'zip'],
    file_urls: []
  });

  // ASSIGNMENT UPLOAD STATE
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [newLecture, setNewLecture] = useState({
    course_id: '',
    title: '',
    description: '',
    google_meet_link: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '11:00',
    duration_minutes: 120,
    materials_url: [],
    status: 'scheduled'
  });

  const [newExam, setNewExam] = useState({
    course_id: '',
    title: '',
    description: '',
    exam_type: 'midterm',
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    venue: 'Main Hall',
    status: 'scheduled'
  });

  const [newFinanceRecord, setNewFinanceRecord] = useState({
    student_id: '',
    description: '',
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    receipt_number: `REC-${Date.now().toString().slice(-6)}`
  });

  const [newAttendanceRecord, setNewAttendanceRecord] = useState({
    student_id: '',
    lecture_id: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'present',
    check_in_time: '09:00',
    check_out_time: '11:00',
    remarks: ''
  });

  // Edit states
  const [editingLecture, setEditingLecture] = useState(null);
  const [editLecture, setEditLecture] = useState({
    title: '',
    description: '',
    google_meet_link: '',
    scheduled_date: '',
    start_time: '',
    end_time: ''
  });

  const [editingExam, setEditingExam] = useState(null);
  const [editExam, setEditExam] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    venue: '',
    status: ''
  });

  // Refs
  const subscriptionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize dashboard
  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
      return;
    }
    
    if (profile) {
      initializeDashboard();
      setupRealtimeSubscription();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [profile, authLoading, navigate]);

  const initializeDashboard = async () => {
    try {
      setLoading(prev => ({ ...prev, dashboard: true }));
      
      await Promise.all([
        fetchDashboardStats(),
        fetchStudents(),
        fetchLecturers(),
        fetchCourses(),
        fetchAssignments(),
        fetchExams(),
        fetchFinancialRecords(),
        fetchLectures(),
        fetchAttendanceData(),
      ]);
      
      // Fetch lecturer-specific data if lecturer
      if (isLecturer) {
        await Promise.all([
          fetchMyAssignments(),
          fetchLecturerStatistics()
        ]);
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setLoading(prev => ({ ...prev, dashboard: false }));
    }
  };

  const setupRealtimeSubscription = () => {
    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'assignment_submissions' }, 
          () => {
            if (isLecturer && selectedAssignment) {
              fetchAssignmentSubmissions(selectedAssignment.id);
            }
            fetchDashboardStats();
            if (isLecturer) {
              fetchLecturerStatistics();
            }
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'assignments' },
          () => {
            fetchAssignments();
            if (isLecturer) {
              fetchMyAssignments();
            }
          }
        )
        .subscribe((status) => {
          setRealtimeConnected(status === 'SUBSCRIBED');
        });
      
      subscriptionRef.current = subscription;
      
    } catch (error) {
      console.error('Realtime subscription error:', error);
    }
  };

  // =================== ASSIGNMENT MANAGEMENT FUNCTIONS ===================

  // Fetch lecturer's assignments
  const fetchMyAssignments = async () => {
    if (!isLecturer) return;
    
    try {
      const { data, error } = await supabase.rpc('get_lecturer_assignments', {
        p_lecturer_id: profile.id
      });
      
      if (error) throw error;
      setMyAssignments(data || []);
      
    } catch (error) {
      console.error('Error fetching my assignments:', error);
    }
  };

  // Fetch assignment submissions
  const fetchAssignmentSubmissions = async (assignmentId) => {
    try {
      const { data, error } = await supabase.rpc('get_assignment_submissions_detail', {
        p_assignment_id: assignmentId
      });
      
      if (error) throw error;
      setAssignmentSubmissions(data || []);
      
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  // Fetch lecturer statistics
  const fetchLecturerStatistics = async () => {
    if (!isLecturer) return;
    
    try {
      const { data, error } = await supabase.rpc('get_lecturer_statistics', {
        p_lecturer_id: profile.id
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setStats(prev => ({
          ...prev,
          myAssignments: data[0].total_assignments || 0,
          pendingGrading: data[0].pending_submissions || 0,
          gradedSubmissions: data[0].graded_submissions || 0,
          averageGrade: data[0].average_grading_time_hours || 0,
          submissionRate: data[0].total_assignments > 0 
            ? Math.round((data[0].graded_submissions / data[0].total_assignments) * 100) 
            : 0
        }));
      }
      
    } catch (error) {
      console.error('Error fetching lecturer stats:', error);
    }
  };

 // AdminDashboard.jsx - UPDATED FILE UPLOAD SECTION

// In the handleCreateAssignment function, update the upload logic:
const uploadAssignmentFiles = async (files) => {
  if (!files || files.length === 0) return [];
  
  const uploadedUrls = [];
  setUploadingFiles(true);
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // IMPORTANT: Upload to a dedicated "assignment-questions" bucket
      const filePath = `assignment-questions/${fileName}`;
      
      // Update progress
      setUploadProgress(Math.round((i / files.length) * 100));
      
      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from('assignment-questions')  // Different bucket for assignment questions
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }
      
      // Get public URL - IMPORTANT: Use getPublicUrl
      const { data: { publicUrl } } = supabase.storage
        .from('assignment-questions')
        .getPublicUrl(filePath);
      
      console.log('Uploaded file URL:', publicUrl);
      
      uploadedUrls.push({
        url: publicUrl,
        name: file.name,
        size: file.size,
        type: file.type
      });
    }
    
    return uploadedUrls.map(u => u.url);
    
  } catch (error) {
    console.error('Error uploading files:', error);
    return [];
  } finally {
    setUploadingFiles(false);
    setUploadProgress(0);
  }
};

  // Create assignment with files
  const handleCreateAssignment = async () => {
    try {
      setLoading(prev => ({ ...prev, creatingAssignment: true }));
      
      // Upload files if any
      let fileUrls = [];
      if (assignmentFiles.length > 0) {
        fileUrls = await uploadAssignmentFiles(assignmentFiles);
      }
      
      // Create assignment
      const assignmentData = {
        course_id: newAssignment.course_id,
        lecturer_id: profile.id,
        title: newAssignment.title,
        due_date: newAssignment.due_date,
        total_marks: newAssignment.total_marks,
        description: newAssignment.description,
        instructions: newAssignment.instructions,
        submission_type: newAssignment.submission_type,
        max_file_size: newAssignment.max_file_size,
        allowed_formats: newAssignment.allowed_formats,
        file_urls: fileUrls,
        status: 'published'
      };
      
      const { error } = await supabase
        .from('assignments')
        .insert([assignmentData]);
      
      if (error) throw error;
      
      // Reset form and close modal
      setNewAssignment({
        course_id: '',
        title: '',
        description: '',
        instructions: '',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        submission_type: 'file',
        max_file_size: 10,
        allowed_formats: ['pdf', 'doc', 'docx', 'zip'],
        file_urls: []
      });
      setAssignmentFiles([]);
      setShowAssignmentUploadModal(false);
      
      // Refresh data
      await Promise.all([
        fetchMyAssignments(),
        fetchDashboardStats(),
        fetchLecturerStatistics()
      ]);
      
      alert('Assignment created successfully!');
      
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Error creating assignment: ' + error.message);
    } finally {
      setLoading(prev => ({ ...prev, creatingAssignment: false }));
    }
  };

  // Grade submission
  const handleGradeSubmission = async (submissionId, marks, feedback) => {
    try {
      setGradingInProgress(true);
      
      const { error } = await supabase
        .from('assignment_submissions')
        .update({ 
          marks_obtained: marks,
          feedback: feedback,
          status: 'graded',
          graded_at: new Date().toISOString()
        })
        .eq('id', submissionId);
      
      if (error) throw error;
      
      // Refresh submissions
      if (selectedAssignment) {
        fetchAssignmentSubmissions(selectedAssignment.id);
      }
      
      // Refresh stats
      fetchLecturerStatistics();
      
      return true;
      
    } catch (error) {
      console.error('Error grading submission:', error);
      alert('Error grading submission: ' + error.message);
      return false;
    } finally {
      setGradingInProgress(false);
    }
  };

  // Bulk grade submissions
  const handleBulkGrade = async () => {
    if (selectedSubmissions.length === 0) {
      alert('Please select submissions to grade');
      return;
    }
    
    try {
      setGradingInProgress(true);
      
      const updates = selectedSubmissions.map(submissionId => {
        const gradeData = gradeForm[submissionId];
        if (gradeData && gradeData.marks !== '') {
          return {
            id: submissionId,
            marks_obtained: parseFloat(gradeData.marks),
            feedback: gradeData.feedback || '',
            status: 'graded',
            graded_at: new Date().toISOString()
          };
        }
        return null;
      }).filter(update => update !== null);
      
      if (updates.length === 0) {
        alert('Please enter marks for selected submissions');
        return;
      }
      
      // Update each submission
      for (const update of updates) {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            marks_obtained: update.marks_obtained,
            feedback: update.feedback,
            status: 'graded',
            graded_at: update.graded_at
          })
          .eq('id', update.id);
        
        if (error) {
          console.error('Error grading submission:', update.id, error);
        }
      }
      
      // Refresh data
      if (selectedAssignment) {
        fetchAssignmentSubmissions(selectedAssignment.id);
      }
      fetchLecturerStatistics();
      
      // Reset
      setSelectedSubmissions([]);
      setGradeForm({});
      setBulkGrading(false);
      
      alert(`${updates.length} submissions graded successfully!`);
      
    } catch (error) {
      console.error('Error bulk grading:', error);
      alert('Error grading submissions: ' + error.message);
    } finally {
      setGradingInProgress(false);
    }
  };

  // Update assignment status
  const handleUpdateAssignmentStatus = async (assignmentId, status) => {
    if (!window.confirm(`Change assignment status to "${status}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status })
        .eq('id', assignmentId)
        .eq('lecturer_id', profile.id);
      
      if (error) throw error;
      
      // Refresh data
      fetchMyAssignments();
      fetchDashboardStats();
      
      alert(`Assignment status updated to "${status}"`);
      
    } catch (error) {
      console.error('Error updating assignment status:', error);
      alert('Error updating assignment status: ' + error.message);
    }
  };

  // Download submissions as CSV
  const downloadSubmissionsCSV = () => {
    if (assignmentSubmissions.length === 0) {
      alert('No submissions to download');
      return;
    }
    
    const headers = ['Student Name', 'Student Email', 'Program', 'Submission Date', 'Status', 'Marks', 'Feedback', 'Late Submission'];
    
    const csvData = assignmentSubmissions.map(sub => [
      sub.student_name,
      sub.student_email,
      sub.student_program || 'N/A',
      sub.submission_date ? new Date(sub.submission_date).toLocaleString() : 'Not Submitted',
      sub.status,
      sub.marks_obtained || 'Not Graded',
      sub.feedback || 'No feedback',
      sub.late_submission ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions_${selectedAssignment?.title || 'assignment'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // =================== EXISTING FUNCTIONS ===================

  const fetchDashboardStats = async () => {
    try {
      // Student counts
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      
      if (isLecturer && departmentCodes.length > 0) {
        studentQuery = studentQuery.in('department_code', departmentCodes);
      }
      
      // Course counts
      let courseQuery = supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });
      
      if (isLecturer && departmentCodes.length > 0) {
        courseQuery = courseQuery.in('department_code', departmentCodes);
      }

      // Execute all queries
      const [
        studentsRes,
        lecturersRes,
        coursesRes,
        assignmentsRes,
        examsRes,
        financialRes,
        attendanceRes,
        lecturesRes
      ] = await Promise.all([
        studentQuery,
        supabase.from('lecturers').select('*', { count: 'exact', head: true }),
        courseQuery,
        supabase.from('assignments').select('*', { count: 'exact', head: true }),
        supabase.from('examinations').select('*', { count: 'exact', head: true }),
        supabase.from('financial_records').select('*', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('status'),
        supabase.from('lectures').select('*', { count: 'exact', head: true })
      ]);

      // Additional stats
      const [pendingExams, pendingAssignments, pendingPayments] = await Promise.all([
        supabase.from('examinations').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('assignments').select('*', { count: 'exact', head: true }).gt('due_date', new Date().toISOString()),
        supabase.from('financial_records').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      const presentAttendance = attendanceRes.data?.filter(a => a.status === 'present').length || 0;
      const totalAttendance = attendanceRes.data?.length || 1;
      const attendanceRate = Math.round((presentAttendance / totalAttendance) * 100);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsRes.count || 0,
        totalLecturers: lecturersRes.count || 0,
        totalCourses: coursesRes.count || 0,
        totalAssignments: assignmentsRes.count || 0,
        totalExams: examsRes.count || 0,
        totalFinancialRecords: financialRes.count || 0,
        totalLectures: lecturesRes.count || 0,
        pendingExams: pendingExams.count || 0,
        pendingAssignments: pendingAssignments.count || 0,
        pendingPayments: pendingPayments.count || 0,
        attendanceRate,
      }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase
        .from('students')
        .select('*')
        .limit(50)
        .order('created_at', { ascending: false });
      
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
      }
      
      if (isLecturer && departmentCodes.length > 0) {
        query = query.in('department_code', departmentCodes);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setStudents(data || []);
      
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchLecturers = async () => {
    try {
      const { data, error } = await supabase
        .from('lecturers')
        .select('*, lecturer_departments(department_code, department_name)')
        .limit(50)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLecturers(data || []);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from('courses')
        .select('*')
        .limit(50)
        .order('year')
        .order('semester');
      
      if (searchTerm) {
        query = query.or(`course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
      
      if (isLecturer && departmentCodes.length > 0) {
        query = query.in('department_code', departmentCodes);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setCourses(data || []);
      
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      let query = supabase
        .from('assignments')
        .select(`
          *,
          courses (course_code, course_name, department_code),
          lecturers (full_name)
        `)
        .limit(50)
        .order('due_date', { ascending: true });
      
      if (isLecturer) {
        query = query.eq('lecturer_id', profile.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAssignments(data || []);
      
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchExams = async () => {
    try {
      let query = supabase
        .from('examinations')
        .select(`
          *,
          courses (course_code, course_name, department_code)
        `)
        .limit(50)
        .order('start_time', { ascending: true });
      
      if (isLecturer && departmentCodes.length > 0) {
        // Get courses in lecturer's departments
        const { data: deptCourses } = await supabase
          .from('courses')
          .select('id')
          .in('department_code', departmentCodes);
        
        const courseIds = deptCourses?.map(c => c.id) || [];
        if (courseIds.length > 0) {
          query = query.in('course_id', courseIds);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchFinancialRecords = async () => {
    try {
      let query = supabase
        .from('financial_records')
        .select('*')
        .limit(50)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      setFinancialRecords(data || []);
    } catch (error) {
      console.error('Error fetching financial records:', error);
    }
  };

  const fetchLectures = async () => {
    try {
      console.log('=== DEBUG: START FETCHING LECTURES ===');
      console.log('Current time:', new Date().toLocaleString());
      console.log('Profile ID:', profile?.id);
      
      // Fetch lectures with course and lecturer details
      let query = supabase
        .from('lectures')
        .select(`
          *,
          courses (id, course_code, course_name, department_code),
          lecturers (id, full_name, email, google_meet_link)
        `)
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (isLecturer) {
        console.log('DEBUG: Filtering for lecturer with ID:', profile.id);
        query = query.eq('lecturer_id', profile.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('DEBUG: Error fetching lectures:', error);
        throw error;
      }
      
      console.log('DEBUG: Found lectures:', data?.length || 0);
      
      // Process lectures to categorize them
      const processedLectures = (data || []).map(lecture => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Create date strings for comparison (using local time)
        const lectureDateStr = lecture.scheduled_date;
        const isToday = lectureDateStr === today;
        
        // Parse times carefully
        const parseTimeToMinutes = (timeStr) => {
          if (!timeStr) return 0;
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const startMinutes = parseTimeToMinutes(lecture.start_time);
        const endMinutes = parseTimeToMinutes(lecture.end_time);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        
        // Determine status - ONLY use database status, don't auto-update
        let status = lecture.status || 'scheduled';
        
        // Only check if it's today and times make sense
        if (isToday && lecture.status === 'scheduled') {
          if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
            status = 'ongoing';
          }
          // Don't automatically mark as completed - let the lecturer do that manually
        }
        
        // Format date and time for display
        const lectureDate = new Date(lecture.scheduled_date);
        const formattedDate = lectureDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Format time properly - handle 12:00 AM correctly
        const formatTimeDisplay = (timeStr) => {
          if (!timeStr) return 'TBD';
          const [hours, minutes] = timeStr.split(':');
          const hourNum = parseInt(hours);
          const minuteStr = minutes || '00';
          const ampm = hourNum >= 12 ? 'PM' : 'AM';
          const displayHour = hourNum % 12 || 12;
          return `${displayHour}:${minuteStr.padStart(2, '0')} ${ampm}`;
        };
        
        return {
          ...lecture,
          formattedDate: formattedDate,
          formattedTime: `${formatTimeDisplay(lecture.start_time)} - ${formatTimeDisplay(lecture.end_time)}`,
          status: status,
          isLiveNow: status === 'ongoing',
          department_code: lecture.lecturer_department_code || lecture.courses?.department_code || '',
          meetLink: lecture.google_meet_link || lecture.lecturers?.google_meet_link,
          // Add debug info
          _debug: {
            scheduled_date: lecture.scheduled_date,
            start_time: lecture.start_time,
            end_time: lecture.end_time,
            db_status: lecture.status,
            calculated_status: status,
            now: now.toLocaleString(),
            today: today,
            isToday: isToday,
            startMinutes: startMinutes,
            endMinutes: endMinutes,
            nowMinutes: nowMinutes
          }
        };
      });
      
      console.log('DEBUG: Processed lectures with statuses:');
      processedLectures.forEach((lecture, idx) => {
        console.log(`  Lecture ${idx + 1}:`, {
          title: lecture.title,
          date: lecture.scheduled_date,
          time: `${lecture.start_time} - ${lecture.end_time}`,
          formattedTime: lecture.formattedTime,
          status: lecture.status,
          debug: lecture._debug
        });
      });
      
      console.log('DEBUG: Setting lectures state with:', processedLectures.length, 'lectures');
      setLectures(processedLectures);
      
      console.log('=== DEBUG: END FETCHING LECTURES ===');
      
    } catch (error) {
      console.error('DEBUG: Error in fetchLectures:', error);
      setLectures([]);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .limit(100)
        .order('date', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = timeParts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = hours % 12 || 12;
    return `${formattedHour}:${minutes.padStart(2, '0')} ${ampm}`;
  };

  // Form handlers
  const handleAddUser = async () => {
    try {
      let tableName, data;
      const password = 'Default123!';
      
      if (newUser.role === 'student') {
        const studentId = `STU-${Date.now().toString().slice(-6)}`;
        data = {
          student_id: studentId,
          full_name: newUser.full_name,
          email: newUser.email,
          password_hash: password,
          phone: newUser.phone,
          program: newUser.program,
          department: newUser.program,
          department_code: newUser.program?.split(' ').map(word => word[0]).join('').toUpperCase(),
          year_of_study: newUser.year_of_study,
          status: 'active'
        };
        tableName = 'students';
      } else {
        const lecturerId = `LEC-${Date.now().toString().slice(-6)}`;
        data = {
          lecturer_id: lecturerId,
          full_name: newUser.full_name,
          email: newUser.email,
          password_hash: password,
          phone: newUser.phone,
          department: newUser.department,
          specialization: newUser.specialization,
          google_meet_link: newUser.google_meet_link,
          status: 'active'
        };
        tableName = 'lecturers';
      }
      
      const { error } = await supabase
        .from(tableName)
        .insert([data]);
      
      if (error) throw error;
      
      setShowUserModal(false);
      setNewUser({
        full_name: '',
        email: '',
        phone: '',
        role: 'student',
        program: '',
        year_of_study: 1,
        department: '',
        specialization: '',
        google_meet_link: ''
      });
      
      if (tableName === 'students') {
        fetchStudents();
      } else {
        fetchLecturers();
      }
      fetchDashboardStats();
      
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user: ' + error.message);
    }
  };

  const handleAddCourse = async () => {
    try {
      const { error } = await supabase
        .from('courses')
        .insert([newCourse]);
      
      if (error) throw error;
      
      setShowCourseModal(false);
      setNewCourse({
        course_code: '',
        course_name: '',
        description: '',
        credits: 3,
        year: 1,
        semester: 1,
        program: '',
        faculty: '',
        department: '',
        department_code: '',
        is_core: true
      });
      
      fetchCourses();
      fetchDashboardStats();
      
    } catch (error) {
      console.error('Error adding course:', error);
      alert('Error adding course: ' + error.message);
    }
  };

  const handleAddAssignment = async () => {
    try {
      const assignmentData = {
        ...newAssignment,
        lecturer_id: profile.id,
        status: 'published'
      };
      
      const { error } = await supabase
        .from('assignments')
        .insert([assignmentData]);
      
      if (error) throw error;
      
      setShowAssignmentModal(false);
      setNewAssignment({
        course_id: '',
        title: '',
        description: '',
        instructions: '',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        submission_type: 'file'
      });
      
      fetchAssignments();
      fetchDashboardStats();
      
    } catch (error) {
      console.error('Error adding assignment:', error);
      alert('Error adding assignment: ' + error.message);
    }
  };

  const handleAddLecture = async () => {
    try {
      console.log('DEBUG: Starting to add lecture');
      console.log('DEBUG: New lecture data:', newLecture);
      console.log('DEBUG: Profile ID:', profile?.id);
      
      // Validate required fields
      if (!newLecture.course_id || !newLecture.title || !newLecture.scheduled_date || 
          !newLecture.start_time || !newLecture.end_time) {
        alert('Please fill in all required fields');
        return;
      }

      // Calculate duration in minutes
      const start = new Date(`${newLecture.scheduled_date}T${newLecture.start_time}`);
      const end = new Date(`${newLecture.scheduled_date}T${newLecture.end_time}`);
      const durationMinutes = Math.round((end - start) / (1000 * 60));
      
      // Get course department code
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('department_code, course_code, course_name')
        .eq('id', newLecture.course_id)
        .single();
      
      if (courseError) {
        console.error('DEBUG: Error fetching course:', courseError);
      }
      
      console.log('DEBUG: Course data:', courseData);
      
      const lectureData = {
        lecturer_id: profile.id,
        course_id: newLecture.course_id,
        title: newLecture.title,
        description: newLecture.description,
        google_meet_link: newLecture.google_meet_link,
        scheduled_date: newLecture.scheduled_date,
        start_time: newLecture.start_time,
        end_time: newLecture.end_time,
        duration_minutes: durationMinutes,
        lecturer_department_code: courseData?.department_code || null,
        status: 'scheduled', // Always start as scheduled
        materials_url: newLecture.materials_url || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('DEBUG: Lecture data to insert:', lectureData);
      
      const { data, error } = await supabase
        .from('lectures')
        .insert([lectureData])
        .select();
      
      if (error) {
        console.error('DEBUG: Supabase error inserting lecture:', error);
        throw error;
      }
      
      console.log('DEBUG: Lecture added successfully:', data);
      
      setShowLectureModal(false);
      setNewLecture({
        course_id: '',
        title: '',
        description: '',
        google_meet_link: '',
        scheduled_date: new Date().toISOString().slice(0, 10),
        start_time: '09:00',
        end_time: '11:00',
        duration_minutes: 120,
        materials_url: [],
        status: 'scheduled'
      });
      
      // Refresh lectures immediately
      console.log('DEBUG: Refreshing lectures after adding...');
      await fetchLectures();
      await fetchDashboardStats();
      
      alert('Lecture scheduled successfully!');
      
    } catch (error) {
      console.error('DEBUG: Error adding lecture:', error);
      alert('Error adding lecture: ' + error.message);
    }
  };

  const handleAddExam = async () => {
    try {
      const examData = {
        ...newExam,
        lecturer_id: profile.id
      };
      
      const { error } = await supabase
        .from('examinations')
        .insert([examData]);
      
      if (error) throw error;
      
      setShowExamsModal(false);
      setNewExam({
        course_id: '',
        title: '',
        description: '',
        exam_type: 'midterm',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        venue: 'Main Hall',
        status: 'scheduled'
      });
      
      fetchExams();
      fetchDashboardStats();
      
      alert('Exam scheduled successfully!');
      
    } catch (error) {
      console.error('Error adding exam:', error);
      alert('Error adding exam: ' + error.message);
    }
  };

  const handleAddFinanceRecord = async () => {
    try {
      const { error } = await supabase
        .from('financial_records')
        .insert([newFinanceRecord]);
      
      if (error) throw error;
      
      setShowFinanceModal(false);
      setNewFinanceRecord({
        student_id: '',
        description: '',
        amount: 0,
        payment_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        receipt_number: `REC-${Date.now().toString().slice(-6)}`
      });
      
      fetchFinancialRecords();
      fetchDashboardStats();
      
      alert('Financial record added successfully!');
      
    } catch (error) {
      console.error('Error adding financial record:', error);
      alert('Error adding financial record: ' + error.message);
    }
  };

  const handleAddAttendanceRecord = async () => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .insert([newAttendanceRecord]);
      
      if (error) throw error;
      
      setShowAttendanceModal(false);
      setNewAttendanceRecord({
        student_id: '',
        lecture_id: '',
        date: new Date().toISOString().slice(0, 10),
        status: 'present',
        check_in_time: '09:00',
        check_out_time: '11:00',
        remarks: ''
      });
      
      fetchAttendanceData();
      fetchDashboardStats();
      
      alert('Attendance record added successfully!');
      
    } catch (error) {
      console.error('Error adding attendance record:', error);
      alert('Error adding attendance record: ' + error.message);
    }
  };

  // Lecture management functions
  const handleStartLecture = async (lectureId) => {
    try {
      console.log('DEBUG: Starting lecture with ID:', lectureId);
      const { error } = await supabase
        .from('lectures')
        .update({ 
          status: 'ongoing',
          updated_at: new Date().toISOString()
        })
        .eq('id', lectureId);
      
      if (error) throw error;
      
      fetchLectures();
      alert('Lecture started successfully!');
      
    } catch (error) {
      console.error('Error starting lecture:', error);
      alert('Error starting lecture: ' + error.message);
    }
  };

  const handleEndLecture = async (lectureId) => {
    try {
      const { error } = await supabase
        .from('lectures')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', lectureId);
      
      if (error) throw error;
      
      fetchLectures();
      alert('Lecture ended successfully!');
      
    } catch (error) {
      console.error('Error ending lecture:', error);
      alert('Error ending lecture: ' + error.message);
    }
  };

  const handleEditLecture = async () => {
    try {
      const { error } = await supabase
        .from('lectures')
        .update({
          title: editLecture.title,
          description: editLecture.description,
          google_meet_link: editLecture.google_meet_link,
          scheduled_date: editLecture.scheduled_date,
          start_time: editLecture.start_time,
          end_time: editLecture.end_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingLecture.id);
      
      if (error) throw error;
      
      setEditingLecture(null);
      setEditLecture({
        title: '',
        description: '',
        google_meet_link: '',
        scheduled_date: '',
        start_time: '',
        end_time: ''
      });
      
      fetchLectures();
      alert('Lecture updated successfully!');
      
    } catch (error) {
      console.error('Error updating lecture:', error);
      alert('Error updating lecture: ' + error.message);
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('lectures')
        .delete()
        .eq('id', lectureId);
      
      if (error) throw error;
      
      fetchLectures();
      alert('Lecture deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting lecture:', error);
      alert('Error deleting lecture: ' + error.message);
    }
  };

  const handleEditExam = async () => {
    try {
      const { error } = await supabase
        .from('examinations')
        .update({
          title: editExam.title,
          description: editExam.description,
          start_time: editExam.start_time,
          end_time: editExam.end_time,
          venue: editExam.venue,
          status: editExam.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingExam.id);
      
      if (error) throw error;
      
      setEditingExam(null);
      fetchExams();
      alert('Exam updated successfully!');
      
    } catch (error) {
      console.error('Error updating exam:', error);
      alert('Error updating exam: ' + error.message);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('examinations')
        .delete()
        .eq('id', examId);
      
      if (error) throw error;
      
      fetchExams();
      alert('Exam deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Error deleting exam: ' + error.message);
    }
  };

  // Student management
  const handleUpdateStudentStatus = async (studentId, status) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ status })
        .eq('id', studentId);
      
      if (error) throw error;
      
      fetchStudents();
      alert('Student status updated!');
      
    } catch (error) {
      console.error('Error updating student:', error);
      alert('Error updating student: ' + error.message);
    }
  };

  // Course management
  const handleToggleCourseActive = async (courseId, isActive) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: !isActive })
        .eq('id', courseId);
      
      if (error) throw error;
      
      fetchCourses();
      alert(`Course ${!isActive ? 'activated' : 'deactivated'}!`);
      
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Error updating course: ' + error.message);
    }
  };

  // Finance management
  const handleUpdateFinanceStatus = async (recordId, status) => {
    try {
      const { error } = await supabase
        .from('financial_records')
        .update({ status })
        .eq('id', recordId);
      
      if (error) throw error;
      
      fetchFinancialRecords();
      alert(`Payment marked as ${status}!`);
      
    } catch (error) {
      console.error('Error updating finance record:', error);
      alert('Error updating finance record: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  // Helper functions
  const renderLecturerDepartments = (lecturer) => {
    if (!lecturer.lecturer_departments || lecturer.lecturer_departments.length === 0) {
      return <span className="text-muted small-text">No departments</span>;
    }
    
    return (
      <div className="departments-badges">
        {lecturer.lecturer_departments.slice(0, 3).map((dept, idx) => (
          <span key={idx} className="department-badge">
            {dept.department_code}
          </span>
        ))}
        {lecturer.lecturer_departments.length > 3 && (
          <span className="text-muted small-text">
            +{lecturer.lecturer_departments.length - 3} more
          </span>
        )}
      </div>
    );
  };

  const getLiveLectures = () => {
    console.log('DEBUG: Getting live lectures from:', lectures);
    return lectures.filter(lecture => lecture.status === 'ongoing');
  };

  const getUpcomingLectures = () => {
    const today = new Date().toISOString().split('T')[0];
    return lectures.filter(lecture => 
      (lecture.status === 'scheduled' || lecture.status === 'ongoing') && 
      lecture.scheduled_date >= today
    );
  };

  const getPastLectures = () => {
    const today = new Date().toISOString().split('T')[0];
    return lectures.filter(lecture => 
      lecture.status === 'completed' || 
      (lecture.status === 'scheduled' && lecture.scheduled_date < today)
    );
  };

  // ASSIGNMENT HELPER FUNCTIONS
  const handleViewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmissionsModal(true);
    await fetchAssignmentSubmissions(assignment.id);
  };

  const handleToggleSubmissionSelection = (submissionId) => {
    setSelectedSubmissions(prev => {
      if (prev.includes(submissionId)) {
        return prev.filter(id => id !== submissionId);
      } else {
        return [...prev, submissionId];
      }
    });
  };

  const handleSelectAllSubmissions = () => {
    const allIds = assignmentSubmissions
      .filter(sub => sub.status === 'submitted')
      .map(sub => sub.submission_id);
    
    if (selectedSubmissions.length === allIds.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(allIds);
    }
  };

  // Loading states
  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  if (isLecturer && deptLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your access permissions...</p>
      </div>
    );
  }

  if (isLecturer && !hasAccess) {
    return (
      <div className="restricted-access-container">
        <div className="restricted-access-card">
          <div className="restricted-access-icon">🔒</div>
          <h2>No Department Access</h2>
          <p>
            You haven't been assigned to any academic departments yet.
          </p>
          <p>
            Please contact the system administrator to request department access.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="restricted-logout-button"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo">
              {isAdmin ? 'SYSTEM ADMIN PORTAL' : 'LECTURER PORTAL'}
            </h1>
            <p className="tagline">
              {isAdmin ? 'University Management System' : 'Teaching & Course Management'}
            </p>
            <div className="realtime-indicator">
              <span className={`realtime-dot ${realtimeConnected ? 'connected' : 'disconnected'}`}></span>
              <span>Realtime: {realtimeConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {isLecturer && allowedDepartments && allowedDepartments.length > 0 && (
              <div className="dept-access-info">
                <span className="access-label">Access to:</span>
                <div className="departments-badges">
                  {allowedDepartments.slice(0, 3).map((dept, idx) => (
                    <span key={idx} className="department-badge">
                      {dept.department_code}
                    </span>
                  ))}
                  {allowedDepartments.length > 3 && (
                    <span className="text-muted">
                      +{allowedDepartments.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="user-section">
            <div className="user-info">
              <div className={`avatar ${isAdmin ? 'admin' : 'lecturer'}`}>
                {profile.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="user-name">{profile.full_name || profile.email}</p>
                <p className="user-role">
                  <span className={`role-badge ${isAdmin ? 'admin' : 'lecturer'}`}>
                    {isAdmin ? 'SYSTEM ADMIN' : 'LECTURER'}
                  </span>
                </p>
              </div>
            </div>
            <button 
              className="logout-button"
              onClick={() => setShowLogoutModal(true)}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dashboard-nav">
        <button 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>

        {isLecturer && (
          <>
            <button 
              className={`nav-item ${activeTab === 'my-assignments' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-assignments')}
            >
              📝 My Assignments
            </button>
            <button 
              className={`nav-item ${activeTab === 'lectures' ? 'active' : ''}`}
              onClick={() => setActiveTab('lectures')}
            >
              🎓 My Lectures
            </button>
            <button 
              className={`nav-item ${activeTab === 'grading' ? 'active' : ''}`}
              onClick={() => setActiveTab('grading')}
            >
              📊 Grading
            </button>
          </>
        )}

        <button 
          className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>

        <button 
          className={`nav-item ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📖 Courses
        </button>

        <button 
          className={`nav-item ${activeTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          🎯 Exams
        </button>

        {isAdmin && (
          <>
            <button 
              className={`nav-item ${activeTab === 'lecturers' ? 'active' : ''}`}
              onClick={() => setActiveTab('lecturers')}
            >
              👨‍🏫 Lecturers
            </button>
            <button 
              className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              💰 Finance
            </button>
            <button 
              className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              📅 Attendance
            </button>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙ Settings
            </button>
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        {loading.dashboard ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="dashboard-content">
                {/* Welcome Section */}
                <div className="welcome-section">
                  <div>
                    <h2>
                      {isAdmin 
                        ? `Welcome, System Administrator! 👑` 
                        : `Welcome, ${profile.full_name?.split(' ')[0] || 'Lecturer'}! 👨‍🏫`
                      }
                    </h2>
                    <p>
                      {isAdmin 
                        ? `Last updated: ${new Date().toLocaleTimeString()}`
                        : `Managing ${allowedDepartments?.length || 0} department${(allowedDepartments?.length || 0) !== 1 ? 's' : ''} • ${new Date().toLocaleDateString()}`
                      }
                    </p>
                  </div>
                  <button 
                    onClick={initializeDashboard}
                    disabled={loading.dashboard}
                    className="refresh-button"
                  >
                    🔄 Refresh
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <h3>{stats.totalStudents.toLocaleString()}</h3>
                    <p>Total Students</p>
                    {isLecturer && (
                      <div className="stat-subtext">
                        In your departments
                      </div>
                    )}
                  </div>
                  
                  {isAdmin && (
                    <div className="stat-card">
                      <div className="stat-icon">👨‍🏫</div>
                      <h3>{stats.totalLecturers}</h3>
                      <p>Lecturers</p>
                    </div>
                  )}
                  
                  <div className="stat-card">
                    <div className="stat-icon">📚</div>
                    <h3>{stats.totalCourses}</h3>
                    <p>Active Courses</p>
                    {isLecturer && (
                      <div className="stat-subtext">
                        In your departments
                      </div>
                    )}
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <h3>{stats.totalAssignments}</h3>
                    <p>Assignments</p>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon">🎓</div>
                    <h3>{stats.totalLectures || 0}</h3>
                    <p>Lectures</p>
                  </div>
                  
                  {isAdmin && (
                    <div className="stat-card">
                      <div className="stat-icon">💰</div>
                      <h3>{stats.totalFinancialRecords}</h3>
                      <p>Financial Records</p>
                    </div>
                  )}

                  {/* Lecturer Specific Stats */}
                  {isLecturer && (
                    <>
                      <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <h3>{stats.myAssignments}</h3>
                        <p>My Assignments</p>
                      </div>
                      
                      <div className="stat-card warning">
                        <div className="stat-icon">⏰</div>
                        <h3>{stats.pendingGrading}</h3>
                        <p>Pending Grading</p>
                      </div>
                      
                      <div className="stat-card success">
                        <div className="stat-icon">✅</div>
                        <h3>{stats.gradedSubmissions}</h3>
                        <p>Graded</p>
                      </div>
                      
                      <div className="stat-card">
                        <div className="stat-icon">📈</div>
                        <h3>{stats.submissionRate}%</h3>
                        <p>Submission Rate</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="actions-section">
                  <h3>Quick Actions</h3>
                  <div className="actions-grid">
                    {isLecturer && (
                      <>
                        <button 
                          className="action-button"
                          onClick={() => setShowAssignmentUploadModal(true)}
                        >
                          <span className="action-icon">📝</span>
                          <span>Create Assignment</span>
                          <small>With file upload</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setShowLectureModal(true)}
                        >
                          <span className="action-icon">🎓</span>
                          <span>Schedule Lecture</span>
                          <small>With Google Meet</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setActiveTab('grading')}
                        >
                          <span className="action-icon">📊</span>
                          <span>Grade Submissions</span>
                          <small>Pending: {stats.pendingGrading}</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setActiveTab('my-assignments')}
                        >
                          <span className="action-icon">📋</span>
                          <span>View Assignments</span>
                          <small>My created assignments</small>
                        </button>
                      </>
                    )}
                    
                    {isAdmin && (
                      <>
                        <button 
                          className="action-button"
                          onClick={() => setShowUserModal(true)}
                        >
                          <span className="action-icon">👤</span>
                          <span>Add New User</span>
                          <small>Student or Lecturer</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setShowCourseModal(true)}
                        >
                          <span className="action-icon">📚</span>
                          <span>Add New Course</span>
                          <small>Academic program</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setActiveTab('finance')}
                        >
                          <span className="action-icon">💰</span>
                          <span>Financial Overview</span>
                          <small>View transactions</small>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Live & Upcoming Lectures - For Lecturers */}
                {isLecturer && (
                  <div className="upcoming-lectures-section">
                    <div className="section-header">
                      <h3>🎥 Live & Upcoming Lectures</h3>
                      <button 
                        className="view-all-button"
                        onClick={() => setActiveTab('lectures')}
                      >
                        View All →
                      </button>
                    </div>
                    
                    {/* Live Lectures */}
                    <div className="lectures-grid">
                      {getLiveLectures().length > 0 ? (
                        getLiveLectures().slice(0, 2).map(lecture => (
                          <div key={lecture.id} className="lecture-card live">
                            <div className="lecture-header">
                              <h4>{lecture.courses?.course_code}: {lecture.title}</h4>
                              <span className="lecture-status live">
                                🔴 LIVE NOW
                              </span>
                            </div>
                            <p>{lecture.description}</p>
                            <div className="lecture-details">
                              <span>👨‍🏫 {lecture.lecturers?.full_name}</span>
                              <span>📅 {lecture.formattedDate}</span>
                              <span>⏰ {lecture.formattedTime}</span>
                              <span>🏛️ {lecture.courses?.department_code}</span>
                            </div>
                            {lecture.meetLink && (
                              <div className="lecture-actions">
                                <a 
                                  href={lecture.meetLink} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="meet-link join-btn"
                                >
                                  🎥 Join Google Meet
                                </a>
                                <button 
                                  className="action-btn end"
                                  onClick={() => handleEndLecture(lecture.id)}
                                >
                                  End Lecture
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="empty-lectures">
                          <p>No live lectures at the moment</p>
                        </div>
                      )}
                    </div>

                    {/* Upcoming Lectures */}
                    <div className="lectures-grid">
                      {getUpcomingLectures().length > 0 ? (
                        getUpcomingLectures().slice(0, 3).map(lecture => (
                          <div key={lecture.id} className="lecture-card">
                            <div className="lecture-header">
                              <h4>{lecture.courses?.course_code}: {lecture.title}</h4>
                              <span className={`lecture-status ${lecture.status}`}>
                                {lecture.status}
                              </span>
                            </div>
                            <p>{lecture.description}</p>
                            <div className="lecture-details">
                              <span>👨‍🏫 {lecture.lecturers?.full_name}</span>
                              <span>📅 {lecture.formattedDate}</span>
                              <span>⏰ {lecture.formattedTime}</span>
                              <span>🏛️ {lecture.courses?.department_code}</span>
                            </div>
                            {lecture.meetLink && (
                              <div className="lecture-actions">
                                <a 
                                  href={lecture.meetLink} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="meet-link"
                                >
                                  🔗 Copy Meeting Link
                                </a>
                                <button 
                                  className="action-btn start"
                                  onClick={() => handleStartLecture(lecture.id)}
                                >
                                  Start Lecture
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="empty-lectures">
                          <p>No upcoming lectures scheduled</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div className="activity-section">
                  <h3>🔄 Recent Activity</h3>
                  <div className="activity-list">
                    <div className="activity-item">
                      <span className="activity-icon">👤</span>
                      <div className="activity-content">
                        <p>System updated successfully</p>
                        <small>Just now</small>
                      </div>
                    </div>
                    <div className="activity-item">
                      <span className="activity-icon">📝</span>
                      <div className="activity-content">
                        <p>{stats.totalAssignments} assignments active</p>
                        <small>Today</small>
                      </div>
                    </div>
                    <div className="activity-item">
                      <span className="activity-icon">🎓</span>
                      <div className="activity-content">
                        <p>{getLiveLectures().length} live lectures ongoing</p>
                        <small>Currently active</small>
                      </div>
                    </div>
                    {isLecturer && (
                      <div className="activity-item">
                        <span className="activity-icon">📊</span>
                        <div className="activity-content">
                          <p>{stats.pendingGrading} submissions need grading</p>
                          <small>Click Grading tab to review</small>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* My Assignments Tab - Lecturer Only */}
            {activeTab === 'my-assignments' && isLecturer && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📝 My Assignments</h2>
                  <div className="tab-actions">
                    <button 
                      className="add-button"
                      onClick={() => setShowAssignmentUploadModal(true)}
                    >
                      + Create Assignment
                    </button>
                  </div>
                </div>
                
                {/* Assignment Statistics */}
                <div className="assignment-stats">
                  <div className="stat-card-small">
                    <h3>{stats.myAssignments}</h3>
                    <p>Total Assignments</p>
                  </div>
                  <div className="stat-card-small warning">
                    <h3>{stats.pendingGrading}</h3>
                    <p>Pending Grading</p>
                  </div>
                  <div className="stat-card-small success">
                    <h3>{stats.gradedSubmissions}</h3>
                    <p>Graded Submissions</p>
                  </div>
                  <div className="stat-card-small">
                    <h3>{stats.submissionRate}%</h3>
                    <p>Submission Rate</p>
                  </div>
                </div>
                
                {/* Assignments List */}
                <div className="assignments-list">
                  {myAssignments.length > 0 ? (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Course</th>
                            <th>Due Date</th>
                            <th>Total Marks</th>
                            <th>Status</th>
                            <th>Submissions</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myAssignments.map(assignment => (
                            <tr key={assignment.assignment_id}>
                              <td>
                                <strong>{assignment.title}</strong>
                                {assignment.description && (
                                  <p className="small-text">{assignment.description.substring(0, 50)}...</p>
                                )}
                              </td>
                              <td>
                                {assignment.course_code} - {assignment.course_name}
                                <br />
                                <span className="dept-badge">{assignment.department_code}</span>
                              </td>
                              <td>
                                {new Date(assignment.due_date).toLocaleDateString()}
                                <br />
                                <span className="small-text">
                                  {new Date(assignment.due_date).toLocaleTimeString()}
                                </span>
                              </td>
                              <td>{assignment.total_marks}</td>
                              <td>
                                <span className={`status-badge ${assignment.status}`}>
                                  {assignment.status}
                                </span>
                              </td>
                              <td>
                                <div className="submission-stats">
                                  <span className="submission-count submitted">
                                    {assignment.submitted_count || 0} submitted
                                  </span>
                                  <span className="submission-count not-submitted">
                                    {assignment.not_submitted_count || 0} not submitted
                                  </span>
                                  <span className="submission-count graded">
                                    {assignment.graded_count || 0} graded
                                  </span>
                                </div>
                                {assignment.total_students > 0 && (
                                  <div className="progress-bar">
                                    <div 
                                      className="progress-fill"
                                      style={{
                                        width: `${assignment.submission_rate || 0}%`
                                      }}
                                    ></div>
                                    <span className="progress-text">
                                      {assignment.submission_rate || 0}% submitted
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="action-btn view"
                                    onClick={() => handleViewSubmissions({
                                      id: assignment.assignment_id,
                                      title: assignment.title,
                                      total_marks: assignment.total_marks
                                    })}
                                  >
                                    View Submissions
                                  </button>
                                  <div className="dropdown">
                                    <button className="action-btn more">⋮</button>
                                    <div className="dropdown-content">
                                      <button 
                                        onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'published')}
                                      >
                                        Publish
                                      </button>
                                      <button 
                                        onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'draft')}
                                      >
                                        Draft
                                      </button>
                                      <button 
                                        onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'closed')}
                                      >
                                        Close
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if (window.confirm('Delete this assignment?')) {
                                            // Implement delete
                                          }
                                        }}
                                        className="danger"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No assignments found</p>
                      <button 
                        onClick={() => setShowAssignmentUploadModal(true)}
                        className="add-button"
                      >
                        Create Your First Assignment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grading Tab - Lecturer Only */}
            {activeTab === 'grading' && isLecturer && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📊 Grading Center</h2>
                  <div className="tab-actions">
                    {bulkGrading && selectedSubmissions.length > 0 && (
                      <button 
                        className="add-button"
                        onClick={handleBulkGrade}
                        disabled={gradingInProgress}
                      >
                        {gradingInProgress ? 'Grading...' : `Grade ${selectedSubmissions.length} Selected`}
                      </button>
                    )}
                    <button 
                      className="action-button"
                      onClick={() => setBulkGrading(!bulkGrading)}
                    >
                      {bulkGrading ? 'Cancel Bulk Grading' : 'Bulk Grade'}
                    </button>
                  </div>
                </div>
                
                {selectedAssignment ? (
                  <div className="grading-content">
                    <div className="assignment-header">
                      <h3>{selectedAssignment.title}</h3>
                      <div className="assignment-meta">
                        <span>Total Marks: {selectedAssignment.total_marks}</span>
                        <span>Submissions: {assignmentSubmissions.length}</span>
                        <button 
                          className="back-button"
                          onClick={() => {
                            setSelectedAssignment(null);
                            setAssignmentSubmissions([]);
                          }}
                        >
                          ← Back to List
                        </button>
                      </div>
                    </div>
                    
                    {/* Bulk Grading Controls */}
                    {bulkGrading && (
                      <div className="bulk-grading-controls">
                        <div className="bulk-header">
                          <h4>Bulk Grading Mode</h4>
                          <div className="bulk-actions">
                            <label className="checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedSubmissions.length === assignmentSubmissions.filter(s => s.status === 'submitted').length}
                                onChange={handleSelectAllSubmissions}
                              />
                              Select All ({assignmentSubmissions.filter(s => s.status === 'submitted').length})
                            </label>
                            <button 
                              className="small-button"
                              onClick={() => setSelectedSubmissions([])}
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                        <p className="bulk-info">
                          Selected: {selectedSubmissions.length} submission(s)
                        </p>
                      </div>
                    )}
                    
                    {/* Submissions List */}
                    <div className="submissions-list">
                      {assignmentSubmissions.length > 0 ? (
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                {bulkGrading && <th>Select</th>}
                                <th>Student</th>
                                <th>Program</th>
                                <th>Submission Date</th>
                                <th>Status</th>
                                <th>Files</th>
                                <th>Marks</th>
                                <th>Feedback</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assignmentSubmissions.map(submission => (
                                <tr key={submission.submission_id}>
                                  {bulkGrading && (
                                    <td>
                                      <input 
                                        type="checkbox"
                                        checked={selectedSubmissions.includes(submission.submission_id)}
                                        onChange={() => handleToggleSubmissionSelection(submission.submission_id)}
                                        disabled={submission.status !== 'submitted'}
                                      />
                                    </td>
                                  )}
                                  <td>
                                    <strong>{submission.student_name}</strong>
                                    <br />
                                    <span className="small-text">{submission.student_email}</span>
                                  </td>
                                  <td>
                                    {submission.student_program || 'N/A'}
                                    <br />
                                    <span className="dept-badge">{submission.student_department || 'N/A'}</span>
                                  </td>
                                  <td>
                                    {submission.submission_date ? (
                                      <>
                                        {new Date(submission.submission_date).toLocaleDateString()}
                                        <br />
                                        <span className={`small-text ${submission.late_submission ? 'late' : ''}`}>
                                          {new Date(submission.submission_date).toLocaleTimeString()}
                                          {submission.late_submission && ` (Late: ${submission.days_late} days)`}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-muted">Not submitted</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`status-badge ${submission.status}`}>
                                      {submission.status}
                                    </span>
                                  </td>
                                  <td>
                                    {submission.file_urls && submission.file_urls.length > 0 ? (
                                      <div className="file-links">
                                        {submission.file_urls.map((url, idx) => (
                                          <a 
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="file-link"
                                          >
                                            File {idx + 1}
                                          </a>
                                        ))}
                                      </div>
                                    ) : submission.submitted_text ? (
                                      <span className="text-preview">
                                        {submission.submitted_text.substring(0, 50)}...
                                      </span>
                                    ) : (
                                      <span className="text-muted">No files</span>
                                    )}
                                  </td>
                                  <td>
                                    {submission.status === 'graded' ? (
                                      <span className="grade-display">
                                        {submission.marks_obtained}/{selectedAssignment.total_marks}
                                      </span>
                                    ) : submission.status === 'submitted' ? (
                                      <div className="grade-input">
                                        <input 
                                          type="number"
                                          min="0"
                                          max={selectedAssignment.total_marks}
                                          step="0.5"
                                          value={gradeForm[submission.submission_id]?.marks || ''}
                                          onChange={(e) => setGradeForm(prev => ({
                                            ...prev,
                                            [submission.submission_id]: {
                                              ...prev[submission.submission_id],
                                              marks: e.target.value
                                            }
                                          }))}
                                          placeholder="Enter marks"
                                          className="small-input"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td>
                                    {submission.status === 'graded' ? (
                                      <span className="feedback-display">
                                        {submission.feedback || 'No feedback'}
                                      </span>
                                    ) : submission.status === 'submitted' ? (
                                      <div className="feedback-input">
                                        <textarea 
                                          value={gradeForm[submission.submission_id]?.feedback || ''}
                                          onChange={(e) => setGradeForm(prev => ({
                                            ...prev,
                                            [submission.submission_id]: {
                                              ...prev[submission.submission_id],
                                              feedback: e.target.value
                                            }
                                          }))}
                                          placeholder="Enter feedback"
                                          rows="2"
                                          className="small-textarea"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      {submission.status === 'submitted' && !bulkGrading && (
                                        <button 
                                          className="action-btn grade"
                                          onClick={async () => {
                                            const marks = gradeForm[submission.submission_id]?.marks;
                                            const feedback = gradeForm[submission.submission_id]?.feedback || '';
                                            
                                            if (!marks || marks === '') {
                                              alert('Please enter marks');
                                              return;
                                            }
                                            
                                            if (parseFloat(marks) > selectedAssignment.total_marks) {
                                              alert(`Marks cannot exceed ${selectedAssignment.total_marks}`);
                                              return;
                                            }
                                            
                                            const success = await handleGradeSubmission(
                                              submission.submission_id,
                                              parseFloat(marks),
                                              feedback
                                            );
                                            
                                            if (success) {
                                              setGradeForm(prev => {
                                                const newForm = { ...prev };
                                                delete newForm[submission.submission_id];
                                                return newForm;
                                              });
                                            }
                                          }}
                                          disabled={gradingInProgress}
                                        >
                                          {gradingInProgress ? 'Grading...' : 'Grade'}
                                        </button>
                                      )}
                                      {submission.status === 'graded' && (
                                        <button 
                                          className="action-btn view"
                                          onClick={() => {
                                            alert(`Marks: ${submission.marks_obtained}/${selectedAssignment.total_marks}\n\nFeedback: ${submission.feedback || 'No feedback'}`);
                                          }}
                                        >
                                          View Grade
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <p>No submissions found for this assignment</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Export Options */}
                    {assignmentSubmissions.length > 0 && (
                      <div className="export-options">
                        <button 
                          className="export-button"
                          onClick={downloadSubmissionsCSV}
                        >
                          📥 Export to CSV
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="select-assignment">
                    <h3>Select an Assignment to Grade</h3>
                    <div className="assignments-grid">
                      {myAssignments.filter(a => a.submitted_count > 0).length > 0 ? (
                        myAssignments
                          .filter(a => a.submitted_count > 0)
                          .map(assignment => (
                            <div key={assignment.assignment_id} className="assignment-card">
                              <div className="assignment-header">
                                <h4>{assignment.title}</h4>
                                <span className={`assignment-status ${assignment.status}`}>
                                  {assignment.status}
                                </span>
                              </div>
                              <p className="course-info">
                                {assignment.course_code} - {assignment.course_name}
                              </p>
                              <div className="assignment-details">
                                <span>📅 Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                                <span>📊 Total Marks: {assignment.total_marks}</span>
                                <span>🏛️ {assignment.department_code}</span>
                              </div>
                              <div className="submission-stats-card">
                                <div className="stat">
                                  <span className="stat-label">Submitted:</span>
                                  <span className="stat-value">{assignment.submitted_count || 0}</span>
                                </div>
                                <div className="stat">
                                  <span className="stat-label">Graded:</span>
                                  <span className="stat-value">{assignment.graded_count || 0}</span>
                                </div>
                                <div className="stat">
                                  <span className="stat-label">Pending:</span>
                                  <span className="stat-value warning">
                                    {assignment.submitted_count - (assignment.graded_count || 0)}
                                  </span>
                                </div>
                              </div>
                              <div className="assignment-actions">
                                <button 
                                  className="action-btn grade"
                                  onClick={() => handleViewSubmissions({
                                    id: assignment.assignment_id,
                                    title: assignment.title,
                                    total_marks: assignment.total_marks
                                  })}
                                >
                                  Grade Submissions
                                </button>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="empty-state">
                          <p>No assignments with submissions to grade</p>
                          <p className="small-text">
                            Students need to submit their assignments before you can grade them
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>👥 Student Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="search-input"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setTimeout(() => fetchStudents(), 300);
                      }}
                    />
                    {isAdmin && (
                      <button 
                        className="add-button"
                        onClick={() => {
                          setNewUser({...newUser, role: 'student'});
                          setShowUserModal(true);
                        }}
                      >
                        + Add Student
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Program</th>
                        <th>Department</th>
                        <th>Year</th>
                        <th>Status</th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => (
                        <tr key={student.id}>
                          <td>{student.student_id}</td>
                          <td>{student.full_name}</td>
                          <td>{student.email}</td>
                          <td>{student.program}</td>
                          <td>
                            <span className="dept-badge">
                              {student.department_code || 'N/A'}
                            </span>
                          </td>
                          <td>Year {student.year_of_study}</td>
                          <td>
                            <span className={`status-badge ${student.status || 'active'}`}>
                              {student.status || 'active'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="action-btn view"
                                  onClick={() => setSelectedUser(student)}
                                >
                                  View
                                </button>
                                <button 
                                  className="action-btn edit"
                                  onClick={() => {
                                    const newStatus = student.status === 'active' ? 'inactive' : 'active';
                                    handleUpdateStudentStatus(student.id, newStatus);
                                  }}
                                >
                                  {student.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Courses Tab */}
            {activeTab === 'courses' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📖 Course Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search courses..."
                      className="search-input"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setTimeout(() => fetchCourses(), 300);
                      }}
                    />
                    {(isAdmin || isLecturer) && (
                      <button 
                        className="add-button"
                        onClick={() => setShowCourseModal(true)}
                      >
                        + Add Course
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="courses-grid">
                  {courses.map(course => (
                    <div key={course.id} className="course-card">
                      <div className="course-header">
                        <h3>{course.course_code}</h3>
                        <div className="course-header-right">
                          <span className="dept-badge">
                            {course.department_code || course.department || 'N/A'}
                          </span>
                          <span className={`course-status ${course.is_active ? 'active' : 'inactive'}`}>
                            {course.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <h4>{course.course_name}</h4>
                      <p className="course-description">{course.description || 'No description'}</p>
                      <div className="course-details">
                        <span>Year {course.year} - Semester {course.semester}</span>
                        <span>{course.credits} Credits</span>
                        <span>{course.program}</span>
                      </div>
                      <div className="course-actions">
                        <button 
                          className="course-btn"
                          onClick={() => setSelectedCourse(course)}
                        >
                          View Details
                        </button>
                        {isLecturer && (
                          <button 
                            className="course-btn course-btn-secondary"
                            onClick={() => handleToggleCourseActive(course.id, course.is_active)}
                          >
                            {course.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lectures Tab */}
            {activeTab === 'lectures' && isLecturer && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>🎓 Lecture Management</h2>
                  <div className="debug-info" style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                    <p>Debug: Showing {lectures.length} lectures | Lecturer ID: {profile?.id} | Is Lecturer: {isLecturer.toString()}</p>
                    <button 
                      onClick={() => {
                        console.log('DEBUG: Current lectures state:', lectures);
                        fetchLectures();
                      }}
                      style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                      Refresh & Debug
                    </button>
                  </div>
                  {isLecturer && (
                    <button 
                      className="add-button"
                      onClick={() => setShowLectureModal(true)}
                    >
                      + Schedule Lecture
                    </button>
                  )}
                </div>
                
                {/* Live Lectures */}
                {getLiveLectures().length > 0 && (
                  <div className="lectures-section">
                    <h3 className="section-title">🔴 Live Lectures</h3>
                    <div className="lectures-grid">
                      {getLiveLectures().map(lecture => (
                        <div key={lecture.id} className="lecture-card live">
                          <div className="lecture-header">
                            <div>
                              <h3>{lecture.courses?.course_code}: {lecture.title}</h3>
                              <p className="course-info">
                                {lecture.courses?.course_name}
                              </p>
                            </div>
                            <span className="lecture-status live">
                              🔴 LIVE
                            </span>
                          </div>
                          <p>{lecture.description}</p>
                          <div className="lecture-details">
                            <span>👨‍🏫 {lecture.lecturers?.full_name}</span>
                            <span>📅 {lecture.formattedDate}</span>
                            <span>⏰ {lecture.formattedTime}</span>
                            <span>🏛️ {lecture.courses?.department_code}</span>
                          </div>
                          <div className="lecture-actions">
                            {lecture.meetLink && (
                              <a 
                                href={lecture.meetLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="meet-link join-btn"
                              >
                                🎥 Join Google Meet
                              </a>
                            )}
                            <button 
                              className="action-btn end"
                              onClick={() => handleEndLecture(lecture.id)}
                            >
                              End Lecture
                            </button>
                            <button 
                              className="action-btn edit"
                              onClick={() => {
                                setEditingLecture(lecture);
                                setEditLecture({
                                  title: lecture.title,
                                  description: lecture.description,
                                  google_meet_link: lecture.google_meet_link,
                                  scheduled_date: lecture.scheduled_date,
                                  start_time: lecture.start_time,
                                  end_time: lecture.end_time
                                });
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Upcoming Lectures */}
                <div className="lectures-section">
                  <h3 className="section-title">📅 Upcoming Lectures</h3>
                  {getUpcomingLectures().length > 0 ? (
                    <div className="lectures-grid">
                      {getUpcomingLectures().map(lecture => (
                        <div key={lecture.id} className="lecture-card">
                          <div className="lecture-header">
                            <div>
                              <h3>{lecture.courses?.course_code}: {lecture.title}</h3>
                              <p className="course-info">
                                {lecture.courses?.course_name}
                              </p>
                            </div>
                            <span className={`lecture-status ${lecture.status}`}>
                              {lecture.status}
                            </span>
                          </div>
                          <p>{lecture.description}</p>
                          <div className="lecture-details">
                            <span>👨‍🏫 {lecture.lecturers?.full_name}</span>
                            <span>📅 {lecture.formattedDate}</span>
                            <span>⏰ {lecture.formattedTime}</span>
                            <span>🏛️ {lecture.courses?.department_code}</span>
                          </div>
                          <div className="lecture-actions">
                            {lecture.meetLink && (
                              <a 
                                href={lecture.meetLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="meet-link"
                              >
                                🔗 Copy Meeting Link
                              </a>
                            )}
                            <button 
                              className="action-btn start"
                              onClick={() => handleStartLecture(lecture.id)}
                            >
                              Start Now
                            </button>
                            <button 
                              className="action-btn edit"
                              onClick={() => {
                                setEditingLecture(lecture);
                                setEditLecture({
                                  title: lecture.title,
                                  description: lecture.description,
                                  google_meet_link: lecture.google_meet_link,
                                  scheduled_date: lecture.scheduled_date,
                                  start_time: lecture.start_time,
                                  end_time: lecture.end_time
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              className="action-btn delete"
                              onClick={() => handleDeleteLecture(lecture.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No upcoming lectures scheduled</p>
                      <button 
                        onClick={() => setShowLectureModal(true)}
                        className="add-button-small"
                      >
                        + Schedule Your First Lecture
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Past Lectures */}
                {getPastLectures().length > 0 && (
                  <div className="lectures-section">
                    <h3 className="section-title">✅ Past Lectures</h3>
                    <div className="lectures-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Course</th>
                            <th>Title</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Recording</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getPastLectures()
                            .slice(0, 10)
                            .map(lecture => (
                              <tr key={lecture.id}>
                                <td>{lecture.formattedDate}</td>
                                <td>{lecture.courses?.course_code}</td>
                                <td>{lecture.title}</td>
                                <td>{lecture.formattedTime}</td>
                                <td>
                                  <span className="lecture-status completed">
                                    Completed
                                  </span>
                                </td>
                                <td>
                                  {lecture.recording_url ? (
                                    <a 
                                      href={lecture.recording_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="recording-link"
                                    >
                                      📹 View Recording
                                    </a>
                                  ) : (
                                    <span className="text-muted">No recording</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exams Tab */}
            {activeTab === 'exams' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>🎯 Exam Management</h2>
                  {(isAdmin || isLecturer) && (
                    <button 
                      className="add-button"
                      onClick={() => setShowExamsModal(true)}
                    >
                      + Schedule Exam
                    </button>
                  )}
                </div>
                
                <div className="exams-list">
                  {exams.length > 0 ? (
                    exams.map(exam => (
                      <div key={exam.id} className="exam-card">
                        <div className="exam-header">
                          <div>
                            <h3>{exam.title}</h3>
                            <p className="course-info">
                              {exam.courses?.course_code} - {exam.courses?.course_name}
                            </p>
                          </div>
                          <span className={`exam-status ${exam.status}`}>
                            {exam.status}
                          </span>
                        </div>
                        <p>{exam.description}</p>
                        <div className="exam-details">
                          <span>📅 Start: {new Date(exam.start_time).toLocaleString()}</span>
                          <span>⏰ End: {new Date(exam.end_time).toLocaleString()}</span>
                          <span>📊 Total Marks: {exam.total_marks}</span>
                          <span>🏛️ Department: {exam.courses?.department_code}</span>
                          <span>📍 Venue: {exam.venue}</span>
                        </div>
                        <div className="exam-actions">
                          <button 
                            className="action-btn view"
                            onClick={() => setSelectedExam(exam)}
                          >
                            View Details
                          </button>
                          {(isAdmin || (isLecturer && exam.lecturer_id === profile.id)) && (
                            <>
                              <button 
                                className="action-btn edit"
                                onClick={() => {
                                  setEditingExam(exam);
                                  setEditExam({
                                    title: exam.title,
                                    description: exam.description,
                                    start_time: exam.start_time,
                                    end_time: exam.end_time,
                                    venue: exam.venue,
                                    status: exam.status
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button 
                                className="action-btn delete"
                                onClick={() => handleDeleteExam(exam.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p>No exams scheduled</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lecturers Tab - Admin Only */}
            {activeTab === 'lecturers' && isAdmin && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>👨‍🏫 Lecturer Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search lecturers..."
                      className="search-input"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        // Implement search
                      }}
                    />
                    <button 
                      className="add-button"
                      onClick={() => {
                        setNewUser({...newUser, role: 'lecturer'});
                        setShowUserModal(true);
                      }}
                    >
                      + Add Lecturer
                    </button>
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Lecturer ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Google Meet</th>
                        <th>Department</th>
                        <th>Specialization</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lecturers.map(lecturer => (
                        <tr key={lecturer.id}>
                          <td>{lecturer.lecturer_id}</td>
                          <td>{lecturer.full_name}</td>
                          <td>{lecturer.email}</td>
                          <td>
                            {lecturer.google_meet_link ? (
                              <a 
                                href={lecturer.google_meet_link} 
                                target="_blank" 
                                rel="noreferrer"
                                className="meet-link small"
                              >
                                🔗 Link
                              </a>
                            ) : (
                              <span className="text-muted">No link</span>
                            )}
                          </td>
                          <td>
                            {renderLecturerDepartments(lecturer)}
                          </td>
                          <td>{lecturer.specialization}</td>
                          <td>
                            <span className={`status-badge ${lecturer.status || 'active'}`}>
                              {lecturer.status || 'active'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn view"
                                onClick={() => setSelectedUser(lecturer)}
                              >
                                View
                              </button>
                              <button 
                                className="action-btn dept"
                                onClick={() => {
                                  setSelectedLecturerForDept(lecturer);
                                  setShowDepartmentModal(true);
                                }}
                              >
                                🏢 Depts
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Finance Tab - Admin Only */}
            {activeTab === 'finance' && isAdmin && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>💰 Financial Management</h2>
                  <button 
                    className="add-button"
                    onClick={() => setShowFinanceModal(true)}
                  >
                    + Add Record
                  </button>
                </div>
                
                <div className="financial-overview">
                  <div className="financial-card">
                    <h3>Total Revenue</h3>
                    <p className="financial-amount positive">
                      ${(stats.totalFinancialRecords * 1000).toLocaleString()}
                    </p>
                    <small>This academic year</small>
                  </div>
                  <div className="financial-card">
                    <h3>Pending Payments</h3>
                    <p className="financial-amount negative">
                      ${(stats.pendingPayments * 500).toLocaleString()}
                    </p>
                    <small>Awaiting clearance</small>
                  </div>
                  <div className="financial-card">
                    <h3>Cleared Payments</h3>
                    <p className="financial-amount neutral">
                      ${((stats.totalFinancialRecords - stats.pendingPayments) * 1000).toLocaleString()}
                    </p>
                    <small>Successfully processed</small>
                  </div>
                </div>
                
                <div className="table-container">
                  <h3>Recent Transactions</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Student ID</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialRecords.slice(0, 10).map(record => (
                        <tr key={record.id}>
                          <td>{record.receipt_number || 'N/A'}</td>
                          <td>{record.student_id?.slice(0, 8) || 'Unknown'}</td>
                          <td>{record.description}</td>
                          <td>${record.amount}</td>
                          <td>{new Date(record.payment_date || record.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${record.status}`}>
                              {record.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn view"
                                onClick={() => setSelectedFinanceRecord(record)}
                              >
                                View
                              </button>
                              <button 
                                className="action-btn edit"
                                onClick={() => handleUpdateFinanceStatus(record.id, 
                                  record.status === 'pending' ? 'paid' : 'pending'
                                )}
                              >
                                {record.status === 'pending' ? 'Mark Paid' : 'Mark Pending'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📅 Attendance Management</h2>
                  <div className="tab-actions">
                    <div className="attendance-rate">
                      Overall Attendance Rate: {stats.attendanceRate}%
                    </div>
                    {isAdmin && (
                      <button 
                        className="add-button"
                        onClick={() => setShowAttendanceModal(true)}
                      >
                        + Add Record
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Lecture</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 20).map(record => (
                        <tr key={record.id}>
                          <td>{record.student_id?.slice(0, 8) || 'N/A'}</td>
                          <td>{record.lecture_id?.slice(0, 8) || 'N/A'}</td>
                          <td>{new Date(record.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${record.status}`}>
                              {record.status}
                            </span>
                          </td>
                          <td>{record.check_in_time || 'N/A'}</td>
                          <td>{record.check_out_time || 'N/A'}</td>
                          <td>{record.remarks || 'No remarks'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab - Admin Only */}
            {activeTab === 'settings' && isAdmin && (
              <div className="tab-content">
                <h2>⚙ System Settings</h2>
                <div className="settings-grid">
                  <div className="setting-card">
                    <h3>Academic Settings</h3>
                    <div className="setting-item">
                      <label className="setting-label">Academic Year</label>
                      <select className="setting-select" defaultValue="2024/2025">
                        <option>2023/2024</option>
                        <option>2024/2025</option>
                        <option>2025/2026</option>
                      </select>
                    </div>
                    <div className="setting-item">
                      <label className="setting-label">Semester</label>
                      <select className="setting-select" defaultValue="1">
                        <option value="1">Semester 1</option>
                        <option value="2">Semester 2</option>
                      </select>
                    </div>
                    <button className="save-button">Save Changes</button>
                  </div>
                  
                  <div className="setting-card">
                    <h3>System Preferences</h3>
                    <div className="setting-item">
                      <label className="setting-label">
                        <input type="checkbox" defaultChecked className="setting-checkbox" />
                        Email Notifications
                      </label>
                    </div>
                    <div className="setting-item">
                      <label className="setting-label">
                        <input type="checkbox" defaultChecked className="setting-checkbox" />
                        Auto Backup
                      </label>
                    </div>
                    <div className="setting-item">
                      <label className="setting-label">
                        <input type="checkbox" className="setting-checkbox" />
                        Maintenance Mode
                      </label>
                    </div>
                    <button className="save-button">Update Preferences</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* =================== MODALS =================== */}

      {/* Assignment Upload Modal */}
      {showAssignmentUploadModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <h3>Create New Assignment</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Course *</label>
                <select 
                  value={newAssignment.course_id}
                  onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                  className="form-select"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name} ({course.department_code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input 
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  placeholder="Assignment title"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date & Time *</label>
                  <input 
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Total Marks *</label>
                  <input 
                    type="number"
                    value={newAssignment.total_marks}
                    onChange={(e) => setNewAssignment({ ...newAssignment, total_marks: parseInt(e.target.value) })}
                    min="1"
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  placeholder="Assignment description"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Instructions</label>
                <textarea 
                  value={newAssignment.instructions}
                  onChange={(e) => setNewAssignment({ ...newAssignment, instructions: e.target.value })}
                  placeholder="Instructions for students"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Submission Type</label>
                  <select 
                    value={newAssignment.submission_type}
                    onChange={(e) => setNewAssignment({ ...newAssignment, submission_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="file">File Upload</option>
                    <option value="text">Text Submission</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Max File Size (MB)</label>
                  <input 
                    type="number"
                    value={newAssignment.max_file_size}
                    onChange={(e) => setNewAssignment({ ...newAssignment, max_file_size: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Allowed Formats</label>
                <div className="checkbox-group">
                  {['pdf', 'doc', 'docx', 'zip', 'jpg', 'png', 'txt'].map(format => (
                    <label key={format} className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={newAssignment.allowed_formats.includes(format)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAssignment({
                              ...newAssignment,
                              allowed_formats: [...newAssignment.allowed_formats, format]
                            });
                          } else {
                            setNewAssignment({
                              ...newAssignment,
                              allowed_formats: newAssignment.allowed_formats.filter(f => f !== format)
                            });
                          }
                        }}
                      />
                      {format.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              
              {/* File Upload Section */}
              <div className="form-group">
                <label className="form-label">Assignment Files (Optional)</label>
                <div 
                  className="file-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('drag-over');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                    const files = Array.from(e.dataTransfer.files);
                    setAssignmentFiles(prev => [...prev, ...files]);
                  }}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setAssignmentFiles(prev => [...prev, ...files]);
                    }}
                    className="file-input"
                  />
                  <div className="upload-icon">📎</div>
                  <p>Drag & drop files here or click to browse</p>
                  <p className="small-text">Supports: PDF, DOC, DOCX, ZIP, Images</p>
                </div>
                
                {/* Upload Progress */}
                {uploadingFiles && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">Uploading: {uploadProgress}%</p>
                  </div>
                )}
                
                {/* File List */}
                {assignmentFiles.length > 0 && (
                  <div className="file-list">
                    <h4>Selected Files ({assignmentFiles.length})</h4>
                    <div className="files-grid">
                      {assignmentFiles.map((file, index) => (
                        <div key={index} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <button 
                            className="remove-file"
                            onClick={() => {
                              setAssignmentFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowAssignmentUploadModal(false);
                    setAssignmentFiles([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleCreateAssignment}
                  disabled={loading.creatingAssignment || uploadingFiles}
                >
                  {loading.creatingAssignment ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {showSubmissionsModal && selectedAssignment && (
        <div className="modal-overlay">
          <div className="modal extra-large-modal">
            <h3>Submissions: {selectedAssignment.title}</h3>
            <div className="modal-content">
              {/* Content from grading section can go here */}
            </div>
          </div>
        </div>
      )}

      {/* Department Assignment Modal */}
      {showDepartmentModal && selectedLecturerForDept && (
        <DepartmentAssignmentModal
          lecturer={selectedLecturerForDept}
          onClose={() => {
            setShowDepartmentModal(false);
            setSelectedLecturerForDept(null);
          }}
          onAssign={() => {
            fetchLecturers();
            fetchDashboardStats();
          }}
        />
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New User</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="form-select"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input 
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="Enter phone number"
                  className="form-input"
                />
              </div>
              
              {newUser.role === 'student' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Program</label>
                    <input 
                      type="text"
                      value={newUser.program}
                      onChange={(e) => setNewUser({ ...newUser, program: e.target.value })}
                      placeholder="e.g., Computer Engineering"
                      className="form-input"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Year of Study</label>
                    <select 
                      value={newUser.year_of_study}
                      onChange={(e) => setNewUser({ ...newUser, year_of_study: parseInt(e.target.value) })}
                      className="form-select"
                    >
                      {[1, 2, 3, 4, 5].map(year => (
                        <option key={year} value={year}>Year {year}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input 
                      type="text"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      placeholder="e.g., Computer Science"
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Specialization</label>
                    <input 
                      type="text"
                      value={newUser.specialization}
                      onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })}
                      placeholder="e.g., Web Development"
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Google Meet Link (Optional)</label>
                    <input 
                      type="url"
                      value={newUser.google_meet_link}
                      onChange={(e) => setNewUser({ ...newUser, google_meet_link: e.target.value })}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      className="form-input"
                    />
                  </div>
                </>
              )}
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddUser}
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {showCourseModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Course</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Course Code</label>
                <input 
                  type="text"
                  value={newCourse.course_code}
                  onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })}
                  placeholder="e.g., CS-401"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input 
                  type="text"
                  value={newCourse.course_name}
                  onChange={(e) => setNewCourse({ ...newCourse, course_name: e.target.value })}
                  placeholder="e.g., Machine Learning"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Course description"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <select 
                    value={newCourse.year}
                    onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    {[1, 2, 3, 4].map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select 
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Credits</label>
                  <input 
                    type="number"
                    value={newCourse.credits}
                    onChange={(e) => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) })}
                    min="1"
                    max="6"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Department Code</label>
                <input 
                  type="text"
                  value={newCourse.department_code}
                  onChange={(e) => setNewCourse({ ...newCourse, department_code: e.target.value })}
                  placeholder="e.g., CS, BUS, MATH"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input 
                  type="text"
                  value={newCourse.department}
                  onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                  placeholder="e.g., Computer Science"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Program</label>
                <input 
                  type="text"
                  value={newCourse.program}
                  onChange={(e) => setNewCourse({ ...newCourse, program: e.target.value })}
                  placeholder="e.g., Computer Engineering"
                  className="form-input"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowCourseModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddCourse}
                >
                  Add Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal (Basic) */}
      {showAssignmentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Assignment</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Course</label>
                <select 
                  value={newAssignment.course_id}
                  onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                  className="form-select"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  placeholder="Assignment title"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  placeholder="Assignment description"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Instructions</label>
                <textarea 
                  value={newAssignment.instructions}
                  onChange={(e) => setNewAssignment({ ...newAssignment, instructions: e.target.value })}
                  placeholder="Instructions for students"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Total Marks</label>
                  <input 
                    type="number"
                    value={newAssignment.total_marks}
                    onChange={(e) => setNewAssignment({ ...newAssignment, total_marks: parseInt(e.target.value) })}
                    min="1"
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowAssignmentModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddAssignment}
                >
                  Create Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lecture Modal */}
      {showLectureModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Schedule New Lecture</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Course</label>
                <select 
                  value={newLecture.course_id}
                  onChange={(e) => setNewLecture({ ...newLecture, course_id: e.target.value })}
                  className="form-select"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text"
                  value={newLecture.title}
                  onChange={(e) => setNewLecture({ ...newLecture, title: e.target.value })}
                  placeholder="Lecture title"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={newLecture.description}
                  onChange={(e) => setNewLecture({ ...newLecture, description: e.target.value })}
                  placeholder="Lecture description"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date"
                    value={newLecture.scheduled_date}
                    onChange={(e) => setNewLecture({ ...newLecture, scheduled_date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="time"
                    value={newLecture.start_time}
                    onChange={(e) => setNewLecture({ ...newLecture, start_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="time"
                    value={newLecture.end_time}
                    onChange={(e) => setNewLecture({ ...newLecture, end_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Google Meet Link (Optional)</label>
                <input 
                  type="url"
                  value={newLecture.google_meet_link}
                  onChange={(e) => setNewLecture({ ...newLecture, google_meet_link: e.target.value })}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="form-input"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowLectureModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddLecture}
                >
                  Schedule Lecture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lecture Modal */}
      {editingLecture && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Lecture</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text"
                  value={editLecture.title}
                  onChange={(e) => setEditLecture({ ...editLecture, title: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={editLecture.description}
                  onChange={(e) => setEditLecture({ ...editLecture, description: e.target.value })}
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Google Meet Link</label>
                <input 
                  type="url"
                  value={editLecture.google_meet_link}
                  onChange={(e) => setEditLecture({ ...editLecture, google_meet_link: e.target.value })}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="form-input"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date"
                    value={editLecture.scheduled_date}
                    onChange={(e) => setEditLecture({ ...editLecture, scheduled_date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="time"
                    value={editLecture.start_time}
                    onChange={(e) => setEditLecture({ ...editLecture, start_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="time"
                    value={editLecture.end_time}
                    onChange={(e) => setEditLecture({ ...editLecture, end_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setEditingLecture(null)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleEditLecture}
                >
                  Update Lecture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lecture Details Modal */}
      {showLectureDetailsModal && selectedLecture && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Lecture Details</h3>
            <div className="lecture-details-modal">
              <div className="detail-item">
                <strong>Title:</strong>
                <span>{selectedLecture.title}</span>
              </div>
              <div className="detail-item">
                <strong>Course:</strong>
                <span>{selectedLecture.courses?.course_code} - {selectedLecture.courses?.course_name}</span>
              </div>
              <div className="detail-item">
                <strong>Lecturer:</strong>
                <span>{selectedLecture.lecturers?.full_name}</span>
              </div>
              <div className="detail-item">
                <strong>Date:</strong>
                <span>{selectedLecture.formattedDate}</span>
              </div>
              <div className="detail-item">
                <strong>Time:</strong>
                <span>{selectedLecture.formattedTime}</span>
              </div>
              <div className="detail-item">
                <strong>Department:</strong>
                <span>{selectedLecture.courses?.department_code}</span>
              </div>
              <div className="detail-item">
                <strong>Status:</strong>
                <span className={`lecture-status ${selectedLecture.status}`}>
                  {selectedLecture.status}
                </span>
              </div>
              {selectedLecture.meetLink && (
                <div className="detail-item">
                  <strong>Google Meet:</strong>
                  <a 
                    href={selectedLecture.meetLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="meet-link"
                  >
                    Join Meeting
                  </a>
                </div>
              )}
              {selectedLecture.description && (
                <div className="detail-item">
                  <strong>Description:</strong>
                  <p>{selectedLecture.description}</p>
                </div>
              )}
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowLectureDetailsModal(false)}
                >
                  Close
                </button>
                {isLecturer && selectedLecture.status === 'scheduled' && (
                  <button 
                    className="confirm-button"
                    onClick={() => {
                      handleStartLecture(selectedLecture.id);
                      setShowLectureDetailsModal(false);
                    }}
                  >
                    Start Lecture
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exams Modal */}
      {showExamsModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Schedule New Exam</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Course</label>
                <select 
                  value={newExam.course_id}
                  onChange={(e) => setNewExam({ ...newExam, course_id: e.target.value })}
                  className="form-select"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text"
                  value={newExam.title}
                  onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                  placeholder="Exam title"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={newExam.description}
                  onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                  placeholder="Exam description"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Exam Type</label>
                  <select 
                    value={newExam.exam_type}
                    onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                    <option value="quiz">Quiz</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Total Marks</label>
                  <input 
                    type="number"
                    value={newExam.total_marks}
                    onChange={(e) => setNewExam({ ...newExam, total_marks: parseInt(e.target.value) })}
                    min="1"
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="datetime-local"
                    value={newExam.start_time}
                    onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="datetime-local"
                    value={newExam.end_time}
                    onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Venue</label>
                <input 
                  type="text"
                  value={newExam.venue}
                  onChange={(e) => setNewExam({ ...newExam, venue: e.target.value })}
                  placeholder="e.g., Main Hall, Room 101"
                  className="form-input"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowExamsModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddExam}
                >
                  Schedule Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {editingExam && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Exam</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input 
                  type="text"
                  value={editExam.title}
                  onChange={(e) => setEditExam({ ...editExam, title: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  value={editExam.description}
                  onChange={(e) => setEditExam({ ...editExam, description: e.target.value })}
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="datetime-local"
                    value={editExam.start_time}
                    onChange={(e) => setEditExam({ ...editExam, start_time: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Time</label>
                    <input 
                      type="datetime-local"
                      value={editExam.end_time}
                      onChange={(e) => setEditExam({ ...editExam, end_time: e.target.value })}
                      className="form-input"
                      required
                    />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Venue</label>
                <input 
                  type="text"
                  value={editExam.venue}
                  onChange={(e) => setEditExam({ ...editExam, venue: e.target.value })}
                  placeholder="e.g., Main Hall, Room 101"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Status</label>
                <select 
                  value={editExam.status}
                  onChange={(e) => setEditExam({ ...editExam, status: e.target.value })}
                  className="form-select"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setEditingExam(null)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleEditExam}
                >
                  Update Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finance Modal */}
      {showFinanceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Financial Record</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Student ID</label>
                <input 
                  type="text"
                  value={newFinanceRecord.student_id}
                  onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, student_id: e.target.value })}
                  placeholder="Enter student ID"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text"
                  value={newFinanceRecord.description}
                  onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, description: e.target.value })}
                  placeholder="e.g., Tuition Fee, Library Fine, etc."
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input 
                    type="number"
                    value={newFinanceRecord.amount}
                    onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, amount: parseFloat(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input 
                    type="date"
                    value={newFinanceRecord.payment_date}
                    onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, payment_date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Status</label>
                <select 
                  value={newFinanceRecord.status}
                  onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, status: e.target.value })}
                  className="form-select"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowFinanceModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddFinanceRecord}
                >
                  Add Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Attendance Record</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Student ID</label>
                <input 
                  type="text"
                  value={newAttendanceRecord.student_id}
                  onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, student_id: e.target.value })}
                  placeholder="Enter student ID"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Lecture ID (Optional)</label>
                <input 
                  type="text"
                  value={newAttendanceRecord.lecture_id}
                  onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, lecture_id: e.target.value })}
                  placeholder="Enter lecture ID"
                  className="form-input"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date"
                    value={newAttendanceRecord.date}
                    onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, date: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select 
                    value={newAttendanceRecord.status}
                    onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, status: e.target.value })}
                    className="form-select"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Check-in Time</label>
                  <input 
                    type="time"
                    value={newAttendanceRecord.check_in_time}
                    onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, check_in_time: e.target.value })}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Check-out Time</label>
                  <input 
                    type="time"
                    value={newAttendanceRecord.check_out_time}
                    onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, check_out_time: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea 
                  value={newAttendanceRecord.remarks}
                  onChange={(e) => setNewAttendanceRecord({ ...newAttendanceRecord, remarks: e.target.value })}
                  placeholder="Any remarks or notes"
                  rows="3"
                  className="form-textarea"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowAttendanceModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddAttendanceRecord}
                >
                  Add Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="small-modal">
            <h3>Confirm Logout</h3>
            <p>
              Are you sure you want to logout?
            </p>
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© {new Date().getFullYear()} NLE University • {isAdmin ? 'Admin Portal' : 'Lecturer Portal'}</p>
        <p className="footer-stats">
          {isAdmin 
            ? `Total Students: ${stats.totalStudents} | Lecturers: ${stats.totalLecturers} | Last Updated: ${new Date().toLocaleTimeString()}`
            : `Your Students: ${stats.totalStudents} | Courses: ${stats.totalCourses} | Departments: ${allowedDepartments?.length || 0}`
          }
        </p>
      </footer>
    </div>
  );
};

export default AdminDashboard;