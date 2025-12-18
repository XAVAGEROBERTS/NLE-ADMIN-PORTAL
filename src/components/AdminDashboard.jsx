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

  // Modals and forms
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedLecturerForDept, setSelectedLecturerForDept] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [showLectureDetailsModal, setShowLectureDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);

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
    submission_type: 'file'
  });

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

  // Refs
  const subscriptionRef = useRef(null);

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
          { event: '*', schema: 'public' }, 
          () => {
            fetchDashboardStats();
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

  // Fetch functions
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

      setStats({
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
      });
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

 // FIXED fetchLectures function with proper time comparison
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
              className={`nav-item ${activeTab === 'lectures' ? 'active' : ''}`}
              onClick={() => setActiveTab('lectures')}
            >
              🎓 My Lectures
            </button>
            <button 
              className={`nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              📝 Assignments
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
                </div>

                {/* Quick Actions */}
                <div className="actions-section">
                  <h3>Quick Actions</h3>
                  <div className="actions-grid">
                    {isLecturer && (
                      <>
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
                          onClick={() => setShowAssignmentModal(true)}
                        >
                          <span className="action-icon">📝</span>
                          <span>Create Assignment</span>
                          <small>For your courses</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => navigate('/materials')}
                        >
                          <span className="action-icon">📚</span>
                          <span>Upload Materials</span>
                          <small>Course resources</small>
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
                  </div>
                </div>
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
            {activeTab === 'lectures' && (
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

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📝 Assignment Management</h2>
                  {isLecturer && (
                    <button 
                      className="add-button"
                      onClick={() => setShowAssignmentModal(true)}
                    >
                      + Create Assignment
                    </button>
                  )}
                </div>
                
                <div className="assignments-list">
                  {assignments.length > 0 ? (
                    assignments.map(assignment => (
                      <div key={assignment.id} className="assignment-card">
                        <div className="assignment-header">
                          <div>
                            <h3>{assignment.title}</h3>
                            <p className="course-info">
                              {assignment.courses?.course_code} - {assignment.courses?.course_name}
                            </p>
                          </div>
                          <span className={`assignment-status ${assignment.status}`}>
                            {assignment.status}
                          </span>
                        </div>
                        <p>{assignment.description}</p>
                        <div className="assignment-details">
                          <span>📅 Due: {new Date(assignment.due_date).toLocaleString()}</span>
                          <span>📊 Total Marks: {assignment.total_marks}</span>
                          <span>👨‍🏫 Lecturer: {assignment.lecturers?.full_name}</span>
                        </div>
                        <div className="assignment-actions">
                          <button className="action-btn view">
                            View Submissions
                          </button>
                          {isLecturer && (
                            <>
                              <button className="action-btn edit">
                                Edit
                              </button>
                              <button className="action-btn grade">
                                Grade
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p>No assignments found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exams Tab */}
            {activeTab === 'exams' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>🎯 Exam Management</h2>
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
                        </div>
                        <div className="exam-actions">
                          <button className="action-btn view">
                            View Details
                          </button>
                          {isAdmin && (
                            <button className="action-btn edit">
                              Edit
                            </button>
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
                  <div className="attendance-rate">
                    Overall Attendance Rate: {stats.attendanceRate}%
                  </div>
                </div>
                
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 20).map(record => (
                        <tr key={record.id}>
                          <td>{record.student_id?.slice(0, 8) || 'N/A'}</td>
                          <td>{new Date(record.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${record.status}`}>
                              {record.status}
                            </span>
                          </td>
                          <td>{record.check_in_time || 'N/A'}</td>
                          <td>{record.check_out_time || 'N/A'}</td>
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

      {/* Modals */}
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

      {/* Assignment Modal */}
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