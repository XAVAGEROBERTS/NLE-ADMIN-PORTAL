// AdminDashboard.jsx - COMPLETE WORKING VERSION WITH FILE DOWNLOAD
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
  // Update the loading state to include submissions
const [loading, setLoading] = useState({ 
  dashboard: true,
  submissions: false, // Add this
  creatingAssignment: false
});
const [enrollStudent, setEnrollStudent] = useState(null);
const [showEnrollModal, setShowEnrollModal] = useState(false);
  
 const [newUser, setNewUser] = useState({
  full_name: '',
  email: '',
  phone: '',
  role: 'student',
  program_id: '',
  program: '',
  department: '',
   department_code: '',
  program_code: '',  // ← ADD THIS
  year_of_study: 1,
  semester: 1,
  intake: 'January',
  academic_year: '',        // ← Now manual input (e.g., 2025/2029)
  date_of_birth: '',        // ← NEW: Date of birth
  specialization: '',
   google_meet_link: '',
  program_duration_years: 4,
 }); 
  
  // === NEW: Cohort selection for assignments and lectures ===
const [selectedCohort, setSelectedCohort] = useState({
  academic_year: '',
  year_of_study: 1,
  semester: 1
});
const [cohortError, setCohortError] = useState('');



  // Add these states near your other state declarations (around line 50-100)
const [showReversalMode, setShowReversalMode] = useState(false);
const [reversalFilters, setReversalFilters] = useState({
  program_id: '',
  academic_year: '',
  year_of_study: 1,
  semester: 1
});
const [completedCourses, setCompletedCourses] = useState([]);
const [selectedCoursesForReversal, setSelectedCoursesForReversal] = useState([]);
const [reversalInProgress, setReversalInProgress] = useState(false);
// [students, lecturers, courses, etc...]
  const [searchTerm, setSearchTerm] = useState('');
  // === ADD TO STATE (near other states) ===


// New state for course completion
const [completionFilters, setCompletionFilters] = useState({
  program_id: '',
  academic_year: '',
  year_of_study: 1,
  semester: 1
});
const [coursesForCompletion, setCoursesForCompletion] = useState([]);
const [studentsToComplete, setStudentsToComplete] = useState([]);
const [selectedCoursesForCompletion, setSelectedCoursesForCompletion] = useState([]);
const [markingInProgress, setMarkingInProgress] = useState(false);

// === NEW FUNCTIONS ===

const fetchCoursesForCompletion = async () => {
  if (!completionFilters.year_of_study || !completionFilters.semester) {
    setCoursesForCompletion([]);
    return;
  }

  try {
    let query = supabase
      .from('courses')
      .select('id, course_code, course_name, program, department_code, program_code')
      .eq('year', completionFilters.year_of_study)
      .eq('semester', completionFilters.semester)
      .eq('is_active', true);

    // If a program is selected, filter by program_code (text field)
    if (completionFilters.program_id) {
      const { data: selectedProgram } = await supabase
        .from('programs')
        .select('code')
        .eq('id', completionFilters.program_id)
        .single();

      if (selectedProgram?.code) {
        query = query.eq('program_code', selectedProgram.code);  // This matches BSCE, BSCS, etc.
      }
    }

    const { data, error } = await query.order('course_code', { ascending: true });

    if (error) throw error;

    setCoursesForCompletion(data || []);
  } catch (err) {
    console.error('Error loading courses:', err);
    alert('Failed to load courses: ' + err.message);
    setCoursesForCompletion([]);
  }
};

// Fetch students in the selected program and year
const fetchStudentsForCompletion = async () => {
  if (!completionFilters.year_of_study || !completionFilters.academic_year) {
    setStudentsToComplete([]);
    return;
  }

  try {
    let query = supabase
      .from('students')
      .select('id')
      .eq('year_of_study', completionFilters.year_of_study)
      .eq('academic_year', completionFilters.academic_year)
      .eq('status', 'active');

    if (completionFilters.program_id) {
      query = query.eq('program_id', completionFilters.program_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    setStudentsToComplete(data || []);
  } catch (err) {
    console.error('Error loading students:', err);
    alert('Failed to load students: ' + err.message);
    setStudentsToComplete([]);
  }
};
// Run when filters change
useEffect(() => {
  fetchCoursesForCompletion();
  fetchStudentsForCompletion();
}, [completionFilters]);

  // Add this useEffect after your existing useEffect for completionFilters
useEffect(() => {
  if (showReversalMode) {
    fetchCompletedCourses();
  } else {
    fetchCoursesForCompletion();
    fetchStudentsForCompletion();
  }
}, [
  showReversalMode,
  reversalFilters.program_id,
  reversalFilters.academic_year,
  reversalFilters.year_of_study,
  reversalFilters.semester,
  completionFilters.program_id,
  completionFilters.academic_year,
  completionFilters.year_of_study,
  completionFilters.semester
]);

const handleMarkSemesterCompleted = async () => {
  if (selectedCoursesForCompletion.length === 0) {
    alert('Please select at least one course to mark as completed');
    return;
  }

  if (studentsToComplete.length === 0) {
    alert('No active students found for this program/year');
    return;
  }

  if (!window.confirm('⚠️ IMPORTANT NOTICE: This will update existing enrollments to "completed" Are you sure you want to proceed?')) return;

  setMarkingInProgress(true);

  try {
    console.log(`Processing ${selectedCoursesForCompletion.length} courses for ${studentsToComplete.length} students`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const student of studentsToComplete) {
      for (const courseId of selectedCoursesForCompletion) {
        // 1. Check if enrollment already exists
        const { data: existing, error: checkError } = await supabase
          .from('student_courses')
          .select('id')
          .eq('student_id', student.id)
          .eq('course_id', courseId)
          .maybeSingle();

        if (checkError) {
          console.error('Check error:', checkError);
          skippedCount++;
          continue;
        }

        let recordId;

        if (existing) {
          // Already enrolled → just update status
          recordId = existing.id;
          const { error: updateError } = await supabase
            .from('student_courses')
            .update({
              status: 'completed',
              // Add these only if columns exist:
              // completion_date: new Date().toISOString().split('T')[0],
              // updated_at: new Date().toISOString(),
            })
            .eq('id', recordId);

          if (updateError) {
            console.error('Update failed:', updateError);
            skippedCount++;
            continue;
          }
        } else {
          // No enrollment → auto-enroll and mark as completed
          const { data: inserted, error: insertError } = await supabase
            .from('student_courses')
            .insert({
              student_id: student.id,
              course_id: courseId,
              status: 'completed', // Directly set to completed
              // Add any other required columns here, e.g.:
              // enrollment_date: new Date().toISOString().split('T')[0],
              // program_id: student.program_id, // if you have this
              // department_code: student.department_code,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`Auto-enroll failed for student ${student.id}, course ${courseId}:`, insertError.message);
            skippedCount++;
            continue;
          }

          recordId = inserted.id;
        }

        processedCount++;
        console.log(`Success: Student ${student.id} → Course ${courseId} marked completed`);
      }
    }

    alert(
      `Operation completed!\n\n` +
      `Processed: ${processedCount} records\n` +
      `Skipped (failed): ${skippedCount} records\n\n` +
      `All selected courses now marked as completed for enrolled students.`
    );

    setSelectedCoursesForCompletion([]);
    fetchDashboardStats();

  } catch (err) {
    console.error('Critical error:', err);
    alert('Failed: ' + (err.message || 'Unknown error'));
  } finally {
    setMarkingInProgress(false);
  }
  };
  
 // Add these functions after your handleMarkSemesterCompleted function (around line 300-400)

// Fetch courses that have been marked as completed
const fetchCompletedCourses = async () => {
  if (!reversalFilters.year_of_study || !reversalFilters.semester) {
    setCompletedCourses([]);
    return;
  }

  try {
    // First get all courses for this semester
    let courseQuery = supabase
      .from('courses')
      .select('id, course_code, course_name, program, department_code, program_code')
      .eq('year', reversalFilters.year_of_study)
      .eq('semester', reversalFilters.semester)
      .eq('is_active', true);

    if (reversalFilters.program_id) {
      const { data: selectedProgram } = await supabase
        .from('programs')
        .select('code')
        .eq('id', reversalFilters.program_id)
        .single();

      if (selectedProgram?.code) {
        courseQuery = courseQuery.eq('program_code', selectedProgram.code);
      }
    }

    const { data: courses, error: coursesError } = await courseQuery.order('course_code', { ascending: true });

    if (coursesError) throw coursesError;

    // Then check which ones have completions
    const coursesWithCompletions = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: completions, error: completionError } = await supabase
          .from('student_courses')
          .select('id')
          .eq('course_id', course.id)
          .eq('status', 'completed')
          .limit(1);

        if (completionError) {
          console.error('Error checking completions:', completionError);
          return null;
        }

        // Return course only if it has completions
        return completions && completions.length > 0 ? course : null;
      })
    );

    // Filter out null values
    const validCourses = coursesWithCompletions.filter(course => course !== null);
    setCompletedCourses(validCourses);

  } catch (err) {
    console.error('Error loading completed courses:', err);
    alert('Failed to load completed courses: ' + err.message);
    setCompletedCourses([]);
  }
};

// Handle reversing course completion
const handleReverseCourseCompletion = async () => {
  if (selectedCoursesForReversal.length === 0) {
    alert('Please select at least one course to reverse');
    return;
  }

  if (!window.confirm(
    `⚠️ IMPORTANT: This will change ${selectedCoursesForReversal.length} course(s) from "completed" back to "enrolled" status.\n\n` +
    `Students will be able to submit assignments/exams for these courses again.\n\n` +
    `Are you sure you want to proceed?`
  )) return;

  setReversalInProgress(true);

  try {
    // Update all selected courses from "completed" to "enrolled"
    const { data, error } = await supabase
      .from('student_courses')
      .update({
        status: 'enrolled',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'completed')
      .in('course_id', selectedCoursesForReversal);

    if (error) throw error;

    alert(`✅ Successfully reversed ${selectedCoursesForReversal.length} course(s) back to "enrolled" status!`);
    
    // Reset selections and refresh data
    setSelectedCoursesForReversal([]);
    fetchCompletedCourses();

  } catch (err) {
    console.error('Error reversing completion:', err);
    alert('Failed to reverse completion: ' + err.message);
  } finally {
    setReversalInProgress(false);
  }
};

// Toggle course selection for reversal
const toggleCourseReversalSelection = (courseId) => {
  setSelectedCoursesForReversal(prev =>
    prev.includes(courseId)
      ? prev.filter(id => id !== courseId)
      : [...prev, courseId]
  );
};

// Select all courses for reversal
const selectAllForReversal = () => {
  if (selectedCoursesForReversal.length === completedCourses.length) {
    setSelectedCoursesForReversal([]);
  } else {
    setSelectedCoursesForReversal(completedCourses.map(c => c.id));
  }
  };
  
  useEffect(() => {
  const fetchLectures = async () => {
    try {
      // Get current logged-in student (adjust based on your auth context)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        setLectures([]);
        return;
      }

      // Get student's cohort
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, academic_year, year_of_study, semester')
        .eq('auth_uid', user.id)  // or .eq('id', user.id) if you link differently
        .single();

      if (studentError || !student) {
        console.error('Student profile not found:', studentError);
        setLectures([]);
        return;
      }

      console.log('Student cohort:', {
        academic_year: student.academic_year,
        year: student.year_of_study,
        semester: student.semester
      });

      // Fetch only lectures matching student's cohort
      const { data: lectures, error } = await supabase
        .from('lectures')
        .select(`
          *,
          courses(course_code, course_name, department_code),
          lecturers(full_name, google_meet_link)
        `)
        .eq('target_academic_year', student.academic_year)
        .eq('target_year_of_study', student.year_of_study)
        .eq('target_semester', student.semester)
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching lectures:', error);
        setLectures([]);
      } else {
        console.log(`Found ${lectures?.length || 0} lectures for this cohort`);
        setLectures(lectures || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setLectures([]);
    }
  };

  fetchLectures();
}, []);

// Auto-select all when courses are loaded
useEffect(() => {
  if (completedCourses.length > 0) {
    setSelectedCoursesForReversal(completedCourses.map(c => c.id));
  }
}, [completedCourses]); 

const toggleCourseCompletionSelection = (courseId) => {
  setSelectedCoursesForCompletion(prev =>
    prev.includes(courseId)
      ? prev.filter(id => id !== courseId)
      : [...prev, courseId]
  );
};

const selectAllForCompletion = () => {
  if (selectedCoursesForCompletion.length === coursesForCompletion.length) {
    setSelectedCoursesForCompletion([]);
  } else {
    setSelectedCoursesForCompletion(coursesForCompletion.map(c => c.id));
  }
  };
  
  // In your component, after fetching courses
useEffect(() => {
  if (coursesForCompletion.length > 0) {
    // Auto-select ALL courses by default
    setSelectedCoursesForCompletion(coursesForCompletion.map(c => c.id));
  }
}, [coursesForCompletion]);
  
    // === TIMETABLE MANAGEMENT STATES ===
  const [timetables, setTimetables] = useState([]);
  const [expandedTimetableId, setExpandedTimetableId] = useState(null);
  const [selectedTimetable, setSelectedTimetable] = useState(null);
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [newTimetable, setNewTimetable] = useState({
    program_id: '',
    academic_year: '2024/2025',
    semester: 1,
    year_of_study: 1,
    is_active: true
  });
  const [newSlot, setNewSlot] = useState({
    course_code: '',
    course_name: '',
    lecturer_id: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '10:00',
    room_number: '',
    building: 'CS Building',
    slot_type: 'lecture'
  });
 
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
  
  // File download states
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

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
  const [selectedLecturerDetails, setSelectedLecturerDetails] = useState(null);
    // Student Edit States
  const [editingStudent, setEditingStudent] = useState(null);
 const [editStudentForm, setEditStudentForm] = useState({
  full_name: '',
  email: '',
  phone: '',
  program_id: '',
  program: '',
  year_of_study: 1,
  semester: 1,
  department: '',
  department_code: '',
  status: 'active'
});
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedFinanceRecord, setSelectedFinanceRecord] = useState(null);


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
  // === TUTORIALS UPLOAD STATES ===
const [showTutorialsModal, setShowTutorialsModal] = useState(false);
const [tutorialTitle, setTutorialTitle] = useState('');
const [tutorialDescription, setTutorialDescription] = useState('');
const [tutorialFiles, setTutorialFiles] = useState([]);
const [uploadingTutorial, setUploadingTutorial] = useState(false);
const [tutorialUploadProgress, setTutorialUploadProgress] = useState(0);
const tutorialFileInputRef = useRef(null);

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
  const fileDownloadRef = useRef(null);

  // =================== INITIALIZATION ===================


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
  useEffect(() => {
    if (activeTab === 'timetables' && isAdmin) {
      fetchProgramTimetables();
      fetchPrograms();
      fetchLecturersList();
    } 
      
  }, [activeTab, isAdmin]);
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
  
    // Load programs from database (only for admin)
  useEffect(() => {
    const loadPrograms = async () => {
      if (!isAdmin) {
        setPrograms([]);
        setProgramsLoading(false);
        return;
      }

      try {
        setProgramsLoading(true);
        const { data, error } = await supabase
          .from('programs')
          .select('id, name, code')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error loading programs:', error);
          alert('Failed to load programs');
          setPrograms([]);
        } else {
          setPrograms(data || []);
          console.log('✅ Programs loaded:', data);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    };

    loadPrograms();
  }, [isAdmin]);

  // =================== FILE DOWNLOAD FUNCTIONS ===================
const downloadFile = async (fileUrl, fileName, submissionId = null) => {
  try {
    const downloadKey = submissionId ? `${submissionId}_${fileName}` : fileName;
    setDownloadingFile(downloadKey);
    
    console.log('📥 Download attempt:', { fileUrl, fileName, submissionId });
    
    // Extract the full path after "assignments/"
    let filePath = '';
    
    if (fileUrl.includes('assignments/')) {
      // Extract everything after "assignments/"
      const match = fileUrl.match(/assignments\/(.*)/);
      if (match && match[1]) {
        filePath = match[1];
        console.log('📂 Extracted file path:', filePath);
      }
    }
    
    if (!filePath) {
      console.error('❌ Could not extract file path from URL:', fileUrl);
      alert('Invalid file URL format');
      return;
    }
    
    // Construct proper Supabase URL
    const projectRef = supabase.supabaseUrl.split('//')[1].split('.')[0];
    const fullUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/assignments/${filePath}`;
    console.log('🔗 Full download URL:', fullUrl);
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('assignments')
      .getPublicUrl(filePath);
    
    console.log('🌐 Generated public URL:', publicUrlData.publicUrl);
    
    // First try: direct fetch with the full URL
    try {
      console.log('🔧 Method 1: Trying direct download with full path...');
      const response = await fetch(fullUrl);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || filePath.split('/').pop() || 'assignment_submission';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log('✅ Direct download successful');
      } else {
        console.warn('⚠️ Direct download failed, trying storage API...');
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (directError) {
      console.warn('⚠️ Direct download error:', directError.message);
      
      // Second try: Supabase storage API with full path
      try {
        console.log('🔧 Method 2: Trying storage API with path:', filePath);
        const { data, error: downloadError } = await supabase.storage
          .from('assignments')
          .download(filePath);
        
        if (downloadError) {
          console.error('❌ Storage API error:', downloadError);
          // Last resort: open in new tab
          console.log('🔄 Opening public URL in new tab...');
          window.open(publicUrlData.publicUrl, '_blank');
        } else {
          const url = window.URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName || filePath.split('/').pop() || 'assignment_submission';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          console.log('✅ Storage API download successful');
        }
      } catch (storageError) {
        console.error('❌ Storage error:', storageError);
        // Final fallback
        window.open(publicUrlData.publicUrl, '_blank');
      }
    }
    
    // Update download count
    if (submissionId) {
      try {
        await supabase
          .from('assignment_submissions')
          .update({ 
            download_count: (assignmentSubmissions.find(s => s.submission_id === submissionId)?.download_count || 0) + 1 
          })
          .eq('id', submissionId);
      } catch (countError) {
        console.warn('⚠️ Could not update download count:', countError);
      }
    }
    
  } catch (error) {
    console.error('❌ Download error:', error);
    alert('Error downloading file: ' + error.message);
  } finally {
    setDownloadingFile(null);
  }
  };
  // =================== DEBUG FUNCTIONS ===================
const debugStudentRelationship = async () => {
  console.log('🔍 Debugging student-submission relationship...');
  
  try {
    // 1. Check the schema of assignment_submissions
    const { data: submissionSchema } = await supabase
      .from('assignment_submissions')
      .select('*')
      .limit(1);
    
    console.log('📋 assignment_submissions schema sample:', submissionSchema);
    
    // 2. Check the schema of students
    const { data: studentSchema } = await supabase
      .from('students')
      .select('*')
      .limit(1);
    
    console.log('📋 students schema sample:', studentSchema);
    
    // 3. Try to find a matching student
    if (submissionSchema && submissionSchema.length > 0) {
      const submission = submissionSchema[0];
      console.log('📝 Sample submission student_id:', submission.student_id);
      
      // Try to find this student
      const { data: matchingStudent } = await supabase
        .from('students')
        .select('*')
        .eq('id', submission.student_id)
        .single();
      
      console.log('👤 Student found by UUID:', matchingStudent);
      
      // If not found by UUID, try by student_id field
      if (!matchingStudent) {
        // Check if student_id might be stored as a string ID
        const { data: studentByStringId } = await supabase
          .from('students')
          .select('*')
          .ilike('student_id', `%${submission.student_id}%`)
          .limit(5);
        
        console.log('🔤 Students found by string ID search:', studentByStringId);
      }
    }
    
    // 4. Check if there are any students at all
    const { data: allStudents, count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: false });
    
    console.log(`👥 Total students in database: ${studentCount}`);
    console.log('📊 First 3 students:', allStudents?.slice(0, 3));
    
    alert(`Debug complete. Check console for details.\nTotal students: ${studentCount}`);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    alert('Debug failed: ' + error.message);
  }
};

const testBucketAccess = async () => {
  console.log('🧪 Testing bucket access...');
  
  try {
    // Test 1: List files in assignments bucket
    const { data: files, error: listError } = await supabase.storage
      .from('assignments')
      .list();
    
    console.log('📁 Bucket files:', files);
    console.log('📊 Total files:', files?.length || 0);
    
    if (listError) {
      console.error('❌ Bucket listing error:', listError);
      alert(`Cannot access bucket: ${listError.message}`);
      return;
    }
    
    // Test 2: Try to download a sample file if exists
    if (files && files.length > 0) {
      const testFile = files[0].name;
      console.log('📄 Testing with file:', testFile);
      
      // Test public URL
      const { data: publicUrlData } = supabase.storage
        .from('assignments')
        .getPublicUrl(testFile);
      
      console.log('🔗 Public URL:', publicUrlData.publicUrl);
      
      // Test download
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('assignments')
        .download(testFile);
      
      if (downloadError) {
        console.warn('⚠️ Test download failed:', downloadError);
        alert(`Bucket exists but download failed: ${downloadError.message}\n\nTry making the bucket public in Supabase Dashboard.`);
      } else {
        console.log('✅ Test download successful!');
        alert(`Bucket access successful! Found ${files.length} files.\n\nPublic URL for "${testFile}":\n${publicUrlData.publicUrl}`);
      }
    } else {
      console.log('📭 Bucket is empty');
      alert('Bucket exists but is empty.');
    }
    
  } catch (error) {
    console.error('❌ Bucket test error:', error);
    alert('Bucket test failed: ' + error.message);
  }
};

const testSpecificFile = async () => {
  const testFilePath = 'e26efb58-2093-4619-9cc9-4f0de6f8648c/b190625d-9fca-401a-8102-9ce82d3266a2/1766055967374_0_https.docx';
  
  console.log('🧪 Testing specific file path:', testFilePath);
  
  try {
    // Test 1: List to see if the file exists in that path
    const { data: listData, error: listError } = await supabase.storage
      .from('assignments')
      .list('e26efb58-2093-4619-9cc9-4f0de6f8648c/b190625d-9fca-401a-8102-9ce82d3266a2');
    
    console.log('📁 Files in subfolder:', listData);
    
    // Test 2: Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('assignments')
      .getPublicUrl(testFilePath);
    
    console.log('🔗 Public URL:', publicUrlData.publicUrl);
    
    // Test 3: Try to download
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('assignments')
      .download(testFilePath);
    
    if (downloadError) {
      console.error('❌ Download test failed:', downloadError);
      alert(`Cannot download: ${downloadError.message}\n\nTry checking bucket policies for nested folders.`);
    } else {
      console.log('✅ Download test successful!');
      alert(`File exists at path: ${testFilePath}\n\nPublic URL:\n${publicUrlData.publicUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    alert('Test failed: ' + error.message);
  }
};

const testStudentDataRetrieval = async () => {
  console.log('🔍 Testing student data retrieval...');
  
  try {
    // Get all submissions to see what student IDs we have
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('student_id')
      .limit(5);
    
    console.log('📋 Sample submissions with student IDs:', submissions);
    
    if (submissions && submissions.length > 0) {
      // Try to get these students
      const studentIds = submissions.map(s => s.student_id).filter(id => id);
      console.log('👥 Student IDs to look up:', studentIds);
      
      // Try by UUID first
      const { data: studentsByUuid, error: uuidError } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);
      
      console.log('👤 Students found by UUID:', studentsByUuid);
      console.log('❌ UUID error:', uuidError);
      
      // Try by student_id string
      const studentIdStrings = studentIds.filter(id => typeof id === 'string' && id.includes('-'));
      if (studentIdStrings.length > 0) {
        const { data: studentsByStringId, error: stringError } = await supabase
          .from('students')
          .select('*')
          .in('student_id', studentIdStrings);
        
        console.log('🔤 Students found by string ID:', studentsByStringId);
        console.log('❌ String ID error:', stringError);
      }
    }
    
    // Count total students
    const { data: allStudents, count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: false });
    
    console.log(`👥 Total students in database: ${totalStudents}`);
    console.log('📊 Sample students:', allStudents?.slice(0, 3));
    
    alert(`Student data test complete.\nTotal students: ${totalStudents}\nCheck console for details.`);
    
  } catch (error) {
    console.error('❌ Student test error:', error);
    alert('Student test failed: ' + error.message);
  }
};
  
  const downloadAllFilesForSubmission = async (submission) => {
    if (!submission.file_download_urls || submission.file_download_urls.length === 0) {
      alert('No files to download');
      return;
    }
    
    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: submission.file_download_urls.length });
    
    try {
      for (let i = 0; i < submission.file_download_urls.length; i++) {
        const url = submission.file_download_urls[i];
        const originalUrl = submission.file_urls[i];
        const fileExt = getFileExtension(originalUrl || url);
        const fileName = `${submission.student_name}_${submission.assignment_title}_file${i + 1}.${fileExt}`
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        
        setBatchProgress({ current: i + 1, total: submission.file_download_urls.length });
        
        await downloadFile(url, fileName, submission.submission_id);
        
        // Add delay between downloads
        if (i < submission.file_download_urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      alert(`All ${submission.file_download_urls.length} files downloaded successfully!`);
    } catch (error) {
      console.error('Batch download error:', error);
      alert('Error downloading files: ' + error.message);
    } finally {
      setBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const downloadAllSubmissions = async () => {
    if (assignmentSubmissions.length === 0) {
      alert('No submissions to download');
      return;
    }
    
    const submissionsWithFiles = assignmentSubmissions.filter(
      sub => sub.file_download_urls && sub.file_download_urls.length > 0
    );
    
    if (submissionsWithFiles.length === 0) {
      alert('No files found in submissions');
      return;
    }
    
    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: submissionsWithFiles.length });
    
    try {
      for (let i = 0; i < submissionsWithFiles.length; i++) {
        const submission = submissionsWithFiles[i];
        setBatchProgress({ current: i + 1, total: submissionsWithFiles.length });
        
        for (let j = 0; j < submission.file_download_urls.length; j++) {
          const url = submission.file_download_urls[j];
          const originalUrl = submission.file_urls[j];
          const fileExt = getFileExtension(originalUrl || url);
          const fileName = `${submission.student_name}_${submission.assignment_title}_${i + 1}_${j + 1}.${fileExt}`
            .replace(/[^a-zA-Z0-9._-]/g, '_');
          
          await downloadFile(url, fileName, submission.submission_id);
          
          // Small delay between files
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Delay between students
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      alert(`All files from ${submissionsWithFiles.length} submissions downloaded!`);
    } catch (error) {
      console.error('All submissions download error:', error);
      alert('Error downloading submissions: ' + error.message);
    } finally {
      setBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const getFileExtension = (url) => {
    if (!url) return 'txt';
    const urlWithoutParams = url.split('?')[0];
    const parts = urlWithoutParams.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'txt';
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return 'file';
    const urlWithoutParams = url.split('?')[0];
    return urlWithoutParams.split('/').pop() || 'file';
  };

  // =================== ASSIGNMENT MANAGEMENT FUNCTIONS ===================
 const fetchMyAssignments = async () => {
  if (!isLecturer) return;
 
  console.log('DEBUG: Fetching assignments for lecturer:', profile.id);
  
  try {
    // First try the complex function
    const { data, error } = await supabase.rpc('get_lecturer_assignments', {
      p_lecturer_id: profile.id
    });
    
    console.log('DEBUG: RPC function result:', { data, error });
    
    if (error) {
      console.error('RPC function error, trying simple version:', error);
      
      // Try simple function
      const { data: simpleData, error: simpleError } = await supabase.rpc('get_lecturer_assignments_simple', {
        p_lecturer_id: profile.id
      });
      
      if (simpleError) {
        console.error('Simple RPC also failed, using direct query:', simpleError);
        
        // Fallback to direct query
        const { data: directData, error: directError } = await supabase
          .from('assignments')
          .select(`
            id,
            title,
            description,
            due_date,
            total_marks,
            status,
            course_id,
            courses!inner (
              course_code,
              course_name,
              department_code
            )
          `)
          .eq('lecturer_id', profile.id)
          .order('due_date', { ascending: true });
        
        if (directError) {
          console.error('Direct query error:', directError);
          throw directError;
        }
        
        console.log('DEBUG: Direct query result:', directData);
        
        // Process each assignment to get submission counts
        const processedAssignments = await Promise.all(
          (directData || []).map(async (assignment) => {
            // Get submission counts
            const { data: submissionsData, error: submissionsError } = await supabase
              .from('assignment_submissions')
              .select('id, status')
              .eq('assignment_id', assignment.id);
            
            console.log(`DEBUG: Submissions for assignment ${assignment.id}:`, submissionsData);
            
            const submittedCount = submissionsData?.filter(s => s.status === 'submitted' || s.status === 'graded').length || 0;
            const gradedCount = submissionsData?.filter(s => s.status === 'graded').length || 0;
            
            // Get total students in course
            const { data: courseStudents } = await supabase
              .from('student_courses')
              .select('student_id')
              .eq('course_id', assignment.course_id);
            
            const totalStudents = courseStudents?.length || 0;
            
            return {
              assignment_id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              due_date: assignment.due_date,
              total_marks: assignment.total_marks,
              status: assignment.status,
              course_code: assignment.courses?.course_code,
              course_name: assignment.courses?.course_name,
              department_code: assignment.courses?.department_code,
              submitted_count: submittedCount,
              not_submitted_count: totalStudents - submittedCount,
              graded_count: gradedCount,
              total_students: totalStudents,
              submission_rate: totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
            };
          })
        );
        
        console.log('DEBUG: Processed assignments:', processedAssignments);
        setMyAssignments(processedAssignments);
        return;
      }
      
      console.log('DEBUG: Simple RPC result:', simpleData);
      
      // Process simple data
      const processedSimpleData = await Promise.all(
        (simpleData || []).map(async (assignment) => {
          // Get submission counts
          const { data: submissionsData } = await supabase
            .from('assignment_submissions')
            .select('id, status')
            .eq('assignment_id', assignment.assignment_id);
          
          const submittedCount = submissionsData?.filter(s => s.status === 'submitted' || s.status === 'graded').length || 0;
          const gradedCount = submissionsData?.filter(s => s.status === 'graded').length || 0;
          
          // Get total students in course (we need course_id - but we don't have it in simple data)
          // We'll need to get the assignment to find course_id
          const { data: fullAssignment } = await supabase
            .from('assignments')
            .select('course_id')
            .eq('id', assignment.assignment_id)
            .single();
          
          let totalStudents = 0;
          if (fullAssignment?.course_id) {
            const { data: courseStudents } = await supabase
              .from('student_courses')
              .select('student_id')
              .eq('course_id', fullAssignment.course_id);
            
            totalStudents = courseStudents?.length || 0;
          }
          
          return {
            ...assignment,
            submitted_count: submittedCount,
            not_submitted_count: totalStudents - submittedCount,
            graded_count: gradedCount,
            total_students: totalStudents,
            submission_rate: totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
          };
        })
      );
      
      console.log('DEBUG: Processed simple data:', processedSimpleData);
      setMyAssignments(processedSimpleData);
      return;
    }
    
    console.log('DEBUG: RPC function successful:', data);
    setMyAssignments(data || []);
    
  } catch (error) {
    console.error('Error fetching my assignments:', error);
    
    // Last resort: get basic assignments only
    try {
      const { data: basicAssignments } = await supabase
        .from('assignments')
        .select('id, title, due_date, total_marks, status')
        .eq('lecturer_id', profile.id);
      
      console.log('DEBUG: Basic assignments fallback:', basicAssignments);
      
      const formattedAssignments = (basicAssignments || []).map(a => ({
        assignment_id: a.id,
        title: a.title,
        due_date: a.due_date,
        total_marks: a.total_marks,
        status: a.status,
        course_code: 'N/A',
        course_name: 'N/A',
        department_code: 'N/A',
        submitted_count: 0,
        not_submitted_count: 0,
        graded_count: 0,
        total_students: 0,
        submission_rate: 0
      }));
      
      setMyAssignments(formattedAssignments);
    } catch (fallbackError) {
      console.error('Complete failure:', fallbackError);
      setMyAssignments([]);
    }
  }
};
const fetchAssignmentSubmissions = async (assignmentId) => {
  console.log('🚀 DEBUG: Starting to fetch submissions for assignment:', assignmentId);
  
  if (!assignmentId) {
    console.error('ERROR: No assignment ID provided');
    setAssignmentSubmissions([]);
    return;
  }

  // Set loading state
  setLoading(prev => ({ ...prev, submissions: true }));
  
  try {
    console.log('🔍 Step 1: Fetching submissions...');
    
    const { data: submissions, error: submissionsError } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('submission_date', { ascending: false });
    
    if (submissionsError) throw submissionsError;
    
    console.log('📊 Found submissions:', submissions?.length || 0);
    
    if (!submissions || submissions.length === 0) {
      setAssignmentSubmissions([]);
      return;
    }
    
    // Get ALL students to debug the relationship
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, student_id, full_name, email, program, department_code')
      .limit(100);
    
    console.log('👥 All students in system:', allStudents?.length || 0);
    console.log('📋 Sample student:', allStudents?.[0]);
    
    // Create multiple maps for different lookup methods
    const studentMapById = {}; // Map by UUID
    const studentMapByStudentId = {}; // Map by string ID (STU-...)
    
    allStudents?.forEach(student => {
      studentMapById[student.id] = student;
      if (student.student_id) {
        studentMapByStudentId[student.student_id] = student;
      }
    });
    
    // Get assignment details
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('title, due_date, total_marks')
      .eq('id', assignmentId)
      .single();
    
    // Process submissions
    const processedSubmissions = submissions.map((sub, index) => {
      console.log(`🔍 Processing submission ${index + 1}:`, {
        submission_id: sub.id,
        student_id_in_submission: sub.student_id,
        student_id_type: typeof sub.student_id,
        student_id_length: sub.student_id?.length
      });
      
      let student = null;
      
      // Try to find student by ID (UUID)
      if (sub.student_id && studentMapById[sub.student_id]) {
        student = studentMapById[sub.student_id];
        console.log(`✅ Found student by UUID: ${student.full_name}`);
      }
      // Try to find by student_id string
      else if (sub.student_id && studentMapByStudentId[sub.student_id]) {
        student = studentMapByStudentId[sub.student_id];
        console.log(`✅ Found student by string ID: ${student.full_name}`);
      }
      // Try to find by partial match
      else if (sub.student_id && typeof sub.student_id === 'string') {
        for (const studentIdStr in studentMapByStudentId) {
          if (studentIdStr.includes(sub.student_id) || sub.student_id.includes(studentIdStr)) {
            student = studentMapByStudentId[studentIdStr];
            console.log(`✅ Found student by partial match: ${student.full_name}`);
            break;
          }
        }
      }
      
      if (!student) {
        console.log(`❌ No student found for submission ${sub.id} with student_id: ${sub.student_id}`);
      }
      
      const submissionDate = sub.submission_date ? new Date(sub.submission_date) : null;
      const dueDate = assignmentData?.due_date ? new Date(assignmentData.due_date) : null;
      const isLate = submissionDate && dueDate && submissionDate > dueDate;
      const daysLate = isLate ? Math.ceil((submissionDate - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      
      // Generate download URLs
      const fileDownloadUrls = (sub.file_urls || []).map(url => {
        if (url && url.startsWith('http')) return url;
        if (!url) return '';
        const projectRef = supabase.supabaseUrl.split('//')[1].split('.')[0];
        return `https://${projectRef}.supabase.co/storage/v1/object/public/assignments/${url}`;
      }).filter(url => url && url !== '');
      
      return {
        submission_id: sub.id,
        student_id: sub.student_id,
        student_name: student?.full_name || 'Unknown Student',
        student_email: student?.email || 'No email',
        student_program: student?.program || 'N/A',
        student_department: student?.department_code || 'N/A',
        submission_date: sub.submission_date,
        submitted_text: sub.submitted_text,
        file_urls: sub.file_urls || [],
        file_download_urls: fileDownloadUrls,
        status: sub.status || 'submitted',
        marks_obtained: sub.marks_obtained,
        feedback: sub.feedback,
        graded_at: sub.graded_at,
        late_submission: isLate,
        days_late: daysLate,
        assignment_title: assignmentData?.title || selectedAssignment?.title,
        assignment_due_date: assignmentData?.due_date,
        assignment_total_marks: assignmentData?.total_marks || selectedAssignment?.total_marks || 100
      };
    });
    
    console.log('✅ Final processed submissions:', processedSubmissions);
    setAssignmentSubmissions(processedSubmissions);
    
  } catch (error) {
    console.error('❌ Error in fetchAssignmentSubmissions:', error);
    alert('Error loading submissions: ' + error.message);
    setAssignmentSubmissions([]);
  } finally {
    // Clear loading state
    setLoading(prev => ({ ...prev, submissions: false }));
  }
  };
  
  const validateCohort = () => {
  if (!selectedCohort.academic_year.trim()) {
    setCohortError('Please enter Academic Year (e.g. 2025/2029)');
    return false;
  }
  if (!selectedCohort.year_of_study) {
    setCohortError('Please select Year of Study');
    return false;
  }
  if (!selectedCohort.semester) {
    setCohortError('Please select Semester');
    return false;
  }
  setCohortError('');
  return true;
};

// Helper function to process submissions when student data is unavailable
const processSubmissionsWithoutStudents = (submissions, assignmentId) => {
  // This function creates a basic submission object without student details
  return submissions.map(sub => {
    const submissionDate = sub.submission_date ? new Date(sub.submission_date) : null;
    
    // Generate download URLs
    const fileDownloadUrls = (sub.file_urls || []).map(url => {
      if (url && url.startsWith('http')) return url;
      
      if (!url) return '';
      
      const projectRef = supabase.supabaseUrl.split('//')[1].split('.')[0];
      return `https://${projectRef}.supabase.co/storage/v1/object/public/assignments/${url}`;
    }).filter(url => url && url !== '');
    
    return {
      submission_id: sub.id,
      student_id: sub.student_id || 'Unknown ID',
      student_name: 'Unknown Student',
      student_email: 'No email',
      student_program: 'N/A',
      student_department: 'N/A',
      submission_date: sub.submission_date,
      submitted_text: sub.submitted_text,
      file_urls: sub.file_urls || [],
      file_download_urls: fileDownloadUrls,
      status: sub.status || 'submitted',
      marks_obtained: sub.marks_obtained,
      feedback: sub.feedback,
      graded_at: sub.graded_at,
      late_submission: false,
      days_late: 0,
      assignment_title: selectedAssignment?.title,
      assignment_total_marks: selectedAssignment?.total_marks || 100
    };
  });
};
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

const uploadAssignmentFiles = async (files) => {
  if (!files || files.length === 0) return [];

  const uploadedPaths = [];
  setUploadingFiles(true);
  setUploadProgress(0);

  try {
    console.log('📤 Starting easy upload to lecturerbucket...', files.length, 'files');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const originalName = file.name;

      // Create a clean, unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeName = originalName.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${timestamp}_${randomStr}_${safeName}`;
      const filePath = fileName; // Store just the filename (no folders needed)

      // Update progress
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));

      console.log(`📤 Uploading ${i + 1}/${files.length}: ${originalName} → ${filePath}`);

      // Simple, clean upload using authenticated Supabase client
      const { data, error } = await supabase.storage
        .from('lecturerbucket')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false, // Set to true if you want to allow overwriting same name
          contentType: file.type || 'application/octet-stream'
        });

      if (error) {
        console.error(`❌ Failed to upload ${originalName}:`, error.message);
        alert(`Failed to upload "${originalName}": ${error.message}`);
        continue; // Skip this file, continue with others
      }

      console.log(`✅ Uploaded: ${originalName} → ${filePath}`);
      uploadedPaths.push(filePath);
    }

    console.log('🎉 All files uploaded successfully!', uploadedPaths);
    alert(`✅ Successfully uploaded ${uploadedPaths.length} file(s)!`);

    return uploadedPaths;

  } catch (error) {
    console.error('❌ Unexpected upload error:', error);
    alert('Upload failed: ' + error.message);
    return [];
  } finally {
    setUploadingFiles(false);
    setUploadProgress(0);
  }
  };
  


  // Upload tutorial files to 'tutorials' bucket
const uploadTutorialFiles = async (files) => {
  if (!files || files.length === 0) return [];
  const uploadedPaths = [];
  setUploadingTutorial(true);
  setTutorialUploadProgress(0);

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const originalName = file.name;
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeName = originalName.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${timestamp}_${randomStr}_${safeName}`;
      const filePath = `${
        selectedCohort.academic_year || 'general'
      }/Year${selectedCohort.year_of_study || ''}_Sem${selectedCohort.semester || ''}/${fileName}`;

      setTutorialUploadProgress(Math.round(((i + 1) / files.length) * 100));

      const { data, error } = await supabase.storage
        .from('Tutorials')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error(`Failed to upload ${originalName}:`, error);
        alert(`Failed to upload "${originalName}"`);
        continue;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('Tutorials')
        .getPublicUrl(filePath);

      uploadedPaths.push({
        path: filePath,
        url: publicUrlData.publicUrl,
        name: originalName,
      });
    }

    alert(`✅ Successfully uploaded ${uploadedPaths.length} tutorial file(s)!`);
    return uploadedPaths;
  } catch (error) {
    console.error('Tutorial upload error:', error);
    alert('Upload failed: ' + error.message);
    return [];
  } finally {
    setUploadingTutorial(false);
    setTutorialUploadProgress(0);
  }
};

const handleCreateAssignment = async () => {
  try {
    setLoading(prev => ({ ...prev, creatingAssignment: true }));

    console.log('🔍 Creating new assignment...');

    // Upload files first (to lecturerbucket)
    let fileUrls = [];
    if (assignmentFiles.length > 0) {
      console.log('📤 Uploading files to lecturerbucket...');
      fileUrls = await uploadAssignmentFiles(assignmentFiles);

      if (fileUrls.length !== assignmentFiles.length) {
        alert('⚠️ Some files failed to upload. Continuing with successful ones.');
      }

      console.log('✅ Files uploaded:', fileUrls);
    }

    // Basic validation
    if (!newAssignment.course_id) {
      alert('Please select a course');
      return;
    }

    if (!newAssignment.title.trim()) {
      alert('Please enter an assignment title');
      return;
    }

    // Use current logged-in user's ID as lecturer_id
    const lecturerId = profile?.id;
    if (!lecturerId) {
      alert('Error: User not authenticated. Please log in again.');
      return;
    }

    // Prepare assignment data
    const assignmentData = {
      course_id: newAssignment.course_id,
      lecturer_id: lecturerId,
      title: newAssignment.title.trim(),
      description: newAssignment.description?.trim() || '',
      instructions: newAssignment.instructions?.trim() || '',
      due_date: newAssignment.due_date,
      total_marks: Number(newAssignment.total_marks) || 100,
      submission_type: newAssignment.submission_type || 'file',
      max_file_size: Number(newAssignment.max_file_size) || 10,
      allowed_formats: newAssignment.allowed_formats || ['pdf', 'doc', 'docx', 'zip'],
      file_urls: fileUrls, // Array of file paths in lecturerbucket
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📝 Inserting assignment into database:', assignmentData);

    // Insert into assignments table
    const { data, error } = await supabase
      .from('assignments')
      .insert([assignmentData])
      .select();

    if (error) {
      console.error('❌ Failed to create assignment:', error);
      alert(`Failed to create assignment: ${error.message}`);
      return;
    }

    console.log('✅ Assignment created successfully:', data);

    // Success! Reset everything
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
    await fetchMyAssignments();
    await fetchDashboardStats();

    alert('✅ Assignment created successfully with attached files!');

  } catch (error) {
    console.error('❌ Unexpected error in handleCreateAssignment:', error);
    alert('An unexpected error occurred. Please try again.');
  } finally {
    setLoading(prev => ({ ...prev, creatingAssignment: false }));
  }
};
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

  const downloadSubmissionsCSV = () => {
    if (assignmentSubmissions.length === 0) {
      alert('No submissions to download');
      return;
    }
   
    const headers = ['Student Name', 'Student Email', 'Program', 'Submission Date', 'Status', 'Marks', 'Feedback', 'Late Submission', 'Files'];
   
    const csvData = assignmentSubmissions.map(sub => [
      sub.student_name,
      sub.student_email,
      sub.student_program || 'N/A',
      sub.submission_date ? new Date(sub.submission_date).toLocaleString() : 'Not Submitted',
      sub.status,
      sub.marks_obtained || 'Not Graded',
      sub.feedback || 'No feedback',
      sub.late_submission ? 'Yes' : 'No',
      sub.file_urls ? sub.file_urls.join('; ') : 'No files'
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
        console.log(` Lecture ${idx + 1}:`, {
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


    const fetchProgramTimetables = async () => {
    try {
      const { data, error } = await supabase
        .from('program_timetables')
        .select(`
          id,
          program_id,
          academic_year,
          semester,
          year_of_study,
          is_active,
          programs (name, code),
          program_timetable_slots (
            id,
            course_code,
            course_name,
            lecturer_id,
            day_of_week,
            start_time,
            end_time,
            room_number,
            building,
            slot_type,
            lecturers (full_name)
          )
        `)
        .order('academic_year', { ascending: false })
        .order('year_of_study');

      if (error) throw error;
      setTimetables(data || []);
    } catch (err) {
      console.error('Error loading timetables:', err);
      alert('Failed to load timetables');
    }
  };

    const refreshCurrentTimetableSlots = async () => {
    if (!selectedTimetable) return;

    try {
      const { data, error } = await supabase
        .from('program_timetable_slots')
        .select(`
          id,
          course_code,
          course_name,
          lecturer_id,
          day_of_week,
          start_time,
          end_time,
          room_number,
          building,
          slot_type,
          lecturers (full_name)
        `)
        .eq('program_timetable_id', selectedTimetable.id)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      // Update only the slots in the selected timetable
      setTimetables(prev => prev.map(tt => 
        tt.id === selectedTimetable.id 
          ? { ...tt, program_timetable_slots: data || [] }
          : tt
      ));

      // Also update selectedTimetable directly for instant refresh
      setSelectedTimetable(prev => ({ ...prev, program_timetable_slots: data || [] }));

    } catch (err) {
      console.error('Error refreshing slots:', err);
      alert('Failed to refresh slots');
    }
  };

  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [lecturersList, setLecturersList] = useState([]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, code')
        .order('name');
      if (error) throw error;
      setPrograms(data || []);
    } catch (err) {
      console.error('Error loading programs:', err);
    }
  };

  const fetchLecturersList = async () => {
    try {
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      setLecturersList(data || []);
    } catch (err) {
      console.error('Error loading lecturers:', err);
    }
  };

const handleSaveTimetable = async () => {
  if (!newTimetable.program_id) {
    alert('Please select a program');
    return;
  }

  try {
    if (selectedTimetable) {
      // Editing existing — safe to update
      const { error } = await supabase
        .from('program_timetables')
        .update({
          academic_year: newTimetable.academic_year,
          semester: newTimetable.semester,
          year_of_study: newTimetable.year_of_study,
          is_active: newTimetable.is_active
        })
        .eq('id', selectedTimetable.id);

      if (error) throw error;
      alert('Timetable updated successfully!');
    } else {
      // Creating new — FIRST check if one already exists
      const { data: existing, error: checkError } = await supabase
        .from('program_timetables')
        .select('id')
        .eq('program_id', newTimetable.program_id)
        .eq('academic_year', newTimetable.academic_year)
        .eq('semester', newTimetable.semester)
        .eq('year_of_study', newTimetable.year_of_study)
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        // Duplicate found!
        const confirmOverwrite = window.confirm(
          `A timetable already exists for this program, year, semester, and academic year.\n\n` +
          `Do you want to activate the existing one instead? (Recommended)\n\n` +
          `Click Cancel to choose different values.`
        );

        if (confirmOverwrite) {
          // Activate the existing one
          const { error: activateError } = await supabase
            .from('program_timetables')
            .update({ is_active: true })
            .eq('id', existing[0].id);

          if (activateError) throw activateError;

          alert('Existing timetable reactivated!');
        } else {
          // User cancelled — don't create
          return;
        }
      } else {
        // No duplicate — safe to insert
        const { error } = await supabase
          .from('program_timetables')
          .insert([{
            program_id: newTimetable.program_id,
            academic_year: newTimetable.academic_year,
            semester: newTimetable.semester,
            year_of_study: newTimetable.year_of_study,
            is_active: true
          }]);

        if (error) throw error;
        alert('New timetable created successfully!');
      }
    }

    setShowTimetableModal(false);
    setSelectedTimetable(null);
    await fetchProgramTimetables();  // Refresh list

  } catch (err) {
    console.error('Error saving timetable:', err);
    alert('Error saving timetable: ' + err.message);
  }
};
    const handleDeleteSlot = async (slotId) => {
    // Safety check
    if (!slotId) {
      alert('Error: No slot selected for deletion');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this time slot?\nThis cannot be undone.')) {
      return;
    }

    try {
      console.log('Deleting slot with ID:', slotId); // Debug line

      const { error } = await supabase
        .from('program_timetable_slots')
        .delete()
        .eq('id', slotId);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      alert('Time slot deleted successfully!');

      // Refresh only current timetable — stays in view
      await refreshCurrentTimetableSlots();

    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete slot: ' + err.message);
    }
  };

    const handleSaveSlot = async () => {
    if (!newSlot.course_code.trim() || !newSlot.course_name.trim()) {
      alert('Please enter both Course Code and Course Name');
      return;
      }

    try {
      if (editingSlot) {
        // Edit existing slot
        const { error } = await supabase
          .from('program_timetable_slots')
          .update({
            course_code: newSlot.course_code.trim(),
            course_name: newSlot.course_name.trim(),
            lecturer_id: newSlot.lecturer_id || null,
            day_of_week: parseInt(newSlot.day_of_week),
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
            room_number: newSlot.room_number.trim(),
            building: newSlot.building.trim(),
            slot_type: newSlot.slot_type
          })
          .eq('id', editingSlot.id);

        if (error) throw error;
        alert('Slot updated successfully!');
      } else {
        // Add new slot
        const { error } = await supabase
          .from('program_timetable_slots')
          .insert([{
            program_timetable_id: selectedTimetable.id,
            course_code: newSlot.course_code.trim(),
            course_name: newSlot.course_name.trim(),
            lecturer_id: newSlot.lecturer_id || null,
            day_of_week: parseInt(newSlot.day_of_week),
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
            room_number: newSlot.room_number.trim(),
            building: newSlot.building.trim(),
            slot_type: newSlot.slot_type,
            is_active: true
          }]);

        if (error) throw error;
        alert('New slot added successfully!');
      }

      // Close modal and reset form
      setShowSlotModal(false);
      setEditingSlot(null);
      setNewSlot({
        course_code: '',
        course_name: '',
        lecturer_id: '',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
        room_number: '',
        building: 'CS Building',
        slot_type: 'lecture'
      });

      // Refresh only current view — user stays in detailed view!
      await refreshCurrentTimetableSlots();

    } catch (err) {
      console.error('Error saving slot:', err);
      alert('Failed to save slot: ' + err.message);
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
   // === AUTO-ENROLL NEW STUDENT IN CURRENT SEMESTER COURSES ===

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    const password = 'Default123!';
    let tableName, profileData;

    const CURRENT_ACADEMIC_YEAR = '2025';

    if (newUser.role === 'student') {
      if (!newUser.program?.trim()) {
        alert('Please enter the Program name.');
        return;
      }

      if (!newUser.department_code?.trim()) {
        alert('Please enter the Department Code (e.g., ENG, BSCS, BIT)');
        return;
      }

      const programName = newUser.program.trim();
      const departmentCode = newUser.department_code.trim().toUpperCase();
      const academicYear = CURRENT_ACADEMIC_YEAR;

// Generate the next sequence number for this department and year
const { data: existingStudents, error: fetchError } = await supabase
  .from('students')
  .select('student_id')
  .like('student_id', `${departmentCode}-${academicYear}-%`)
  .order('student_id', { ascending: false })
  .limit(1);

if (fetchError) {
  throw new Error('Failed to check existing student IDs');
}

let sequenceNumber = 1; // Start from 1 if no existing

if (existingStudents && existingStudents.length > 0) {
  const latestId = existingStudents[0].student_id;
  const idParts = latestId.split('-');
  if (idParts.length === 3) {
    const lastSequence = parseInt(idParts[2], 10); // Base 10, not hex!
    if (!isNaN(lastSequence)) {
      sequenceNumber = lastSequence + 1;
    }
  }
}

// Use real sequential decimal number, padded to 6 digits
const sequencePadded = sequenceNumber.toString().padStart(6, '0');

// Final Student ID: e.g., SCT-2025-000042
const studentId = `${departmentCode}-${academicYear}-${sequencePadded}`;
      tableName = 'students';
profileData = {
  student_id: studentId,
  full_name: newUser.full_name.trim(),
  email: newUser.email.toLowerCase().trim(),
  password_hash: password,
  phone: newUser.phone?.trim() || null,
  date_of_birth: newUser.date_of_birth || null,
  program: newUser.program,
  year_of_study: parseInt(newUser.year_of_study),
  semester: parseInt(newUser.semester),
  intake: newUser.intake,
  academic_year: newUser.academic_year.trim(),
  status: 'active',
  program_id: newUser.program_id,
  program_code: newUser.program_code.trim().toUpperCase(),
department: newUser.department.trim(),
department_code: newUser.department_code.trim().toUpperCase(),
  program_duration_years: parseInt(newUser.program_duration_years),
  program_total_semesters: parseInt(newUser.program_duration_years) * 2,  // Auto-calculated
  created_at: new Date().toISOString(),
  
};

      // === Duplicate checks ===
      const { data: existingProfile, error: checkError } = await supabase
        .from(tableName)
        .select('id, email, student_id')
        .or(`email.eq.${profileData.email},student_id.eq.${studentId}`)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw new Error('Error checking for existing records');
      }

      if (existingProfile) {
        if (existingProfile.email === profileData.email) {
          throw new Error('This email already exists as a student');
        }
        if (existingProfile.student_id === studentId) {
          throw new Error('This Student ID already exists');
        }
      }

    } else {
      // ========== LECTURER LOGIC ==========
      // Generate the next lecturer sequence number
      const { data: existingLecturers, error: fetchLecturersError } = await supabase
        .from('lecturers')
        .select('lecturer_id')
        .like('lecturer_id', 'LEC-%')
        .order('lecturer_id', { ascending: false })
        .limit(1);

      if (fetchLecturersError) {
        throw new Error('Failed to check existing lecturer IDs');
      }

      let lecturerSequence = 1;
      
      if (existingLecturers && existingLecturers.length > 0) {
        const latestId = existingLecturers[0].lecturer_id;
        const idParts = latestId.split('-');
        if (idParts.length === 2) {
          const existingSequence = idParts[1];
          lecturerSequence = parseInt(existingSequence, 16) + 1;
        }
      }

      const lecturerSequenceHex = lecturerSequence.toString(16).padStart(6, '0').toUpperCase();
      const lecturerId = `LEC-${lecturerSequenceHex}`;

      tableName = 'lecturers';
      profileData = {
        lecturer_id: lecturerId,
        full_name: newUser.full_name.trim(),
        email: newUser.email.toLowerCase().trim(),
        password_hash: password,
        phone: newUser.phone?.trim() || null,
        department: newUser.department?.trim() || null,
        specialization: newUser.specialization?.trim() || null,
        google_meet_link: newUser.google_meet_link?.trim() || null,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      // === Duplicate checks for lecturers ===
      const { data: existingLecturer, error: checkLecturerError } = await supabase
        .from(tableName)
        .select('id, email, lecturer_id')
        .or(`email.eq.${profileData.email},lecturer_id.eq.${lecturerId}`)
        .maybeSingle();

      if (checkLecturerError && checkLecturerError.code !== 'PGRST116') {
        throw new Error('Error checking for existing lecturer records');
      }

      if (existingLecturer) {
        if (existingLecturer.email === profileData.email) {
          throw new Error('This email already exists as a lecturer');
        }
        if (existingLecturer.lecturer_id === lecturerId) {
          throw new Error('This Lecturer ID already exists');
        }
      }
    }

    // Cross-check email in the other table (student vs lecturer)
    const otherTableName = newUser.role === 'student' ? 'lecturers' : 'students';
    const { data: crossCheck } = await supabase
      .from(otherTableName)
      .select('email')
      .eq('email', profileData.email)
      .maybeSingle();

    if (crossCheck) {
      throw new Error(`This email already exists as a ${newUser.role === 'student' ? 'lecturer' : 'student'}`);
    }

    // === Insert ===
    const { data: tableData, error: tableError } = await supabase
      .from(tableName)
      .insert([profileData])
      .select()
      .single();

    if (tableError) {
      if (tableError.code === '23505') {
        throw new Error('Email or ID already exists!');
      }
      throw new Error(tableError.message);
    }

    // === AUTO-ENROLL NEW STUDENT AFTER SUCCESSFUL INSERT ===
    if (newUser.role === 'student' && tableData?.id) {
      const studentId = tableData.id; // UUID from students table

      try {
        const { data: startingCourses, error: courseError } = await supabase
          .from('courses')
          .select('id')
          .eq('department_code', newUser.department_code.trim().toUpperCase())
          .eq('year', newUser.year_of_study || 1)
          .eq('semester', newUser.semester || 1)
          .eq('is_active', true);

        if (courseError) {
          console.warn('Auto-enroll: Failed to fetch courses', courseError);
        } else if (startingCourses && startingCourses.length > 0) {
          const enrollments = startingCourses.map(course => ({
            student_id: studentId,
            course_id: course.id,
            status: 'enrolled',
            enrollment_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: enrollError } = await supabase
            .from('student_courses')
            .insert(enrollments);

          if (enrollError) {
            console.warn('Auto-enroll failed', enrollError);
            alert('Student created successfully, but auto-enrollment failed. Please enroll courses manually if needed.');
          } else {
            console.log(`✅ Auto-enrolled in ${enrollments.length} courses`);
          }
        }
      } catch (err) {
        console.warn('Auto-enroll error:', err);
      }
    }
    // === END AUTO-ENROLL ===

    // Optional user_roles insert (keep as is)
    try {
      await supabase.from('user_roles').insert([{
        email: profileData.email,
        role: newUser.role,
        profile_id: tableData.id,
        profile_table: tableName,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.log('Note: Could not add to user_roles:', e.message);
    }

    // Reset form & success message (keep your existing code)
    setShowUserModal(false);
    // ... rest of success handling
    setNewUser({
      full_name: '', email: '', phone: '', role: 'student',
      program: '', department_code: '', department: '',
      year_of_study: 1, semester: 1, intake: 'January',
      specialization: '', google_meet_link: ''
    });

    // Success message
    const successMessage = newUser.role === 'student' ? `
✅ Student Successfully Added!

Student ID: ${profileData.student_id}

Format: ${newUser.department_code.trim().toUpperCase()}-${CURRENT_ACADEMIC_YEAR}-[SEQUENCE]

Full Name: ${profileData.full_name}
Email: ${profileData.email}
Program: ${profileData.program}
Academic Year: ${profileData.academic_year}

Share this Student ID with the student!
    ` : `
✅ Lecturer Successfully Added!

Lecturer ID: ${profileData.lecturer_id}
Full Name: ${profileData.full_name}
Email: ${profileData.email}
Department: ${profileData.department || 'Not specified'}
    `;

    alert(successMessage);

    // Refresh data
    if (newUser.role === 'student') await fetchStudents();
    else await fetchLecturers();
    await fetchDashboardStats();

  } catch (error) {
    alert(`Error: ${error.message || 'Something went wrong'}`);
    console.error('Add user error:', error);
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

    if (durationMinutes <= 0) {
      alert('End time must be after start time');
      return;
    }

    // Get course department code
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('department_code, course_code, course_name')
      .eq('id', newLecture.course_id)
      .single();

    if (courseError) {
      console.error('DEBUG: Error fetching course:', courseError);
      alert('Failed to fetch course details: ' + courseError.message);
      return;
    }

    console.log('DEBUG: Course data:', courseData);

 const lectureData = {
  lecturer_id: profile.id,
  course_id: newLecture.course_id,
  title: newLecture.title.trim(),
  description: newLecture.description?.trim() || '',
  google_meet_link: newLecture.google_meet_link?.trim() || null,
  scheduled_date: newLecture.scheduled_date,
  start_time: newLecture.start_time,
  end_time: newLecture.end_time,
  duration_minutes: durationMinutes,
  lecturer_department_code: courseData?.department_code || null,
  status: 'scheduled',
  materials_url: newLecture.materials_url || [],
  // === NEW: Save the selected cohort ===
  target_academic_year: selectedCohort.academic_year.trim(),
  target_year_of_study: selectedCohort.year_of_study,
  target_semester: selectedCohort.semester,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
    // DEBUG: Log the exact payload being sent
    console.log('DEBUG: Lecture insert payload:', lectureData);

    // Optional: Force schema cache refresh (helps avoid "column not found in schema cache" errors)
    try {
      await supabase.from('lectures').select('lecturer_department_code').limit(0).single();
    } catch (_) {}

    // Insert the lecture
    const { data, error } = await supabase
      .from('lectures')
      .insert([lectureData])
      .select();
    

    if (error) {
      console.error('DEBUG: Supabase insert error:', error);
      alert('Error adding lecture: ' + error.message);
      return;
    }

    console.log('DEBUG: Lecture added successfully:', data);

    // Reset form
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

    // Refresh data
    await fetchLectures();
    await fetchDashboardStats();

    alert('Lecture scheduled successfully!');

  } catch (error) {
    console.error('DEBUG: Unexpected error adding lecture:', error);
    alert('Error adding lecture: ' + (error.message || 'Unknown error'));
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
  // Get the assignment ID
  const assignmentId = assignment.id || assignment.assignment_id;
  
  if (!assignmentId) {
    console.error('ERROR: No assignment ID found:', assignment);
    alert('Cannot view submissions: Assignment ID not found');
    return;
  }
  
  console.log('DEBUG: Navigating to Grading tab for assignment:', {
    id: assignmentId,
    title: assignment.title,
    total_marks: assignment.total_marks
  });
  
  // Set the selected assignment with all needed data
  setSelectedAssignment({
    id: assignmentId,
    title: assignment.title || 'Untitled Assignment',
    total_marks: assignment.total_marks || 100,
    course_code: assignment.course_code,
    course_name: assignment.course_name,
    due_date: assignment.due_date
  });
  
  // Navigate to Grading tab
  setActiveTab('grading');
  
  // Clear any existing submissions
  setAssignmentSubmissions([]);
  
  // Fetch submissions for this assignment
  await fetchAssignmentSubmissions(assignmentId);
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
              className={`nav-item ${activeTab === 'timetables' ? 'active' : ''}`}
              onClick={() => setActiveTab('timetables')}
            >
              ⏰ Timetables
            </button>
            <button
              className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              📅 Attendance
            </button>
            {isAdmin && (
  <button
    className={`nav-item ${activeTab === 'complete-courses' ? 'active' : ''}`}
    onClick={() => setActiveTab('complete-courses')}
  >
    ✅ Complete Courses
  </button>
)}
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
                      
                    <button
  className="action-button"
  onClick={() => {
    setShowTutorialsModal(true);
    setTutorialTitle('');
    setTutorialDescription('');
    setTutorialFiles([]);
  }}
>
  <span className="action-icon">📚</span>
  <span>Upload Tutorials</span>
  <small>PDFs, Docs, Videos for students</small>
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
  <div className="action-buttons flat">
    {/* FIXED: View Submissions - passes full assignment object */}
    <button
      className="action-btn view"
      onClick={() => handleViewSubmissions({
        id: assignment.assignment_id,
        title: assignment.title,
        total_marks: assignment.total_marks,
        course_code: assignment.course_code,
        course_name: assignment.course_name,
        due_date: assignment.due_date
      })}
    >
      View Submissions
    </button>
     <button
      className="action-btn small publish"
      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'published')}
      disabled={assignment.status === 'published'}
    >
      Publish
    </button>

    <button
      className="action-btn small draft"
      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'draft')}
      disabled={assignment.status === 'draft'}
    >
      Draft
    </button>

    <button
      className="action-btn small close"
      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'closed')}
      disabled={assignment.status === 'closed'}
    >
      Close
    </button>

    <button
      className="action-btn small delete"
      onClick={async () => {
        if (!window.confirm('⚠️ Permanently delete this assignment?\n\nAll submissions will be lost. This cannot be undone.')) {
          return;
        }
        try {
          const { error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', assignment.assignment_id)
            .eq('lecturer_id', profile.id);

          if (error) throw error;

          alert('Assignment deleted successfully!');
          await fetchMyAssignments();
        } catch (err) {
          alert('Failed to delete: ' + err.message);
        }
      }}
    >
      Delete
    </button>
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
    {/* DEBUG INFO - You can keep or remove this based on your needs */}
    <div className="debug-info" style={{
      background: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '20px',
      fontSize: '13px'
    }}>
      <h4 style={{ marginTop: 0, color: '#856404' }}>🔍 Debug Information</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div>
          <strong>Lecturer ID:</strong> {profile?.id}
        </div>
        <div>
          <strong>Total Assignments:</strong> {myAssignments.length}
        </div>
        <div>
          <strong>Assignments with submissions:</strong> {myAssignments.filter(a => (a.submitted_count || 0) > 0).length}
        </div>
        <div>
          <strong>Dashboard pending:</strong> {stats.pendingGrading}
        </div>
        <div>
          <strong>Selected Assignment:</strong> {selectedAssignment?.id ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Current Submissions:</strong> {assignmentSubmissions.length}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={debugStudentRelationship}
          style={{
            background: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🔍 Debug Student Relationship
        </button>
        
        <button
          onClick={testBucketAccess}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🪣 Test Bucket Access
        </button>
        
        <button
          onClick={testSpecificFile}
          style={{
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          📄 Test Specific File
        </button>
        
        <button
          onClick={testStudentDataRetrieval}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          👤 Test Student Data
        </button>
        
        <button
          onClick={() => {
            console.log('DEBUG: myAssignments:', myAssignments);
            console.log('DEBUG: Profile:', profile);
            fetchMyAssignments();
          }}
          style={{
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🔄 Refresh Assignments
        </button>
        
        <button
          onClick={async () => {
            console.log('Testing bucket connection...');
            
            // Test 1: List files in assignments bucket
            const { data: files, error: listError } = await supabase.storage
              .from('assignments')
              .list();
            
            console.log('Bucket files:', files);
            console.log('List error:', listError);
            
            // Test 2: Check if we can access any file
            if (files && files.length > 0) {
              const testFile = files[0].name;
              const { data: urlData } = supabase.storage
                .from('assignments')
                .getPublicUrl(testFile);
              
              console.log('Public URL for', testFile, ':', urlData.publicUrl);
            }
            
            alert('Check console for bucket connection test results');
          }}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🪣 Test Bucket Connection
        </button>
        
        <button
          onClick={async () => {
            if (!selectedAssignment) {
              alert('Please select an assignment first');
              return;
            }
            
            console.log('DEBUG: Testing assignment submissions for:', selectedAssignment.id);
            
            // Direct query test
            const { data, error } = await supabase
              .from('assignment_submissions')
              .select('id, student_id, status, submission_date')
              .eq('assignment_id', selectedAssignment.id);
            
            console.log('Direct query result:', { data, error });
            
            // Also test the RPC function
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_assignment_submissions_detail', {
              p_assignment_id: selectedAssignment.id
            });
            
            console.log('RPC function result:', { rpcData, rpcError });
            
            alert(`Found ${data?.length || 0} submissions via direct query\nRPC function ${rpcError ? 'failed' : 'found ' + (rpcData?.length || 0) + ' submissions'}`);
          }}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🔍 Test Assignment Submissions
        </button>
      </div>
    </div>
    
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
      <div className="assignment-header blue-theme">
  <h3>{selectedAssignment.title}</h3>
  <div className="assignment-meta">
    <div className="counter-badge">
      <div className="badge-icon">📊</div>
      <div className="badge-content">
        <span className="badge-value">{selectedAssignment.total_marks}</span>
        <span className="badge-label">Total Marks</span>
      </div>
    </div>
    
    <div className="counter-badge">
      <div className="badge-icon">📝</div>
      <div className="badge-content">
        <span className="badge-value">{assignmentSubmissions.length}</span>
        <span className="badge-label">Submissions</span>
      </div>
    </div>
    
    <button
      className="back-button"
      onClick={() => {
        setSelectedAssignment(null);
        setAssignmentSubmissions([]);
      }}
    >
      Back to List
    </button>
  </div>
</div>
       
        {/* Loading State for Submissions */}
        {loading.submissions ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <h4>Loading Submissions...</h4>
            <p>
              Fetching submission data for this assignment
            </p>
          </div>
        ) : (
          <>
            {/* Batch Download Progress */}
            {batchDownloading && (
              <div className="download-progress">
                <div className="progress-info">
                  <span>Downloading files...</span>
                  <span>{batchProgress.current} of {batchProgress.total}</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${(batchProgress.current / batchProgress.total) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            )}

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
                            <strong>{submission.student_name || 'Unknown Student'}</strong>
                            <br />
                            <span className="small-text">{submission.student_email || 'No email'}</span>
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
                                  {submission.late_submission && ` (Late: ${submission.days_late || 0} days)`}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted">Not submitted</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${submission.status || 'not_submitted'}`}>
                              {submission.status || 'Not Submitted'}
                            </span>
                          </td>
                          <td>
                            {submission.file_download_urls && submission.file_download_urls.length > 0 ? (
                              <div className="file-links">
                                {submission.file_download_urls.map((url, idx) => {
                                  const originalUrl = submission.file_urls?.[idx] || url;
                                  const fileName = getFileNameFromUrl(originalUrl);
                                  const fileExt = getFileExtension(originalUrl);
                                  const displayName = `File ${idx + 1}.${fileExt}`;
                                  const downloadKey = `${submission.submission_id}_file${idx + 1}`;
                                  
                                  return (
                                    <div key={idx} className="file-download-item">
                                      <a
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          downloadFile(url, `${submission.student_name || 'Student'}_${displayName}`, submission.submission_id);
                                        }}
                                        className="file-link"
                                      >
                                        📥 {displayName}
                                      </a>
                                      {downloadingFile === downloadKey && (
                                        <span className="downloading-text">Downloading...</span>
                                      )}
                                    </div>
                                  );
                                })}
                                <button
                                  className="download-all-btn"
                                  onClick={() => downloadAllFilesForSubmission(submission)}
                                  disabled={batchDownloading}
                                >
                                  📦 Download All Files
                                </button>
                              </div>
                            ) : submission.submitted_text ? (
                              <div className="text-submission">
                                <span className="text-preview">
                                  {submission.submitted_text.substring(0, 50)}...
                                </span>
                                <button
                                  className="view-text-btn"
                                  onClick={() => {
                                    alert(`Text Submission from ${submission.student_name}:\n\n${submission.submitted_text}`);
                                  }}
                                >
                                  View Full Text
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted">No submission</span>
                            )}
                          </td>
                          <td>
                            {submission.status === 'graded' ? (
                              <span className="grade-display">
                                {submission.marks_obtained || 0}/{selectedAssignment.total_marks}
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
                                    alert(`Marks: ${submission.marks_obtained || 0}/${selectedAssignment.total_marks}\n\nFeedback: ${submission.feedback || 'No feedback'}`);
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
                  <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>
                    📭
                  </div>
                  <h4>No Submissions Found</h4>
                  <p className="small-text" style={{ maxWidth: '500px', margin: '0 auto' }}>
                    No students have submitted this assignment yet.
                    Students will appear here once they submit their work.
                  </p>
                  <button
                    className="refresh-button"
                    onClick={() => selectedAssignment && fetchAssignmentSubmissions(selectedAssignment.id)}
                    style={{ marginTop: '20px' }}
                  >
                    🔄 Refresh Submissions
                  </button>
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
                <button
                  className="export-button"
                  onClick={downloadAllSubmissions}
                  disabled={batchDownloading}
                >
                  📦 Download All Files
                </button>
              </div>
            )}
          </>
        )}
      </div>
    ) : (
      <div className="select-assignment">
        <h3>Select an Assignment to Grade</h3>
        <div className="assignments-grid">
          {myAssignments.length > 0 ? (
            myAssignments.map(assignment => {
              const submittedCount = assignment.submitted_count || 0;
              const gradedCount = assignment.graded_count || 0;
              const pendingCount = submittedCount - gradedCount;
              
              return (
                <div key={assignment.assignment_id} className="assignment-card">
                  <div className="assignment-header">
                    <h4>{assignment.title}</h4>
                    <span className={`assignment-status ${assignment.status}`}>
                      {assignment.status || 'published'}
                    </span>
                  </div>
                  <p className="course-info">
                    {assignment.course_code || 'No Code'} - {assignment.course_name || 'No Name'}
                  </p>
                  <div className="assignment-details">
                    <span>📅 Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                    <span>📊 Total Marks: {assignment.total_marks || 100}</span>
                    <span>🏛️ {assignment.department_code || 'N/A'}</span>
                  </div>
                  <div className="submission-stats-card">
                    <div className="stat">
                      <span className="stat-label">Submitted:</span>
                      <span className="stat-value">{submittedCount}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Graded:</span>
                      <span className="stat-value">{gradedCount}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Pending:</span>
                      <span className={`stat-value ${pendingCount > 0 ? 'warning' : ''}`}>
                        {pendingCount}
                      </span>
                    </div>
                  </div>
                  <div className="assignment-actions">
                   <button
  className="action-btn view"
  onClick={() => handleViewSubmissions({
    id: assignment.assignment_id,
    title: assignment.title,
    total_marks: assignment.total_marks,
    course_code: assignment.course_code,
    course_name: assignment.course_name
  })}
>
  View Submissions
</button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>
                📝
              </div>
              <h4>No Assignments Found</h4>
              <p className="small-text" style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
                Create assignments first, then students can submit them for grading.
              </p>
              <button
                onClick={() => setShowAssignmentUploadModal(true)}
                className="add-button"
              >
                + Create Assignment
              </button>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
)}
            {/* Students Tab */}
                       {/* Students Tab - IMPROVED WITH EDIT */}
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
              setNewUser({ ...newUser, role: 'student' });
              setShowUserModal(true);
            }}
          >
            + Add Student
          </button>
        )}
      </div>
    </div>

    <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Program</th> {/* This will expand to full name */}
            <th>Department</th>
            <th>Year</th>
            <th>Status</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                No students found
              </td>
            </tr>
          ) : (
            students.map(student => (
              <tr key={student.id}>
                <td><strong>{student.student_id}</strong></td>
                <td>{student.full_name}</td>
                <td>{student.email}</td>

                {/* Full Program Name - No Ellipsis */}
                <td className="program-full">
                  {student.program || 'N/A'}
                </td>

                <td>
                  <span className="dept-badge">
                    {student.department_code || 'N/A'}
                  </span>
                </td>
                <td>Year {student.year_of_study || 1} - Sem {student.semester || 1}</td>
                <td>
                  <span className={`status-badge ${student.status || 'active'}`}>
                    {student.status?.charAt(0).toUpperCase() + student.status?.slice(1) || 'Active'}
                  </span>
                </td>

                {isAdmin && (
                  <td>
                    <div className="actions-dropdown">
                      <button className="actions-toggle-btn">
                        Actions <span className="dropdown-icon">▼</span>
                      </button>
                      <div className="actions-menu">
                        <button
                          className="action-item edit"
                          onClick={() => {
                            setEditingStudent(student);
                            const matchingProgram = programs.find(p =>
                              p.code === student.department_code ||
                              p.name === student.program
                            );
                            setEditStudentForm({
                              full_name: student.full_name || '',
                              email: student.email || '',
                              phone: student.phone || '',
                              program_id: matchingProgram?.id || '',
                              program: student.program || '',
                              year_of_study: student.year_of_study || 1,
                              semester: student.semester || 1,
                              department: student.department || '',
                              department_code: student.department_code || '',
                              status: student.status || 'active'
                            });
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="action-item enroll"
                          onClick={() => {
                            setEnrollStudent(student);
                            setShowEnrollModal(true);
                          }}
                        >
                          📚 Enroll
                        </button>
                        <button
                          className="action-item status"
                          onClick={() => handleUpdateStudentStatus(student.id,
                            student.status === 'active' ? 'inactive' : 'active'
                          )}
                        >
                          {student.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
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
                  <div className="debug-info" style={{ fontSize: '12px', color: '#666', marginTop: '10px', display: 'none' }}>
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
  onClick={() => setSelectedLecturerDetails(lecturer)}
>
  View Details
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
                    {/* Timetable Management Tab - Admin Only */}
            {activeTab === 'timetables' && isAdmin && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>⏰ Timetable Management</h2>
                  <button
                    className="add-button"
                    onClick={() => {
                      setNewTimetable({
                        program_id: '',
                        academic_year: '2024/2025',
                        semester: 1,
                        year_of_study: 1,
                        is_active: true
                      });
                      setShowTimetableModal(true);
                    }}
                  >
                    + Create New Timetable
                  </button>
                </div>

               <div className="timetables-grid">
  {timetables.length === 0 ? (
    <div className="empty-state">
      <p>No timetables created yet</p>
      <button
        onClick={() => setShowTimetableModal(true)}
        className="add-button"
      >
        Create First Timetable
      </button>
    </div>
  ) : (
    timetables.map(tt => (
      <div key={tt.id} className="timetable-card expandable">
        <div className="timetable-header">
          <h3>
            {tt.programs?.name || 'Unknown Program'} - Year {tt.year_of_study}
          </h3>
          <div>
            <span className="semester-badge">
              Semester {tt.semester}
            </span>
            <span className={`status-badge ${tt.is_active ? 'active' : 'inactive'}`}>
              {tt.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <p>{tt.academic_year}</p>
        <p className="small-text">
          {tt.program_timetable_slots?.length || 0} slot{(tt.program_timetable_slots?.length || 0) !== 1 ? 's' : ''}
        </p>
        <div className="timetable-actions">
          <button
            className="action-btn view"
            onClick={() => setExpandedTimetableId(expandedTimetableId === tt.id ? null : tt.id)}
          >
            {expandedTimetableId === tt.id ? '↑ Hide Slots' : '↓ View & Edit Slots'}
          </button>
        </div>

        {/* Expanded Slots Table */}
        {expandedTimetableId === tt.id && (
          <div className="expanded-slots-section" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0 }}>Time Slots</h4>
              <button
                className="add-button small"
                onClick={() => {
                  setSelectedTimetable(tt);
                  setEditingSlot(null);
                  setNewSlot({
                    course_code: '',
                    course_name: '',
                    lecturer_id: '',
                    day_of_week: 1,
                    start_time: '08:00',
                    end_time: '10:00',
                    room_number: '',
                    building: 'CS Building',
                    slot_type: 'lecture'
                  });
                  setShowSlotModal(true);
                }}
              >
                + Add Slot
              </button>
            </div>

            {tt.program_timetable_slots?.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Course</th>
                      <th>Lecturer</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tt.program_timetable_slots.map(slot => (
                      <tr key={slot.id}>
                        <td>
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.day_of_week]}
                        </td>
                        <td>{slot.start_time} – {slot.end_time}</td>
                        <td>
                          <strong>{slot.course_code}</strong><br/>
                          <small>{slot.course_name}</small>
                        </td>
                        <td>{slot.lecturers?.full_name || 'Not Assigned'}</td>
                        <td>{slot.room_number} {slot.building}</td>
                        <td>
                          <span className="status-badge">{slot.slot_type}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="action-btn edit small"
                              onClick={() => {
                                setSelectedTimetable(tt);
                                setEditingSlot(slot);
                                setNewSlot({
                                  course_code: slot.course_code,
                                  course_name: slot.course_name,
                                  lecturer_id: slot.lecturer_id || '',
                                  day_of_week: slot.day_of_week,
                                  start_time: slot.start_time,
                                  end_time: slot.end_time,
                                  room_number: slot.room_number,
                                  building: slot.building,
                                  slot_type: slot.slot_type
                                });
                                setShowSlotModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="action-btn delete small"
                              onClick={() => handleDeleteSlot(slot.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                No slots added yet. Click "Add Slot" to create one.
              </p>
            )}
          </div>
        )}
      </div>
    ))
  )}
</div>
                {/* Detailed View of Selected Timetable */}
                {selectedTimetable && (
                  <div className="timetable-detail" style={{ marginTop: '30px' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>
                        {selectedTimetable.programs?.name} - Year {selectedTimetable.year_of_study} Sem {selectedTimetable.semester}
                      </h3>
                      <div>
                        <button
                          className="add-button small"
                          onClick={() => {
                            setEditingSlot(null);
                            setNewSlot({
                              course_code: '',
                              course_name: '',
                              lecturer_id: '',
                              day_of_week: 1,
                              start_time: '08:00',
                              end_time: '10:00',
                              room_number: '',
                              building: 'CS Building',
                              slot_type: 'lecture'
                            });
                            setShowSlotModal(true);
                          }}
                        >
                          + Add Slot
                        </button>
                        <button
                          className="back-button"
                          onClick={() => setSelectedTimetable(null)}
                          style={{ marginLeft: '10px' }}
                        >
                          ← Back
                        </button>
                      </div>
                    </div>

                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Course</th>
                            <th>Lecturer</th>
                            <th>Location</th>
                            <th>Type</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTimetable.program_timetable_slots?.length > 0 ? (
                            selectedTimetable.program_timetable_slots.map(slot => (
                              <tr key={slot.id}>
                                <td>
                                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.day_of_week]}
                                </td>
                                <td>{slot.start_time} – {slot.end_time}</td>
                                <td>
                                  <strong>{slot.course_code}</strong><br/>
                                  <small>{slot.course_name}</small>
                                </td>
                                <td>{slot.lecturers?.full_name || 'Not Assigned'}</td>
                                <td>{slot.room_number} {slot.building}</td>
                                <td>
                                  <span className="status-badge">{slot.slot_type}</span>
                                </td>
                                  <td>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button
        className="action-btn edit small"
        onClick={() => {
          setEditingSlot(slot);
          setNewSlot({
            course_code: slot.course_code,
            course_name: slot.course_name,
            lecturer_id: slot.lecturer_id || '',
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            room_number: slot.room_number,
            building: slot.building,
            slot_type: slot.slot_type
          });
          setShowSlotModal(true);
        }}
      >
        Edit
      </button>
      <button
        className="action-btn delete small"
        onClick={() => handleDeleteSlot(slot.id)}
      >
        Delete
      </button>
    </div>
  </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                                No slots added yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
        )}
        
{activeTab === 'complete-courses' && isAdmin && (
  <div className="tab-content">
    <div className="tab-header">
      <h2>✅ Course Completion Management</h2>
      <p>Mark courses as completed for a semester OR reverse previously marked courses.</p>
    </div>

    {/* Toggle between Mark and Reverse modes */}
    <div className="mode-toggle" style={{
      marginBottom: '20px',
      display: 'flex',
      gap: '10px',
      background: '#f8f9fa',
      padding: '15px',
      borderRadius: '10px',
      border: '1px solid #dee2e6'
    }}>
      <button
        className={`mode-button ${!showReversalMode ? 'active' : ''}`}
        onClick={() => {
          setShowReversalMode(false);
          setSelectedCoursesForReversal([]);
        }}
        style={{
          flex: 1,
          padding: '12px 20px',
          border: '2px solid',
          borderColor: !showReversalMode ? '#007bff' : '#dee2e6',
          background: !showReversalMode ? '#007bff' : 'white',
          color: !showReversalMode ? 'white' : '#495057',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          transition: 'all 0.3s'
        }}
      >
        📝 Mark as Completed
      </button>
      <button
        className={`mode-button ${showReversalMode ? 'active' : ''}`}
        onClick={() => {
          setShowReversalMode(true);
          fetchCompletedCourses();
        }}
        style={{
          flex: 1,
          padding: '12px 20px',
          border: '2px solid',
          borderColor: showReversalMode ? '#dc3545' : '#dee2e6',
          background: showReversalMode ? '#dc3545' : 'white',
          color: showReversalMode ? 'white' : '#495057',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          transition: 'all 0.3s'
        }}
      >
        ↩️ Reverse Completion
      </button>
    </div>

    {/* FILTERS SECTION - Academic Year is now text input */}
    <div className="filters-section" style={{
      padding: '20px',
      background: showReversalMode ? '#fff8f8' : '#f8fff8',
      borderRadius: '10px',
      marginBottom: '20px'
    }}>
      <div className="form-row">
        <div className="form-group">
          <label>Program (Optional)</label>
          <select
            value={showReversalMode ? reversalFilters.program_id : completionFilters.program_id}
            onChange={(e) => showReversalMode
              ? setReversalFilters({ ...reversalFilters, program_id: e.target.value })
              : setCompletionFilters({ ...completionFilters, program_id: e.target.value })
            }
            className="form-select"
          >
            <option value="">All Programs</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>

        {/* Academic Year - Manual Text Input */}
        <div className="form-group">
          <label>Academic Year (e.g. 2025/2029) *</label>
          <input
            type="text"
            value={showReversalMode ? reversalFilters.academic_year : completionFilters.academic_year}
            onChange={(e) => showReversalMode
              ? setReversalFilters({ ...reversalFilters, academic_year: e.target.value.trim() })
              : setCompletionFilters({ ...completionFilters, academic_year: e.target.value.trim() })
            }
            placeholder="Enter academic year (e.g. 2025/2029)"
            className="form-input"
            required
          />
          <small>Admin enters full range manually</small>
        </div>

        <div className="form-group">
          <label>Year of Study *</label>
          <select
            value={showReversalMode ? reversalFilters.year_of_study : completionFilters.year_of_study}
            onChange={(e) => showReversalMode
              ? setReversalFilters({ ...reversalFilters, year_of_study: parseInt(e.target.value) })
              : setCompletionFilters({ ...completionFilters, year_of_study: parseInt(e.target.value) })
            }
            className="form-select"
          >
            <option value="">Select Year</option>
            {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Semester *</label>
          <select
            value={showReversalMode ? reversalFilters.semester : completionFilters.semester}
            onChange={(e) => showReversalMode
              ? setReversalFilters({ ...reversalFilters, semester: parseInt(e.target.value) })
              : setCompletionFilters({ ...completionFilters, semester: parseInt(e.target.value) })
            }
            className="form-select"
          >
            <option value="">Select Semester</option>
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
          </select>
        </div>
      </div>

      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: showReversalMode ? '#ffecec' : '#e3fcec',
        borderRadius: '6px'
      }}>
        <strong>Cohort:</strong> {
          showReversalMode
            ? reversalFilters.academic_year || '—'
            : completionFilters.academic_year || '—'
        } • Year {
          showReversalMode
            ? reversalFilters.year_of_study || '—'
            : completionFilters.year_of_study || '—'
        } • Semester {
          showReversalMode
            ? reversalFilters.semester || '—'
            : completionFilters.semester || '—'
        }<br/>
        {showReversalMode ? (
          <strong>Completed courses found:</strong>
        ) : (
          <strong>Active students found:</strong>
        )} {
          showReversalMode
            ? completedCourses.length
            : studentsToComplete.length
        }
      </div>
    </div>

    {/* CONTENT BASED ON MODE */}
    {showReversalMode ? (
      /* REVERSAL MODE */
      completedCourses.length > 0 ? (
        <>
          <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Completed Courses to Reverse</h3>
            <label>
              <input
                type="checkbox"
                checked={selectedCoursesForReversal.length === completedCourses.length && completedCourses.length > 0}
                onChange={selectAllForReversal}
              />
              Select All ({selectedCoursesForReversal.length} selected)
            </label>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Program</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedCourses.map(course => (
                  <tr key={course.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCoursesForReversal.includes(course.id)}
                        onChange={() => toggleCourseReversalSelection(course.id)}
                      />
                    </td>
                    <td><strong>{course.course_code}</strong></td>
                    <td>{course.course_name}</td>
                    <td>{course.program || 'N/A'}</td>
                    <td>{course.department_code || 'N/A'}</td>
                    <td>
                      <span className="status-badge completed">Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: '25px' }}>
            <button
              className="confirm-button large"
              onClick={handleReverseCourseCompletion}
              disabled={reversalInProgress || selectedCoursesForReversal.length === 0}
              style={{
                background: reversalInProgress ? '#6c757d' : '#dc3545',
                borderColor: reversalInProgress ? '#6c757d' : '#dc3545'
              }}
            >
              {reversalInProgress
                ? 'Processing Reversal...'
                : `↩️ Reverse ${selectedCoursesForReversal.length} Course(s) to "Enrolled"`
              }
            </button>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              This will change course status from "completed" to "enrolled" for all students.
            </p>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>
            ✅
          </div>
          <h4>No Completed Courses Found</h4>
          <p className="small-text" style={{ maxWidth: '500px', margin: '0 auto' }}>
            No courses have been marked as completed for the selected filters.
            <br />
            Adjust the filters or use "Mark as Completed" mode instead.
          </p>
        </div>
      )
    ) : (
      /* MARKING MODE */
      coursesForCompletion.length > 0 ? (
        <>
          <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Courses to Mark as Completed</h3>
            <label>
              <input
                type="checkbox"
                checked={selectedCoursesForCompletion.length === coursesForCompletion.length && coursesForCompletion.length > 0}
                onChange={selectAllForCompletion}
              />
              Select All ({selectedCoursesForCompletion.length} selected)
            </label>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Program</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {coursesForCompletion.map(course => (
                  <tr key={course.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCoursesForCompletion.includes(course.id)}
                        onChange={() => toggleCourseCompletionSelection(course.id)}
                      />
                    </td>
                    <td><strong>{course.course_code}</strong></td>
                    <td>{course.course_name}</td>
                    <td>{course.program || 'N/A'}</td>
                    <td>{course.department_code || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: '25px' }}>
            <button
              className="confirm-button large"
              onClick={handleMarkSemesterCompleted}
              disabled={markingInProgress || selectedCoursesForCompletion.length === 0 || studentsToComplete.length === 0}
              style={{
                background: markingInProgress ? '#6c757d' : '#28a745',
                borderColor: markingInProgress ? '#6c757d' : '#28a745'
              }}
            >
              {markingInProgress
                ? 'Processing...'
                : `✅ Mark ${selectedCoursesForCompletion.length} Course(s) as Completed`
              }
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>No courses found. Adjust filters or add courses for this year/semester.</p>
        </div>
      )
    )}
          </div>
          
          
        )}
        
              {/* === TUTORIALS UPLOAD MODAL === */}
      {showTutorialsModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <h3>Upload Tutorial Materials</h3>

            {/* Cohort Selection - REQUIRED */}
            <div style={{
              background: '#fff8e1',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '25px',
              border: '2px solid #ffb300'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#ff8f00' }}>
                Target Student Cohort (REQUIRED)
              </h4>
              <p style={{ fontSize: '14px', marginBottom: '15px', color: '#555' }}>
                Select the exact group of students who should see this tutorial.
              </p>
              <div className="form-row">
                <div className="form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={selectedCohort.academic_year}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Year *</label>
                  <select
                    value={selectedCohort.year_of_study}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, year_of_study: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Semester *</label>
                  <select
                    value={selectedCohort.semester}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, semester: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={tutorialTitle}
                  onChange={(e) => setTutorialTitle(e.target.value)}
                  placeholder="e.g. Week 5 Tutorial - Database Normalization"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={tutorialDescription}
                  onChange={(e) => setTutorialDescription(e.target.value)}
                  placeholder="Brief description of this tutorial"
                  rows="3"
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label>Tutorial Files *</label>
                <div
                  className="file-upload-area"
                  onClick={() => tutorialFileInputRef.current?.click()}
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
                    const files = e.dataTransfer?.files;
                    if (files) {
                      setTutorialFiles(Array.from(files));
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={tutorialFileInputRef}
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        setTutorialFiles(Array.from(files));
                      }
                    }}
                    className="file-input"
                    style={{ display: 'none' }}
                  />
                  <div className="upload-icon">📤</div>
                  <p><strong>Drop files here or click to browse</strong></p>
                  <p className="small-text">PDF, DOC, PPT, MP4, ZIP, etc.</p>
                </div>

                {uploadingTutorial && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${tutorialUploadProgress}%` }}
                      ></div>
                    </div>
                    <p>Uploading: {tutorialUploadProgress}%</p>
                  </div>
                )}

                {tutorialFiles.length > 0 && (
                  <div className="file-list">
                    <h4>Selected Files ({tutorialFiles.length})</h4>
                    <div className="files-grid">
                      {tutorialFiles.map((file, i) => (
                        <div key={i} className="file-item">
                          <div className="file-info">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            onClick={() => setTutorialFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="remove-file"
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
                    setShowTutorialsModal(false);
                    setTutorialFiles([]);
                    setTutorialTitle('');
                    setTutorialDescription('');
                    setSelectedCohort({ academic_year: '', year_of_study: 1, semester: 1 });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="confirm-button"
                  onClick={async () => {
                    if (!tutorialTitle.trim()) {
                      alert('Please enter a title');
                      return;
                    }
                    if (tutorialFiles.length === 0) {
                      alert('Please select at least one file');
                      return;
                    }
                    if (!selectedCohort.academic_year || !selectedCohort.year_of_study || !selectedCohort.semester) {
                      alert('Please select the target cohort');
                      return;
                    }

                    const uploaded = await uploadTutorialFiles(tutorialFiles);
                    if (uploaded.length > 0) {
                      setShowTutorialsModal(false);
                      setTutorialFiles([]);
                      setTutorialTitle('');
                      setTutorialDescription('');
                      setSelectedCohort({ academic_year: '', year_of_study: 1, semester: 1 });
                    }
                  }}
                  disabled={uploadingTutorial}
                >
                  {uploadingTutorial ? 'Uploading...' : 'Upload Tutorials'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        

      </main>

      {/* =================== MODALS =================== */}

      {/* edit student modal */}
{editingStudent && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Edit Student: {editingStudent.student_id}</h3>
      <div className="modal-form">
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            value={editStudentForm.full_name}
            onChange={e => setEditStudentForm({ ...editStudentForm, full_name: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={editStudentForm.email}
            onChange={e => setEditStudentForm({ ...editStudentForm, email: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            value={editStudentForm.phone}
            onChange={e => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
            className="form-input"
          />
        </div>

        {/* Date of Birth */}
        <div className="form-group">
          <label>Date of Birth</label>
          <input
            type="date"
            value={editStudentForm.date_of_birth || ''}
            onChange={e => setEditStudentForm({ ...editStudentForm, date_of_birth: e.target.value })}
            className="form-input"
          />
        </div>

        {/* Department Code - manual */}
        <div className="form-group">
          <label>Department Code</label>
          <input
            type="text"
            value={editStudentForm.department_code || ''}
            onChange={e => setEditStudentForm({
              ...editStudentForm,
              department_code: e.target.value.trim().toUpperCase()
            })}
            placeholder="e.g. SCT, ENG"
            className="form-input"
          />
        </div>

        {/* Program Code - manual entry (now fully editable like Add Student) */}
        <div className="form-group">
          <label>Program Code</label>
          <input
            type="text"
            value={editStudentForm.program_code || ''}
            onChange={e => setEditStudentForm({
              ...editStudentForm,
              program_code: e.target.value.trim().toUpperCase()
            })}
            placeholder="e.g. BSCE, BSCS, BIT"
            className="form-input"
          />
          <small>No spaces, uppercase only</small>
        </div>

        {/* Program Selection (optional - still linked to program_id) */}
        <div className="form-group">
          <label>Program (Optional)</label>
          <select
            value={editStudentForm.program_id || ''}
            onChange={(e) => {
              const prog = programs.find(p => p.id === e.target.value);
              setEditStudentForm({
                ...editStudentForm,
                program_id: prog?.id || '',
                program: prog?.name || '',
                // Note: department_code is now manually edited above
              });
            }}
            className="form-select"
          >
            <option value="">Select Program</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Department Name</label>
          <input
            type="text"
            value={editStudentForm.department}
            onChange={e => setEditStudentForm({ ...editStudentForm, department: e.target.value })}
            className="form-input"
            placeholder="e.g. Science and Technology"
          />
        </div>

        {/* Intake */}
        <div className="form-group">
          <label>Intake</label>
          <select
            value={editStudentForm.intake || 'January'}
            onChange={e => setEditStudentForm({ ...editStudentForm, intake: e.target.value })}
            className="form-select"
          >
            <option value="January">January</option>
            <option value="August">August</option>
          </select>
        </div>

        {/* Academic Year - Manual */}
        <div className="form-group">
          <label>Academic Year</label>
          <input
            type="text"
            value={editStudentForm.academic_year || ''}
            onChange={e => setEditStudentForm({ ...editStudentForm, academic_year: e.target.value.trim() })}
            placeholder="e.g. 2025/2029"
            className="form-input"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Year of Study</label>
            <select
              value={editStudentForm.year_of_study}
              onChange={e => setEditStudentForm({ ...editStudentForm, year_of_study: parseInt(e.target.value) })}
              className="form-select"
            >
              {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Semester</label>
            <select
              value={editStudentForm.semester}
              onChange={e => setEditStudentForm({ ...editStudentForm, semester: parseInt(e.target.value) })}
              className="form-select"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={editStudentForm.status}
              onChange={e => setEditStudentForm({ ...editStudentForm, status: e.target.value })}
              className="form-select"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-button" onClick={() => setEditingStudent(null)}>
            Cancel
          </button>
          <button
            className="confirm-button"
            onClick={async () => {
              try {
                const { error } = await supabase
                  .from('students')
                  .update({
                    full_name: editStudentForm.full_name.trim(),
                    email: editStudentForm.email.trim(),
                    phone: editStudentForm.phone || null,
                    date_of_birth: editStudentForm.date_of_birth || null,
                    program_id: editStudentForm.program_id,
                    program: editStudentForm.program,
                    program_code: editStudentForm.program_code.trim().toUpperCase(),
                    department: editStudentForm.department.trim(),
                    department_code: editStudentForm.department_code.trim().toUpperCase(),
                    year_of_study: editStudentForm.year_of_study,
                    semester: editStudentForm.semester,
                    intake: editStudentForm.intake,
                    academic_year: editStudentForm.academic_year.trim(),
                    status: editStudentForm.status,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', editingStudent.id);
                if (error) throw error;
                alert('Student updated successfully!');
                setEditingStudent(null);
                fetchStudents();
                fetchDashboardStats();
              } catch (err) {
                alert('Error updating student: ' + err.message);
              }
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
      )}
      
    
      
   {showAssignmentUploadModal && (
  <div className="modal-overlay">
    <div className="modal large-modal">
      <h3>Create New Assignment</h3>

      {/* REQUIRED COHORT SELECTION */}
      <div style={{
        background: '#f0f8ff',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '25px',
        border: '2px solid #1976d2'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>Target Student Cohort (REQUIRED)</h4>
        <p style={{ fontSize: '14px', marginBottom: '15px', color: '#555' }}>
          Select the exact group of students who should receive this assignment.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Academic Year *</label>
            <input
              type="text"
              value={selectedCohort.academic_year}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, academic_year: e.target.value.trim() })}
              placeholder="e.g. 2025/2029"
              className="form-input"
              style={{ borderColor: cohortError ? '#d32f2f' : '' }}
            />
          </div>
          <div className="form-group">
            <label>Year of Study *</label>
            <select
              value={selectedCohort.year_of_study}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, year_of_study: parseInt(e.target.value) })}
              className="form-select"
            >
              <option value={1}>Year 1</option>
              <option value={2}>Year 2</option>
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
            </select>
          </div>
          <div className="form-group">
            <label>Semester *</label>
            <select
              value={selectedCohort.semester}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, semester: parseInt(e.target.value) })}
              className="form-select"
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </div>
        </div>
        {cohortError && (
          <p style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: '10px' }}>
            ⚠️ {cohortError}
          </p>
        )}
      </div>

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

        {/* File upload section remains exactly as before */}
        <div className="form-group">
          <label className="form-label">Assignment Files (Optional)</label>
          <p className="small-text" style={{ color: '#3b82f6', marginBottom: '10px' }}>
            📦 Files will be uploaded to <strong>public lecturerbucket</strong>
          </p>
          <div
            className="file-upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
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
            <div className="upload-icon">📤</div>
            <p><strong>Drag & drop files here or click to browse</strong></p>
            <p className="small-text">Supported: PDF, DOC, DOCX, ZIP, Images, Text</p>
          </div>

          {uploadingFiles && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="progress-text">Uploading: {uploadProgress}%</p>
            </div>
          )}

          {assignmentFiles.length > 0 && (
            <div className="file-list">
              <h4>Files to Upload ({assignmentFiles.length})</h4>
              <div className="files-grid">
                {assignmentFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="file-actions">
                      <span className="file-type">{file.name.split('.').pop().toUpperCase()}</span>
                      <button
                        className="remove-file"
                        onClick={() => setAssignmentFiles(prev => prev.filter((_, i) => i !== index))}
                      >×</button>
                    </div>
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
              setSelectedCohort({ academic_year: '', year_of_study: 1, semester: 1 });
              setCohortError('');
            }}
          >
            Cancel
          </button>
          <button
            className="confirm-button"
            onClick={() => {
              if (!validateCohort()) return;
              handleCreateAssignment();
            }}
            disabled={loading.creatingAssignment || uploadingFiles}
          >
            {loading.creatingAssignment ? 'Creating...' : 'Create Assignment'}
          </button>
        </div>
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

      {/* NEW: Lecturer Details Modal */}
      {selectedLecturerDetails && (
        <div className="modal-overlay" onClick={() => setSelectedLecturerDetails(null)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Lecturer Details: {selectedLecturerDetails.full_name}</h3>
              <button
                className="cancel-button"
                onClick={() => setSelectedLecturerDetails(null)}
                style={{ padding: '8px 16px' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <strong>Lecturer ID:</strong><br/>
                <span>{selectedLecturerDetails.lecturer_id || 'N/A'}</span>
              </div>
              <div>
                <strong>Email:</strong><br/>
                <span>{selectedLecturerDetails.email}</span>
              </div>
              <div>
                <strong>Phone:</strong><br/>
                <span>{selectedLecturerDetails.phone || 'Not provided'}</span>
              </div>
              <div>
                <strong>Specialization:</strong><br/>
                <span>{selectedLecturerDetails.specialization || 'Not specified'}</span>
              </div>
              <div>
                <strong>Google Meet Link:</strong><br/>
                {selectedLecturerDetails.google_meet_link ? (
                  <a href={selectedLecturerDetails.google_meet_link} target="_blank" rel="noreferrer" className="meet-link small">
                    🔗 Open Meet Link
                  </a>
                ) : (
                  <span className="text-muted">No link provided</span>
                )}
              </div>
              <div>
                <strong>Status:</strong><br/>
                <span className={`status-badge ${selectedLecturerDetails.status || 'active'}`}>
                  {selectedLecturerDetails.status?.charAt(0).toUpperCase() + selectedLecturerDetails.status?.slice(1) || 'Active'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h4>Assigned Departments</h4>
              {selectedLecturerDetails.lecturer_departments && selectedLecturerDetails.lecturer_departments.length > 0 ? (
                <div className="departments-badges" style={{ marginTop: '10px' }}>
                  {selectedLecturerDetails.lecturer_departments.map((dept, idx) => (
                    <span key={idx} className="department-badge">
                      {dept.department_code} - {dept.department_name || dept.department_code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No departments assigned yet.</p>
              )}
            </div>

            <div style={{ marginTop: '30px', textAlign: 'right' }}>
              <button
                className="action-btn dept"
                onClick={() => {
                  setSelectedLecturerForDept(selectedLecturerDetails);
                  setShowDepartmentModal(true);
                  setSelectedLecturerDetails(null);
                }}
              >
                🏢 Manage Departments
              </button>
            </div>
          </div>
        </div>
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
    {/* Date of Birth */}
    <div className="form-group">
      <label className="form-label">Date of Birth</label>
      <input
        type="date"
        value={newUser.date_of_birth}
        onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })}
        className="form-input"
      />
      <small>Optional</small>
    </div>

    {/* Program Selection - only sets name and program_id */}
    <div className="form-group">
      <label className="form-label">Program *</label>
      {programsLoading ? (
        <p>Loading programs...</p>
      ) : programs.length === 0 ? (
        <p>No programs available.</p>
      ) : (
        <select
          value={newUser.program_id || ''}
          onChange={(e) => {
            const selectedProg = programs.find(p => p.id === e.target.value);
            setNewUser({
              ...newUser,
              program_id: selectedProg?.id || '',
              program: selectedProg?.name || ''
              // department_code and department are NOT set here anymore
            });
          }}
          className="form-select"
          required
        >
          <option value="">Select Program</option>
          {programs.map(prog => (
            <option key={prog.id} value={prog.id}>
              {prog.name} ({prog.code})
            </option>
          ))}
        </select>
      )}
      <small>Selected: {newUser.program || 'None'}</small>
    </div>

    {/* Department Name - manual */}
<div className="form-group">
  <label className="form-label">Department Name *</label>
  <input
    type="text"
    value={newUser.department}
    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}  // ← Fixed!
    placeholder="e.g. Science and Technology"
    className="form-input"
    required
  />
  <small>Spaces are fully allowed</small>
</div>

    {/* Department Code - manual */}
  <div className="form-group">
  <label className="form-label">Department Code *</label>
  <input
    type="text"
    value={newUser.department_code}
    onChange={(e) => setNewUser({ 
      ...newUser, 
      department_code: e.target.value.trim().toUpperCase().replace(/\s+/g, '') 
    })}
    placeholder="e.g. SCT"
    className="form-input"
    required
  />
  <small>No spaces, uppercase only</small>
</div>

{/* Program Code - manual entry */}
<div className="form-group">
  <label className="form-label">Program Code *</label>
  <input
    type="text"
    value={newUser.program_code || ''}
    onChange={(e) => setNewUser({
      ...newUser,
      program_code: e.target.value.trim().toUpperCase().replace(/\s+/g, '')
    })}
    placeholder="e.g. BSCE, BSCS, BIT"
    className="form-input"
    required
  />
  <small>No spaces, uppercase only (e.g. BSCE)</small>
</div>

    {/* Program Duration */}
    <div className="form-group">
      <label className="form-label">Program Duration (Years) *</label>
      <select
        value={newUser.program_duration_years}
        onChange={(e) => setNewUser({ ...newUser, program_duration_years: parseInt(e.target.value) })}
        className="form-select"
      >
        <option value={3}>3 Years</option>
        <option value={4}>4 Years</option>
        <option value={5}>5 Years</option>
      </select>
      <small>Total semesters will be: {newUser.program_duration_years * 2}</small>
    </div>

    {/* Intake */}
    <div className="form-group">
      <label className="form-label">Intake *</label>
      <select
        value={newUser.intake}
        onChange={(e) => setNewUser({ ...newUser, intake: e.target.value })}
        className="form-select"
      >
        <option value="January">January</option>
        <option value="August">August</option>
      </select>
    </div>

    {/* Academic Year - manual */}
    <div className="form-group">
      <label className="form-label">Academic Year (Entry/End) *</label>
      <input
        type="text"
        value={newUser.academic_year}
        onChange={(e) => setNewUser({ ...newUser, academic_year: e.target.value.trim() })}
        placeholder="e.g. 2025/2029"
        className="form-input"
        required
      />
      <small>Admin enters full range (e.g. 2025/2028 for 3yr, 2025/2029 for 4yr)</small>
    </div>

    {/* Year & Semester */}
    <div className="form-row">
      <div className="form-group">
        <label className="form-label">Year of Study</label>
        <select
          value={newUser.year_of_study}
          onChange={(e) => setNewUser({ ...newUser, year_of_study: parseInt(e.target.value) })}
          className="form-select"
        >
          {[1, 2, 3, 4, 5].map(y => (
            <option key={y} value={y}>Year {y}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Semester</label>
        <select
          value={newUser.semester}
          onChange={(e) => setNewUser({ ...newUser, semester: parseInt(e.target.value) })}
          className="form-select"
        >
          <option value={1}>Semester 1</option>
          <option value={2}>Semester 2</option>
        </select>
      </div>
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
                  placeholder="e.g., ENG, SCT"
                  className="form-input"
                />
              </div>
             
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  value={newCourse.department}
                  onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                  placeholder="e.g., Science and Technology"
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

      {/* Lecture Modal */}
      {showLectureModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Schedule New Lecture</h3>
                  {/* REQUIRED COHORT SELECTION FOR LECTURES */}
      <div style={{
        background: '#f0fff4',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '25px',
        border: '2px solid #388e3c'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#388e3c' }}>Target Student Cohort (REQUIRED)</h4>
        <p style={{ fontSize: '14px', marginBottom: '15px', color: '#555' }}>
          Select the exact group of students who should see this lecture.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Academic Year *</label>
            <input
              type="text"
              value={selectedCohort.academic_year}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, academic_year: e.target.value.trim() })}
              placeholder="e.g. 2025/2029"
              className="form-input"
              style={{ borderColor: cohortError ? '#d32f2f' : '' }}
            />
          </div>
          <div className="form-group">
            <label>Year of Study *</label>
            <select
              value={selectedCohort.year_of_study}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, year_of_study: parseInt(e.target.value) })}
              className="form-select"
            >
              <option value={1}>Year 1</option>
              <option value={2}>Year 2</option>
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
            </select>
          </div>
          <div className="form-group">
            <label>Semester *</label>
            <select
              value={selectedCohort.semester}
              onChange={(e) => setSelectedCohort({ ...selectedCohort, semester: parseInt(e.target.value) })}
              className="form-select"
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </div>
        </div>
        {cohortError && (
          <p style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: '10px' }}>
            ⚠️ {cohortError}
          </p>
        )}
      </div>
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
  onClick={() => {
    setShowLectureModal(false);
    setSelectedCohort({ academic_year: '', year_of_study: 1, semester: 1 });
    setCohortError('');
  }}
>
  Cancel
</button>
              <button
  className="confirm-button"
  onClick={() => {
    if (!validateCohort()) return;
    handleAddLecture();
  }}
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

            {/* Create/Edit Program Timetable Modal */}
      {showTimetableModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{selectedTimetable ? 'Edit' : 'Create New'} Timetable</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>Program</label>
                <select
                  value={newTimetable.program_id}
                  onChange={(e) => setNewTimetable({ ...newTimetable, program_id: e.target.value })}
                  className="form-select"
                  disabled={selectedTimetable} // Can't change program after creation
                >
                  <option value="">Select Program</option>
                  {programs.map(prog => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name} ({prog.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    value={newTimetable.academic_year}
                    onChange={(e) => setNewTimetable({ ...newTimetable, academic_year: e.target.value })}
                    placeholder="e.g. 2024/2025"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    value={newTimetable.semester}
                    onChange={(e) => setNewTimetable({ ...newTimetable, semester: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Year of Study</label>
                  <select
                    value={newTimetable.year_of_study}
                    onChange={(e) => setNewTimetable({ ...newTimetable, year_of_study: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="cancel-button" onClick={() => {
                  setShowTimetableModal(false);
                  setSelectedTimetable(null);
                }}>
                  Cancel
                </button>
                <button className="confirm-button" onClick={handleSaveTimetable}>
                  Save Timetable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Slot Modal */}
      {showSlotModal && selectedTimetable && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingSlot ? 'Edit' : 'Add New'} Time Slot</h3>
            <div className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Course Code</label>
                  <input
                    type="text"
                    value={newSlot.course_code}
                    onChange={(e) => setNewSlot({ ...newSlot, course_code: e.target.value })}
                    placeholder="e.g. CSC301"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Course Name</label>
                  <input
                    type="text"
                    value={newSlot.course_name}
                    onChange={(e) => setNewSlot({ ...newSlot, course_name: e.target.value })}
                    placeholder="e.g. Database Systems"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Lecturer</label>
                <select
                  value={newSlot.lecturer_id}
                  onChange={(e) => setNewSlot({ ...newSlot, lecturer_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">Not Assigned</option>
                  {lecturersList.map(lec => (
                    <option key={lec.id} value={lec.id}>
                      {lec.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Day</label>
                  <select
                    value={newSlot.day_of_week}
                    onChange={(e) => setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })}
                    className="form-select"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={newSlot.start_time}
                    onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={newSlot.end_time}
                    onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Room</label>
                  <input
                    type="text"
                    value={newSlot.room_number}
                    onChange={(e) => setNewSlot({ ...newSlot, room_number: e.target.value })}
                    placeholder="e.g. 101"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Building</label>
                  <input
                    type="text"
                    value={newSlot.building}
                    onChange={(e) => setNewSlot({ ...newSlot, building: e.target.value })}
                    placeholder="e.g. CS Building"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={newSlot.slot_type}
                    onChange={(e) => setNewSlot({ ...newSlot, slot_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="practical">Practical</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="cancel-button" onClick={() => {
                  setShowSlotModal(false);
                  setEditingSlot(null);
                }}>
                  Cancel
                </button>
                <button className="confirm-button" onClick={handleSaveSlot}>
                  {editingSlot ? 'Update' : 'Add'} Slot
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

      {/* Enroll Courses Modal */}
      {showEnrollModal && enrollStudent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Enroll {enrollStudent.full_name} in Courses</h3>
            <p>
              <strong>ID:</strong> {enrollStudent.student_id}<br/>
              <strong>Program:</strong> {enrollStudent.program} ({enrollStudent.program_code})<br/>
              <strong>Current:</strong> Year {enrollStudent.year_of_study}, Semester {enrollStudent.semester}
            </p>

            <div className="enrollment-options">
              <div className="option-card">
           <h4>Enroll in All Program Courses</h4>
<p>
  This will enroll the student in <strong>ALL active courses</strong> belonging to their program:
</p>
<ul>
  <li>Program: <strong>{enrollStudent.program}</strong></li>
  <li>Program Code: <strong>{enrollStudent.program_code}</strong></li>
  <li>Total Active Courses Found: Will be shown after confirmation</li>
</ul>
<p><strong>Includes courses from all years and semesters.</strong></p>
                <button
                  className="confirm-button"
                 onClick={async () => {
  if (!window.confirm(
    `Enroll ${enrollStudent.full_name} in ALL active courses for their program?\n\n` +
    `Program: ${enrollStudent.program} (${enrollStudent.program_code})\n` +
    `This will include courses from all years and semesters.`
  )) return;

  try {
    const { data: courses, error: fetchError } = await supabase
      .from('courses')
      .select('id')
      .eq('program_code', enrollStudent.program_code)
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    if (courses.length === 0) {
      alert('No active courses found for this program code: ' + enrollStudent.program_code);
      return;
    }

    const enrollments = courses.map(c => ({
      student_id: enrollStudent.id,
      course_id: c.id,
      status: 'enrolled',
      enrollment_date: new Date().toISOString().split('T')[0]
    }));

    const { error: insertError } = await supabase
      .from('student_courses')
      .insert(enrollments);

    if (insertError) {
      if (insertError.code === '23505') {
        alert('Some courses were already enrolled (skipped duplicates). Others enrolled successfully.');
      } else {
        throw insertError;
      }
    } else {
      alert(`✅ Successfully enrolled in ${courses.length} course(s) for ${enrollStudent.program_code}!`);
    }

    setShowEnrollModal(false);
    setEnrollStudent(null);
  } catch (err) {
    console.error(err);
    alert('Enrollment failed: ' + err.message);
  }
}}
                >
                 Enroll in All Courses ({enrollStudent.program_code})
                </button>
              </div>

              <div className="option-card">
                <h4>Custom Enrollment Later</h4>
                <p>You can create a custom SQL query or use bulk tools if needed.</p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowEnrollModal(false);
                  setEnrollStudent(null);
                }}
              >
                Close
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