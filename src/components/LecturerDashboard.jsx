// LecturerDashboard.jsx - Complete with Timetable Tab
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import { useLecturerDepartments } from '../hooks/useLecturerDepartments';
import './lecturer/LecturerDashboard.css';

// Import all lecturer sub-components
import LecturerFilesManager from './lecturer/LecturerFilesManager';
import LecturerAssignmentsManager from './lecturer/LecturerAssignmentsManager';
import LecturerExamsManager from './lecturer/LecturerExamsManager';
import LecturerLecturesManager from './lecturer/LecturerLecturesManager';
import LecturerNotesManager from './lecturer/LecturerNotesManager';
import LecturerSettings from './lecturer/LecturerSettings';
import LecturerGradingManager from './lecturer/LecturerGradingManager';
import LecturerTimetable from './lecturer/LecturerTimetable';

const LecturerDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut, isLecturer, loading: authLoading } = useAdminAuth();

  const {
    departments: allowedDepartments,
    departmentCodes,
    loading: lecturerDeptLoading,
    hasAccess,
  } = useLecturerDepartments(isLecturer ? profile?.id : null);

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState({ dashboard: true, courses: false });
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
  const [pendingAllocations, setPendingAllocations] = useState([]);
  const [courseSources, setCourseSources] = useState({});

  // Chat - Updated to include both HODs and Admins with profile pictures
  const [showChat, setShowChat] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  const notificationToastTimeoutRef = useRef(null);

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    totalDirectCourses: 0,
    totalAllocatedCourses: 0,
    pendingAllocations: 0,
    totalAssignments: 0,
    totalExams: 0,
    totalLectures: 0,
  });

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const lecturerEmail = profile?.email || '';
  const lecturerName = profile?.full_name || 'Lecturer';
  const lecturerId = profile?.id || '';

  // ==================== PROFILE UPDATE ====================
  const handleProfileUpdate = (updatedData) => {
    if (updatedData.profile_picture_url !== undefined) {
      profile.profile_picture_url = updatedData.profile_picture_url;
      setProfileVersion(Date.now());
    }
  };

  // ==================== CHAT - FETCH HODS AND ADMINS ====================
  const fetchContacts = useCallback(async () => {
    if (!departmentCodes || departmentCodes.length === 0) return;
    try {
      const { data: depts } = await supabase
        .from('departments')
        .select('id')
        .in('department_code', departmentCodes);

      const deptIds = depts?.map(d => d.id) || [];
      if (deptIds.length === 0) return;

      // Fetch HODs with profile pictures
      const { data: hodRoles, error: hodError } = await supabase
        .from('user_roles')
        .select(`
          id, 
          email, 
          role, 
          department_id, 
          faculty_id,
          user_id,
          profile_picture_url,
          departments:department_id (department_code, department_name, head_of_department)
        `)
        .eq('role', 'hod')
        .in('department_id', deptIds);

      if (hodError) throw hodError;

      // Fetch Admins with profile pictures
      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select(`
          id, 
          email, 
          role, 
          department_id, 
          faculty_id,
          user_id,
          profile_picture_url
        `)
        .eq('role', 'admin');

      if (adminError) throw adminError;

      const allContacts = [
        ...(hodRoles || []).map(h => ({
          ...h,
          full_name: h.departments?.head_of_department || 'HOD',
          profile_picture_url: h.profile_picture_url || null,
        })),
        ...(adminRoles || []).map(a => ({
          ...a,
          full_name: 'Admin',
          profile_picture_url: a.profile_picture_url || null,
        }))
      ];

      setContacts(allContacts || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, [departmentCodes]);

  // ==================== CHAT MESSAGES ====================
  const fetchChatMessages = useCallback(async (contactEmail) => {
    if (!lecturerEmail || !contactEmail) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_email.eq.${lecturerEmail},receiver_email.eq.${contactEmail}),` +
          `and(sender_email.eq.${contactEmail},receiver_email.eq.${lecturerEmail})`
        )
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setChatMessages(data || []);

      // Mark unread as read
      const unread = (data || []).filter(
        (m) => m.receiver_email === lecturerEmail && !m.is_read
      );
      for (const msg of unread) {
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
      }

      fetchNotifications();

      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } catch (err) {
      console.error('Error fetching chat:', err);
    }
  }, [lecturerEmail]);

  // ==================== SEND MESSAGE ====================
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;

    const tempId = `temp-${Date.now()}`;
    const messageText = newMessage.trim();

    const optimisticMsg = {
      id: tempId,
      sender_email: lecturerEmail,
      sender_role: 'lecturer',
      sender_name: lecturerName,
      receiver_email: selectedContact.email,
      receiver_role: selectedContact.role,
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');
    setSendingMessage(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          sender_id: profile?.id,
          sender_email: lecturerEmail,
          sender_role: 'lecturer',
          sender_name: lecturerName,
          receiver_email: selectedContact.email,
          receiver_role: selectedContact.role,
          message: messageText,
          department_id: selectedContact.department_id,
          faculty_id: selectedContact.faculty_id,
          is_read: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m))
      );
    } catch (err) {
      console.error('Send error:', err);
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast('Failed to send message: ' + err.message, 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // ==================== OPEN CHAT ====================
  const openChatWithContact = (contact) => {
    if (!contact?.email) return;
    setSelectedContact(contact);
    setShowChat(true);
    setChatMessages([]);
    fetchChatMessages(contact.email);
  };

  const openChatModal = () => {
    setSelectedContact(null);
    setChatMessages([]);
    setShowChat(true);
  };

  // ==================== REAL-TIME CHAT ====================
  useEffect(() => {
    if (!showChat || !selectedContact?.email || !lecturerEmail) return;

    console.log('[LECTURER CHAT] Setting up realtime:', lecturerEmail, '↔', selectedContact.email);

    const channel = supabase
      .channel(`lecturer-chat-${lecturerEmail}-${selectedContact.email}`)
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

          const isThisChat =
            (msg.sender_email === lecturerEmail && msg.receiver_email === selectedContact.email) ||
            (msg.sender_email === selectedContact.email && msg.receiver_email === lecturerEmail);

          if (!isThisChat) return;

          if (payload.eventType === 'INSERT') {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              const cleaned = prev.filter(
                (m) =>
                  !(typeof m.id === 'string' && m.id.startsWith('temp-') && m.message === msg.message)
              );
              return [...cleaned, msg];
            });

            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            fetchNotifications();
          }
        }
      )
      .subscribe((status) => {
        console.log('[LECTURER CHAT] Realtime status:', status);
      });

    const pollInterval = setInterval(() => {
      fetchChatMessages(selectedContact.email);
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [showChat, selectedContact?.email, lecturerEmail, fetchChatMessages]);

  // ==================== NOTIFICATIONS ====================
  const fetchNotifications = useCallback(async () => {
    if (!lecturerEmail) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', lecturerEmail)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      let notifData = [];
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_email', lecturerEmail)
          .order('created_at', { ascending: false })
          .limit(50);
        notifData = data || [];
      } catch (_) {}

      const combined = [
        ...notifData.map(n => ({ ...n, _source: 'notification' })),
        ...(unreadMessages || []).map(msg => ({
          id: `chat-${msg.id}`,
          user_email: msg.receiver_email,
          title: `Message from ${msg.sender_name || msg.sender_role || 'Someone'}`,
          message: msg.message,
          sender_email: msg.sender_email,
          sender_name: msg.sender_name,
          sender_role: msg.sender_role,
          type: 'message',
          is_read: false,
          created_at: msg.created_at,
          _source: 'chat',
          _chat_id: msg.id,
        })),
      ];

      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotifications(combined);
      setUnreadCount(combined.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error in fetchNotifications:', err);
    }
  }, [lecturerEmail]);

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
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', lecturerEmail)
        .eq('is_read', false);

      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_email', lecturerEmail)
          .eq('is_read', false);
      } catch (_) {}

      await fetchNotifications();
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification.id);
    setShowNotifications(false);

    if (notification.type === 'message') {
      const contact = contacts.find(c => c.email === notification.sender_email);
      if (contact) {
        openChatWithContact(contact);
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

  // ==================== COURSE FETCHING WITH ALLOCATIONS ====================
  const fetchCourses = useCallback(async () => {
    if (!lecturerId) return;

    setLoading(prev => ({ ...prev, courses: true }));
    try {
      // 1. Get directly assigned courses (from courses table)
      let query = supabase
        .from("courses")
        .select("*")
        .limit(100)
        .order("year")
        .order("semester");

      if (searchTerm) {
        query = query.or(`course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%`);
      }
      query = query.eq("lecturer_id", lecturerId);

      const { data: directCourses, error: directError } = await query;
      if (directError) throw directError;

      // 2. Get approved allocations (from course_allocations table)
      const { data: approvedAllocations, error: allocError } = await supabase
        .from('course_allocations')
        .select(`
          id,
          course_id,
          status,
          created_at,
          courses:course_id (
            id,
            course_code,
            course_name,
            description,
            credits,
            year,
            semester,
            department_code,
            program,
            is_active,
            created_at
          )
        `)
        .eq('lecturer_id', lecturerId)
        .eq('status', 'approved');

      if (allocError) throw allocError;

      // 3. Get pending allocations (for display)
      const { data: pendingAllocData, error: pendingError } = await supabase
        .from('course_allocations')
        .select(`
          id,
          course_id,
          status,
          created_at,
          courses:course_id (
            course_code,
            course_name,
            department_code
          )
        `)
        .eq('lecturer_id', lecturerId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;
      setPendingAllocations(pendingAllocData || []);

      // 4. Combine courses from both sources
      const allCourseIds = new Set();
      const combinedCourses = [];

      // Add direct courses first (these are officially assigned)
      (directCourses || []).forEach(c => {
        if (!allCourseIds.has(c.id)) {
          allCourseIds.add(c.id);
          combinedCourses.push({ 
            ...c, 
            source: 'direct',
            source_id: null
          });
        }
      });

      // Add approved allocated courses
      (approvedAllocations || []).forEach(a => {
        const c = a.courses;
        if (c && !allCourseIds.has(c.id)) {
          allCourseIds.add(c.id);
          combinedCourses.push({ 
            ...c, 
            source: 'allocation',
            source_id: a.id,
            allocated_at: a.created_at
          });
        }
      });

      // Create a map of source for each course
      const sourceMap = {};
      combinedCourses.forEach(c => {
        sourceMap[c.id] = c.source;
      });
      setCourseSources(sourceMap);

      setCourses(combinedCourses);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalCourses: combinedCourses.length,
        totalDirectCourses: (directCourses || []).length,
        totalAllocatedCourses: (approvedAllocations || []).length,
        pendingAllocations: pendingAllocData?.length || 0,
      }));

    } catch (error) {
      console.error("Error fetching courses:", error);
      showToast('Error loading courses: ' + error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  }, [lecturerId, searchTerm]);

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
      fetchContacts();
      fetchNotifications();
      fetchCourses(); // Fetch courses with allocations
    }
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
      if (notificationSubscriptionRef.current) notificationSubscriptionRef.current.unsubscribe();
      if (notificationToastTimeoutRef.current) clearTimeout(notificationToastTimeoutRef.current);
    };
  }, [profile, authLoading, navigate, fetchContacts, fetchNotifications, fetchCourses]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (profile?.email && !showChat) fetchNotifications();
    }, 12000);
    return () => clearInterval(interval);
  }, [profile?.email, showChat, fetchNotifications]);

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
        .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
          fetchStudents();
          fetchDashboardStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
          fetchCourses();
          fetchDashboardStats();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "course_allocations" }, () => {
          fetchCourses();
        })
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

      if (!lecturerEmail) return;

      const subscription = supabase
        .channel(`lecturer-notifications-${profile?.id || 'lecturer'}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_email=eq.${lecturerEmail}`,
        }, (payload) => {
          const msg = payload.new;
          fetchNotifications();
          displayNotificationToast({
            id: `chat-${msg.id}`,
            title: `Message from ${msg.sender_name || msg.sender_role || 'Someone'}`,
            message: msg.message,
            sender_email: msg.sender_email,
            sender_name: msg.sender_name,
            sender_role: msg.sender_role,
            type: 'message',
            is_read: false,
            created_at: msg.created_at,
          });
        })
        .subscribe();

      notificationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error("Notification subscription error:", error);
    }
  };

  // ==================== DATA FETCHING ====================
  const fetchDashboardStats = async () => {
    try {
      let studentQuery = supabase.from("students").select("*", { count: "exact", head: true });
      if (departmentCodes.length > 0) studentQuery = studentQuery.in("department_code", departmentCodes);

      const [studentsRes, assignmentsRes, lecturesRes] = await Promise.all([
        studentQuery,
        supabase.from("assignments").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id),
        supabase.from("lectures").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id),
      ]);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsRes.count || 0,
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

  const fetchExams = async () => {
    try {
      let query = supabase.from("examinations")
        .select(`*, courses (course_code, course_name, department_code)`)
        .limit(100)
        .order("start_time", { ascending: true });

      const { data: deptCourses } = await supabase
        .from("courses")
        .select("id")
        .in("department_code", departmentCodes);

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

  // ==================== CONTACT AVATAR HELPER ====================
  const getContactAvatar = (contact) => {
    if (contact.profile_picture_url) {
      return (
        <img 
          src={contact.profile_picture_url} 
          alt={contact.full_name || contact.role}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.textContent = contact.full_name?.[0]?.toUpperCase() || contact.role?.[0]?.toUpperCase() || '👤';
          }}
        />
      );
    }
    return contact.role === 'admin' ? '👨‍💼' : '👨‍🏫';
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
                <td>
                  <span className="lecturer-dept-badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    {student.department_code || "N/A"}
                  </span>
                </td>
                <td>Year {student.year_of_study || 1} - Sem {student.semester || 1}</td>
                <td>
                  <span className={`lecturer-status-badge ${student.status || "active"}`}>
                    {(student.status || "active").charAt(0).toUpperCase() + (student.status || "active").slice(1)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // ==================== RENDER COURSES GRID WITH SOURCE INDICATORS ====================
  const renderCoursesGrid = () => (
    <div className="lecturer-courses-grid">
      {loading.courses ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="lecturer-empty-state">
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📚</span>
          <h3>No Courses Assigned</h3>
          <p>You haven't been assigned to any courses yet.</p>
          {pendingAllocations.length > 0 && (
            <p style={{ color: '#e65100' }}>
              ⏳ You have {pendingAllocations.length} course allocation{ pendingAllocations.length > 1 ? 's' : '' } pending approval.
            </p>
          )}
        </div>
      ) : (
        courses.map((course) => (
          <div key={course.id} className="lecturer-course-card">
            <div className="lecturer-course-header">
              <h3>{course.course_code}</h3>
              <div className="lecturer-course-header-right">
                <span className="lecturer-dept-badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                  {course.department_code || course.department || "N/A"}
                </span>
                {course.source === 'allocation' && (
                  <span className="lecturer-course-source" style={{ 
                    background: '#e8f5e9', 
                    color: '#2e7d32',
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '600'
                  }}>
                    📋 Allocated
                  </span>
                )}
                <span className={`lecturer-course-status ${course.is_active ? "active" : "inactive"}`}>
                  {course.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <h4>{course.course_name}</h4>
            <p className="lecturer-course-description">{course.description || "No description"}</p>
            <div className="lecturer-course-details">
              <span>Year {course.year} - Semester {course.semester}</span>
              <span>{course.credits} Credits</span>
              <span>{course.program}</span>
            </div>
            {course.source === 'allocation' && (
              <div style={{ 
                marginTop: '10px', 
                padding: '6px 12px', 
                background: '#f5f5f5', 
                borderRadius: '4px',
                fontSize: '11px',
                color: '#666'
              }}>
                ✅ Approved on {new Date(course.allocated_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // ==================== RENDER PENDING ALLOCATIONS ====================
  const renderPendingAllocations = () => {
    if (pendingAllocations.length === 0) return null;

    return (
      <div className="lecturer-section" style={{ marginBottom: '24px' }}>
        <div style={{ 
          background: '#fff3e0', 
          padding: '16px 20px', 
          borderRadius: '8px',
          border: '1px solid #ffcc80'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '20px', marginRight: '12px' }}>⏳</span>
              <strong style={{ color: '#e65100' }}>
                {pendingAllocations.length} Course Allocation{pendingAllocations.length > 1 ? 's' : ''} Pending Approval
              </strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                Your course assignments are waiting for HOD approval
              </p>
            </div>
            <button 
              className="lecturer-primary-btn" 
              onClick={() => setActiveTab("courses")}
              style={{ 
                background: '#e65100', 
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              View Status
            </button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {pendingAllocations.map(a => (
              <span key={a.id} style={{ 
                background: 'white', 
                padding: '4px 12px', 
                borderRadius: '4px',
                border: '1px solid #ffcc80',
                fontSize: '13px'
              }}>
                {a.courses?.course_code || 'Unknown'} - {a.courses?.course_name || 'Unknown Course'}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ==================== LOADING ====================
  if (authLoading) {
    return (
      <div className="lecturer-loading-container">
        <div className="lecturer-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }
  if (!profile) return null;
  if (lecturerDeptLoading) {
    return (
      <div className="lecturer-loading-container">
        <div className="lecturer-spinner"></div>
        <p>Loading your access permissions...</p>
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div className="lecturer-restricted-access">
        <div className="lecturer-restricted-card">
          <div className="lecturer-restricted-icon">🔒</div>
          <h2>No Department Access</h2>
          <p>You haven't been assigned to any academic departments yet.</p>
          <button onClick={() => supabase.auth.signOut()} className="lecturer-restricted-logout">
            Logout
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="lecturer-dashboard">
      {toast.show && (
        <div className={`lecturer-toast lecturer-toast-${toast.type}`}>
          <span className="lecturer-toast-icon">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span className="lecturer-toast-message">{toast.message}</span>
          <button className="lecturer-toast-close" onClick={hideToast}>✕</button>
        </div>
      )}

      {showNotificationToast && latestNotification && (
        <div
          className="lecturer-notification-toast"
          onClick={() => {
            setShowNotificationToast(false);
            handleNotificationClick(latestNotification);
          }}
        >
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
                }}
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
                      <button className="lecturer-notification-mark-all" onClick={markAllNotificationsRead}>
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
                            {notif.type === 'message' || notif._source === 'chat' ? '💬' : '🔔'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block', color: '#1a237e', fontSize: '12px', marginBottom: '2px' }}>
                              {notif.title || (notif.sender_name ? `Message from ${notif.sender_name}` : 'Notification')}
                            </strong>
                            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#555', lineHeight: '1.3' }}>
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
                              marginTop: '4px',
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
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
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

      <nav className="lecturer-nav">
        <button className={`lecturer-nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>📊 Dashboard</button>
        <button className={`lecturer-nav-item ${activeTab === "my-files" ? "active" : ""}`} onClick={() => setActiveTab("my-files")}>📁 My Files</button>
        <button className={`lecturer-nav-item ${activeTab === "my-assignments" ? "active" : ""}`} onClick={() => setActiveTab("my-assignments")}>📝 My Assignments</button>
        <button className={`lecturer-nav-item ${activeTab === "lectures" ? "active" : ""}`} onClick={() => setActiveTab("lectures")}>🎓 My Lectures</button>
        <button className={`lecturer-nav-item ${activeTab === "exams" ? "active" : ""}`} onClick={() => setActiveTab("exams")}>🎯 Exams</button>
        <button className={`lecturer-nav-item ${activeTab === "students" ? "active" : ""}`} onClick={() => setActiveTab("students")}>👥 Students</button>
        <button className={`lecturer-nav-item ${activeTab === "courses" ? "active" : ""}`} onClick={() => setActiveTab("courses")}>📖 Courses</button>
        <button className={`lecturer-nav-item ${activeTab === "notes-upload" ? "active" : ""}`} onClick={() => setActiveTab("notes-upload")}>📚 Upload Materials</button>
        <button className={`lecturer-nav-item ${activeTab === "grading" ? "active" : ""}`} onClick={() => setActiveTab("grading")}>📊 Grading</button>
        <button className={`lecturer-nav-item ${activeTab === "timetable" ? "active" : ""}`} onClick={() => setActiveTab("timetable")}>📅 Timetable</button>
        <button className={`lecturer-nav-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>⚙️ Settings</button>
        {contacts.length > 0 && (
          <button className="lecturer-nav-item lecturer-nav-chat" onClick={openChatModal}>
            💬 Messages {unreadCount > 0 && <span className="lecturer-nav-badge">{unreadCount}</span>}
          </button>
        )}
      </nav>

      <main className="lecturer-main">
        {loading.dashboard ? (
          <div className="lecturer-loading-content">
            <div className="lecturer-spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <div className="lecturer-tab-content">
                <div className="lecturer-welcome">
                  <div>
                    <h2>Welcome, {profile.full_name?.split(" ")[0] || "Lecturer"}! 👨‍🏫</h2>
                    <p>
                      Managing {allowedDepartments?.length || 0} department
                      {(allowedDepartments?.length || 0) !== 1 ? "s" : ""} • {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={initializeDashboard} disabled={loading.dashboard} className="lecturer-refresh-btn">
                    🔄 Refresh
                  </button>
                </div>

                {/* Pending Allocations Section */}
                {renderPendingAllocations()}

                {/* Contacts Section */}
                {contacts.length > 0 && (
                  <div className="lecturer-contacts-section" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1a237e' }}>Your Contacts</h3>
                    <div className="lecturer-hod-grid">
                      {contacts.slice(0, 6).map(contact => (
                        <div key={contact.id} className="lecturer-hod-card" style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center',
                          textAlign: 'center'
                        }}>
                          <div className="lecturer-hod-avatar" style={{ 
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '50%', 
                            overflow: 'hidden', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '28px',
                            marginBottom: '10px',
                            flexShrink: 0
                          }}>
                            {getContactAvatar(contact)}
                          </div>
                          <h4 style={{ margin: '4px 0' }}>
                            {contact.full_name || (contact.role === 'admin' ? 'Admin' : 'HOD')}
                          </h4>
                          <p style={{ margin: '2px 0 10px 0' }}>
                            {contact.role?.toUpperCase()} 
                            {contact.departments?.department_code ? ` • ${contact.departments.department_code}` : ''}
                          </p>
                          <button 
                            className="lecturer-chat-btn" 
                            onClick={() => openChatWithContact(contact)}
                          >
                            💬 Message
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="lecturer-stats-grid">
                  <div className="lecturer-stat-card">
                    <div className="lecturer-stat-icon">👥</div>
                    <h3>{stats.totalStudents.toLocaleString()}</h3>
                    <p>Total Students</p>
                    <div className="lecturer-stat-subtext">In your departments</div>
                  </div>
                  <div className="lecturer-stat-card">
                    <div className="lecturer-stat-icon">📚</div>
                    <h3>{stats.totalCourses}</h3>
                    <p>Total Courses</p>
                    <div className="lecturer-stat-subtext">
                      {stats.totalDirectCourses} direct • {stats.totalAllocatedCourses} allocated
                    </div>
                  </div>
                  <div className="lecturer-stat-card">
                    <div className="lecturer-stat-icon">⏳</div>
                    <h3>{stats.pendingAllocations}</h3>
                    <p>Pending Allocations</p>
                    <div className="lecturer-stat-subtext">Awaiting HOD approval</div>
                  </div>
                  <div className="lecturer-stat-card">
                    <div className="lecturer-stat-icon">📝</div>
                    <h3>{stats.totalAssignments}</h3>
                    <p>Assignments</p>
                    <div className="lecturer-stat-subtext">Created by you</div>
                  </div>
                </div>

                <div className="lecturer-actions-section">
                  <h3>Quick Actions</h3>
                  <div className="lecturer-actions-grid">
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("my-assignments")}>
                      <span className="lecturer-action-icon">📝</span>
                      <span>Create Assignment</span>
                      <small>With file upload</small>
                    </button>
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("lectures")}>
                      <span className="lecturer-action-icon">🎓</span>
                      <span>Schedule Lecture</span>
                      <small>With Google Meet</small>
                    </button>
                    <button className="lecturer-action-btn" onClick={() => setActiveTab("exams")}>
                      <span className="lecturer-action-icon">🎯</span>
                      <span>Manage Exams</span>
                      <small>Schedule & grade</small>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "my-assignments" && (
              <LecturerAssignmentsManager profile={profile} courses={courses} stats={stats} showToast={showToast} mode="create" />
            )}
            {activeTab === "my-files" && <LecturerFilesManager profile={profile} showToast={showToast} />}
            {activeTab === "lectures" && <LecturerLecturesManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "grading" && <LecturerGradingManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "exams" && (
              <LecturerExamsManager
                profile={profile}
                courses={courses}
                programs={programs}
                programsLoading={programsLoading}
                showToast={showToast}
              />
            )}
            {activeTab === "students" && (
              <div className="lecturer-tab-content">
                <div className="lecturer-tab-header">
                  <h2>👥 Student Management</h2>
                  <div className="lecturer-tab-actions">
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="lecturer-search-input"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                    <input
                      type="text"
                      placeholder="Search courses..."
                      className="lecturer-search-input"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button 
                      className="lecturer-refresh-btn" 
                      onClick={fetchCourses}
                      style={{ marginLeft: '10px' }}
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
                {renderCoursesGrid()}
              </div>
            )}
            {activeTab === "notes-upload" && <LecturerNotesManager profile={profile} courses={courses} showToast={showToast} />}
            {activeTab === "timetable" && (
              <LecturerTimetable 
                profile={profile} 
                courses={courses} 
                showToast={showToast} 
              />
            )}
            {activeTab === "settings" && (
              <LecturerSettings profile={profile} showToast={showToast} onProfileUpdate={handleProfileUpdate} />
            )}
          </>
        )}
      </main>

      <footer className="lecturer-footer">
        <p>© {new Date().getFullYear()} NLE University • Lecturer Portal</p>
        <p className="lecturer-footer-stats">
          Your Students: {stats.totalStudents} | Courses: {stats.totalCourses} | Departments: {allowedDepartments?.length || 0}
        </p>
      </footer>

      {/* Chat Modal */}
      {showChat && (
        <div className="lecturer-chat-overlay" onClick={() => setShowChat(false)}>
          <div className="lecturer-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lecturer-chat-header">
              <div>
                <h3>💬 Messages</h3>
                {selectedContact ? (
                  <p>
                    {selectedContact.full_name || (selectedContact.role === 'admin' ? 'Admin' : 'HOD')}
                    {' - '}{selectedContact.email}
                  </p>
                ) : (
                  <p>Select a contact to chat with</p>
                )}
              </div>
              <button
                className="lecturer-chat-close"
                onClick={() => {
                  setShowChat(false);
                  setSelectedContact(null);
                }}
              >
                ✕
              </button>
            </div>

            {!selectedContact ? (
              <div className="lecturer-hod-select-list">
                {/* HODs Section */}
                {contacts.filter(c => c.role === 'hod').length > 0 && (
                  <>
                    <div style={{ padding: '10px', borderBottom: '1px solid #e0e0e0' }}>
                      <h4 style={{ margin: '0', color: '#1a237e' }}>Department Heads</h4>
                    </div>
                    {contacts.filter(c => c.role === 'hod').map(contact => (
                      <div key={contact.id} className="lecturer-hod-select-item" onClick={() => openChatWithContact(contact)}>
                        <div className="lecturer-hod-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          {getContactAvatar(contact)}
                        </div>
                        <div>
                          <h4>{contact.full_name || contact.departments?.head_of_department || 'HOD'}</h4>
                          <p>{contact.departments?.department_name} ({contact.departments?.department_code})</p>
                          <small>{contact.email}</small>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Admins Section */}
                {contacts.filter(c => c.role === 'admin').length > 0 && (
                  <>
                    <div style={{ padding: '10px', borderBottom: '1px solid #e0e0e0', borderTop: '1px solid #e0e0e0' }}>
                      <h4 style={{ margin: '0', color: '#1a237e' }}>Administrators</h4>
                    </div>
                    {contacts.filter(c => c.role === 'admin').map(contact => (
                      <div key={contact.id} className="lecturer-hod-select-item" onClick={() => openChatWithContact(contact)}>
                        <div className="lecturer-hod-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          {getContactAvatar(contact)}
                        </div>
                        <div>
                          <h4>{contact.full_name || 'Admin'}</h4>
                          <p>System Administrator</p>
                          <small>{contact.email}</small>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="lecturer-chat-body">
                  {chatMessages.length === 0 ? (
                    <div className="lecturer-chat-empty">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`lecturer-chat-message ${msg.sender_role === 'lecturer' ? 'sent' : 'received'}`}
                      >
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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !sendingMessage) sendMessage();
                    }}
                    placeholder={`Message ${selectedContact.role === 'admin' ? 'Admin' : 'HOD'}...`}
                    className="lecturer-chat-input"
                  />
                  <button
                    className="lecturer-chat-send"
                    onClick={sendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                  >
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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