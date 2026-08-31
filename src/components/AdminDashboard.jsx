// AdminDashboard.jsx - COMPLETE WORKING VERSION WITH FULL CHAT & DEBUG LOGGING
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import DepartmentAssignmentModal from './DepartmentAssignmentModal';
import { useLecturerDepartments } from '../hooks/useLecturerDepartments';
import './AdminDashboardStyles.css';
import FinanceDashboard from './FinanceDashboard';
import StudentProfilePictureModal from "./StudentProfilePictureModal";
import AttendanceManager from './AttendanceManager';
import FacultyManager from './FacultyManager';
import DepartmentManager from './DepartmentManager';
import LecturerDashboard from './LecturerDashboard';

// ============================================
// COURSE ASSIGNMENT MODAL (Admin only)
// ============================================
const CourseAssignmentModal = ({ lecturer, onClose, onAssign }) => {
  const [availableCourses, setAvailableCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedForUnassign, setSelectedForUnassign] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('courses')
          .select('id, course_code, course_name, lecturer_id, department_code, is_active')
          .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
          setAssignedCourses([]);
          setAvailableCourses([]);
          return;
        }

        const assigned = data.filter(c => c.lecturer_id === lecturer.id);
        const available = data.filter(c => c.lecturer_id !== lecturer.id);

        setAssignedCourses(assigned);
        setAvailableCourses(available);
        setSelectedForUnassign([]);
      } catch (err) {
        console.error("Error loading courses:", err);
        alert("Error loading courses: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (lecturer?.id) {
      fetchData();
    }
  }, [lecturer?.id]);

  const handleAssignCourse = async () => {
    if (!selectedCourse) return alert('Select a course');

    try {
      const { error } = await supabase
        .from('courses')
        .update({ lecturer_id: lecturer.id })
        .eq('id', selectedCourse);

      if (error) throw error;

      alert('Course assigned successfully!');

      const course = availableCourses.find(c => c.id === selectedCourse);
      setAssignedCourses(prev => [...prev, course]);
      setAvailableCourses(prev => prev.filter(c => c.id !== selectedCourse));
      setSelectedCourse('');
      onAssign();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const toggleSelectForUnassign = (courseId) => {
    setSelectedForUnassign(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const selectAllForUnassign = () => {
    if (selectedForUnassign.length === assignedCourses.length) {
      setSelectedForUnassign([]);
    } else {
      setSelectedForUnassign(assignedCourses.map(c => c.id));
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedForUnassign.length === 0) return alert('Select at least one course');

    if (!window.confirm(`Unassign ${selectedForUnassign.length} selected course(s)?`)) return;

    try {
      const { error } = await supabase
        .from('courses')
        .update({ lecturer_id: null })
        .in('id', selectedForUnassign);

      if (error) throw error;

      alert(`${selectedForUnassign.length} course(s) unassigned successfully!`);

      setAssignedCourses(prev => prev.filter(c => !selectedForUnassign.includes(c.id)));
      const unassignedCourses = assignedCourses.filter(c => selectedForUnassign.includes(c.id));
      setAvailableCourses(prev => [...prev, ...unassignedCourses.map(c => ({ ...c, lecturer_id: null }))]);
      setSelectedForUnassign([]);
      onAssign();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal large-modal">
        <h3>Assign Courses — {lecturer.full_name}</h3>

        {loading ? (
          <p>Loading courses...</p>
        ) : (
          <>
            <div className="form-group">
              <h4>Assign New Course</h4>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="form-select"
              >
                <option value="">— Select course —</option>
                {availableCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name} ({c.department_code})
                  </option>
                ))}
              </select>
              <button
                className="confirm-button"
                onClick={handleAssignCourse}
                disabled={!selectedCourse}
                style={{ marginTop: '12px' }}
              >
                Assign Course
              </button>
            </div>

            <div style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4>Assigned Courses ({assignedCourses.length})</h4>
                {assignedCourses.length > 0 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedForUnassign.length === assignedCourses.length && assignedCourses.length > 0}
                      onChange={selectAllForUnassign}
                    />
                    Select All
                  </label>
                )}
              </div>

              {assignedCourses.length === 0 ? (
                <p>No courses assigned.</p>
              ) : (
                <>
                  {selectedForUnassign.length > 0 && (
                    <button
                      className="confirm-button"
                      onClick={handleBulkUnassign}
                      style={{ marginBottom: '15px', background: '#dc3545' }}
                    >
                      Unassign Selected ({selectedForUnassign.length})
                    </button>
                  )}

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Dept</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedCourses.map(c => (
                        <tr key={c.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedForUnassign.includes(c.id)}
                              onChange={() => toggleSelectForUnassign(c.id)}
                            />
                          </td>
                          <td>{c.course_code}</td>
                          <td>{c.course_name}</td>
                          <td>{c.department_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

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

  // ==================== MODALS ====================
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

  // ==================== TOAST ====================
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

// ==================== CHAT FUNCTIONS (IMPROVED) ====================
// ==================== CHAT FUNCTIONS (FULLY REAL-TIME) ====================

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

    // Mark unread as read
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

  // Optimistic message
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

    // Replace temp with real message
    setChatMessages((prev) =>
      prev.map((m) => (m.id === tempId ? data : m))
    );

    fetchChatUsers();
    fetchUnreadCount();
    showToast('Message sent', 'success');
  } catch (err) {
    console.error('[CHAT] Send error:', err);
    // Remove optimistic message on failure
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
    console.log("💬 [DEBUG] fetchChatUsers called with profile?.email:", profile?.email);
    
    if (!profile?.email) {
      console.log("⚠️ [DEBUG] No profile email, skipping fetchChatUsers");
      return;
    }
    
    setLoadingChatUsers(true);
    try {
      // Get all unique users who have chatted with the admin
      console.log("💬 [DEBUG] Fetching chat messages...");
      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_email, sender_role, sender_name, receiver_email, receiver_role, message, created_at')
        .or(`sender_email.eq.${profile.email},receiver_email.eq.${profile.email}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("❌ [DEBUG] Error fetching chat messages:", error);
        throw error;
      }
      console.log(`💬 [DEBUG] Got ${data?.length || 0} chat messages`);

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

      // Also fetch all users by role for the chat tabs
      console.log("💬 [DEBUG] Fetching deans from user_roles...");
      const { data: deansData, error: deansError } = await supabase
        .from('user_roles')
        .select('id, email, role, faculty_id')
        .eq('role', 'dean')
        .limit(50);
      
      if (deansError) {
        console.error("❌ [DEBUG] Error fetching deans:", deansError);
      } else {
        console.log(`💬 [DEBUG] Got ${deansData?.length || 0} deans`);
        deansData?.forEach(d => {
          if (!userMap.has(d.email)) {
            userMap.set(d.email, {
              email: d.email,
              role: 'dean',
              name: d.email?.split('@')[0] || 'Dean',
              display_name: d.email?.split('@')[0] || 'Dean',
              faculty_id: d.faculty_id,
              last_message: '',
              last_message_time: null
            });
          }
        });
      }

      // Fetch HODs
      console.log("💬 [DEBUG] Fetching HODs from user_roles...");
      const { data: hodsData, error: hodsError } = await supabase
        .from('user_roles')
        .select('id, email, role, department_id, faculty_id')
        .eq('role', 'hod')
        .limit(50);
      
      if (hodsError) {
        console.error("❌ [DEBUG] Error fetching HODs:", hodsError);
      } else {
        console.log(`💬 [DEBUG] Got ${hodsData?.length || 0} HODs`);
        hodsData?.forEach(d => {
          if (!userMap.has(d.email)) {
            userMap.set(d.email, {
              email: d.email,
              role: 'hod',
              name: d.email?.split('@')[0] || 'HOD',
              display_name: d.email?.split('@')[0] || 'HOD',
              department_id: d.department_id,
              faculty_id: d.faculty_id,
              last_message: '',
              last_message_time: null
            });
          }
        });
      }

      // Fetch lecturers
      console.log("💬 [DEBUG] Fetching lecturers from lecturers table...");
      const { data: lecturersData, error: lecturersError } = await supabase
        .from('lecturers')
        .select('id, email, full_name')
        .limit(50);
      
      if (lecturersError) {
        console.error("❌ [DEBUG] Error fetching lecturers:", lecturersError);
      } else {
        console.log(`💬 [DEBUG] Got ${lecturersData?.length || 0} lecturers`);
        lecturersData?.forEach(d => {
          if (!userMap.has(d.email)) {
            userMap.set(d.email, {
              email: d.email,
              role: 'lecturer',
              name: d.full_name || d.email?.split('@')[0] || 'Lecturer',
              display_name: d.full_name || d.email?.split('@')[0] || 'Lecturer',
              last_message: '',
              last_message_time: null
            });
          }
        });
      }

      // Fetch finance officers
      console.log("💬 [DEBUG] Fetching finance officers from finance_officers table...");
      const { data: financeData, error: financeError } = await supabase
        .from('finance_officers')
        .select('id, email, full_name')
        .limit(50);
      
      if (financeError) {
        console.error("❌ [DEBUG] Error fetching finance officers:", financeError);
      } else {
        console.log(`💬 [DEBUG] Got ${financeData?.length || 0} finance officers`);
        financeData?.forEach(d => {
          if (!userMap.has(d.email)) {
            userMap.set(d.email, {
              email: d.email,
              role: 'finance',
              name: d.full_name || d.email?.split('@')[0] || 'Finance Officer',
              display_name: d.full_name || d.email?.split('@')[0] || 'Finance Officer',
              last_message: '',
              last_message_time: null
            });
          }
        });
      }

      // Fetch students
      console.log("💬 [DEBUG] Fetching students from students table...");
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, email, full_name')
        .limit(50);
      
      if (studentsError) {
        console.error("❌ [DEBUG] Error fetching students:", studentsError);
      } else {
        console.log(`💬 [DEBUG] Got ${studentsData?.length || 0} students`);
        studentsData?.forEach(d => {
          if (!userMap.has(d.email)) {
            userMap.set(d.email, {
              email: d.email,
              role: 'student',
              name: d.full_name || d.email?.split('@')[0] || 'Student',
              display_name: d.full_name || d.email?.split('@')[0] || 'Student',
              last_message: '',
              last_message_time: null
            });
          }
        });
      }

      const users = Array.from(userMap.values());
      console.log(`💬 [DEBUG] Total chat users: ${users.length}`);
      setChatUserList(users);
      
    } catch (error) {
      console.error('❌ [DEBUG] Error fetching chat users:', error);
    } finally {
      setLoadingChatUsers(false);
      console.log("💬 [DEBUG] fetchChatUsers complete");
    }
  }, [profile?.email]);

  const getFilteredChatUsers = () => {
    if (chatTab === 'all') return chatUserList;
    return chatUserList.filter(user => user.role === chatTab);
  };


  // ==================== NOTIFICATION FUNCTIONS ====================
  const fetchNotifications = useCallback(async () => {
    console.log("🔔 [DEBUG] fetchNotifications called with profile?.email:", profile?.email);
    
    if (!profile?.email) {
      console.log("⚠️ [DEBUG] No profile email, skipping fetchNotifications");
      return;
    }
    
    try {
      console.log("🔔 [DEBUG] Fetching notifications from chat_messages...");
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', profile.email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error("❌ [DEBUG] Error fetching notifications:", error);
        throw error;
      }
      
      console.log(`🔔 [DEBUG] Got ${data?.length || 0} notifications`);
      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read)?.length || 0;
      setUnreadCount(unread);
      setChatUnreadCount(unread);
    } catch (error) {
      console.error('❌ [DEBUG] Error fetching notifications:', error);
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
      
      // Refresh chat users and notifications
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
    console.log("🚀 [DEBUG] ========================================");
    console.log("🚀 [DEBUG] STARTING DASHBOARD INITIALIZATION");
    console.log("🚀 [DEBUG] Profile:", profile);
    console.log("🚀 [DEBUG] Profile email:", profile?.email);
    console.log("🚀 [DEBUG] Is admin:", isAdmin);
    console.log("🚀 [DEBUG] ========================================");
    
    try {
      setLoading(prev => ({ ...prev, dashboard: true }));
      
      console.log("📊 [DEBUG] Fetching dashboard stats...");
      await fetchDashboardStats();
      console.log("✅ [DEBUG] Dashboard stats complete");
      
      console.log("👥 [DEBUG] Fetching students...");
      await fetchStudents();
      console.log("✅ [DEBUG] Students complete");
      
      console.log("👨‍🏫 [DEBUG] Fetching lecturers...");
      await fetchLecturers();
      console.log("✅ [DEBUG] Lecturers complete");
      
      console.log("📖 [DEBUG] Fetching courses...");
      await fetchCourses();
      console.log("✅ [DEBUG] Courses complete");
      
      console.log("📝 [DEBUG] Fetching assignments...");
      await fetchAssignments();
      console.log("✅ [DEBUG] Assignments complete");
      
      console.log("🎯 [DEBUG] Fetching exams...");
      await fetchExams();
      console.log("✅ [DEBUG] Exams complete");
      
      console.log("💰 [DEBUG] Fetching financial records...");
      await fetchFinancialRecords();
      console.log("✅ [DEBUG] Financial records complete");
      
      console.log("📅 [DEBUG] Fetching lectures...");
      await fetchLectures();
      console.log("✅ [DEBUG] Lectures complete");
      
      console.log("🔔 [DEBUG] Fetching notifications...");
      await fetchNotifications();
      console.log("✅ [DEBUG] Notifications complete");
      
      console.log("👨‍🎓 [DEBUG] Fetching deans...");
      await fetchDeans();
      console.log("✅ [DEBUG] Deans complete");
      
      console.log("🏢 [DEBUG] Fetching HODs...");
      await fetchHODs();
      console.log("✅ [DEBUG] HODs complete");
      
      console.log("💰 [DEBUG] Fetching finance officers...");
      await fetchFinanceOfficers();
      console.log("✅ [DEBUG] Finance officers complete");
      
      console.log("💬 [DEBUG] Fetching chat users...");
      await fetchChatUsers();
      console.log("✅ [DEBUG] Chat users complete");
      
      console.log("📬 [DEBUG] Fetching unread count...");
      await fetchUnreadCount();
      console.log("✅ [DEBUG] Unread count complete");
      
      console.log("🎉 [DEBUG] ALL FETCHES COMPLETE!");
      
    } catch (error) {
      console.error("❌ [DEBUG] Initialization error:", error);
      console.error("❌ [DEBUG] Error stack:", error.stack);
      showToast("Error loading dashboard: " + error.message, 'error');
    } finally {
      console.log("🏁 [DEBUG] Setting loading.dashboard to false");
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
    console.log("  📊 [fetchDashboardStats] Starting...");
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

      console.log("  📊 [fetchDashboardStats] Results:", {
        students: studentsRes.count,
        lecturers: lecturersRes.count,
        courses: coursesRes.count,
        assignments: assignmentsRes.count,
        exams: examsRes.count,
        financialRecords: financialRes.count,
        lectures: lecturesRes.count,
      });

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
      console.log("  ✅ [fetchDashboardStats] Complete");
    } catch (error) {
      console.error("  ❌ [fetchDashboardStats] Error:", error);
      throw error;
    }
  };

  const fetchStudents = async () => {
    console.log("  👥 [fetchStudents] Starting...");
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

      console.log("  👥 [fetchStudents] Executing query...");
      const { data, error } = await query;
      
      if (error) {
        console.error("  ❌ [fetchStudents] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchStudents] Got ${data?.length || 0} students`);
      setStudents(data || []);
    } catch (error) {
      console.error("  ❌ [fetchStudents] Exception:", error);
      throw error;
    }
  };

  const fetchLecturers = async () => {
    console.log("  👨‍🏫 [fetchLecturers] Starting...");
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

      console.log("  👨‍🏫 [fetchLecturers] Executing query...");
      const { data, error } = await query;
      
      if (error) {
        console.error("  ❌ [fetchLecturers] Error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("  👨‍🏫 [fetchLecturers] No lecturers found");
        setLecturers([]);
        return;
      }

      console.log(`  👨‍🏫 [fetchLecturers] Got ${data.length} lecturers, fetching departments...`);
      
      const lecturersWithDepts = await Promise.all(
        data.map(async (lecturer) => {
          const { data: deptData, error: deptError } = await supabase
            .from("lecturer_departments")
            .select("department_code, department_name")
            .eq("lecturer_id", lecturer.id)
            .eq("is_active", true);

          if (deptError) {
            console.warn(`  ⚠️ [fetchLecturers] Dept fetch error for ${lecturer.id}:`, deptError);
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

      console.log(`  ✅ [fetchLecturers] Complete, ${lecturersWithDepts.length} lecturers`);
      setLecturers(lecturersWithDepts);
    } catch (error) {
      console.error("  ❌ [fetchLecturers] Error:", error);
      throw error;
    }
  };

  const fetchDeans = async () => {
    console.log("  👨‍🎓 [fetchDeans] Starting...");
    try {
      setLoadingDeans(true);
      
      const { data: deansData, error: deansError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "dean")
        .order("created_at", { ascending: false });

      if (deansError) {
        console.error("  ❌ [fetchDeans] Error:", deansError);
        throw deansError;
      }

      if (!deansData || deansData.length === 0) {
        console.log("  👨‍🎓 [fetchDeans] No deans found");
        setDeans([]);
        return;
      }

      console.log(`  👨‍🎓 [fetchDeans] Got ${deansData.length} deans, fetching faculties...`);

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

      console.log(`  ✅ [fetchDeans] Complete, ${deansWithFaculty.length} deans`);
      setDeans(deansWithFaculty);
    } catch (error) {
      console.error("  ❌ [fetchDeans] Error:", error);
      throw error;
    } finally {
      setLoadingDeans(false);
    }
  };

  const fetchHODs = async () => {
    console.log("  🏢 [fetchHODs] Starting...");
    try {
      setLoadingHODs(true);
      
      const { data: hodsData, error: hodsError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "hod")
        .order("created_at", { ascending: false });

      if (hodsError) {
        console.error("  ❌ [fetchHODs] Error:", hodsError);
        throw hodsError;
      }

      if (!hodsData || hodsData.length === 0) {
        console.log("  🏢 [fetchHODs] No HODs found");
        setHODs([]);
        return;
      }

      console.log(`  🏢 [fetchHODs] Got ${hodsData.length} HODs, fetching departments...`);

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

      console.log(`  ✅ [fetchHODs] Complete, ${hodsWithDetails.length} HODs`);
      setHODs(hodsWithDetails);
    } catch (error) {
      console.error("  ❌ [fetchHODs] Error:", error);
      throw error;
    } finally {
      setLoadingHODs(false);
    }
  };

  const fetchFinanceOfficers = async () => {
    console.log("  💰 [fetchFinanceOfficers] Starting...");
    try {
      setLoadingFinance(true);
      
      const { data, error } = await supabase
        .from("finance_officers")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("  ❌ [fetchFinanceOfficers] Error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("  💰 [fetchFinanceOfficers] No finance officers found");
        setFinanceOfficers([]);
        return;
      }

      console.log(`  💰 [fetchFinanceOfficers] Got ${data.length} finance officers`);

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

      console.log(`  ✅ [fetchFinanceOfficers] Complete, ${officersWithPics.length} officers`);
      setFinanceOfficers(officersWithPics);
    } catch (error) {
      console.error("  ❌ [fetchFinanceOfficers] Error:", error);
      throw error;
    } finally {
      setLoadingFinance(false);
    }
  };

  const fetchCourses = async () => {
    console.log("  📖 [fetchCourses] Starting...");
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
      
      if (error) {
        console.error("  ❌ [fetchCourses] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchCourses] Got ${data?.length || 0} courses`);
      setCourses(data || []);
    } catch (error) {
      console.error("  ❌ [fetchCourses] Error:", error);
      throw error;
    }
  };

  const fetchAssignments = async () => {
    console.log("  📝 [fetchAssignments] Starting...");
    try {
      const { data, error } = await supabase
        .from("assignments")
        .select(`*, courses (course_code, course_name, department_code), lecturers (full_name)`)
        .limit(100)
        .order("due_date", { ascending: true });
      
      if (error) {
        console.error("  ❌ [fetchAssignments] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchAssignments] Got ${data?.length || 0} assignments`);
      setAssignments(data || []);
    } catch (error) {
      console.error("  ❌ [fetchAssignments] Error:", error);
      throw error;
    }
  };

  const fetchExams = async () => {
    console.log("  🎯 [fetchExams] Starting...");
    try {
      const { data, error } = await supabase
        .from("examinations")
        .select(`*, courses (course_code, course_name, department_code)`)
        .limit(100)
        .order("start_time", { ascending: true });
      
      if (error) {
        console.error("  ❌ [fetchExams] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchExams] Got ${data?.length || 0} exams`);
      setExams(data || []);
    } catch (error) {
      console.error("  ❌ [fetchExams] Error:", error);
      throw error;
    }
  };

  const fetchFinancialRecords = async () => {
    console.log("  💰 [fetchFinancialRecords] Starting...");
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("  ❌ [fetchFinancialRecords] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchFinancialRecords] Got ${data?.length || 0} records`);
      setFinancialRecords(data || []);
    } catch (error) {
      console.error("  ❌ [fetchFinancialRecords] Error:", error);
      throw error;
    }
  };

  const fetchLectures = async () => {
    console.log("  📅 [fetchLectures] Starting...");
    try {
      const { data, error } = await supabase
        .from("lectures")
        .select(`*, courses (id, course_code, course_name, department_code), lecturers (id, full_name, email, google_meet_link)`)
        .limit(100)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) {
        console.error("  ❌ [fetchLectures] Error:", error);
        throw error;
      }
      
      console.log(`  ✅ [fetchLectures] Got ${data?.length || 0} lectures`);
      setLectures(data || []);
    } catch (error) {
      console.error("  ❌ [fetchLectures] Error:", error);
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
      showToast("Please enter both Course Code and Course Name", 'error');
      return;
    }

    try {
      if (editingSlot) {
        const { error } = await supabase
          .from("program_timetable_slots")
          .update({
            course_code: newSlot.course_code.trim(),
            course_name: newSlot.course_name.trim(),
            lecturer_id: newSlot.lecturer_id || null,
            day_of_week: parseInt(newSlot.day_of_week),
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
            room_number: newSlot.room_number.trim(),
            building: newSlot.building.trim(),
            slot_type: newSlot.slot_type,
          })
          .eq("id", editingSlot.id);

        if (error) throw error;
        showToast("Slot updated successfully!", 'success');
      } else {
        const { error } = await supabase
          .from("program_timetable_slots")
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
            is_active: true,
          }]);

        if (error) throw error;
        showToast("New slot added successfully!", 'success');
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

      await refreshCurrentTimetableSlots();
    } catch (err) {
      console.error("Error saving slot:", err);
      showToast("Failed to save slot: " + err.message, 'error');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!slotId) {
      showToast("Error: No slot selected for deletion", 'error');
      return;
    }

    if (!window.confirm("Are you sure you want to delete this time slot? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("program_timetable_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;
      showToast("Time slot deleted successfully!", 'success');
      await refreshCurrentTimetableSlots();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Failed to delete slot: " + err.message, 'error');
    }
  };

  const refreshCurrentTimetableSlots = async () => {
    if (!selectedTimetable) return;

    try {
      const { data, error } = await supabase
        .from("program_timetable_slots")
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
        .eq("program_timetable_id", selectedTimetable.id)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;

      setTimetables(prev =>
        prev.map(tt =>
          tt.id === selectedTimetable.id
            ? { ...tt, program_timetable_slots: data || [] }
            : tt
        )
      );

      setSelectedTimetable(prev => ({
        ...prev,
        program_timetable_slots: data || [],
      }));
    } catch (err) {
      console.error("Error refreshing slots:", err);
      showToast("Failed to refresh slots", 'error');
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

  // ==================== RENDER HELPERS ====================
  const renderStudentsTable = () => {
    return (
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "60px" }}>Photo</th>
              <th>Student ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Program</th>
              <th>Department</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: "30px" }}>
                  No students found
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
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
                        setSelectedStudentForPicture(student);
                        setShowProfilePictureModal(true);
                      }}
                      title="Click to change photo"
                    >
                      {student.profile_picture_url ? (
                        <img
                          src={student.profile_picture_url}
                          alt={student.full_name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "18px", color: "#666" }}>
                          {student.full_name?.[0]?.toUpperCase() || "👤"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><strong>{student.student_id}</strong></td>
                  <td>{student.full_name}</td>
                  <td>{student.email}</td>
                  <td>{student.program || "N/A"}</td>
                  <td>
                    <span className="dept-badge">{student.department_code || "N/A"}</span>
                  </td>
                  <td>Year {student.year_of_study || 1} - Sem {student.semester || 1}</td>
                  <td>
                    <span className={`status-badge ${student.status || "active"}`}>
                      {student.status?.charAt(0).toUpperCase() + student.status?.slice(1) || "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(student, 'student')}
                      >
                        ✏️ Edit
                      </button>
                <button
  className="action-btn message"
  onClick={() => openChatWithUser(student, 'student')}
>
  💬 Message
</button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleUpdateStudentStatus(
                          student.id,
                          student.status === "active" ? "inactive" : "active"
                        )}
                      >
                        {student.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLecturersTable = () => {
    return (
      <div className="table-container">
        <div className="tab-header">
          <h2>👨‍🏫 Lecturer Management</h2>
          <div className="tab-actions">
            <input
              type="text"
              placeholder="Search lecturers..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              className="add-button"
              onClick={() => {
                setNewUser({ ...newUser, role: "lecturer" });
                setShowUserModal(true);
              }}
            >
              + Add Lecturer
            </button>
            <button
              className="add-button bulk-message"
              onClick={() => {
                setBulkMessageRole('lecturer');
                setBulkMessageText('');
                setShowBulkMessageModal(true);
              }}
            >
              📨 Message All
            </button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>Photo</th>
              <th>Lecturer ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Specialization</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lecturers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "30px" }}>
                  No lecturers found
                </td>
              </tr>
            ) : (
              lecturers.map((lecturer) => (
                <tr key={lecturer.id}>
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
                            await handleProfilePictureUpdate(file, lecturer.id, 'lecturer');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {lecturer.profile_picture_url ? (
                        <img
                          src={lecturer.profile_picture_url}
                          alt={lecturer.full_name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", color: "#666" }}>
                          {lecturer.full_name?.[0]?.toUpperCase() || "👤"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{lecturer.lecturer_id}</td>
                  <td>{lecturer.full_name}</td>
                  <td>{lecturer.email}</td>
                  <td>{renderLecturerDepartments(lecturer)}</td>
                  <td>{lecturer.specialization}</td>
                  <td>
                    <span className={`status-badge ${lecturer.status || "active"}`}>
                      {lecturer.status || "active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(lecturer, 'lecturer')}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="action-btn message"
                   onClick={() => openChatWithUser(lecturer, 'lecturer')}
                      >
                        💬 Message
                      </button>
                      <button
                        className="action-btn dept"
                        onClick={() => {
                          setSelectedLecturerForDept(lecturer);
                          setShowDeptAssignmentModal(true);
                        }}
                      >
                        🏢 Depts
                      </button>
                      <button
                        className="action-btn courses"
                        onClick={() => {
                          setSelectedLecturerForCourses(lecturer);
                          setShowCourseAssignmentModal(true);
                        }}
                      >
                        📚 Courses
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDeansTable = () => {
    return (
      <div className="table-container">
        <div className="tab-header">
          <h2>👨‍🎓 Dean Management</h2>
          <button
            className="add-button"
            onClick={() => {
              setNewUser({ 
                ...newUser, 
                role: "dean",
                faculty_id: "",
                faculty_name: "",
              });
              setShowUserModal(true);
            }}
          >
            + Add Dean
          </button>
          <button
            className="add-button bulk-message"
            onClick={() => {
              setBulkMessageRole('dean');
              setBulkMessageText('');
              setShowBulkMessageModal(true);
            }}
          >
            📨 Message All
          </button>
        </div>

        {loadingDeans ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading deans...</p>
          </div>
        ) : deans.length === 0 ? (
          <div className="empty-state">
            <p>No deans found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Faculty</th>
                <th>Faculty Code</th>
                <th>Contact</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deans.map((dean) => (
                <tr key={dean.id}>
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
                            await handleProfilePictureUpdate(file, dean.id, 'dean');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {dean.profile_picture_url ? (
                        <img
                          src={dean.profile_picture_url}
                          alt={dean.display_name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", color: "#666" }}>
                          {dean.display_name?.[0]?.toUpperCase() || "👤"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><strong>{dean.display_name || dean.email}</strong></td>
                  <td>{dean.email}</td>
                  <td>{dean.faculties?.faculty_name || 'N/A'}</td>
                  <td><span className="dept-badge">{dean.faculties?.faculty_code || 'N/A'}</span></td>
                  <td>
                    {dean.faculties?.contact_phone || dean.faculties?.contact_email ? (
                      <div style={{ fontSize: '12px' }}>
                        {dean.faculties?.contact_email && <div>📧 {dean.faculties?.contact_email}</div>}
                        {dean.faculties?.contact_phone && <div>📱 {dean.faculties?.contact_phone}</div>}
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>{dean.created_at ? new Date(dean.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(dean, 'dean')}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="action-btn message"
                   onClick={() => openChatWithUser(dean, 'dean')}
                      >
                        💬 Message
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => {
                          if (window.confirm(`Remove Dean ${dean.email}?`)) {
                            supabase.from("user_roles").delete().eq("id", dean.id)
                              .then(() => {
                                showToast("Dean removed successfully!", 'success');
                                fetchDeans();
                                fetchDashboardStats();
                              })
                              .catch(err => showToast("Error: " + err.message, 'error'));
                          }
                        }}
                      >
                        Remove
                      </button>
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

  const renderHODsTable = () => {
    return (
      <div className="table-container">
        <div className="tab-header">
          <h2>🏢 HOD Management</h2>
          <button
            className="add-button"
            onClick={() => {
              setNewUser({ 
                ...newUser, 
                role: "hod",
                department_id: "",
                department_name: "",
                department_code: "",
              });
              setShowUserModal(true);
            }}
          >
            + Add HOD
          </button>
          <button
            className="add-button bulk-message"
            onClick={() => {
              setBulkMessageRole('hod');
              setBulkMessageText('');
              setShowBulkMessageModal(true);
            }}
          >
            📨 Message All
          </button>
        </div>

        {loadingHODs ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading HODs...</p>
          </div>
        ) : hods.length === 0 ? (
          <div className="empty-state">
            <p>No HODs found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Department Code</th>
                <th>Contact</th>
                <th>Faculty</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hods.map((hod) => (
                <tr key={hod.id}>
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
                            await handleProfilePictureUpdate(file, hod.id, 'hod');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {hod.profile_picture_url ? (
                        <img
                          src={hod.profile_picture_url}
                          alt={hod.display_name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", color: "#666" }}>
                          {hod.display_name?.[0]?.toUpperCase() || "👤"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><strong>{hod.display_name || hod.email}</strong></td>
                  <td>{hod.email}</td>
                  <td>{hod.departments?.department_name || 'N/A'}</td>
                  <td><span className="dept-badge">{hod.departments?.department_code || 'N/A'}</span></td>
                  <td>
                    {hod.departments?.contact_phone || hod.departments?.contact_email ? (
                      <div style={{ fontSize: '12px' }}>
                        {hod.departments?.contact_email && <div>📧 {hod.departments?.contact_email}</div>}
                        {hod.departments?.contact_phone && <div>📱 {hod.departments?.contact_phone}</div>}
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>{hod.faculties?.faculty_name || 'N/A'}</td>
                  <td>{hod.created_at ? new Date(hod.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(hod, 'hod')}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="action-btn message"
               onClick={() => openChatWithUser(hod, 'hod')}
                      >
                        💬 Message
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => {
                          if (window.confirm(`Remove HOD ${hod.email}?`)) {
                            supabase.from("user_roles").delete().eq("id", hod.id)
                              .then(() => {
                                showToast("HOD removed successfully!", 'success');
                                fetchHODs();
                                fetchDashboardStats();
                              })
                              .catch(err => showToast("Error: " + err.message, 'error'));
                          }
                        }}
                      >
                        Remove
                      </button>
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
                      <button
                        className="action-btn edit"
                        onClick={() => openEditModal(officer, 'finance')}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="action-btn message"
                   onClick={() => openChatWithUser(officer, 'finance')}
                      >
                        💬 Message
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => {
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
                        }}
                      >
                        Remove
                      </button>
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
        {/* Header */}
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

        {/* Messages */}
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
                      background: isMe ? '#1976d2' : '#ffffff',
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

        {/* Input */}
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
              background: sendingMessage || !newMessage.trim() ? '#bbb' : '#1976d2',
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
  


  // ==================== useEffect - INITIALIZATION ====================

  // ==================== REAL-TIME FOR OPEN CHAT ====================
useEffect(() => {
  if (!showChatModal || !selectedUser?.email || !profile?.email) return;

  console.log('[ADMIN CHAT] Setting up realtime for:', profile.email, '↔', selectedUser.email);

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

            // Remove any temp optimistic message
            const cleaned = prev.filter(
              (m) => !(typeof m.id === 'string' && m.id.startsWith('temp-') && m.message === msg.message)
            );
            return [...cleaned, msg];
          });

          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);

          // Also refresh notification count
          fetchUnreadCount();
        }
      }
    )
    .subscribe((status) => {
      console.log('[ADMIN CHAT] Realtime status:', status);
    });

  // Fallback polling every 6 seconds while chat is open
  const pollInterval = setInterval(() => {
    fetchChatMessages(selectedUser.email);
  }, 6000);

  return () => {
    supabase.removeChannel(channel);
    clearInterval(pollInterval);
  };
}, [showChatModal, selectedUser?.email, profile?.email, fetchChatMessages]);
  useEffect(() => {
    console.log("🔄 [useEffect] AdminDashboard mounted");
    console.log("📋 [useEffect] Profile:", profile);
    console.log("📋 [useEffect] Is admin:", isAdmin);
    console.log("📋 [useEffect] Is lecturer:", isLecturer);
    console.log("📋 [useEffect] Is finance:", isFinance);
    console.log("📋 [useEffect] Auth loading:", authLoading);
    
    if (!authLoading && profile) {
      console.log("🔄 [useEffect] Profile loaded, initializing dashboard...");
      initializeDashboard();
      setupRealtimeSubscription();
      setupNotificationSubscription();
      fetchPrograms();
      fetchLecturersList();
      fetchProgramTimetables();
      fetchFaculties();
      fetchDepartments();
    } else if (!authLoading && !profile) {
      console.log("⚠️ [useEffect] No profile found, skipping initialization");
    }
    
    return () => {
      console.log("🔄 [useEffect] Cleaning up...");
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }
    };
  }, [authLoading, profile]); // Added dependencies


// Real-time messages for the currently open chat
useEffect(() => {
  if (!showChatModal || !selectedUser?.email || !profile?.email) return;

  const channelName = `admin-chat-${profile.email}-${selectedUser.email}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      },
      (payload) => {
        const msg = payload.new;

        // Only add messages that belong to this conversation
        const isThisChat =
          (msg.sender_email === profile.email && msg.receiver_email === selectedUser.email) ||
          (msg.sender_email === selectedUser.email && msg.receiver_email === profile.email);

        if (!isThisChat) return;

        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev; // avoid duplicates
          return [...prev, msg];
        });

        // Auto-scroll
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [showChatModal, selectedUser?.email, profile?.email]);
  
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
                          color: '#1976d2',
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
                                background: '#1976d2',
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
              <div className="dashboard-content">
                <div className="welcome-section">
                  <div>
                    <h2>Welcome, System Administrator! 👑</h2>
                    <p>Last updated: {new Date().toLocaleTimeString()}</p>
                  </div>
                  <button onClick={initializeDashboard} disabled={loading.dashboard} className="refresh-button">🔄 Refresh</button>
                </div>
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-icon">👥</div><h3>{stats.totalStudents.toLocaleString()}</h3><p>Total Students</p></div>
                  <div className="stat-card"><div className="stat-icon">👨‍🏫</div><h3>{stats.totalLecturers}</h3><p>Lecturers</p></div>
                  <div className="stat-card"><div className="stat-icon">👨‍🎓</div><h3>{deans.length}</h3><p>Deans</p></div>
                  <div className="stat-card"><div className="stat-icon">🏢</div><h3>{hods.length}</h3><p>HODs</p></div>
                  <div className="stat-card"><div className="stat-icon">💰</div><h3>{financeOfficers.length}</h3><p>Finance Officers</p></div>
                  <div className="stat-card"><div className="stat-icon">📚</div><h3>{stats.totalCourses}</h3><p>Active Courses</p></div>
                </div>
                <div className="actions-section">
                  <h3>Quick Actions</h3>
                  <div className="actions-grid">
                    <button className="action-button" onClick={() => { setNewUser({ ...newUser, role: "student" }); setShowUserModal(true); }}>
                      <span className="action-icon">👤</span><span>Add Student</span><small>New student enrollment</small>
                    </button>
                    <button className="action-button" onClick={() => { setNewUser({ ...newUser, role: "lecturer" }); setShowUserModal(true); }}>
                      <span className="action-icon">👨‍🏫</span><span>Add Lecturer</span><small>New lecturer hire</small>
                    </button>
                    <button className="action-button" onClick={() => { setNewUser({ ...newUser, role: "dean" }); setShowUserModal(true); }}>
                      <span className="action-icon">👨‍🎓</span><span>Add Dean</span><small>Faculty dean appointment</small>
                    </button>
                    <button className="action-button" onClick={() => { setNewUser({ ...newUser, role: "hod" }); setShowUserModal(true); }}>
                      <span className="action-icon">🏢</span><span>Add HOD</span><small>Department head appointment</small>
                    </button>
                    <button className="action-button" onClick={() => { setNewUser({ ...newUser, role: "finance" }); setShowUserModal(true); }}>
                      <span className="action-icon">💰</span><span>Add Finance Officer</span><small>New finance officer</small>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "students" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>👥 Student Management</h2>
                  <div className="tab-actions">
                    <input type="text" placeholder="Search students..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <button className="add-button" onClick={() => { setNewUser({ ...newUser, role: "student" }); setShowUserModal(true); }}>+ Add Student</button>
                    <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('student'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>📨 Message All</button>
                  </div>
                </div>
                {renderStudentsTable()}
              </div>
            )}

            {activeTab === "lecturers" && renderLecturersTable()}
            {activeTab === "deans" && renderDeansTable()}
            {activeTab === "hods" && renderHODsTable()}
            
            {activeTab === "finance" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>💰 Finance Management</h2>
                  <div className="tab-actions">
                    <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('finance'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>📨 Message All Finance</button>
                    <button className="add-button" onClick={() => { setNewUser({ ...newUser, role: "finance" }); setShowUserModal(true); }}>+ Add Finance Officer</button>
                    <button className="add-button" onClick={() => setShowFinanceModal(true)}>+ Add Record</button>
                  </div>
                </div>

                <div style={{ marginBottom: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>👤 Finance Officers</h3>
                  </div>
                  {renderFinanceOfficersTable()}
                </div>

                <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: '30px' }}>
                  <h3 style={{ marginBottom: '15px' }}>📊 Financial Records</h3>
                  <div className="stats-grid" style={{ marginBottom: '20px' }}>
                    <div className="stat-card"><h3>{financialRecords.length}</h3><p>Total Records</p></div>
                    <div className="stat-card success"><h3>${financialRecords.filter(r => r.status === "paid").reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</h3><p>Total Paid</p></div>
                    <div className="stat-card warning"><h3>${financialRecords.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</h3><p>Pending</p></div>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead><tr><th>Student ID</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {financialRecords.slice(0, 50).map((record) => (
                          <tr key={record.id}>
                            <td>{record.student_id}</td>
                            <td>{record.description}</td>
                            <td>${record.amount.toFixed(2)}</td>
                            <td><span className={`status-badge ${record.status}`}>{record.status}</span></td>
                            <td>{new Date(record.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "courses" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📖 Course Management</h2>
                  <div className="tab-actions">
                    <input type="text" placeholder="Search courses..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <button className="add-button" onClick={() => setShowCourseModal(true)}>+ Add Course</button>
                  </div>
                </div>
                {renderCoursesGrid()}
              </div>
            )}

            {activeTab === "exams" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>🎯 Exam Management</h2>
                  <button className="add-button" onClick={() => setShowExamsModal(true)}>+ Schedule Exam</button>
                </div>
                <div className="exams-list">
                  {exams.length > 0 ? (
                    exams.map((exam) => {
                      const status = getAdminExamStatus(exam);
                      return (
                        <div key={exam.id} className="exam-card">
                          <div className="exam-header">
                            <div><h3>{exam.title}</h3><p className="course-info">{exam.courses?.course_code} - {exam.courses?.course_name}</p></div>
                            <span className={`exam-status ${status}`}>{status.toUpperCase()}</span>
                          </div>
                          <p>{exam.description}</p>
                          <div className="exam-status-bar">
                            <strong>{status === "active" ? "🔴 EXAM IS ONGOING NOW" : status === "upcoming" ? `Starts in ${getTimeUntilStart(exam.start_time)}` : "Exam Ended"}</strong>
                          </div>
                          <div className="exam-details">
                            <div><strong>Start:</strong> {new Date(exam.start_time).toLocaleString()}</div>
                            <div><strong>End:</strong> {new Date(exam.end_time).toLocaleString()}</div>
                            <div><strong>Duration:</strong> {exam.duration_minutes} minutes</div>
                            <div><strong>Total Marks:</strong> {exam.total_marks}</div>
                            <div><strong>Location:</strong> {exam.venue || exam.location || "Online"}</div>
                          </div>
                          <div className="exam-actions">
                            <button className="action-btn delete" onClick={() => handleDeleteExam(exam.id)}>Delete</button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state"><p>No exams scheduled</p></div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "attendance" && (
              <AttendanceManager profile={profile} isLecturer={false} isAdmin={true} departmentCodes={departmentCodes} allowedDepartments={allowedDepartments} students={students} lectures={lectures} stats={stats} fetchDashboardStats={fetchDashboardStats} showToast={showToast} />
            )}

            {activeTab === "timetables" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>⏰ Timetable Management</h2>
                  <button className="add-button" onClick={() => { setNewTimetable({ program_id: "", academic_year: "2024/2025", semester: 1, year_of_study: 1, is_active: true }); setShowTimetableModal(true); }}>+ Create New Timetable</button>
                </div>
                <div className="timetables-grid">
                  {timetables.length === 0 ? (
                    <div className="empty-state"><p>No timetables created yet</p></div>
                  ) : (
                    timetables.map((tt) => (
                      <div key={tt.id} className="timetable-card expandable">
                        <div className="timetable-header">
                          <h3>{tt.programs?.name || "Unknown Program"} - Year {tt.year_of_study}</h3>
                          <div><span className="semester-badge">Semester {tt.semester}</span><span className={`status-badge ${tt.is_active ? "active" : "inactive"}`}>{tt.is_active ? "Active" : "Inactive"}</span></div>
                        </div>
                        <p>{tt.academic_year}</p>
                        <p className="small-text">{tt.program_timetable_slots?.length || 0} slot{(tt.program_timetable_slots?.length || 0) !== 1 ? "s" : ""}</p>
                        <div className="timetable-actions">
                          <button className="action-btn view" onClick={() => setExpandedTimetableId(expandedTimetableId === tt.id ? null : tt.id)}>
                            {expandedTimetableId === tt.id ? "↑ Hide Slots" : "↓ View & Edit Slots"}
                          </button>
                        </div>
                        {expandedTimetableId === tt.id && (
                          <div className="expanded-slots-section" style={{ marginTop: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                              <h4 style={{ margin: 0 }}>Time Slots</h4>
                              <button className="add-button small" onClick={() => { setSelectedTimetable(tt); setEditingSlot(null); setNewSlot({ course_code: "", course_name: "", lecturer_id: "", day_of_week: 1, start_time: "08:00", end_time: "10:00", room_number: "", building: "CS Building", slot_type: "lecture" }); setShowSlotModal(true); }}>+ Add Slot</button>
                            </div>
                            {tt.program_timetable_slots?.length > 0 ? (
                              <div className="table-container">
                                <table className="data-table">
                                  <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Lecturer</th><th>Location</th><th>Type</th><th>Actions</th></tr></thead>
                                  <tbody>
                                    {tt.program_timetable_slots.map((slot) => (
                                      <tr key={slot.id}>
                                        <td>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][slot.day_of_week]}</td>
                                        <td>{slot.start_time} – {slot.end_time}</td>
                                        <td><strong>{slot.course_code}</strong><br /><small>{slot.course_name}</small></td>
                                        <td>{slot.lecturers?.full_name || "Not Assigned"}</td>
                                        <td>{slot.room_number} {slot.building}</td>
                                        <td><span className="status-badge">{slot.slot_type}</span></td>
                                        <td>
                                          <div style={{ display: "flex", gap: "8px" }}>
                                            <button className="action-btn edit small" onClick={() => { setSelectedTimetable(tt); setEditingSlot(slot); setNewSlot({ course_code: slot.course_code, course_name: slot.course_name, lecturer_id: slot.lecturer_id || "", day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time, room_number: slot.room_number, building: slot.building, slot_type: slot.slot_type }); setShowSlotModal(true); }}>Edit</button>
                                            <button className="action-btn delete small" onClick={() => handleDeleteSlot(slot.id)}>Delete</button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-muted" style={{ textAlign: "center", padding: "20px" }}>No slots added yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "programs" && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>🎓 Program Management</h2>
                  <button className="add-button" onClick={() => { setEditingProgram(null); setNewProgram({ name: "", code: "" }); setShowProgramModal(true); }}>+ Add Program</button>
                </div>
                <div className="table-container">
                  {programs.length === 0 ? (
                    <div className="empty-state"><p>No programs defined yet</p></div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Program Name</th><th>Code</th><th>Actions</th></tr></thead>
                      <tbody>
                        {programs.map((program) => (
                          <tr key={program.id}>
                            <td><strong>{program.name}</strong></td>
                            <td><span className="dept-badge">{program.code}</span></td>
                            <td>
                              <div className="action-buttons flat">
                                <button className="action-btn edit small" onClick={() => { setEditingProgram(program); setNewProgram({ name: program.name, code: program.code }); setShowProgramModal(true); }}>Edit</button>
                                <button className="action-btn delete small" onClick={() => handleDeleteProgram(program.id, program.name)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === "departments" && <DepartmentManager isAdmin={isAdmin} showToast={showToast} refreshTrigger={activeTab === "departments" ? 1 : 0} />}
            {activeTab === "faculties" && <FacultyManager isAdmin={isAdmin} showToast={showToast} refreshTrigger={activeTab === "faculties" ? 1 : 0} />}

            {activeTab === "settings" && (
              <div className="tab-content">
                <h2>⚙ System Settings</h2>
                <div className="settings-grid">
                  <div className="setting-card">
                    <h3>Academic Settings</h3>
                    <div className="setting-item"><label className="setting-label">Academic Year</label><select className="setting-select" defaultValue="2024/2025"><option>2023/2024</option><option>2024/2025</option><option>2025/2026</option></select></div>
                    <div className="setting-item"><label className="setting-label">Semester</label><select className="setting-select" defaultValue="1"><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div>
                    <button className="save-button">Save Changes</button>
                  </div>
                  <div className="setting-card">
                    <h3>System Preferences</h3>
                    <div className="setting-item"><label className="setting-label"><input type="checkbox" defaultChecked className="setting-checkbox" /> Email Notifications</label></div>
                    <div className="setting-item"><label className="setting-label"><input type="checkbox" defaultChecked className="setting-checkbox" /> Auto Backup</label></div>
                    <div className="setting-item"><label className="setting-label"><input type="checkbox" className="setting-checkbox" /> Maintenance Mode</label></div>
                    <button className="save-button">Update Preferences</button>
                  </div>
                </div>
              </div>
            )}
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
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {newUser.role === "student" && "Add New Student"}
              {newUser.role === "lecturer" && "Add New Lecturer"}
              {newUser.role === "dean" && "Add New Dean"}
              {newUser.role === "hod" && "Add New HOD"}
              {newUser.role === "finance" && "Add New Finance Officer"}
            </h3>
            <div className="modal-form">
              <div className="form-group"><label>Full Name *</label><input type="text" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="Enter full name" className="form-input" /></div>
              <div className="form-group"><label>Email *</label><input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Enter email address" className="form-input" /></div>
              <div className="form-group"><label>Phone</label><input type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="Enter phone number" className="form-input" /></div>

              {newUser.role === "student" && (
                <>
                  <div className="form-group"><label>Date of Birth</label><input type="date" value={newUser.date_of_birth} onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })} className="form-input" /></div>
                  <div className="form-group"><label>Program *</label>{programsLoading ? <p>Loading programs...</p> : <select value={newUser.program_id || ""} onChange={(e) => { const selectedProg = programs.find(p => p.id === e.target.value); setNewUser({ ...newUser, program_id: selectedProg?.id || "", program: selectedProg?.name || "", program_code: selectedProg?.code || "" }); }} className="form-select"><option value="">Select Program</option>{programs.map((prog) => (<option key={prog.id} value={prog.id}>{prog.name} ({prog.code})</option>))}</select>}</div>
                  <div className="form-group"><label>Department Code *</label><input type="text" value={newUser.department_code} onChange={(e) => setNewUser({ ...newUser, department_code: e.target.value.trim().toUpperCase().replace(/\s+/g, "") })} placeholder="e.g. SCT" className="form-input" /></div>
                  <div className="form-group"><label>Academic Year *</label><input type="text" value={newUser.academic_year} onChange={(e) => setNewUser({ ...newUser, academic_year: e.target.value.trim() })} placeholder="e.g. 2025/2029" className="form-input" /></div>
                  <div className="form-row">
                    <div className="form-group"><label>Year of Study</label><select value={newUser.year_of_study} onChange={(e) => setNewUser({ ...newUser, year_of_study: parseInt(e.target.value) })} className="form-select">{[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}</select></div>
                    <div className="form-group"><label>Semester</label><select value={newUser.semester} onChange={(e) => setNewUser({ ...newUser, semester: parseInt(e.target.value) })} className="form-select"><option value={1}>Semester 1</option><option value={2}>Semester 2</option></select></div>
                  </div>
                </>
              )}

              {newUser.role === "lecturer" && (
                <>
                  <div className="form-group"><label>Department</label><input type="text" value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} placeholder="e.g., Computer Science" className="form-input" /></div>
                  <div className="form-group"><label>Specialization</label><input type="text" value={newUser.specialization} onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })} placeholder="e.g., Web Development" className="form-input" /></div>
                  <div className="form-group"><label>Google Meet Link</label><input type="url" value={newUser.google_meet_link} onChange={(e) => setNewUser({ ...newUser, google_meet_link: e.target.value })} placeholder="https://meet.google.com/xxx-xxxx-xxx" className="form-input" /></div>
                </>
              )}

              {newUser.role === "dean" && (
                <div className="form-group"><label>Faculty *</label><select value={newUser.faculty_id} onChange={(e) => { const selectedFaculty = faculties.find(f => f.id === e.target.value); setNewUser({ ...newUser, faculty_id: e.target.value, faculty_name: selectedFaculty?.faculty_name || "" }); }} className="form-select" required><option value="">Select Faculty</option>{faculties.map((faculty) => (<option key={faculty.id} value={faculty.id}>{faculty.faculty_name} ({faculty.faculty_code})</option>))}</select></div>
              )}

              {newUser.role === "hod" && (
                <div className="form-group"><label>Department *</label><select value={newUser.department_id} onChange={(e) => { const selectedDept = departments.find(d => d.id === e.target.value); setNewUser({ ...newUser, department_id: e.target.value, department_name: selectedDept?.department_name || "", department_code: selectedDept?.department_code || "" }); }} className="form-select" required><option value="">Select Department</option>{departments.map((dept) => (<option key={dept.id} value={dept.id}>{dept.department_name} ({dept.department_code})</option>))}</select></div>
              )}

              {newUser.role === "finance" && (
                <div className="form-group"><label>Department</label><input type="text" value="Finance Department" disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} /><small style={{ color: '#999' }}>Department is fixed</small></div>
              )}

              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={() => {
                  if (newUser.role === "student") handleAddStudent();
                  else if (newUser.role === "lecturer") handleAddLecturer();
                  else if (newUser.role === "dean") handleAddDean();
                  else if (newUser.role === "hod") handleAddHOD();
                  else if (newUser.role === "finance") handleAddFinance();
                }}>{newUser.role === "student" && "Add Student"}{newUser.role === "lecturer" && "Add Lecturer"}{newUser.role === "dean" && "Add Dean"}{newUser.role === "hod" && "Add HOD"}{newUser.role === "finance" && "Add Finance Officer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editUser.role?.charAt(0).toUpperCase() + editUser.role?.slice(1)}</h3>
            <div className="modal-form">
              <div className="form-group"><label>Full Name *</label><input type="text" value={editUser.full_name} onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })} className="form-input" /></div>
              <div className="form-group"><label>Email</label><input type="email" value={editUser.email} disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} /><small style={{ color: '#999' }}>Email cannot be changed</small></div>

              {(editUser.role === "student" || editUser.role === "lecturer") && (
                <div className="form-group"><label>Phone</label><input type="tel" value={editUser.phone || ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} className="form-input" /></div>
              )}

              <div className="form-group"><label>Status</label><select value={editUser.status} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })} className="form-select"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>

              {editUser.role === "student" && (
                <>
                  <div className="form-group"><label>Program</label><input type="text" value={editUser.program || ''} onChange={(e) => setEditUser({ ...editUser, program: e.target.value })} className="form-input" /></div>
                  <div className="form-group"><label>Department Code</label><input type="text" value={editUser.department_code || ''} onChange={(e) => setEditUser({ ...editUser, department_code: e.target.value })} className="form-input" /></div>
                  <div className="form-row"><div className="form-group"><label>Year of Study</label><select value={editUser.year_of_study} onChange={(e) => setEditUser({ ...editUser, year_of_study: parseInt(e.target.value) })} className="form-select">{[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}</select></div><div className="form-group"><label>Semester</label><select value={editUser.semester} onChange={(e) => setEditUser({ ...editUser, semester: parseInt(e.target.value) })} className="form-select"><option value={1}>Semester 1</option><option value={2}>Semester 2</option></select></div></div>
                  <div className="form-group"><label>Academic Year</label><input type="text" value={editUser.academic_year || ''} onChange={(e) => setEditUser({ ...editUser, academic_year: e.target.value })} className="form-input" /></div>
                </>
              )}

              {editUser.role === "lecturer" && (
                <>
                  <div className="form-group"><label>Department</label><input type="text" value={editUser.department || ''} onChange={(e) => setEditUser({ ...editUser, department: e.target.value })} className="form-input" /></div>
                  <div className="form-group"><label>Specialization</label><input type="text" value={editUser.specialization || ''} onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })} className="form-input" /></div>
                  <div className="form-group"><label>Google Meet Link</label><input type="url" value={editUser.google_meet_link || ''} onChange={(e) => setEditUser({ ...editUser, google_meet_link: e.target.value })} className="form-input" /></div>
                </>
              )}

              {editUser.role === "dean" && (
                <>
                  <div style={{ background: '#f5f5f5', padding: '10px 15px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    <strong>📚 Faculty Information</strong>
                    <p style={{ margin: '4px 0 0 0' }}>This information is stored in the faculties table</p>
                  </div>
                  <div className="form-group">
                    <label>Faculty</label>
                    <input
                      type="text"
                      value={editUser.faculty_id ? faculties.find(f => f.id === editUser.faculty_id)?.faculty_name || 'N/A' : 'N/A'}
                      disabled
                      className="form-input"
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#999' }}>Faculty cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      value={editUser.contact_email || ''}
                      onChange={(e) => setEditUser({ ...editUser, contact_email: e.target.value })}
                      className="form-input"
                      placeholder="Enter faculty contact email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={editUser.contact_phone || ''}
                      onChange={(e) => setEditUser({ ...editUser, contact_phone: e.target.value })}
                      className="form-input"
                      placeholder="Enter faculty contact phone"
                    />
                  </div>
                </>
              )}

              {editUser.role === "hod" && (
                <>
                  <div style={{ background: '#f5f5f5', padding: '10px 15px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                    <strong>🏢 Department Information</strong>
                    <p style={{ margin: '4px 0 0 0' }}>This information is stored in the departments table</p>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      value={editUser.department_id ? departments.find(d => d.id === editUser.department_id)?.department_name || 'N/A' : 'N/A'}
                      disabled
                      className="form-input"
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    />
                    <small style={{ color: '#999' }}>Department cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      value={editUser.contact_email || ''}
                      onChange={(e) => setEditUser({ ...editUser, contact_email: e.target.value })}
                      className="form-input"
                      placeholder="Enter department contact email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="tel"
                      value={editUser.contact_phone || ''}
                      onChange={(e) => setEditUser({ ...editUser, contact_phone: e.target.value })}
                      className="form-input"
                      placeholder="Enter department contact phone"
                    />
                  </div>
                </>
              )}

              {editUser.role === "finance" && (
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value="Finance Department"
                    disabled
                    className="form-input"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#999' }}>Department cannot be changed</small>
                </div>
              )}

              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleEditUser}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>💬 Send Message to {selectedUser?.full_name || selectedUser?.email}</h3>
            <div className="modal-form">
              <div className="form-group"><label>To</label><input type="text" value={selectedUser?.email || ''} disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} /></div>
              <div className="form-group"><label>Message</label><textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type your message here..." rows="5" className="form-textarea" /></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowMessageModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSendMessage} disabled={!messageText.trim()}>Send Message</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkMessageModal && (
        <div className="modal-overlay" onClick={() => setShowBulkMessageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>📨 Send Message to All {bulkMessageRole?.charAt(0).toUpperCase() + bulkMessageRole?.slice(1)}s</h3>
            <div className="modal-form">
              <div className="form-group"><label>Recipients</label><input type="text" value={`All ${bulkMessageRole}s (${bulkMessageRole === 'lecturer' ? lecturers.length : bulkMessageRole === 'dean' ? deans.length : bulkMessageRole === 'hod' ? hods.length : bulkMessageRole === 'finance' ? financeOfficers.length : students.length} recipients)`} disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} /></div>
              <div className="form-group"><label>Message</label><textarea value={bulkMessageText} onChange={(e) => setBulkMessageText(e.target.value)} placeholder={`Type your message to all ${bulkMessageRole}s...`} rows="5" className="form-textarea" /></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowBulkMessageModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSendBulkMessage} disabled={!bulkMessageText.trim()}>Send to All</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCourseModal && (
        <div className="modal-overlay" onClick={() => setShowCourseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Course</h3>
            <div className="modal-form">
              <div className="form-group"><label>Course Code *</label><input type="text" value={newCourse.course_code} onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })} placeholder="e.g., CS-401" className="form-input" /></div>
              <div className="form-group"><label>Course Name *</label><input type="text" value={newCourse.course_name} onChange={(e) => setNewCourse({ ...newCourse, course_name: e.target.value })} placeholder="e.g., Machine Learning" className="form-input" /></div>
              <div className="form-group"><label>Description</label><textarea value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} placeholder="Course description" rows="3" className="form-textarea" /></div>
              <div className="form-row"><div className="form-group"><label>Year</label><select value={newCourse.year} onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })} className="form-select">{[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}</select></div><div className="form-group"><label>Semester</label><select value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: parseInt(e.target.value) })} className="form-select"><option value={1}>Semester 1</option><option value={2}>Semester 2</option></select></div><div className="form-group"><label>Credits</label><input type="number" value={newCourse.credits} onChange={(e) => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) })} min="1" max="6" className="form-input" /></div></div>
              <div className="form-group"><label>Department Code</label><input type="text" value={newCourse.department_code} onChange={(e) => setNewCourse({ ...newCourse, department_code: e.target.value })} placeholder="e.g., ENG, SCT" className="form-input" /></div>
              <div className="form-group"><label>Program</label><input type="text" value={newCourse.program} onChange={(e) => setNewCourse({ ...newCourse, program: e.target.value })} placeholder="e.g., Computer Engineering" className="form-input" /></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowCourseModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleAddCourse}>Add Course</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExamsModal && (
        <div className="modal-overlay" onClick={() => setShowExamsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule New Exam</h3>
            <div className="modal-form">
              <div className="form-group"><label>Course *</label><select value={newExam.course_id} onChange={(e) => setNewExam({ ...newExam, course_id: e.target.value })} className="form-select"><option value="">Select Course</option>{courses.map((course) => (<option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>))}</select></div>
              <div className="form-group"><label>Title *</label><input type="text" value={newExam.title} onChange={(e) => setNewExam({ ...newExam, title: e.target.value })} placeholder="e.g. Midterm Examination" className="form-input" /></div>
              <div className="form-group"><label>Description</label><textarea value={newExam.description} onChange={(e) => setNewExam({ ...newExam, description: e.target.value })} placeholder="Brief description" rows="3" className="form-textarea" /></div>
              <div className="form-row"><div className="form-group"><label>Start Date & Time *</label><input type="datetime-local" value={newExam.start_time} onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })} className="form-input" /></div><div className="form-group"><label>End Date & Time *</label><input type="datetime-local" value={newExam.end_time} onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })} className="form-input" /></div></div>
              <div className="form-row"><div className="form-group"><label>Total Marks *</label><input type="number" value={newExam.total_marks} onChange={(e) => setNewExam({ ...newExam, total_marks: parseInt(e.target.value) || 100 })} min="1" className="form-input" /></div><div className="form-group"><label>Venue</label><input type="text" value={newExam.venue} onChange={(e) => setNewExam({ ...newExam, venue: e.target.value })} placeholder="e.g. Main Hall, Online" className="form-input" /></div></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowExamsModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleAddExam}>Schedule Exam</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFinanceModal && (
        <div className="modal-overlay" onClick={() => setShowFinanceModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Financial Record</h3>
            <div className="modal-form">
              <div className="form-group"><label>Student ID *</label><input type="text" value={newFinanceRecord.student_id} onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, student_id: e.target.value })} placeholder="Enter student ID" className="form-input" /></div>
              <div className="form-group"><label>Description *</label><input type="text" value={newFinanceRecord.description} onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, description: e.target.value })} placeholder="e.g., Tuition Fee, Library Fine" className="form-input" /></div>
              <div className="form-row"><div className="form-group"><label>Amount ($) *</label><input type="number" value={newFinanceRecord.amount} onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, amount: parseFloat(e.target.value) || 0 })} min="0" step="0.01" className="form-input" /></div><div className="form-group"><label>Payment Date</label><input type="date" value={newFinanceRecord.payment_date} onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, payment_date: e.target.value })} className="form-input" /></div></div>
              <div className="form-group"><label>Status</label><select value={newFinanceRecord.status} onChange={(e) => setNewFinanceRecord({ ...newFinanceRecord, status: e.target.value })} className="form-select"><option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowFinanceModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleAddFinanceRecord}>Add Record</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTimetableModal && (
        <div className="modal-overlay" onClick={() => setShowTimetableModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedTimetable ? "Edit" : "Create New"} Timetable</h3>
            <div className="modal-form">
              <div className="form-group"><label>Program</label><select value={newTimetable.program_id} onChange={(e) => setNewTimetable({ ...newTimetable, program_id: e.target.value })} className="form-select" disabled={selectedTimetable}><option value="">Select Program</option>{programs.map((prog) => (<option key={prog.id} value={prog.id}>{prog.name} ({prog.code})</option>))}</select></div>
              <div className="form-row"><div className="form-group"><label>Academic Year</label><input type="text" value={newTimetable.academic_year} onChange={(e) => setNewTimetable({ ...newTimetable, academic_year: e.target.value })} placeholder="e.g. 2024/2025" className="form-input" /></div><div className="form-group"><label>Semester</label><select value={newTimetable.semester} onChange={(e) => setNewTimetable({ ...newTimetable, semester: parseInt(e.target.value) })} className="form-select"><option value={1}>Semester 1</option><option value={2}>Semester 2</option></select></div><div className="form-group"><label>Year of Study</label><select value={newTimetable.year_of_study} onChange={(e) => setNewTimetable({ ...newTimetable, year_of_study: parseInt(e.target.value) })} className="form-select">{[1, 2, 3, 4].map((y) => (<option key={y} value={y}>Year {y}</option>))}</select></div></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowTimetableModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSaveTimetable}>Save Timetable</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSlotModal && selectedTimetable && (
        <div className="modal-overlay" onClick={() => setShowSlotModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSlot ? "Edit" : "Add New"} Time Slot</h3>
            <div className="modal-form">
              <div className="form-row"><div className="form-group"><label>Course Code</label><input type="text" value={newSlot.course_code} onChange={(e) => setNewSlot({ ...newSlot, course_code: e.target.value })} placeholder="e.g. CSC301" className="form-input" /></div><div className="form-group"><label>Course Name</label><input type="text" value={newSlot.course_name} onChange={(e) => setNewSlot({ ...newSlot, course_name: e.target.value })} placeholder="e.g. Database Systems" className="form-input" /></div></div>
              <div className="form-group"><label>Lecturer</label><select value={newSlot.lecturer_id} onChange={(e) => setNewSlot({ ...newSlot, lecturer_id: e.target.value })} className="form-select"><option value="">Not Assigned</option>{lecturersList.map((lec) => (<option key={lec.id} value={lec.id}>{lec.full_name}</option>))}</select></div>
              <div className="form-row"><div className="form-group"><label>Day</label><select value={newSlot.day_of_week} onChange={(e) => setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })} className="form-select"><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option></select></div><div className="form-group"><label>Start Time</label><input type="time" value={newSlot.start_time} onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })} className="form-input" /></div><div className="form-group"><label>End Time</label><input type="time" value={newSlot.end_time} onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })} className="form-input" /></div></div>
              <div className="form-row"><div className="form-group"><label>Room</label><input type="text" value={newSlot.room_number} onChange={(e) => setNewSlot({ ...newSlot, room_number: e.target.value })} placeholder="e.g. 101" className="form-input" /></div><div className="form-group"><label>Building</label><input type="text" value={newSlot.building} onChange={(e) => setNewSlot({ ...newSlot, building: e.target.value })} placeholder="e.g. CS Building" className="form-input" /></div><div className="form-group"><label>Type</label><select value={newSlot.slot_type} onChange={(e) => setNewSlot({ ...newSlot, slot_type: e.target.value })} className="form-select"><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="tutorial">Tutorial</option><option value="practical">Practical</option></select></div></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowSlotModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSaveSlot}>{editingSlot ? "Update" : "Add"} Slot</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProgramModal && (
        <div className="modal-overlay" onClick={() => setShowProgramModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProgram ? "Edit" : "Add New"} Program</h3>
            <div className="modal-form">
              <div className="form-group"><label>Program Name *</label><input type="text" value={newProgram.name} onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })} placeholder="e.g. Bachelor of Science in Computer Engineering" className="form-input" /></div>
              <div className="form-group"><label>Program Code *</label><input type="text" value={newProgram.code} onChange={(e) => setNewProgram({ ...newProgram, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="e.g. BSCE" className="form-input" /></div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setShowProgramModal(false)}>Cancel</button>
                <button className="confirm-button" onClick={handleSaveProgram}>{editingProgram ? "Update" : "Add"} Program</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeptAssignmentModal && selectedLecturerForDept && (
        <DepartmentAssignmentModal lecturer={selectedLecturerForDept} onClose={() => { setShowDeptAssignmentModal(false); setSelectedLecturerForDept(null); }} onAssign={() => { fetchLecturers(); fetchDashboardStats(); }} />
      )}

      {showCourseAssignmentModal && selectedLecturerForCourses && (
        <CourseAssignmentModal lecturer={selectedLecturerForCourses} onClose={() => { setShowCourseAssignmentModal(false); setSelectedLecturerForCourses(null); }} onAssign={() => { fetchLecturers(); }} />
      )}

      {showProfilePictureModal && selectedStudentForPicture && (
        <StudentProfilePictureModal student={selectedStudentForPicture} onClose={() => { setShowProfilePictureModal(false); setSelectedStudentForPicture(null); }} onUpdate={handleStudentPictureUpdate} />
      )}

      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="small-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="confirm-logout-button" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;