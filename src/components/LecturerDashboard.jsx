// LecturerDashboard.jsx - Fixed Notification Bell + Chat Modal + Settings Tab
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import { useLecturerDepartments } from '../hooks/useLecturerDepartments';
import './LecturerDashboard.css';

// Import sub-components
import LecturerFilesManager from './LecturerFilesManager';
import LecturerAssignmentsManager from './LecturerAssignmentsManager';
import LecturerExamsManager from './LecturerExamsManager';
import LecturerLecturesManager from './LecturerLecturesManager';
import LecturerNotesManager from './LecturerNotesManager';
import LecturerSettings from './LecturerSettings';

const LecturerDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut, isLecturer, loading: authLoading } = useAdminAuth();

  // Department hook
  const {
    departments: allowedDepartments,
    departmentCodes,
    loading: lecturerDeptLoading,
    hasAccess,
  } = useLecturerDepartments(isLecturer ? profile?.id : null);

  // ==================== STATE MANAGEMENT ====================
  
  // Tab & UI state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState({ dashboard: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const subscriptionRef = useRef(null);
  const notificationSubscriptionRef = useRef(null);

  // Data states
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [selectedHOD, setSelectedHOD] = useState(null);
  const [hods, setHODs] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  const notificationToastTimeoutRef = useRef(null);

  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    totalAssignments: 0,
    totalExams: 0,
    totalLectures: 0,
    pendingExams: 0,
    pendingAssignments: 0,
    myAssignments: 0,
    pendingGrading: 0,
    gradedSubmissions: 0,
    submissionRate: 0,
  });

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // ==================== PROFILE UPDATE ====================
  const handleProfileUpdate = (updatedData) => {
    if (updatedData.profile_picture_url !== undefined) {
      profile.profile_picture_url = updatedData.profile_picture_url;
      setProfileVersion(Date.now());
    }
  };

  // ==================== CHAT FUNCTIONS ====================
  
  const fetchHODs = useCallback(async () => {
    if (!departmentCodes || departmentCodes.length === 0) return;
    
    try {
      const { data: depts } = await supabase
        .from('departments')
        .select('id')
        .in('department_code', departmentCodes);
      
      const deptIds = depts?.map(d => d.id) || [];
      if (deptIds.length === 0) return;

      const { data: hodRoles, error } = await supabase
        .from('user_roles')
        .select(`
          id, email, role, department_id, faculty_id,
          departments:department_id (department_code, department_name, head_of_department)
        `)
        .eq('role', 'hod')
        .in('department_id', deptIds);

      if (error) throw error;
      setHODs(hodRoles || []);
    } catch (err) {
      console.error('Error fetching HODs:', err);
    }
  }, [departmentCodes]);

  const fetchChatMessages = useCallback(async (hodEmail) => {
    const lecturerEmail = (profile?.email || '').toLowerCase();
    const targetEmail = (hodEmail || '').toLowerCase();
    
    if (!lecturerEmail || !targetEmail) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_email.eq.${lecturerEmail},receiver_email.eq.${targetEmail}),and(sender_email.eq.${targetEmail},receiver_email.eq.${lecturerEmail})`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setChatMessages(data || []);
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error fetching chat:', err);
    }
  }, [profile?.email]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedHOD) return;
    
    setSendingMessage(true);
    try {
      const messageData = {
        sender_id: profile?.id,
        sender_email: (profile?.email || '').toLowerCase(),
        sender_role: 'lecturer',
        sender_name: profile?.full_name,
        receiver_email: (selectedHOD.email || '').toLowerCase(),
        receiver_role: 'hod',
        message: newMessage.trim(),
        department_id: selectedHOD.department_id,
        faculty_id: selectedHOD.faculty_id,
        is_read: false,
      };

      const { error } = await supabase.from('chat_messages').insert([messageData]);
      if (error) throw error;

      try {
        await supabase.from('notifications').insert([{
          student_id: '0',
          user_email: (selectedHOD.email || '').toLowerCase(),
          title: 'New Message from Lecturer',
          message: `${profile?.full_name}: "${newMessage.trim().substring(0, 50)}..."`,
          sender_email: (profile?.email || '').toLowerCase(),
          sender_name: profile?.full_name,
          sender_role: 'lecturer',
          type: 'message',
          is_read: false,
        }]);
      } catch (notifError) {
        console.warn('Could not create notification:', notifError);
      }

      setNewMessage('');
      await fetchChatMessages(selectedHOD.email);
      showToast('Message sent!', 'success');
    } catch (err) {
      console.error('Error sending message:', err);
      showToast('Failed to send message', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const openChatWithHOD = (hod) => {
    setSelectedHOD(hod);
    setShowChat(true);
    fetchChatMessages(hod.email);
  };

  const openChatModal = () => {
    setSelectedHOD(null);
    setChatMessages([]);
    setShowChat(true);
  };

  // ==================== NOTIFICATIONS FUNCTIONS ====================
  
  const fetchNotifications = useCallback(async () => {
    if (!profile?.email) return;
    
    const email = profile.email.toLowerCase();
    
    try {
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifError) console.error('Error fetching notifications:', notifError);

      const { data: unreadMessages, error: chatError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', email)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (chatError) console.error('Error fetching chat messages:', chatError);

      const combinedNotifications = [
        ...(notifData || []).map(n => ({ ...n, _source: 'notification' })),
        ...(unreadMessages || []).map(msg => ({
          id: `chat-${msg.id}`,
          user_email: msg.receiver_email,
          title: `Message from ${msg.sender_name || 'HOD'}`,
          message: msg.message,
          sender_email: msg.sender_email,
          sender_name: msg.sender_name,
          sender_role: msg.sender_role,
          type: 'message',
          is_read: false,
          created_at: msg.created_at,
          _source: 'chat',
          _chat_id: msg.id
        }))
      ];

      combinedNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(combinedNotifications);
      setUnreadCount(combinedNotifications.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error in fetchNotifications:', err);
    }
  }, [profile?.email]);

  const markNotificationRead = async (id) => {
    try {
      if (typeof id === 'string' && id.startsWith('chat-')) {
        const chatId = id.replace('chat-', '');
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', chatId);
      } else {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      }
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const email = profile.email.toLowerCase();
      
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_email', email)
        .eq('is_read', false);
      
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', email)
        .eq('is_read', false);
      
      await fetchNotifications();
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification.id);
    setShowNotifications(false);
    
    if (notification.type === 'message' && notification.sender_role === 'hod') {
      const hod = hods.find(h => h.email?.toLowerCase() === notification.sender_email?.toLowerCase());
      if (hod) {
        openChatWithHOD(hod);
      } else {
        openChatModal();
      }
    }
  };

  const displayNotificationToast = (notification) => {
    setLatestNotification(notification);
    setShowNotificationToast(true);
    
    if (notificationToastTimeoutRef.current) {
      clearTimeout(notificationToastTimeoutRef.current);
    }
    
    notificationToastTimeoutRef.current = setTimeout(() => {
      setShowNotificationToast(false);
    }, 5000);
  };

  // ==================== EFFECTS ====================
  
  useEffect(() => {
    if (authLoading) return;
    if (!authLoading && !profile) {
      navigate('/login');
      return;
    }
    if (profile) {
      initializeDashboard();
      setupRealtimeSubscription();
      setupNotificationSubscription();
      fetchHODs();
      fetchNotifications();
    }
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
      if (notificationSubscriptionRef.current) notificationSubscriptionRef.current.unsubscribe();
      if (notificationToastTimeoutRef.current) clearTimeout(notificationToastTimeoutRef.current);
    };
  }, [profile, authLoading, navigate, fetchHODs, fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (profile?.email) fetchNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [profile?.email, fetchNotifications]);

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        setProgramsLoading(true);
        const { data, error } = await supabase
          .from("programs")
          .select("id, name, code")
          .order("name", { ascending: true });
        if (error) throw error;
        setPrograms(data || []);
      } catch (err) {
        console.error("Error loading programs:", err);
        setPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    };
    loadPrograms();
  }, []);

  // ==================== INITIALIZATION ====================
  
  const initializeDashboard = async () => {
    try {
      setLoading(prev => ({ ...prev, dashboard: true }));
      await Promise.all([
        fetchDashboardStats(),
        fetchStudents(),
        fetchCourses(),
        fetchExams(),
      ]);
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      setLoading(prev => ({ ...prev, dashboard: false }));
    }
  };

  const setupRealtimeSubscription = () => {
    try {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
      const subscription = supabase
        .channel("lecturer-dashboard-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => { fetchStudents(); fetchDashboardStats(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => { fetchCourses(); fetchDashboardStats(); })
        .subscribe((status) => {
          setRealtimeConnected(status === "SUBSCRIBED");
        });
      subscriptionRef.current = subscription;
    } catch (error) {
      console.error("Realtime subscription error:", error);
    }
  };

  const setupNotificationSubscription = () => {
    try {
      if (notificationSubscriptionRef.current) notificationSubscriptionRef.current.unsubscribe();
      
      const email = profile?.email?.toLowerCase();
      if (!email) return;
      
      const notifSubscription = supabase
        .channel(`lecturer-notifications-${profile.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_email=eq.${email}`,
        }, (payload) => {
          fetchNotifications();
          displayNotificationToast(payload.new);
        })
        .subscribe();

      const chatSubscription = supabase
        .channel(`lecturer-chat-${profile.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_email=eq.${email}`,
        }, (payload) => {
          const msg = payload.new;
          const chatNotification = {
            id: `chat-${msg.id}`,
            user_email: msg.receiver_email,
            title: `Message from ${msg.sender_name}`,
            message: msg.message,
            sender_email: msg.sender_email,
            sender_name: msg.sender_name,
            sender_role: msg.sender_role,
            type: 'message',
            is_read: false,
            created_at: msg.created_at,
            _source: 'chat',
            _chat_id: msg.id
          };
          fetchNotifications();
          displayNotificationToast(chatNotification);
        })
        .subscribe();

      notificationSubscriptionRef.current = {
        unsubscribe: () => {
          notifSubscription.unsubscribe();
          chatSubscription.unsubscribe();
        }
      };
    } catch (error) {
      console.error("Notification subscription error:", error);
    }
  };

  // ==================== DATA FETCHING ====================
  
  const fetchDashboardStats = async () => {
    try {
      let studentQuery = supabase.from("students").select("*", { count: "exact", head: true });
      if (departmentCodes.length > 0) studentQuery = studentQuery.in("department_code", departmentCodes);

      let courseQuery = supabase.from("courses").select("*", { count: "exact", head: true });
      if (departmentCodes.length > 0) courseQuery = courseQuery.in("department_code", departmentCodes);

      const [studentsRes, coursesRes, assignmentsRes, lecturesRes] = await Promise.all([
        studentQuery,
        courseQuery,
        supabase.from("assignments").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id),
        supabase.from("lectures").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id),
      ]);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsRes.count || 0,
        totalCourses: coursesRes.count || 0,
        totalAssignments: assignmentsRes.count || 0,
        totalLectures: lecturesRes.count || 0,
      }));
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase.from("students").select("*").limit(100).order("created_at", { ascending: false });
      if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
      if (departmentCodes.length > 0) query = query.in("department_code", departmentCodes);
      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchCourses = async () => {
    try {
      let query = supabase.from("courses").select("*").limit(100).order("year").order("semester");
      if (searchTerm) query = query.or(`course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%`);
      query = query.eq("lecturer_id", profile.id);
      const { data, error } = await query;
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchExams = async () => {
    try {
      let query = supabase.from("examinations").select(`*, courses (course_code, course_name, department_code)`).limit(100).order("start_time", { ascending: true });
      const { data: deptCourses } = await supabase.from("courses").select("id").in("department_code", departmentCodes);
      const courseIds = deptCourses?.map(c => c.id) || [];
      if (courseIds.length > 0) query = query.in("course_id", courseIds);
      const { data, error } = await query;
      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error("Error fetching exams:", error);
    }
  };

  // ==================== TOAST ====================
  
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const hideToast = () => setToast({ show: false, message: '', type: 'success' });

  // ==================== LOGOUT ====================
  
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      navigate("/login");
    }
  };

  // ==================== RENDER HELPERS ====================
  
  const renderStudentsTable = () => (
    <div className="lecturer-table-container">
      <table className="lecturer-data-table">
        <thead>
          <tr>
            <th style={{ width: "50px" }}>Photo</th>
            <th>Student ID</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Program</th>
            <th>Department</th>
            <th>Year</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr><td colSpan="8" className="lecturer-empty-state">No students found</td></tr>
          ) : (
            students.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="lecturer-student-avatar" style={{ width: '35px', height: '35px' }}>
                    {student.profile_picture_url ? (
                      <img src={student.profile_picture_url} alt={student.full_name} />
                    ) : (
                      <span style={{ fontSize: '14px' }}>{student.full_name?.[0]?.toUpperCase() || "👤"}</span>
                    )}
                  </div>
                </td>
                <td><strong>{student.student_id}</strong></td>
                <td>{student.full_name}</td>
                <td>{student.email}</td>
                <td>{student.program || "N/A"}</td>
                <td><span className="lecturer-dept-badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>{student.department_code || "N/A"}</span></td>
                <td>Year {student.year_of_study || 1} - Sem {student.semester || 1}</td>
                <td><span className={`lecturer-status-badge ${student.status || "active"}`}>{(student.status || "active").charAt(0).toUpperCase() + (student.status || "active").slice(1)}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderCoursesGrid = () => (
    <div className="lecturer-courses-grid">
      {courses.map((course) => (
        <div key={course.id} className="lecturer-course-card">
          <div className="lecturer-course-header">
            <h3>{course.course_code}</h3>
            <div className="lecturer-course-header-right">
              <span className="lecturer-dept-badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>{course.department_code || course.department || "N/A"}</span>
              <span className={`lecturer-course-status ${course.is_active ? "active" : "inactive"}`}>{course.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>
          <h4>{course.course_name}</h4>
          <p className="lecturer-course-description">{course.description || "No description"}</p>
          <div className="lecturer-course-details">
            <span>Year {course.year} - Semester {course.semester}</span>
            <span>{course.credits} Credits</span>
            <span>{course.program}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // ==================== LOADING STATES ====================
  
  if (authLoading) {
    return <div className="lecturer-loading-container"><div className="lecturer-spinner"></div><p>Checking authentication...</p></div>;
  }
  if (!profile) return null;
  if (lecturerDeptLoading) {
    return <div className="lecturer-loading-container"><div className="lecturer-spinner"></div><p>Loading your access permissions...</p></div>;
  }
  if (!hasAccess) {
    return (
      <div className="lecturer-restricted-access">
        <div className="lecturer-restricted-card">
          <div className="lecturer-restricted-icon">🔒</div>
          <h2>No Department Access</h2>
          <p>You haven't been assigned to any academic departments yet.</p>
          <button onClick={() => supabase.auth.signOut()} className="lecturer-restricted-logout">Logout</button>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  
  return (
    <div className="lecturer-dashboard">
      {/* Toast */}
      {toast.show && (
        <div className={`lecturer-toast lecturer-toast-${toast.type}`}>
          <span className="lecturer-toast-icon">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span className="lecturer-toast-message">{toast.message}</span>
          <button className="lecturer-toast-close" onClick={hideToast}>✕</button>
        </div>
      )}

      {/* Notification Toast */}
      {showNotificationToast && latestNotification && (
        <div className="lecturer-notification-toast" onClick={() => {
          setShowNotificationToast(false);
          handleNotificationClick(latestNotification);
        }}>
          <div className="lecturer-notification-toast-icon">
            {latestNotification.type === 'message' ? '💬' : '🔔'}
          </div>
          <div className="lecturer-notification-toast-content">
            <strong>{latestNotification.title || 'New Notification'}</strong>
            <p>{latestNotification.message}</p>
          </div>
          <button 
            className="lecturer-notification-toast-close"
            onClick={(e) => {
              e.stopPropagation();
              setShowNotificationToast(false);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="lecturer-header">
        <div className="lecturer-header-content">
          <div className="lecturer-header-left">
            <h1 className="lecturer-logo">LECTURER PORTAL</h1>
            <p className="lecturer-tagline">Teaching & Course Management</p>
            <div className="lecturer-realtime">
              <span className={`lecturer-realtime-dot ${realtimeConnected ? "connected" : "disconnected"}`}></span>
              <span>{realtimeConnected ? "Connected" : "Disconnected"}</span>
            </div>
            {allowedDepartments && allowedDepartments.length > 0 && (
              <div className="lecturer-dept-access">
                <span className="lecturer-access-label">Access to:</span>
                <div className="lecturer-dept-badges">
                  {allowedDepartments.slice(0, 3).map((dept, idx) => (
                    <span key={idx} className="lecturer-dept-badge">{dept.department_code}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lecturer-user-section">
            {/* Notification Bell */}
            <div className="lecturer-notification-wrapper" style={{ position: 'relative', marginRight: '10px' }}>
              <button 
                className="lecturer-notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '35px',
                  height: '35px',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#ff1744',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 5px',
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
                <div className="lecturer-notification-dropdown">
                  <div className="lecturer-notification-header">
                    <h4>Notifications ({unreadCount} unread)</h4>
                    {unreadCount > 0 && (
                      <button 
                        className="lecturer-notification-mark-all"
                        onClick={markAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="lecturer-notification-list">
                    {notifications.length === 0 ? (
                      <div className="lecturer-notification-empty" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                        <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
                        <p style={{ margin: '0', fontSize: '14px' }}>No notifications</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`lecturer-notification-item ${!notif.is_read ? 'unread' : ''}`} 
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <span style={{ fontSize: '18px', flexShrink: 0 }}>
                            {notif.type === 'message' || notif._source === 'chat' ? '💬' : notif.type === 'exam' ? '📝' : '🔔'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ 
                              display: 'block',
                              color: '#1a237e', 
                              fontSize: '12px',
                              marginBottom: '2px'
                            }}>
                              {notif.title || (notif.sender_name ? `Message from ${notif.sender_name}` : 'Notification')}
                            </strong>
                            <p style={{ 
                              margin: '0 0 4px 0', 
                              fontSize: '11px', 
                              color: '#555',
                              lineHeight: '1.3'
                            }}>
                              {notif.message}
                            </p>
                            <small style={{ color: '#999', fontSize: '10px' }}>
                              {new Date(notif.created_at).toLocaleString()}
                            </small>
                          </div>
                          {!notif.is_read && (
                            <span style={{
                              width: '6px',
                              height: '6px',
                              background: '#1976d2',
                              borderRadius: '50%',
                              flexShrink: 0,
                              marginTop: '4px'
                            }}></span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="lecturer-user-info">
              <div className="lecturer-avatar">
                {profile?.profile_picture_url ? (
                  <img 
                    src={`${profile.profile_picture_url}?t=${profileVersion}`} 
                    alt={profile.full_name} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: '50%', 
                      objectFit: 'cover' 
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.textContent = profile.full_name?.[0]?.toUpperCase() || "U";
                    }}
                  />
                ) : (
                  profile.full_name?.[0]?.toUpperCase() || "U"
                )}
              </div>
              <div>
                <p className="lecturer-user-name">{profile.full_name || profile.email}</p>
                <p className="lecturer-user-role"><span className="lecturer-role-badge">LECTURER</span></p>
              </div>
            </div>
            <button className="lecturer-logout-btn" onClick={() => setShowLogoutModal(true)}>Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="lecturer-nav">
        <button className={`lecturer-nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>📊 Dashboard</button>
        <button className={`lecturer-nav-item ${activeTab === "my-files" ? "active" : ""}`} onClick={() => setActiveTab("my-files")}>📁 My Files</button>
        <button className={`lecturer-nav-item ${activeTab === "my-assignments" ? "active" : ""}`} onClick={() => setActiveTab("my-assignments")}>📝 My Assignments</button>
        <button className={`lecturer-nav-item ${activeTab === "lectures" ? "active" : ""}`} onClick={() => setActiveTab("lectures")}>🎓 My Lectures</button>
        <button className={`lecturer-nav-item ${activeTab === "exams" ? "active" : ""}`} onClick={() => setActiveTab("exams")}>🎯 Exams</button>
        <button className={`lecturer-nav-item ${activeTab === "students" ? "active" : ""}`} onClick={() => setActiveTab("students")}>👥 Students</button>
        <button className={`lecturer-nav-item ${activeTab === "courses" ? "active" : ""}`} onClick={() => setActiveTab("courses")}>📖 Courses</button>
        <button className={`lecturer-nav-item ${activeTab === "notes-upload" ? "active" : ""}`} onClick={() => setActiveTab("notes-upload")}>📚 Upload Materials</button>
        <button className={`lecturer-nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>⚙️ Settings</button>
        {hods.length > 0 && (
          <button className="lecturer-nav-item lecturer-nav-chat" onClick={openChatModal}>
            💬 Message HOD {unreadCount > 0 && <span className="lecturer-nav-badge">{unreadCount}</span>}
          </button>
        )}
      </nav>

      {/* Main Content */}
      <main className="lecturer-main">
        {loading.dashboard ? (
          <div className="lecturer-loading-content"><div className="lecturer-spinner"></div><p>Loading dashboard...</p></div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <div className="lecturer-tab-content">
                <div className="lecturer-welcome">
                  <div>
                    <h2>Welcome, {profile.full_name?.split(" ")[0] || "Lecturer"}! 👨‍🏫</h2>
                    <p>Managing {allowedDepartments?.length || 0} department{(allowedDepartments?.length || 0) !== 1 ? "s" : ""} • {new Date().toLocaleDateString()}</p>
                  </div>
                  <button onClick={initializeDashboard} disabled={loading.dashboard} className="lecturer-refresh-btn">🔄 Refresh</button>
                </div>

                {hods.length > 0 && (
                  <div className="lecturer-hod-section">
                    <h3>Your Department Heads</h3>
                    <div className="lecturer-hod-grid">
                      {hods.map(hod => (
                        <div key={hod.id} className="lecturer-hod-card">
                          <div className="lecturer-hod-avatar">👨‍💼</div>
                          <h4>{hod.departments?.head_of_department || 'HOD'}</h4>
                          <p>{hod.departments?.department_name} ({hod.departments?.department_code})</p>
                          <button className="lecturer-chat-btn" onClick={() => openChatWithHOD(hod)}>💬 Message</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="lecturer-stats-grid">
                  <div className="lecturer-stat-card"><div className="lecturer-stat-icon">👥</div><h3>{stats.totalStudents.toLocaleString()}</h3><p>Total Students</p><div className="lecturer-stat-subtext">In your departments</div></div>
                  <div className="lecturer-stat-card"><div className="lecturer-stat-icon">📚</div><h3>{stats.totalCourses}</h3><p>Active Courses</p><div className="lecturer-stat-subtext">In your departments</div></div>
                  <div className="lecturer-stat-card"><div className="lecturer-stat-icon">📝</div><h3>{stats.totalAssignments}</h3><p>Assignments</p><div className="lecturer-stat-subtext">Created by you</div></div>
                  <div className="lecturer-stat-card"><div className="lecturer-stat-icon">🎓</div><h3>{stats.totalLectures || 0}</h3><p>Lectures</p><div className="lecturer-stat-subtext">Scheduled</div></div>
                </div>

                <div className="lecturer-actions-section">
                  <h3>Quick Actions</h3>
                  <div className="lecturer-actions-grid">
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("my-assignments")}><span className="lecturer-action-icon">📝</span><span>Create Assignment</span><small>With file upload</small></button>
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("lectures")}><span className="lecturer-action-icon">🎓</span><span>Schedule Lecture</span><small>With Google Meet</small></button>
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("grading")}><span className="lecturer-action-icon">📊</span><span>Grade Submissions</span><small>Pending: {stats.pendingGrading || 0}</small></button>
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("exams")}><span className="lecturer-action-icon">🎯</span><span>Manage Exams</span><small>Schedule & grade</small></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "my-assignments" && <LecturerAssignmentsManager profile={profile} courses={courses} stats={stats} showToast={showToast} mode="create" />}
            {activeTab === "my-files" && <LecturerFilesManager profile={profile} showToast={showToast} />}
            {activeTab === "lectures" && <LecturerLecturesManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "grading" && <LecturerGradingManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "exams" && <LecturerExamsManager profile={profile} courses={courses} programs={programs} programsLoading={programsLoading} showToast={showToast} />}
            {activeTab === "students" && (
              <div className="lecturer-tab-content">
                <div className="lecturer-tab-header">
                  <h2>👥 Student Management</h2>
                  <div className="lecturer-tab-actions">
                    <input type="text" placeholder="Search students..." className="lecturer-search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                {renderStudentsTable()}
              </div>
            )}
            {activeTab === "courses" && (
              <div className="lecturer-tab-content">
                <div className="lecturer-tab-header">
                  <h2>📖 Course Management</h2>
                  <div className="lecturer-tab-actions">
                    <input type="text" placeholder="Search courses..." className="lecturer-search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                {renderCoursesGrid()}
              </div>
            )}
            {activeTab === "notes-upload" && <LecturerNotesManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "settings" && (
              <LecturerSettings 
                profile={profile} 
                showToast={showToast} 
                onProfileUpdate={handleProfileUpdate}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="lecturer-footer">
        <p>© {new Date().getFullYear()} NLE University • Lecturer Portal</p>
        <p className="lecturer-footer-stats">Your Students: {stats.totalStudents} | Courses: {stats.totalCourses} | Departments: {allowedDepartments?.length || 0}</p>
      </footer>

      {/* Chat Modal */}
      {showChat && (
        <div className="lecturer-chat-overlay" onClick={() => setShowChat(false)}>
          <div className="lecturer-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lecturer-chat-header">
              <div>
                <h3>💬 Message your HOD</h3>
                {selectedHOD ? (
                  <p>{selectedHOD.departments?.department_name} - {selectedHOD.email}</p>
                ) : (
                  <p>Select a department head to chat with</p>
                )}
              </div>
              <button className="lecturer-chat-close" onClick={() => { setShowChat(false); setSelectedHOD(null); }}>✕</button>
            </div>
            
            {!selectedHOD ? (
              <div className="lecturer-hod-select-list">
                {hods.map(hod => (
                  <div key={hod.id} className="lecturer-hod-select-item" onClick={() => openChatWithHOD(hod)}>
                    <div className="lecturer-hod-avatar">👨‍💼</div>
                    <div>
                      <h4>{hod.departments?.head_of_department || 'HOD'}</h4>
                      <p>{hod.departments?.department_name} ({hod.departments?.department_code})</p>
                      <small>{hod.email}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="lecturer-chat-body">
                  {chatMessages.length === 0 ? (
                    <div className="lecturer-chat-empty"><p>No messages yet. Start the conversation!</p></div>
                  ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className={`lecturer-chat-message ${msg.sender_role === 'lecturer' ? 'sent' : 'received'}`}>
                        <div className="lecturer-chat-meta">
                          <strong>{msg.sender_name}</strong>
                          <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                        </div>
                        <p>{msg.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="lecturer-chat-footer">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !sendingMessage) sendMessage(); }}
                    placeholder="Type your message..."
                    className="lecturer-chat-input"
                  />
                  <button className="lecturer-chat-send" onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="lecturer-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="lecturer-small-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="lecturer-modal-actions">
              <button className="lecturer-cancel-btn" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="lecturer-logout-confirm" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerDashboard;