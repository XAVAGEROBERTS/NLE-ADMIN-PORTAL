// src/components/AdminDashboard.jsx - COMPLETE VERSION WITH ALL MODALS
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import { useLecturerDepartments } from '../hooks/useLecturerDepartments';
import './admin/AdminDashboardStyles.css';
import FinanceDashboard from './FinanceDashboard';
import LecturerDashboard from './LecturerDashboard';

// Import Tab Components
import DashboardTab from './admin/DashboardTab';
import StudentsTab from './admin/StudentsTab';
import LecturersTab from './admin/LecturersTab';
import DeansTab from './admin/DeansTab';
import HODsTab from './admin/HODsTab';
import FinanceTab from './admin/FinanceTab';
import CoursesTab from './admin/CoursesTab';
import ExamsTab from './admin/ExamsTab';
import TimetablesTab from './admin/TimetablesTab';
import ProgramsTab from './admin/ProgramsTab';
import SettingsTab from './admin/SettingsTab';

// Import Modal Components
import UserModal from './admin/modals/UserModal';
import EditUserModal from './admin/modals/EditUserModal';
import CourseModal from './admin/modals/CourseModal';
import ExamModal from './admin/modals/ExamModal';
import FinanceRecordModal from './admin/modals/FinanceRecordModal';
import TimetableModal from './admin/modals/TimetableModal';
import SlotModal from './admin/modals/SlotModal';
import ProgramModal from './admin/modals/ProgramModal';
import LogoutModal from './admin/modals/LogoutModal';

// Import Existing Admin Components
import DepartmentAssignmentModal from './admin/modals/DepartmentAssignmentModal';
import StudentProfilePictureModal from "./admin/modals/StudentProfilePictureModal";
import AttendanceManager from './admin/AttendanceManager';
import FacultyManager from './admin/FacultyManager';
import DepartmentManager from './admin/DepartmentManager';
import CourseAssignmentModal from './admin/modals/CourseAssignmentModal';

// ============================================
// MAIN ADMIN DASHBOARD
// ============================================
const AdminDashboard = () => {
  const navigate = useNavigate();
  const {
    profile,
    signOut,
    isAdmin,
    isLecturer,
    isFinance,
    loading: authLoading,
  } = useAdminAuth();

  const {
    departments: allowedDepartments,
    departmentCodes,
    loading: lecturerDeptLoading,
    hasAccess,
  } = useLecturerDepartments(isLecturer ? profile?.id : null);

  // ==================== STATE MANAGEMENT ====================
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState({ dashboard: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const subscriptionRef = useRef(null);

  // ==================== DATA STATES ====================
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [deans, setDeans] = useState([]);
  const [hods, setHODs] = useState([]);
  const [financeOfficers, setFinanceOfficers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [financialRecords, setFinancialRecords] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingDeans, setLoadingDeans] = useState(false);
  const [loadingHODs, setLoadingHODs] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);

  // ==================== CHAT STATES ====================
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserType, setSelectedUserType] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);
  const [chatTab, setChatTab] = useState('all');
  const [chatUserList, setChatUserList] = useState([]);
  const [loadingChatUsers, setLoadingChatUsers] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // ==================== NOTIFICATIONS STATE ====================
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationSubscriptionRef = useRef(null);

  // ==================== STATISTICS ====================
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

  // ==================== MODAL STATES ====================
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showBulkMessageModal, setShowBulkMessageModal] = useState(false);
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showDeptAssignmentModal, setShowDeptAssignmentModal] = useState(false);
  const [showCourseAssignmentModal, setShowCourseAssignmentModal] = useState(false);
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);

  // ==================== SELECTED ITEMS ====================
  const [selectedStudentForPicture, setSelectedStudentForPicture] = useState(null);
  const [selectedLecturerForDept, setSelectedLecturerForDept] = useState(null);
  const [selectedLecturerForCourses, setSelectedLecturerForCourses] = useState(null);
  const [selectedTimetable, setSelectedTimetable] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [expandedTimetableId, setExpandedTimetableId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [bulkMessageRole, setBulkMessageRole] = useState('');
  const [bulkMessageText, setBulkMessageText] = useState('');

  // ==================== FORM STATES ====================
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "student",
    program_id: "",
    program: "",
    department: "",
    department_code: "",
    program_code: "",
    year_of_study: 1,
    semester: 1,
    intake: "January",
    academic_year: "",
    date_of_birth: "",
    program_duration_years: 4,
    specialization: "",
    google_meet_link: "",
    faculty_id: "",
    department_id: "",
    faculty_name: "",
    department_name: "",
    dean_title: "",
    hod_title: "",
    profile_picture_url: "",
  });

  const [editUser, setEditUser] = useState({
    id: "",
    full_name: "",
    email: "",
    phone: "",
    role: "",
    program: "",
    department: "",
    department_code: "",
    program_code: "",
    year_of_study: 1,
    semester: 1,
    academic_year: "",
    specialization: "",
    google_meet_link: "",
    faculty_id: "",
    department_id: "",
    status: "active",
    profile_picture_url: "",
    contact_email: "",
    contact_phone: "",
  });

  const [newCourse, setNewCourse] = useState({
    course_code: "",
    course_name: "",
    description: "",
    credits: 3,
    year: 1,
    semester: 1,
    program: "",
    faculty: "",
    department: "",
    department_code: "",
    is_core: true,
  });

  const [newExam, setNewExam] = useState({
    course_id: "",
    title: "",
    description: "",
    exam_type: "midterm",
    submission_type: "both",
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    venue: "Main Hall",
    status: "scheduled",
  });

  const [newFinanceRecord, setNewFinanceRecord] = useState({
    student_id: "",
    description: "",
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    status: "pending",
    receipt_number: `REC-${Date.now().toString().slice(-6)}`,
  });

  const [newTimetable, setNewTimetable] = useState({
    program_id: "",
    academic_year: "2024/2025",
    semester: 1,
    year_of_study: 1,
    is_active: true,
  });

  const [newSlot, setNewSlot] = useState({
    course_code: "",
    course_name: "",
    lecturer_id: "",
    day_of_week: 1,
    start_time: "08:00",
    end_time: "10:00",
    room_number: "",
    building: "CS Building",
    slot_type: "lecture",
  });

  const [newProgram, setNewProgram] = useState({
    name: "",
    code: "",
  });

  // ==================== TIMETABLE STATES ====================
  const [timetables, setTimetables] = useState([]);
  const [lecturersList, setLecturersList] = useState([]);

  const normalizeTime = (t) => {
    if (!t) return "08:00";
    return String(t).slice(0, 5);
  };

  // ==================== TOAST ====================
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  // ==================== CHAT FUNCTIONS ====================
  const fetchChatMessages = useCallback(async (userEmail) => {
    if (!profile?.email || !userEmail) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_email.eq.${profile.email},receiver_email.eq.${userEmail}),` +
          `and(sender_email.eq.${userEmail},receiver_email.eq.${profile.email})`
        )
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;

      setChatMessages(data || []);

      const unread = (data || []).filter(
        (msg) => msg.receiver_email === profile.email && !msg.is_read
      );

      if (unread.length > 0) {
        await Promise.all(
          unread.map((msg) =>
            supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id)
          )
        );
        fetchUnreadCount();
        fetchNotifications();
      }

      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } catch (err) {
      console.error('[CHAT] Error fetching messages:', err);
    }
  }, [profile?.email]);

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !selectedUser?.email) {
      showToast('Please enter a message', 'error');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const messageText = newMessage.trim();

    const optimisticMsg = {
      id: tempId,
      sender_email: profile.email,
      sender_role: 'admin',
      sender_name: profile.full_name || 'System Admin',
      receiver_email: selectedUser.email,
      receiver_role: selectedUserType || selectedUser.role || 'user',
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');
    setSendingMessage(true);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 30);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          sender_id: profile?.id || null,
          sender_email: profile.email,
          sender_role: 'admin',
          sender_name: profile.full_name || 'System Admin',
          receiver_email: selectedUser.email,
          receiver_role: selectedUserType || selectedUser.role || 'user',
          message: messageText,
          faculty_id: selectedUser.faculty_id || null,
          department_id: selectedUser.department_id || null,
          is_read: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m))
      );

      fetchChatUsers();
      fetchUnreadCount();
      showToast('Message sent', 'success');
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast('Failed to send message: ' + err.message, 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const openChatWithUser = (user, type) => {
    if (!user?.email) return;

    setSelectedUser({
      email: user.email,
      role: type || user.role || 'user',
      name: user.display_name || user.full_name || user.name || user.email,
      display_name: user.display_name || user.full_name || user.name || user.email,
      faculty_id: user.faculty_id || null,
      department_id: user.department_id || null,
      id: user.id || null,
    });
    setSelectedUserType(type || user.role || 'user');
    setShowChatModal(true);
    setChatMessages([]);
    fetchChatMessages(user.email);
  };

  const openChatFromNotification = (notif) => {
    if (!notif?.sender_email) return;

    markNotificationRead(notif.id);

    const user = {
      email: notif.sender_email,
      role: notif.sender_role || 'user',
      name: notif.sender_name || notif.sender_email,
      display_name: notif.sender_name || notif.sender_email,
      faculty_id: notif.faculty_id || null,
      department_id: notif.department_id || null,
    };

    setSelectedUser(user);
    setSelectedUserType(notif.sender_role || 'user');
    setShowChatModal(true);
    setChatMessages([]);
    fetchChatMessages(notif.sender_email);
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.email) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('receiver_email', profile.email)
        .eq('is_read', false);

      if (error) throw error;
      const count = data?.length || 0;
      setChatUnreadCount(count);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [profile?.email]);

  const fetchChatUsers = useCallback(async () => {
    if (!profile?.email) return;
    
    setLoadingChatUsers(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_email, sender_role, sender_name, receiver_email, receiver_role, message, created_at')
        .or(`sender_email.eq.${profile.email},receiver_email.eq.${profile.email}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userMap = new Map();
      
      data?.forEach(msg => {
        let userEmail, userRole, userName, lastMessage;
        if (msg.sender_email === profile.email) {
          userEmail = msg.receiver_email;
          userRole = msg.receiver_role;
          userName = msg.sender_name;
          lastMessage = msg.message;
        } else {
          userEmail = msg.sender_email;
          userRole = msg.sender_role;
          userName = msg.sender_name;
          lastMessage = msg.message;
        }
        
        if (!userMap.has(userEmail)) {
          userMap.set(userEmail, {
            email: userEmail,
            role: userRole || 'user',
            name: userName || userEmail,
            display_name: userName || userEmail,
            last_message: lastMessage || '',
            last_message_time: msg.created_at
          });
        }
      });

      const users = Array.from(userMap.values());
      setChatUserList(users);
      
    } catch (error) {
      console.error('Error fetching chat users:', error);
    } finally {
      setLoadingChatUsers(false);
    }
  }, [profile?.email]);

  // ==================== NOTIFICATION FUNCTIONS ====================
  const fetchNotifications = useCallback(async () => {
    if (!profile?.email) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', profile.email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read)?.length || 0;
      setUnreadCount(unread);
      setChatUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [profile?.email]);

  const setupNotificationSubscription = () => {
    try {
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel('admin-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_email=eq.${profile?.email}`,
        }, (payload) => {
          fetchNotifications();
          fetchUnreadCount();
          fetchChatUsers();
          showToast(`📩 New message from ${payload.new.sender_name || payload.new.sender_email}`, 'info');
        })
        .subscribe();

      notificationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Notification subscription error:', error);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', id);
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', profile?.email)
        .eq('is_read', false);
      fetchNotifications();
      fetchUnreadCount();
      showToast('✅ All messages marked as read', 'success');
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  };

  // ==================== MESSAGE FUNCTIONS ====================
  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    try {
      const messageData = {
        sender_id: profile.id,
        sender_email: profile.email,
        sender_role: 'admin',
        sender_name: profile.full_name || 'System Admin',
        receiver_id: selectedUser.id,
        receiver_email: selectedUser.email,
        receiver_role: selectedUserType === 'dean' ? 'dean' : 
                       selectedUserType === 'hod' ? 'hod' : 
                       selectedUserType === 'lecturer' ? 'lecturer' : 
                       selectedUserType === 'finance' ? 'finance' : 'student',
        message: messageText.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('chat_messages')
        .insert([messageData]);

      if (error) throw error;

      showToast(`✅ Message sent to ${selectedUser.full_name || selectedUser.email}`, 'success');
      setMessageText('');
      setShowMessageModal(false);
      setSelectedUser(null);
      
      fetchChatUsers();
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('❌ Failed to send message: ' + error.message, 'error');
    }
  };

  const handleSendBulkMessage = async () => {
    if (!bulkMessageText.trim() || !bulkMessageRole) {
      showToast('Please enter a message and select a role', 'error');
      return;
    }

    let users = [];
    if (bulkMessageRole === 'dean') users = deans;
    else if (bulkMessageRole === 'hod') users = hods;
    else if (bulkMessageRole === 'lecturer') users = lecturers;
    else if (bulkMessageRole === 'finance') users = financeOfficers;
    else if (bulkMessageRole === 'student') users = students;

    if (users.length === 0) {
      showToast(`No ${bulkMessageRole}s found to message`, 'error');
      return;
    }

    if (!window.confirm(`Send message to all ${users.length} ${bulkMessageRole}(s)?`)) return;

    try {
      const messages = users.map(user => ({
        sender_id: profile.id,
        sender_email: profile.email,
        sender_role: 'admin',
        sender_name: profile.full_name || 'System Admin',
        receiver_id: user.id,
        receiver_email: user.email,
        receiver_role: bulkMessageRole,
        message: bulkMessageText.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('chat_messages')
        .insert(messages);

      if (error) throw error;

      showToast(`✅ Message sent to all ${users.length} ${bulkMessageRole}(s)!`, 'success');
      setBulkMessageText('');
      setBulkMessageRole('');
      setShowBulkMessageModal(false);
      fetchChatUsers();
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error sending bulk message:', error);
      showToast('❌ Failed to send messages: ' + error.message, 'error');
    }
  };

  // ==================== PROFILE PICTURE FUNCTIONS ====================
  const handleProfilePictureUpdate = async (file, userId, userType) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        showToast('❌ Upload failed: ' + uploadError.message, 'error');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('admin profiles')
        .getPublicUrl(filePath);

      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', userId);

      if (roleUpdateError) {
        console.error('Role update error:', roleUpdateError);
      }

      if (userType === 'lecturer') {
        const { error: updateError } = await supabase
          .from('lecturers')
          .update({ profile_picture_url: publicUrl })
          .eq('id', userId);
        if (updateError) throw updateError;
      } else if (userType === 'finance') {
        const { error: updateError } = await supabase
          .from('finance_officers')
          .update({ profile_picture_url: publicUrl })
          .eq('id', userId);
        if (updateError) throw updateError;
      }

      showToast('✅ Profile picture updated successfully!', 'success');
      
      if (userType === 'lecturer') fetchLecturers();
      else if (userType === 'dean') fetchDeans();
      else if (userType === 'hod') fetchHODs();
      else if (userType === 'finance') fetchFinanceOfficers();
      else if (userType === 'student') fetchStudents();

    } catch (error) {
      console.error('Error updating profile picture:', error);
      showToast('❌ Failed to update profile picture: ' + error.message, 'error');
    }
  };

  // ==================== DATA FETCHING ====================
  const initializeDashboard = async () => {
    try {
      setLoading(prev => ({ ...prev, dashboard: true }));
      await fetchDashboardStats();
      await fetchStudents();
      await fetchLecturers();
      await fetchCourses();
      await fetchAssignments();
      await fetchExams();
      await fetchFinancialRecords();
      await fetchLectures();
      await fetchNotifications();
      await fetchDeans();
      await fetchHODs();
      await fetchFinanceOfficers();
      await fetchChatUsers();
      await fetchUnreadCount();
    } catch (error) {
      console.error("Initialization error:", error);
      showToast("Error loading dashboard: " + error.message, 'error');
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
        .channel("admin-dashboard-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
          fetchStudents();
          fetchDashboardStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "lecturers" }, () => {
          fetchLecturers();
          fetchDashboardStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
          fetchCourses();
          fetchDashboardStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => {
          fetchAssignments();
          fetchDashboardStats();
        })
        .subscribe((status) => {
          setRealtimeConnected(status === "SUBSCRIBED");
        });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.error("Realtime subscription error:", error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const [
        studentsRes,
        lecturersRes,
        coursesRes,
        assignmentsRes,
        examsRes,
        financialRes,
        lecturesRes,
        pendingExams,
        pendingAssignments,
        pendingPayments,
      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("lecturers").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("assignments").select("*", { count: "exact", head: true }),
        supabase.from("examinations").select("*", { count: "exact", head: true }),
        supabase.from("financial_records").select("*", { count: "exact", head: true }),
        supabase.from("lectures").select("*", { count: "exact", head: true }),
        supabase.from("examinations").select("*", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("assignments").select("*", { count: "exact", head: true }).gt("due_date", new Date().toISOString()),
        supabase.from("financial_records").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

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
        attendanceRate: 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase
        .from("students")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      throw error;
    }
  };

  const fetchLecturers = async () => {
    try {
      let query = supabase
        .from("lecturers")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,lecturer_id.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;

      if (!data || data.length === 0) {
        setLecturers([]);
        return;
      }
      
      const lecturersWithDepts = await Promise.all(
        data.map(async (lecturer) => {
          const { data: deptData, error: deptError } = await supabase
            .from("lecturer_departments")
            .select("department_code, department_name")
            .eq("lecturer_id", lecturer.id)
            .eq("is_active", true);

          if (deptError) {
            return {
              ...lecturer,
              lecturer_departments: []
            };
          }

          return {
            ...lecturer,
            lecturer_departments: deptData || []
          };
        })
      );

      setLecturers(lecturersWithDepts);
    } catch (error) {
      console.error("Error fetching lecturers:", error);
      throw error;
    }
  };

  const fetchDeans = async () => {
    try {
      setLoadingDeans(true);
      
      const { data: deansData, error: deansError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "dean")
        .order("created_at", { ascending: false });

      if (deansError) throw deansError;

      if (!deansData || deansData.length === 0) {
        setDeans([]);
        return;
      }

      const facultyIds = deansData.map(d => d.faculty_id).filter(id => id);
      let facultiesMap = {};
      
      if (facultyIds.length > 0) {
        const { data: facultiesData, error: facultiesError } = await supabase
          .from("faculties")
          .select("*")
          .in("id", facultyIds);

        if (!facultiesError && facultiesData) {
          facultiesMap = facultiesData.reduce((acc, f) => {
            acc[f.id] = f;
            return acc;
          }, {});
        }
      }

      const deansWithFaculty = deansData.map(dean => {
        const faculty = dean.faculty_id ? facultiesMap[dean.faculty_id] || null : null;
        return {
          ...dean,
          faculties: faculty,
          display_name: faculty?.dean || (dean.email ? dean.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : dean.email),
          full_name: faculty?.dean || (dean.email ? dean.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : dean.email)
        };
      });

      setDeans(deansWithFaculty);
    } catch (error) {
      console.error("Error fetching deans:", error);
      throw error;
    } finally {
      setLoadingDeans(false);
    }
  };

  const fetchHODs = async () => {
    try {
      setLoadingHODs(true);
      
      const { data: hodsData, error: hodsError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "hod")
        .order("created_at", { ascending: false });

      if (hodsError) throw hodsError;

      if (!hodsData || hodsData.length === 0) {
        setHODs([]);
        return;
      }

      const deptIds = hodsData.map(d => d.department_id).filter(id => id);
      let departmentsMap = {};
      let facultiesMap = {};
      
      if (deptIds.length > 0) {
        const { data: deptsData, error: deptsError } = await supabase
          .from("departments")
          .select("*")
          .in("id", deptIds);

        if (!deptsError && deptsData) {
          departmentsMap = deptsData.reduce((acc, d) => {
            acc[d.id] = d;
            return acc;
          }, {});
          
          const facultyIds = deptsData.map(d => d.faculty_id).filter(id => id);
          if (facultyIds.length > 0) {
            const { data: facsData, error: facsError } = await supabase
              .from("faculties")
              .select("id, faculty_name, faculty_code")
              .in("id", facultyIds);
            
            if (!facsError && facsData) {
              facultiesMap = facsData.reduce((acc, f) => {
                acc[f.id] = f;
                return acc;
              }, {});
            }
          }
        }
      }

      const hodsWithDetails = hodsData.map(hod => {
        const dept = hod.department_id ? departmentsMap[hod.department_id] || null : null;
        return {
          ...hod,
          departments: dept,
          faculties: dept?.faculty_id ? facultiesMap[dept.faculty_id] || null : null,
          display_name: dept?.head_of_department || (hod.email ? hod.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : hod.email),
          full_name: dept?.head_of_department || (hod.email ? hod.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : hod.email)
        };
      });

      setHODs(hodsWithDetails);
    } catch (error) {
      console.error("Error fetching HODs:", error);
      throw error;
    } finally {
      setLoadingHODs(false);
    }
  };

  const fetchFinanceOfficers = async () => {
    try {
      setLoadingFinance(true);
      
      const { data, error } = await supabase
        .from("finance_officers")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setFinanceOfficers([]);
        return;
      }

      const officersWithPics = await Promise.all(
        data.map(async (officer) => {
          let profilePic = null;
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("profile_picture_url")
            .eq("email", officer.email)
            .maybeSingle();
          
          if (!roleError && roleData) {
            profilePic = roleData.profile_picture_url;
          }
          
          return {
            ...officer,
            profile_picture_url: profilePic || null,
            display_name: officer.full_name || officer.email?.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || officer.email,
            full_name: officer.full_name || officer.email?.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || officer.email,
            status: 'active'
          };
        })
      );

      setFinanceOfficers(officersWithPics);
    } catch (error) {
      console.error("Error fetching finance officers:", error);
      throw error;
    } finally {
      setLoadingFinance(false);
    }
  };

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from("courses")
        .select("*")
        .limit(100)
        .order("year")
        .order("semester");

      if (searchTerm) {
        query = query.or(
          `course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      throw error;
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`*, courses (course_code, course_name, department_code), lecturers (full_name)`)
        .limit(100)
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }
  };

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from("examinations")
        .select(`*, courses (course_code, course_name, department_code)`)
        .limit(100)
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      
      setExams(data || []);
    } catch (error) {
      console.error("Error fetching exams:", error);
      throw error;
    }
  };

  const fetchFinancialRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setFinancialRecords(data || []);
    } catch (error) {
      console.error("Error fetching financial records:", error);
      throw error;
    }
  };

  const fetchLectures = async () => {
    try {
      const { data, error } = await supabase
        .from("lectures")
        .select(`*, courses (id, course_code, course_name, department_code), lecturers (id, full_name, email, google_meet_link)`)
        .limit(100)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      
      setLectures(data || []);
    } catch (error) {
      console.error("Error fetching lectures:", error);
      throw error;
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      setPrograms(data || []);
      setProgramsLoading(false);
    } catch (err) {
      console.error("Error loading programs:", err);
      setProgramsLoading(false);
    }
  };

  const fetchLecturersList = async () => {
    try {
      const { data, error } = await supabase
        .from("lecturers")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      setLecturersList(data || []);
    } catch (err) {
      console.error("Error loading lecturers:", err);
    }
  };

  const fetchProgramTimetables = async () => {
    try {
      const { data, error } = await supabase
        .from("program_timetables")
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
        .order("academic_year", { ascending: false })
        .order("year_of_study");
      if (error) throw error;
      setTimetables(data || []);
    } catch (err) {
      console.error("Error loading timetables:", err);
      alert("Failed to load timetables");
    }
  };

  const fetchFaculties = async () => {
    try {
      const { data, error } = await supabase
        .from("faculties")
        .select("*")
        .order("faculty_name");
      if (error) throw error;
      setFaculties(data || []);
    } catch (err) {
      console.error("Error loading faculties:", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("department_name");
      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  };

  // ==================== EDIT FUNCTIONS ====================
  const openEditModal = (user, type) => {
    let facultyId = '';
    let departmentId = '';
    let contactEmail = '';
    let contactPhone = '';
    
    if (type === 'dean') {
      facultyId = user.faculty_id || '';
      contactEmail = user.faculties?.contact_email || user.contact_email || '';
      contactPhone = user.faculties?.contact_phone || user.contact_phone || '';
    } else if (type === 'hod') {
      departmentId = user.department_id || '';
      contactEmail = user.departments?.contact_email || user.contact_email || '';
      contactPhone = user.departments?.contact_phone || user.contact_phone || '';
    }
    
    setEditUser({
      id: user.id,
      full_name: user.full_name || user.display_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: type,
      program: user.program || '',
      department: user.department || user.departments?.department_name || '',
      department_code: user.department_code || user.departments?.department_code || '',
      program_code: user.program_code || '',
      year_of_study: user.year_of_study || 1,
      semester: user.semester || 1,
      academic_year: user.academic_year || '',
      specialization: user.specialization || '',
      google_meet_link: user.google_meet_link || '',
      faculty_id: facultyId,
      department_id: departmentId,
      status: user.status || 'active',
      profile_picture_url: user.profile_picture_url || '',
      contact_email: contactEmail,
      contact_phone: contactPhone,
    });
    setShowEditModal(true);
  };

  const handleEditUser = async () => {
    try {
      const updates = {
        full_name: editUser.full_name,
        phone: editUser.phone,
        status: editUser.status,
      };

      let tableName = '';
      let idField = 'id';

      if (editUser.role === 'student') {
        tableName = 'students';
        updates.program = editUser.program;
        updates.department_code = editUser.department_code;
        updates.program_code = editUser.program_code;
        updates.year_of_study = parseInt(editUser.year_of_study);
        updates.semester = parseInt(editUser.semester);
        updates.academic_year = editUser.academic_year;
        
        const { error } = await supabase
          .from(tableName)
          .update(updates)
          .eq(idField, editUser.id);

        if (error) throw error;
        
        showToast('✅ Student updated successfully!', 'success');
        setShowEditModal(false);
        fetchStudents();
        
      } else if (editUser.role === 'lecturer') {
        tableName = 'lecturers';
        updates.department = editUser.department;
        updates.specialization = editUser.specialization;
        updates.google_meet_link = editUser.google_meet_link;
        
        const { error } = await supabase
          .from(tableName)
          .update(updates)
          .eq(idField, editUser.id);

        if (error) throw error;
        
        showToast('✅ Lecturer updated successfully!', 'success');
        setShowEditModal(false);
        fetchLecturers();
        
      } else if (editUser.role === 'finance') {
        const financeUpdates = {
          full_name: editUser.full_name,
          phone: editUser.phone,
        };
        
        const { error } = await supabase
          .from('finance_officers')
          .update(financeUpdates)
          .eq('id', editUser.id);

        if (error) throw error;
        
        showToast('✅ Finance Officer updated successfully!', 'success');
        setShowEditModal(false);
        fetchFinanceOfficers();
        return;
        
      } else if (editUser.role === 'dean') {
        const deanUpdates = {
          dean: editUser.full_name,
          contact_email: editUser.contact_email || null,
          contact_phone: editUser.contact_phone || null,
        };
        
        const { error: facultyUpdateError } = await supabase
          .from('faculties')
          .update(deanUpdates)
          .eq('id', editUser.faculty_id);
        
        if (facultyUpdateError) {
          console.error('❌ Faculty update error:', facultyUpdateError);
          showToast('❌ Error updating dean: ' + facultyUpdateError.message, 'error');
          return;
        }
        
        showToast('✅ Dean updated successfully!', 'success');
        setShowEditModal(false);
        fetchDeans();
        return;
        
      } else if (editUser.role === 'hod') {
        const hodUpdates = {
          head_of_department: editUser.full_name,
          contact_email: editUser.contact_email || null,
          contact_phone: editUser.contact_phone || null,
        };
        
        const { error: deptUpdateError } = await supabase
          .from('departments')
          .update(hodUpdates)
          .eq('id', editUser.department_id);
        
        if (deptUpdateError) {
          console.error('❌ Department update error:', deptUpdateError);
          showToast('❌ Error updating HOD: ' + deptUpdateError.message, 'error');
          return;
        }
        
        showToast('✅ HOD updated successfully!', 'success');
        setShowEditModal(false);
        fetchHODs();
        return;
      }

    } catch (error) {
      console.error('Error updating user:', error);
      showToast('❌ Error updating user: ' + error.message, 'error');
    }
  };

  // ==================== STUDENT MANAGEMENT ====================
  const handleUpdateStudentStatus = async (studentId, status) => {
    try {
      const { error } = await supabase
        .from("students")
        .update({ status })
        .eq("id", studentId);
      if (error) throw error;
      fetchStudents();
      fetchDashboardStats();
      showToast(`Student status updated to ${status}`, 'success');
    } catch (error) {
      console.error("Error updating student:", error);
      showToast("Error updating student: " + error.message, 'error');
    }
  };

  const handleStudentPictureUpdate = (newPictureUrl) => {
    setStudents(prevStudents =>
      prevStudents.map(s =>
        s.id === selectedStudentForPicture?.id
          ? { ...s, profile_picture_url: newPictureUrl }
          : s
      )
    );
    fetchStudents();
  };

  // ==================== LECTURER RENDER HELPERS ====================
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

  // ==================== COURSE MANAGEMENT ====================
  const handleAddCourse = async () => {
    try {
      const { error } = await supabase.from("courses").insert([newCourse]);
      if (error) throw error;

      setShowCourseModal(false);
      setNewCourse({
        course_code: "",
        course_name: "",
        description: "",
        credits: 3,
        year: 1,
        semester: 1,
        program: "",
        faculty: "",
        department: "",
        department_code: "",
        is_core: true,
      });

      fetchCourses();
      fetchDashboardStats();
      showToast("Course added successfully!", 'success');
    } catch (error) {
      console.error("Error adding course:", error);
      showToast("Error adding course: " + error.message, 'error');
    }
  };

  const handleToggleCourseActive = async (courseId, isActive) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_active: !isActive })
        .eq("id", courseId);
      if (error) throw error;
      fetchCourses();
      showToast(`Course ${!isActive ? "activated" : "deactivated"}!`, 'success');
    } catch (error) {
      console.error("Error updating course:", error);
      showToast("Error updating course: " + error.message, 'error');
    }
  };

  // ==================== EXAM MANAGEMENT ====================
  const handleAddExam = async () => {
    try {
      const start = new Date(newExam.start_time);
      const end = new Date(newExam.end_time);
      const durationMinutes = Math.round((end - start) / 60000);

      if (durationMinutes <= 0) {
        showToast("End time must be after start time", 'error');
        return;
      }

      const examData = {
        ...newExam,
        status: "published",
        duration_minutes: durationMinutes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("examinations").insert([examData]);
      if (error) throw error;

      setShowExamsModal(false);
      setNewExam({
        course_id: "",
        title: "",
        description: "",
        exam_type: "midterm",
        submission_type: "both",
        start_time: "",
        end_time: "",
        total_marks: 100,
        venue: "",
        status: "published",
      });

      fetchExams();
      fetchDashboardStats();
      showToast("Exam scheduled successfully!", 'success');
    } catch (error) {
      console.error("Error scheduling exam:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;

    try {
      const { error } = await supabase
        .from("examinations")
        .delete()
        .eq("id", examId);
      if (error) throw error;
      fetchExams();
      fetchDashboardStats();
      showToast("Exam deleted successfully!", 'success');
    } catch (error) {
      console.error("Error deleting exam:", error);
      showToast("Error deleting exam: " + error.message, 'error');
    }
  };

  const getAdminExamStatus = (exam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    if (now >= start && now <= end) return "active";
    if (now < start) return "upcoming";
    return "ended";
  };

  const getTimeUntilStart = (startTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const diffSeconds = Math.floor((start - now) / 1000);

    if (diffSeconds <= 0) return "Started";
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // ==================== FINANCE MANAGEMENT ====================
  const handleAddFinanceRecord = async () => {
    try {
      const { error } = await supabase
        .from("financial_records")
        .insert([newFinanceRecord]);
      if (error) throw error;

      setShowFinanceModal(false);
      setNewFinanceRecord({
        student_id: "",
        description: "",
        amount: 0,
        payment_date: new Date().toISOString().slice(0, 10),
        status: "pending",
        receipt_number: `REC-${Date.now().toString().slice(-6)}`,
      });

      fetchFinancialRecords();
      fetchDashboardStats();
      showToast("Financial record added successfully!", 'success');
    } catch (error) {
      console.error("Error adding financial record:", error);
      showToast("Error adding financial record: " + error.message, 'error');
    }
  };

  // ==================== USER MANAGEMENT ====================
  const handleAddStudent = async () => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email.trim())) {
        showToast("Please enter a valid email address", 'error');
        return;
      }

      if (!newUser.program?.trim()) {
        showToast("Please enter the Program name.", 'error');
        return;
      }
      if (!newUser.department_code?.trim()) {
        showToast("Please enter the Department Code (e.g., ENG, SCT)", 'error');
        return;
      }
      if (!newUser.program_code?.trim()) {
        showToast("Please enter the Program Code (e.g., BSCE, BSCS)", 'error');
        return;
      }

      const password = "Default123!";
      const departmentCode = newUser.department_code.trim().toUpperCase();

      const { data: existingStudents, error: fetchError } = await supabase
        .from("students")
        .select("student_id")
        .ilike("student_id", `${departmentCode}-%`)
        .order("student_id", { ascending: false });

      if (fetchError) throw fetchError;

      let maxSequence = 0;
      if (existingStudents && existingStudents.length > 0) {
        existingStudents.forEach((student) => {
          const studentId = student.student_id;
          if (studentId && studentId.startsWith(`${departmentCode}-`)) {
            const parts = studentId.split("-");
            if (parts.length === 2) {
              const sequencePart = parts[1];
              if (/^\d+$/.test(sequencePart)) {
                const sequenceNum = parseInt(sequencePart, 10);
                if (!isNaN(sequenceNum) && sequenceNum > maxSequence) {
                  maxSequence = sequenceNum;
                }
              }
            }
          }
        });
      }

      const nextSequenceNumber = maxSequence + 1;
      const studentId = `${departmentCode}-${nextSequenceNumber}`;

      const profileData = {
        student_id: studentId,
        registration_number: studentId,
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
        status: "active",
        program_id: newUser.program_id,
        program_code: newUser.program_code.trim().toUpperCase(),
        department: newUser.department.trim(),
        department_code: departmentCode,
        program_duration_years: parseInt(newUser.program_duration_years),
        program_total_semesters: parseInt(newUser.program_duration_years) * 2,
        created_at: new Date().toISOString(),
      };

      const { data: existingProfile, error: checkError } = await supabase
        .from("students")
        .select("id, email, student_id")
        .or(`email.eq.${profileData.email},student_id.eq.${studentId}`)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        throw new Error("Error checking for existing records");
      }
      if (existingProfile) {
        if (existingProfile.email === profileData.email) {
          throw new Error("This email already exists as a student");
        }
        if (existingProfile.student_id === studentId) {
          throw new Error("This Student ID already exists");
        }
      }

      const { data: tableData, error: tableError } = await supabase
        .from("students")
        .insert([profileData])
        .select()
        .single();

      if (tableError) {
        if (tableError.code === "23505") {
          throw new Error("Email or ID already exists!");
        }
        throw new Error(tableError.message);
      }

      if (tableData?.id) {
        try {
          const actualProgramCode = tableData.program_code || newUser.program_code.trim().toUpperCase();
          const actualDepartmentCode = tableData.department_code || newUser.department_code.trim().toUpperCase();

          const { data: startingCourses, error: courseError } = await supabase
            .from("courses")
            .select("id")
            .eq("department_code", actualDepartmentCode)
            .eq("program_code", actualProgramCode)
            .eq("year", newUser.year_of_study || 1)
            .eq("semester", newUser.semester || 1)
            .eq("is_active", true);

          if (!courseError && startingCourses && startingCourses.length > 0) {
            const enrollments = startingCourses.map((course) => ({
              student_id: tableData.id,
              course_id: course.id,
              program_code: actualProgramCode,
              status: "enrolled",
              enrollment_date: new Date().toISOString().split("T")[0],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));

            await supabase
              .from("student_courses")
              .upsert(enrollments, {
                onConflict: "student_id,course_id",
                ignoreDuplicates: true,
              });
          }
        } catch (err) {
          console.warn("Auto-enroll error:", err);
        }
      }

      setShowUserModal(false);
      resetUserForm();
      showToast(`✅ Student "${newUser.full_name}" added successfully!`, 'success');
      await fetchStudents();
      await fetchDashboardStats();
      
    } catch (error) {
      showToast(`Error: ${error.message || "Something went wrong"}`, 'error');
      console.error("Add student error:", error);
    }
  };

  const handleAddLecturer = async () => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email.trim())) {
        showToast("Please enter a valid email address", 'error');
        return;
      }

      if (!newUser.full_name.trim()) {
        showToast("Please enter the lecturer's full name", 'error');
        return;
      }

      const password = "Default123!";

      const { data: existingLecturers, error: fetchLecturersError } = await supabase
        .from("lecturers")
        .select("lecturer_id")
        .like("lecturer_id", "LEC-%")
        .order("lecturer_id", { ascending: false })
        .limit(1);

      if (fetchLecturersError) throw fetchLecturersError;

      let lecturerSequence = 1;
      if (existingLecturers && existingLecturers.length > 0) {
        const latestId = existingLecturers[0].lecturer_id;
        const idParts = latestId.split("-");
        if (idParts.length === 2) {
          const existingSequence = idParts[1];
          lecturerSequence = parseInt(existingSequence, 16) + 1;
        }
      }

      const lecturerSequenceHex = lecturerSequence.toString(16).padStart(6, "0").toUpperCase();
      const lecturerId = `LEC-${lecturerSequenceHex}`;

      const profileData = {
        lecturer_id: lecturerId,
        full_name: newUser.full_name.trim(),
        email: newUser.email.toLowerCase().trim(),
        password_hash: password,
        phone: newUser.phone?.trim() || null,
        department: newUser.department?.trim() || null,
        specialization: newUser.specialization?.trim() || null,
        google_meet_link: newUser.google_meet_link?.trim() || null,
        status: "active",
        created_at: new Date().toISOString(),
      };

      const { data: existingLecturer, error: checkLecturerError } = await supabase
        .from("lecturers")
        .select("id, email, lecturer_id")
        .or(`email.eq.${profileData.email},lecturer_id.eq.${lecturerId}`)
        .maybeSingle();

      if (checkLecturerError && checkLecturerError.code !== "PGRST116") {
        throw new Error("Error checking for existing lecturer records");
      }
      if (existingLecturer) {
        if (existingLecturer.email === profileData.email) {
          throw new Error("This email already exists as a lecturer");
        }
        if (existingLecturer.lecturer_id === lecturerId) {
          throw new Error("This Lecturer ID already exists");
        }
      }

      await supabase
        .from('user_roles')
        .insert([{
          email: profileData.email,
          role: 'lecturer',
          table_id: null,
          password_hash: password,
          created_at: new Date().toISOString(),
        }]);

      const { error: tableError } = await supabase
        .from("lecturers")
        .insert([profileData]);

      if (tableError) {
        if (tableError.code === "23505") {
          throw new Error("Email or ID already exists!");
        }
        throw new Error(tableError.message);
      }

      setShowUserModal(false);
      resetUserForm();
      showToast(`✅ Lecturer "${newUser.full_name}" added successfully!`, 'success');
      await fetchLecturers();
      await fetchDashboardStats();
      
    } catch (error) {
      showToast(`Error: ${error.message || "Something went wrong"}`, 'error');
      console.error("Add lecturer error:", error);
    }
  };

  const handleAddDean = async () => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email.trim())) {
        showToast("Please enter a valid email address", 'error');
        return;
      }

      if (!newUser.faculty_id) {
        showToast("Please select a faculty for the Dean", 'error');
        return;
      }

      if (!newUser.full_name.trim()) {
        showToast("Please enter the Dean's full name", 'error');
        return;
      }

      const password = "Default123!";

      const { data: existingDean, error: checkDeanError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("faculty_id", newUser.faculty_id)
        .eq("role", "dean")
        .maybeSingle();

      if (checkDeanError && checkDeanError.code !== "PGRST116") {
        throw checkDeanError;
      }

      if (existingDean) {
        showToast("This faculty already has a Dean assigned!", 'error');
        return;
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          email: newUser.email.toLowerCase().trim(),
          role: "dean",
          table_id: newUser.faculty_id,
          faculty_id: newUser.faculty_id,
          password_hash: password,
          created_at: new Date().toISOString(),
        }]);

      if (roleError) throw roleError;

      await supabase
        .from("faculties")
        .update({ dean: newUser.full_name.trim() })
        .eq("id", newUser.faculty_id);

      showToast(`✅ Dean "${newUser.full_name}" added successfully!`, 'success');
      
      resetUserForm();
      setShowUserModal(false);
      await fetchDeans();
      await fetchDashboardStats();
      
    } catch (error) {
      showToast(`Error: ${error.message || "Something went wrong"}`, 'error');
      console.error("Add dean error:", error);
    }
  };

  const handleAddHOD = async () => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email.trim())) {
        showToast("Please enter a valid email address", 'error');
        return;
      }

      if (!newUser.department_id) {
        showToast("Please select a department for the HOD", 'error');
        return;
      }

      if (!newUser.full_name.trim()) {
        showToast("Please enter the HOD's full name", 'error');
        return;
      }

      const password = "Default123!";

      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("faculty_id")
        .eq("id", newUser.department_id)
        .single();

      if (deptError) throw deptError;

      const { data: existingHOD, error: checkHODError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("department_id", newUser.department_id)
        .eq("role", "hod")
        .maybeSingle();

      if (checkHODError && checkHODError.code !== "PGRST116") {
        throw checkHODError;
      }

      if (existingHOD) {
        showToast("This department already has an HOD assigned!", 'error');
        return;
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          email: newUser.email.toLowerCase().trim(),
          role: "hod",
          table_id: newUser.department_id,
          faculty_id: deptData.faculty_id || null,
          department_id: newUser.department_id,
          password_hash: password,
          created_at: new Date().toISOString(),
        }]);

      if (roleError) throw roleError;

      await supabase
        .from("departments")
        .update({ head_of_department: newUser.full_name.trim() })
        .eq("id", newUser.department_id);

      showToast(`✅ HOD "${newUser.full_name}" added successfully!`, 'success');
      
      resetUserForm();
      setShowUserModal(false);
      await fetchHODs();
      await fetchDashboardStats();
      
    } catch (error) {
      showToast(`Error: ${error.message || "Something went wrong"}`, 'error');
      console.error("Add HOD error:", error);
    }
  };

  const handleAddFinance = async () => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUser.email.trim())) {
        showToast("Please enter a valid email address", 'error');
        return;
      }

      if (!newUser.full_name.trim()) {
        showToast("Please enter the finance officer's full name", 'error');
        return;
      }

      const password = "Default123!";

      const { data: existingFinance, error: checkFinanceError } = await supabase
        .from("finance_officers")
        .select("id")
        .eq("email", newUser.email.toLowerCase().trim())
        .maybeSingle();

      if (checkFinanceError && checkFinanceError.code !== "PGRST116") {
        throw checkFinanceError;
      }

      if (existingFinance) {
        showToast("This email already exists as a finance officer!", 'error');
        return;
      }

      const profileData = {
        full_name: newUser.full_name.trim(),
        email: newUser.email.toLowerCase().trim(),
        password_hash: password,
        phone: newUser.phone?.trim() || null,
        created_at: new Date().toISOString(),
      };

      const { data: tableData, error: tableError } = await supabase
        .from("finance_officers")
        .insert([profileData])
        .select()
        .single();

      if (tableError) {
        if (tableError.code === "23505") {
          throw new Error("Email already exists!");
        }
        throw new Error(tableError.message);
      }

      await supabase
        .from('user_roles')
        .insert([{
          email: newUser.email.toLowerCase().trim(),
          role: 'finance',
          table_id: tableData.id,
          password_hash: password,
          created_at: new Date().toISOString(),
        }]);

      showToast(`✅ Finance Officer "${newUser.full_name}" added successfully!`, 'success');
      
      resetUserForm();
      setShowUserModal(false);
      await fetchFinanceOfficers();
      await fetchDashboardStats();
      
    } catch (error) {
      showToast(`Error: ${error.message || "Something went wrong"}`, 'error');
      console.error("Add finance officer error:", error);
    }
  };

  const resetUserForm = () => {
    setNewUser({
      full_name: "",
      email: "",
      phone: "",
      role: "student",
      program_id: "",
      program: "",
      department: "",
      department_code: "",
      program_code: "",
      year_of_study: 1,
      semester: 1,
      intake: "January",
      academic_year: "",
      date_of_birth: "",
      program_duration_years: 4,
      specialization: "",
      google_meet_link: "",
      faculty_id: "",
      department_id: "",
      faculty_name: "",
      department_name: "",
      dean_title: "",
      hod_title: "",
      profile_picture_url: "",
    });
  };

  // ==================== TIMETABLE MANAGEMENT ====================
  const handleSaveTimetable = async () => {
    if (!newTimetable.program_id) {
      showToast("Please select a program", 'error');
      return;
    }

    try {
      if (selectedTimetable) {
        const { error } = await supabase
          .from("program_timetables")
          .update({
            academic_year: newTimetable.academic_year,
            semester: newTimetable.semester,
            year_of_study: newTimetable.year_of_study,
            is_active: newTimetable.is_active,
          })
          .eq("id", selectedTimetable.id);

        if (error) throw error;
        showToast("Timetable updated successfully!", 'success');
      } else {
        const { data: existing, error: checkError } = await supabase
          .from("program_timetables")
          .select("id")
          .eq("program_id", newTimetable.program_id)
          .eq("academic_year", newTimetable.academic_year)
          .eq("semester", newTimetable.semester)
          .eq("year_of_study", newTimetable.year_of_study)
          .limit(1);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
          if (window.confirm("A timetable already exists for this combination. Activate the existing one?")) {
            const { error: activateError } = await supabase
              .from("program_timetables")
              .update({ is_active: true })
              .eq("id", existing[0].id);

            if (activateError) throw activateError;
            showToast("Existing timetable reactivated!", 'success');
          } else {
            return;
          }
        } else {
          const { error } = await supabase.from("program_timetables").insert([{
            program_id: newTimetable.program_id,
            academic_year: newTimetable.academic_year,
            semester: newTimetable.semester,
            year_of_study: newTimetable.year_of_study,
            is_active: true,
          }]);

          if (error) throw error;
          showToast("New timetable created successfully!", 'success');
        }
      }

      setShowTimetableModal(false);
      setSelectedTimetable(null);
      await fetchProgramTimetables();
    } catch (err) {
      console.error("Error saving timetable:", err);
      showToast("Error saving timetable: " + err.message, 'error');
    }
  };

  const handleSaveSlot = async () => {
    if (!newSlot.course_code.trim() || !newSlot.course_name.trim()) {
      showToast("Please enter both Course Code and Course Name", "error");
      return;
    }

    if (!selectedTimetable?.id) {
      showToast("No timetable selected", "error");
      return;
    }

    try {
      const payload = {
        course_code: newSlot.course_code.trim(),
        course_name: newSlot.course_name.trim(),
        lecturer_id: newSlot.lecturer_id || null,
        day_of_week: parseInt(newSlot.day_of_week, 10),
        start_time: normalizeTime(newSlot.start_time),
        end_time: normalizeTime(newSlot.end_time),
        room_number: newSlot.room_number?.trim() || null,
        building: newSlot.building?.trim() || null,
        slot_type: newSlot.slot_type || "lecture",
        is_active: true,
      };

      if (editingSlot) {
        const { error } = await supabase
          .from("program_timetable_slots")
          .update(payload)
          .eq("id", editingSlot.id);

        if (error) throw error;
        showToast("Slot updated successfully!", "success");
      } else {
        const { error } = await supabase
          .from("program_timetable_slots")
          .insert([
            {
              ...payload,
              program_timetable_id: selectedTimetable.id,
            },
          ]);

        if (error) throw error;
        showToast("New slot added successfully!", "success");
      }

      setShowSlotModal(false);
      setEditingSlot(null);
      setNewSlot({
        course_code: "",
        course_name: "",
        lecturer_id: "",
        day_of_week: 1,
        start_time: "08:00",
        end_time: "10:00",
        room_number: "",
        building: "CS Building",
        slot_type: "lecture",
      });

      await fetchProgramTimetables();
    } catch (err) {
      console.error("Error saving slot:", err);
      showToast("Failed to save slot: " + err.message, "error");
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!slotId) {
      showToast("Error: No slot selected for deletion", "error");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this time slot? This cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("program_timetable_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;
      showToast("Time slot deleted successfully!", "success");
      await fetchProgramTimetables();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Failed to delete slot: " + err.message, "error");
    }
  };

  // ==================== PROGRAM MANAGEMENT ====================
  const handleSaveProgram = async () => {
    if (!newProgram.name.trim() || !newProgram.code.trim()) {
      showToast("Both name and code are required", 'error');
      return;
    }

    try {
      if (editingProgram) {
        const { error } = await supabase
          .from("programs")
          .update({
            name: newProgram.name.trim(),
            code: newProgram.code.trim().toUpperCase(),
          })
          .eq("id", editingProgram.id);
        if (error) throw error;
        showToast("Program updated successfully!", 'success');
      } else {
        const { error } = await supabase.from("programs").insert([{
          name: newProgram.name.trim(),
          code: newProgram.code.trim().toUpperCase(),
        }]);
        if (error) {
          if (error.code === "23505") {
            showToast("A program with this code already exists!", 'error');
          } else {
            throw error;
          }
          return;
        }
        showToast("Program added successfully!", 'success');
      }

      setShowProgramModal(false);
      setEditingProgram(null);
      setNewProgram({ name: "", code: "" });
      fetchPrograms();
    } catch (err) {
      showToast("Error saving program: " + err.message, 'error');
    }
  };

  const handleDeleteProgram = async (programId, programName) => {
    if (!window.confirm(`Delete program "${programName}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from("programs")
        .delete()
        .eq("id", programId);
      if (error) throw error;
      showToast("Program deleted successfully", 'success');
      fetchPrograms();
    } catch (err) {
      showToast("Failed to delete program: " + err.message, 'error');
    }
  };

  // ==================== COURSE GRID RENDER ====================
  const renderCoursesGrid = () => {
    return (
      <div className="courses-grid">
        {courses.map((course) => (
          <div key={course.id} className="course-card">
            <div className="course-header">
              <h3>{course.course_code}</h3>
              <div className="course-header-right">
                <span className="dept-badge">{course.department_code || course.department || "N/A"}</span>
                <span className={`course-status ${course.is_active ? "active" : "inactive"}`}>
                  {course.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <h4>{course.course_name}</h4>
            <p className="course-description">{course.description || "No description"}</p>
            <div className="course-details">
              <span>Year {course.year} - Semester {course.semester}</span>
              <span>{course.credits} Credits</span>
              <span>{course.program}</span>
            </div>
            <div className="course-actions">
              <button
                className="course-btn"
                onClick={() => handleToggleCourseActive(course.id, course.is_active)}
              >
                {course.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ==================== FINANCE OFFICERS TABLE RENDER ====================
  const renderFinanceOfficersTable = () => {
    return (
      <div className="table-container">
        {loadingFinance ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading finance officers...</p>
          </div>
        ) : financeOfficers.length === 0 ? (
          <div className="empty-state">
            <p>No finance officers found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {financeOfficers.map((officer) => (
                <tr key={officer.id}>
                  <td>
                    <div
                      style={{
                        width: "35px",
                        height: "35px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        cursor: "pointer",
                        border: "2px solid #ddd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#f0f0f0",
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            await handleProfilePictureUpdate(file, officer.id, 'finance');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {officer.profile_picture_url ? (
                        <img
                          src={officer.profile_picture_url}
                          alt={officer.display_name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", color: "#666" }}>
                          {officer.display_name?.[0]?.toUpperCase() || "👤"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><strong>{officer.display_name || officer.full_name}</strong></td>
                  <td>{officer.email}</td>
                  <td>{officer.phone || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${officer.status || "active"}`}>
                      {officer.status || "active"}
                    </span>
                  </td>
                  <td>{officer.created_at ? new Date(officer.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => openEditModal(officer, 'finance')}>✏️</button>
                      <button className="action-btn message" onClick={() => openChatWithUser(officer, 'finance')}>💬</button>
                      <button className="action-btn delete" onClick={() => {
                        if (window.confirm(`Remove finance officer ${officer.email}?`)) {
                          supabase.from("finance_officers").delete().eq("id", officer.id)
                            .then(() => {
                              supabase.from("user_roles").delete().eq("email", officer.email).eq("role", "finance");
                              showToast("Finance officer removed successfully!", 'success');
                              fetchFinanceOfficers();
                              fetchDashboardStats();
                            })
                            .catch(err => showToast("Error: " + err.message, 'error'));
                        }
                      }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // ==================== CHAT MODAL RENDER ====================
  const renderChatModal = () => {
    if (!showChatModal || !selectedUser) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowChatModal(false)}>
        <div
          className="modal chat-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '620px', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8f9fa',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                💬 {selectedUserType?.toUpperCase() || 'USER'}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#555' }}>
                {selectedUser.display_name || selectedUser.name || selectedUser.email}
              </p>
            </div>
            <button
              onClick={() => setShowChatModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#666',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              background: '#f0f2f5',
              minHeight: '320px',
            }}
          >
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#999' }}>
                <div style={{ fontSize: '42px', marginBottom: '8px' }}>💬</div>
                <p>No messages yet. Say hello!</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender_role === 'admin' || msg.sender_email === profile?.email;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? '#667eea' : '#ffffff',
                        color: isMe ? '#fff' : '#222',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {!isMe && (
                        <div style={{ fontSize: '11px', opacity: 0.75, marginBottom: '3px' }}>
                          {msg.sender_name || msg.sender_email}
                        </div>
                      )}
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.message}
                      </p>
                      <div
                        style={{
                          fontSize: '10px',
                          opacity: 0.7,
                          marginTop: '4px',
                          textAlign: 'right',
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '10px',
              background: '#fff',
            }}
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={sendingMessage}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: '22px',
                border: '1px solid #ddd',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={sendingMessage || !newMessage.trim()}
              style={{
                padding: '0 22px',
                borderRadius: '22px',
                border: 'none',
                background: sendingMessage || !newMessage.trim() ? '#bbb' : '#667eea',
                color: 'white',
                fontWeight: 600,
                cursor: sendingMessage || !newMessage.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {sendingMessage ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==================== TOAST HELPER ====================
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'success' });
  };

  // ==================== LOGOUT ====================
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login");
    }
  };

  // ==================== REAL-TIME CHAT ====================
  useEffect(() => {
    if (!showChatModal || !selectedUser?.email || !profile?.email) return;

    const channel = supabase
      .channel(`admin-chat-${profile.email}-${selectedUser.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;

          const isThisConversation =
            (msg.sender_email === profile.email && msg.receiver_email === selectedUser.email) ||
            (msg.sender_email === selectedUser.email && msg.receiver_email === profile.email);

          if (!isThisConversation) return;

          if (payload.eventType === 'INSERT') {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              const cleaned = prev.filter(
                (m) => !(typeof m.id === 'string' && m.id.startsWith('temp-') && m.message === msg.message)
              );
              return [...cleaned, msg];
            });

            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);

            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchChatMessages(selectedUser.email);
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [showChatModal, selectedUser?.email, profile?.email, fetchChatMessages]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (!authLoading && profile) {
      initializeDashboard();
      setupRealtimeSubscription();
      setupNotificationSubscription();
      fetchPrograms();
      fetchLecturersList();
      fetchProgramTimetables();
      fetchFaculties();
      fetchDepartments();
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }
    };
  }, [authLoading, profile]);

  // ==================== LOADING STATES ====================
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

  if (isLecturer) {
    return <LecturerDashboard />;
  }

  if (isFinance) {
    return <FinanceDashboard profile={profile} signOut={signOut} />;
  }

  // ==================== MAIN ADMIN RENDER ====================
  return (
    <div className="admin-dashboard">
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
          <button onClick={hideToast}>✕</button>
        </div>
      )}

      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo">SYSTEM ADMIN PORTAL</h1>
            <p className="tagline">University Management System</p>
            <div className="realtime-indicator">
              <span className={`realtime-dot ${realtimeConnected ? "connected" : "disconnected"}`}></span>
              <span>Realtime: {realtimeConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>

          <div className="user-section">
            <div className="notification-wrapper" style={{ position: 'relative', marginRight: '15px' }}>
              <button
                className="notification-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '5px',
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ff1744',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown" style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  width: '350px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  zIndex: '9999',
                }}>
                  <div className="notification-header" style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <h4 style={{ margin: 0 }}>Notifications ({unreadCount} unread)</h4>
                    {unreadCount > 0 && (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#667eea',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        onClick={markAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                        <span style={{ fontSize: '36px', display: 'block' }}>📭</span>
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f0f0f0',
                            cursor: 'pointer',
                            background: notif.is_read ? 'white' : '#f0f7ff',
                            transition: 'background 0.2s',
                          }}
                          onClick={() => openChatFromNotification(notif)}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = notif.is_read ? 'white' : '#f0f7ff'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: '13px', display: 'block' }}>
                                💬 {notif.sender_name || notif.sender_email}
                              </strong>
                              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555' }}>
                                {notif.message}
                              </p>
                              <small style={{ color: '#999', fontSize: '10px' }}>
                                {new Date(notif.created_at).toLocaleString()}
                              </small>
                            </div>
                            {!notif.is_read && (
                              <span style={{
                                width: '8px',
                                height: '8px',
                                background: '#667eea',
                                borderRadius: '50%',
                                flexShrink: 0,
                                marginTop: '4px',
                              }}></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-info">
              <div className="avatar admin">
                {profile.full_name?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="user-name">{profile.full_name || profile.email}</p>
                <p className="user-role">
                  <span className="role-badge admin">SYSTEM ADMIN</span>
                </p>
              </div>
            </div>
            <button className="logout-button" onClick={() => setShowLogoutModal(true)}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>📊 Dashboard</button>
        <button className={`nav-item ${activeTab === "students" ? "active" : ""}`} onClick={() => setActiveTab("students")}>👥 Students</button>
        <button className={`nav-item ${activeTab === "lecturers" ? "active" : ""}`} onClick={() => setActiveTab("lecturers")}>👨‍🏫 Lecturers</button>
        <button className={`nav-item ${activeTab === "deans" ? "active" : ""}`} onClick={() => setActiveTab("deans")}>👨‍🎓 Deans</button>
        <button className={`nav-item ${activeTab === "hods" ? "active" : ""}`} onClick={() => setActiveTab("hods")}>🏢 HODs</button>
        <button className={`nav-item ${activeTab === "finance" ? "active" : ""}`} onClick={() => setActiveTab("finance")}>💰 Finance</button>
        <button className={`nav-item ${activeTab === "courses" ? "active" : ""}`} onClick={() => setActiveTab("courses")}>📖 Courses</button>
        <button className={`nav-item ${activeTab === "exams" ? "active" : ""}`} onClick={() => setActiveTab("exams")}>🎯 Exams</button>
        <button className={`nav-item ${activeTab === "attendance" ? "active" : ""}`} onClick={() => setActiveTab("attendance")}>📅 Attendance</button>
        <button className={`nav-item ${activeTab === "timetables" ? "active" : ""}`} onClick={() => setActiveTab("timetables")}>⏰ Timetables</button>
        <button className={`nav-item ${activeTab === "programs" ? "active" : ""}`} onClick={() => setActiveTab("programs")}>🎓 Programs</button>
        <button className={`nav-item ${activeTab === "departments" ? "active" : ""}`} onClick={() => setActiveTab("departments")}>🏢 Departments</button>
        <button className={`nav-item ${activeTab === "faculties" ? "active" : ""}`} onClick={() => setActiveTab("faculties")}>🏛️ Faculties</button>
        <button className={`nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>⚙ Settings</button>
      </nav>

      <main className="dashboard-main">
        {loading.dashboard ? (
          <div className="loading-content" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardTab 
                stats={stats}
                deans={deans}
                hods={hods}
                financeOfficers={financeOfficers}
                initializeDashboard={initializeDashboard}
                loading={loading}
                setNewUser={setNewUser}
                setShowUserModal={setShowUserModal}
              />
            )}

            {activeTab === "students" && (
              <StudentsTab
                students={students}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                setShowUserModal={setShowUserModal}
                setNewUser={setNewUser}
                setBulkMessageRole={setBulkMessageRole}
                setBulkMessageText={setBulkMessageText}
                setShowBulkMessageModal={setShowBulkMessageModal}
                openEditModal={openEditModal}
                handleUpdateStudentStatus={handleUpdateStudentStatus}
                setSelectedStudentForPicture={setSelectedStudentForPicture}
                setShowProfilePictureModal={setShowProfilePictureModal}
                openChatWithUser={openChatWithUser}
              />
            )}

            {activeTab === "lecturers" && (
              <LecturersTab
                lecturers={lecturers}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                setShowUserModal={setShowUserModal}
                setNewUser={setNewUser}
                setBulkMessageRole={setBulkMessageRole}
                setBulkMessageText={setBulkMessageText}
                setShowBulkMessageModal={setShowBulkMessageModal}
                openEditModal={openEditModal}
                openChatWithUser={openChatWithUser}
                setSelectedLecturerForDept={setSelectedLecturerForDept}
                setShowDeptAssignmentModal={setShowDeptAssignmentModal}
                setSelectedLecturerForCourses={setSelectedLecturerForCourses}
                setShowCourseAssignmentModal={setShowCourseAssignmentModal}
                handleProfilePictureUpdate={handleProfilePictureUpdate}
                renderLecturerDepartments={renderLecturerDepartments}
              />
            )}

            {activeTab === "deans" && (
              <DeansTab
                deans={deans}
                loadingDeans={loadingDeans}
                setShowUserModal={setShowUserModal}
                setNewUser={setNewUser}
                setBulkMessageRole={setBulkMessageRole}
                setBulkMessageText={setBulkMessageText}
                setShowBulkMessageModal={setShowBulkMessageModal}
                openEditModal={openEditModal}
                openChatWithUser={openChatWithUser}
                handleProfilePictureUpdate={handleProfilePictureUpdate}
                fetchDeans={fetchDeans}
                fetchDashboardStats={fetchDashboardStats}
                showToast={showToast}
              />
            )}

            {activeTab === "hods" && (
              <HODsTab
                hods={hods}
                loadingHODs={loadingHODs}
                setShowUserModal={setShowUserModal}
                setNewUser={setNewUser}
                setBulkMessageRole={setBulkMessageRole}
                setBulkMessageText={setBulkMessageText}
                setShowBulkMessageModal={setShowBulkMessageModal}
                openEditModal={openEditModal}
                openChatWithUser={openChatWithUser}
                handleProfilePictureUpdate={handleProfilePictureUpdate}
                fetchHODs={fetchHODs}
                fetchDashboardStats={fetchDashboardStats}
                showToast={showToast}
                departments={departments}
              />
            )}

            {activeTab === "finance" && (
              <FinanceTab
                setShowUserModal={setShowUserModal}
                setNewUser={setNewUser}
                setBulkMessageRole={setBulkMessageRole}
                setBulkMessageText={setBulkMessageText}
                setShowBulkMessageModal={setShowBulkMessageModal}
                setShowFinanceModal={setShowFinanceModal}
                renderFinanceOfficersTable={renderFinanceOfficersTable}
                fetchFinanceOfficers={fetchFinanceOfficers}
                showToast={showToast}
              />
            )}

            {activeTab === "courses" && (
              <CoursesTab
                courses={courses}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                setShowCourseModal={setShowCourseModal}
                renderCoursesGrid={renderCoursesGrid}
                handleToggleCourseActive={handleToggleCourseActive}
              />
            )}

            {activeTab === "exams" && (
              <ExamsTab
                exams={exams}
                setShowExamsModal={setShowExamsModal}
                handleDeleteExam={handleDeleteExam}
                getAdminExamStatus={getAdminExamStatus}
                getTimeUntilStart={getTimeUntilStart}
              />
            )}

            {activeTab === "timetables" && (
              <TimetablesTab
                timetables={timetables}
                expandedTimetableId={expandedTimetableId}
                setExpandedTimetableId={setExpandedTimetableId}
                setShowTimetableModal={setShowTimetableModal}
                setNewTimetable={setNewTimetable}
                setSelectedTimetable={setSelectedTimetable}
                setEditingSlot={setEditingSlot}
                setNewSlot={setNewSlot}
                setShowSlotModal={setShowSlotModal}
                handleDeleteSlot={handleDeleteSlot}
              />
            )}

            {activeTab === "programs" && (
              <ProgramsTab
                programs={programs}
                programsLoading={programsLoading}
                setShowProgramModal={setShowProgramModal}
                setEditingProgram={setEditingProgram}
                setNewProgram={setNewProgram}
                handleDeleteProgram={handleDeleteProgram}
              />
            )}

            {activeTab === "departments" && (
              <DepartmentManager 
                isAdmin={isAdmin} 
                showToast={showToast} 
                refreshTrigger={activeTab === "departments" ? 1 : 0} 
                faculties={faculties}
                facultiesLoading={false}
              />
            )}

            {activeTab === "faculties" && (
              <FacultyManager 
                isAdmin={isAdmin} 
                showToast={showToast} 
                refreshTrigger={activeTab === "faculties" ? 1 : 0} 
              />
            )}

            {activeTab === "attendance" && (
              <AttendanceManager 
                profile={profile} 
                isLecturer={false} 
                isAdmin={true} 
                departmentCodes={departmentCodes} 
                allowedDepartments={allowedDepartments} 
                students={students} 
                lectures={lectures} 
                stats={stats} 
                fetchDashboardStats={fetchDashboardStats} 
                showToast={showToast} 
              />
            )}

            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} NLE University • Admin Portal</p>
        <p className="footer-stats">Total Students: {stats.totalStudents} | Lecturers: {stats.totalLecturers} | Deans: {deans.length} | HODs: {hods.length} | Finance: {financeOfficers.length} | Last Updated: {new Date().toLocaleTimeString()}</p>
      </footer>

      {/* =================== CHAT MODAL =================== */}
      {renderChatModal()}

      {/* =================== MODALS =================== */}

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          newUser={newUser}
          setNewUser={setNewUser}
          showUserModal={showUserModal}
          setShowUserModal={setShowUserModal}
          handleAddStudent={handleAddStudent}
          handleAddLecturer={handleAddLecturer}
          handleAddDean={handleAddDean}
          handleAddHOD={handleAddHOD}
          handleAddFinance={handleAddFinance}
          programs={programs}
          programsLoading={programsLoading}
          faculties={faculties}
          departments={departments}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <EditUserModal
          editUser={editUser}
          setEditUser={setEditUser}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          handleEditUser={handleEditUser}
          faculties={faculties}
          departments={departments}
        />
      )}

      {/* Course Modal */}
      {showCourseModal && (
        <CourseModal
          showCourseModal={showCourseModal}
          setShowCourseModal={setShowCourseModal}
          newCourse={newCourse}
          setNewCourse={setNewCourse}
          handleAddCourse={handleAddCourse}
        />
      )}

      {/* Exam Modal */}
      {showExamsModal && (
        <ExamModal
          showExamsModal={showExamsModal}
          setShowExamsModal={setShowExamsModal}
          newExam={newExam}
          setNewExam={setNewExam}
          handleAddExam={handleAddExam}
          courses={courses}
        />
      )}

      {/* Finance Record Modal */}
      {showFinanceModal && (
        <FinanceRecordModal
          showFinanceModal={showFinanceModal}
          setShowFinanceModal={setShowFinanceModal}
          newFinanceRecord={newFinanceRecord}
          setNewFinanceRecord={setNewFinanceRecord}
          handleAddFinanceRecord={handleAddFinanceRecord}
        />
      )}

      {/* Timetable Modal */}
      {showTimetableModal && (
        <TimetableModal
          showTimetableModal={showTimetableModal}
          setShowTimetableModal={setShowTimetableModal}
          newTimetable={newTimetable}
          setNewTimetable={setNewTimetable}
          selectedTimetable={selectedTimetable}
          handleSaveTimetable={handleSaveTimetable}
          programs={programs}
        />
      )}

      {/* Slot Modal */}
      {showSlotModal && selectedTimetable && (
        <SlotModal
          showSlotModal={showSlotModal}
          setShowSlotModal={setShowSlotModal}
          newSlot={newSlot}
          setNewSlot={setNewSlot}
          editingSlot={editingSlot}
          handleSaveSlot={handleSaveSlot}
          lecturersList={lecturersList}
          selectedTimetable={selectedTimetable}
        />
      )}

      {/* Program Modal */}
      {showProgramModal && (
        <ProgramModal
          showProgramModal={showProgramModal}
          setShowProgramModal={setShowProgramModal}
          newProgram={newProgram}
          setNewProgram={setNewProgram}
          editingProgram={editingProgram}
          handleSaveProgram={handleSaveProgram}
        />
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <LogoutModal
          showLogoutModal={showLogoutModal}
          setShowLogoutModal={setShowLogoutModal}
          handleLogout={handleLogout}
        />
      )}

      {/* Department Assignment Modal */}
      {showDeptAssignmentModal && selectedLecturerForDept && (
        <DepartmentAssignmentModal
          lecturer={selectedLecturerForDept}
          onClose={() => { setShowDeptAssignmentModal(false); setSelectedLecturerForDept(null); }}
          onAssign={() => { fetchLecturers(); fetchDashboardStats(); }}
        />
      )}

      {/* Course Assignment Modal */}
      {showCourseAssignmentModal && selectedLecturerForCourses && (
        <CourseAssignmentModal
          lecturer={selectedLecturerForCourses}
          onClose={() => { setShowCourseAssignmentModal(false); setSelectedLecturerForCourses(null); }}
          onAssign={() => { fetchLecturers(); }}
        />
      )}

      {/* Profile Picture Modal */}
      {showProfilePictureModal && selectedStudentForPicture && (
        <StudentProfilePictureModal
          student={selectedStudentForPicture}
          onClose={() => { setShowProfilePictureModal(false); setSelectedStudentForPicture(null); }}
          onUpdate={handleStudentPictureUpdate}
        />
      )}
    </div>
  );
};

export default AdminDashboard;