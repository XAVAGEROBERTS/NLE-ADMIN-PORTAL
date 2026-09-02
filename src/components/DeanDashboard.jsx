// DeanDashboard.jsx - COMPLETE HARDENED VERSION WITH NOTIFICATION FIXES
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';

// All dean components
import DeanOverview from './dean/DeanOverview';
import DeanCourseAllocations from './dean/DeanCourseAllocations';
import DeanWorkload from './dean/DeanWorkload';
import DeanLeaveApprovals from './dean/DeanLeaveApprovals';
import DeanAppeals from './dean/DeanAppeals';
import DeanTimetable from './dean/DeanTimetable';
import DeanExamResults from './dean/DeanExamResults';
import DeanAppraisals from './dean/DeanAppraisals';
import DeanBudget from './dean/DeanBudget';
import DeanCurriculum from './dean/DeanCurriculum';
import DeanQualityAssurance from './dean/DeanQualityAssurance';
import DeanAdmissions from './dean/DeanAdmissions';
import DeanDisciplinary from './dean/DeanDisciplinary';
import DeanPostgraduate from './dean/DeanPostgraduate';
import DeanBoardReports from './dean/DeanBoardReports';
import DeanSettings from './dean/DeanSettings';
import DeanChat from './dean/DeanChat';
import DeanNotifications from './dean/DeanNotifications';
import DeanHODs from './dean/DeanHODs';
import DeanDepartments from './dean/DeanDepartments';

import './dean/DeanDashboard.css';

const DeanDashboard = () => {
  const { profile, signOut } = useAdminAuth();
  const navigate = useNavigate();

  // ========== STATE ==========
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [hods, setHODs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileVersion, setProfileVersion] = useState(0);
  const [profilePicUrl, setProfilePicUrl] = useState(null);

  const [stats, setStats] = useState({
    totalDepartments: 0,
    totalCourses: 0,
    totalStudents: 0,
    totalLecturers: 0,
    totalHODs: 0,
    pendingAllocations: 0,
    pendingLeaveApprovals: 0,
    pendingAppeals: 0,
    pendingBudgetRequests: 0,
  });

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserType, setSelectedUserType] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationSubscriptionRef = useRef(null);

  // Stable derived
  const facultyId = profile?.faculty_id || profile?.id || profile?.table_id || null;
  const facultyName = profile?.faculty_name || 'Faculty';
  const deanEmail = profile?.email || '';
  const deanName = profile?.full_name || 'Dean';

  // ========== FETCH FUNCTIONS ==========
  const fetchAdmins = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url, table_id, user_id')
        .eq('role', 'admin')
        .limit(10);
      if (error || !data) { setAdmins([]); return []; }
      const list = data.map((a) => {
        const name = (a.email?.split('@')[0] || 'Admin').replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        return { ...a, display_name: name, full_name: name, name };
      });
      setAdmins(list);
      return list;
    } catch { setAdmins([]); return []; }
  }, []);

  const fetchHODs = useCallback(async () => {
    if (!facultyId) return [];
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`id, email, role, department_id, faculty_id, profile_picture_url,
          departments:department_id (id, department_code, department_name, head_of_department, contact_email, contact_phone, is_active)`)
        .eq('role', 'hod').eq('faculty_id', facultyId);
      if (error) throw error;
      const list = (data || []).map((h) => ({
        id: h.id, email: h.email, role: h.role, department_id: h.department_id,
        department_code: h.departments?.department_code || '',
        department_name: h.departments?.department_name || '',
        head_name: h.departments?.head_of_department || h.email,
        contact_email: h.departments?.contact_email || h.email,
        contact_phone: h.departments?.contact_phone || '',
        is_active: h.departments?.is_active ?? true,
        profile_picture_url: h.profile_picture_url || null,
      }));
      setHODs(list);
      return list;
    } catch { return []; }
  }, [facultyId]);

  const fetchDepartments = useCallback(async () => {
    if (!facultyId) return [];
    try {
      const { data, error } = await supabase
        .from('departments').select('*').eq('faculty_id', facultyId).order('department_code');
      if (error) throw error;
      setDepartments(data || []);
      return data || [];
    } catch { return []; }
  }, [facultyId]);

  const fetchPendingCounts = useCallback(async (deptCodes) => {
    if (!deptCodes?.length) return;
    try {
      const [a, l, ap, b] = await Promise.all([
        supabase.from('course_allocations').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).eq('status', 'pending'),
        supabase.from('lecturer_leave_requests').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).in('status', ['pending', 'pending_dean']),
        supabase.from('student_complaints').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).in('status', ['pending', 'pending_dean']),
        supabase.from('budget_requests').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).eq('faculty_status', 'pending_dean'),
      ]);
      setStats((prev) => ({
        ...prev,
        pendingAllocations: a.count || 0,
        pendingLeaveApprovals: l.count || 0,
        pendingAppeals: ap.count || 0,
        pendingBudgetRequests: b.count || 0,
      }));
    } catch {}
  }, []);

  const fetchDeanData = useCallback(async (isInitial = false) => {
    if (!facultyId) return;
    if (isInitial) setLoading(true);
    try {
      const depts = await fetchDepartments();
      const deptCodes = (depts || []).map((d) => d.department_code).filter(Boolean);
      const hodList = await fetchHODs();

      let coursesData = [], studentsData = [], lecturerIds = [], attendance = [];

      if (deptCodes.length > 0) {
        const [cRes, sRes, ldRes] = await Promise.all([
          supabase.from('courses').select('*').in('department_code', deptCodes).order('course_code'),
          supabase.from('students').select('*').in('department_code', deptCodes).order('full_name').limit(100),
          supabase.from('lecturer_departments').select('lecturer_id').in('department_code', deptCodes),
        ]);

        coursesData = cRes.data || [];
        studentsData = sRes.data || [];
        lecturerIds = [...new Set((ldRes.data || []).map((x) => x.lecturer_id))];

        if (lecturerIds.length) {
          const { data: lects } = await supabase.from('lecturers').select('*').in('id', lecturerIds).order('full_name');
          setLecturers(lects || []);
        }

        const courseIds = coursesData.map((c) => c.id);
        if (courseIds.length) {
          const { data: att } = await supabase
            .from('attendance_records')
            .select(`id, date, status, student_id, course_id,
              students:student_id (full_name, student_id),
              courses:course_id (course_code, course_name)`)
            .in('course_id', courseIds).order('date', { ascending: false }).limit(50);
          attendance = att || [];
        }

        await fetchPendingCounts(deptCodes);
      }

      setCourses(coursesData);
      setStudents(studentsData);
      setRecentAttendance(attendance);
      setStats((prev) => ({
        ...prev,
        totalDepartments: depts?.length || 0,
        totalCourses: coursesData.length,
        totalStudents: studentsData.length,
        totalLecturers: lecturerIds.length,
        totalHODs: hodList.length,
      }));

      await fetchAdmins();

      if (deanEmail) {
        const { data: role } = await supabase
          .from('user_roles').select('profile_picture_url').eq('email', deanEmail).eq('role', 'dean').maybeSingle();
        if (role?.profile_picture_url) {
          setProfilePicUrl(role.profile_picture_url);
          setProfileVersion(Date.now());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [facultyId, deanEmail, fetchDepartments, fetchHODs, fetchAdmins, fetchPendingCounts]);

  // ========== NOTIFICATIONS ==========
  const fetchNotifications = useCallback(async () => {
    if (!deanEmail) return;
    try {
      const { data } = await supabase
        .from('chat_messages').select('*').eq('receiver_email', deanEmail)
        .order('created_at', { ascending: false }).limit(50);
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch {}
  }, [deanEmail]);

  // ========== SETUP NOTIFICATION SUBSCRIPTION ==========
  const setupNotificationSubscription = useCallback(() => {
    if (notificationSubscriptionRef.current) {
      notificationSubscriptionRef.current.unsubscribe();
    }

    if (!deanEmail) return;

    const subscription = supabase
      .channel('dean-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_email=eq.${deanEmail}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    notificationSubscriptionRef.current = subscription;
  }, [deanEmail, fetchNotifications]);

  // ========== CHAT ==========
  const fetchChatMessages = useCallback(async (userEmail) => {
    if (!deanEmail || !userEmail) return;
    try {
      const { data } = await supabase
        .from('chat_messages').select('*')
        .or(`and(sender_email.eq.${deanEmail},receiver_email.eq.${userEmail}),and(sender_email.eq.${userEmail},receiver_email.eq.${deanEmail})`)
        .order('created_at', { ascending: true }).limit(200);
      setChatMessages(data || []);
    } catch {}
  }, [deanEmail]);

  const openChatWithUser = useCallback((user, type) => {
    if (!user?.email) return;
    setSelectedUser({
      email: user.email,
      role: type,
      name: user.display_name || user.full_name || user.head_name || user.email,
      display_name: user.display_name || user.full_name || user.head_name || user.email,
      department_id: user.department_id || null,
      id: user.id,
    });
    setSelectedUserType(type);
    setShowChat(true);
    setChatMessages([]);
    fetchChatMessages(user.email);
  }, [fetchChatMessages]);

  const openAdminChat = useCallback(async () => {
    let list = admins;
    if (!list.length) list = await fetchAdmins();
    if (list.length) openChatWithUser(list[0], 'admin');
    else alert('No administrators available');
  }, [admins, fetchAdmins, openChatWithUser]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedUser) return;
    const text = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    setChatMessages((prev) => [...prev, {
      id: tempId,
      sender_email: deanEmail,
      sender_role: 'dean',
      sender_name: deanName,
      receiver_email: selectedUser.email,
      receiver_role: selectedUserType,
      message: text,
      is_read: false,
      created_at: new Date().toISOString(),
    }]);
    setNewMessage('');
    setSendingMessage(true);

    try {
      const { data, error } = await supabase.from('chat_messages').insert([{
        sender_id: profile?.id || facultyId,
        sender_email: deanEmail,
        sender_role: 'dean',
        sender_name: deanName,
        receiver_email: selectedUser.email,
        receiver_role: selectedUserType,
        message: text,
        faculty_id: facultyId,
        department_id: selectedUser.department_id || null,
        is_read: false,
      }]).select().single();
      if (error) throw error;
      setChatMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
    } catch (err) {
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(err.message);
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, selectedUser, selectedUserType, deanEmail, deanName, facultyId, profile]);

  // ========== EFFECTS ==========
  useEffect(() => {
    if (!facultyId) return;
    fetchDeanData(true);
    fetchNotifications();
    setupNotificationSubscription();

    return () => {
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }
    };
  }, [facultyId, fetchDeanData, fetchNotifications, setupNotificationSubscription]);

  // Soft refresh every 3 min
  useEffect(() => {
    if (!facultyId) return;
    const id = setInterval(() => {
      fetchDeanData(false);
      fetchNotifications();
    }, 180000);
    return () => clearInterval(id);
  }, [facultyId, fetchDeanData, fetchNotifications]);

  // ========== MEMOIZED PROPS ==========
  const commonProps = useMemo(() => ({
    facultyId, facultyName, deanEmail, deanName,
    departments, hods, courses, students, lecturers, recentAttendance,
    stats, admins, openChatWithUser, openAdminChat,
    profile, profileVersion, profilePicUrl, loading,
    searchTerm, setSearchTerm, fetchDeanData, setStats,
  }), [
    facultyId, facultyName, deanEmail, deanName,
    departments, hods, courses, students, lecturers, recentAttendance,
    stats, admins, openChatWithUser, openAdminChat,
    profileVersion, profilePicUrl, loading, searchTerm
  ]);

  // ========== RENDER ==========
  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <DeanOverview {...commonProps} />;
      case 'allocations': return <DeanCourseAllocations {...commonProps} />;
      case 'workload': return <DeanWorkload {...commonProps} />;
      case 'leave-approvals': return <DeanLeaveApprovals {...commonProps} />;
      case 'appeals': return <DeanAppeals {...commonProps} />;
      case 'timetable': return <DeanTimetable {...commonProps} />;
      case 'exam-results': return <DeanExamResults {...commonProps} />;
      case 'appraisals': return <DeanAppraisals {...commonProps} />;
      case 'budget': return <DeanBudget {...commonProps} />;
      case 'curriculum': return <DeanCurriculum {...commonProps} />;
      case 'quality': return <DeanQualityAssurance {...commonProps} />;
      case 'admissions': return <DeanAdmissions {...commonProps} />;
      case 'disciplinary': return <DeanDisciplinary {...commonProps} />;
      case 'postgraduate': return <DeanPostgraduate {...commonProps} />;
      case 'reports': return <DeanBoardReports {...commonProps} />;
      case 'hods': return <DeanHODs {...commonProps} />;
      case 'departments': return <DeanDepartments {...commonProps} />;
      case 'settings': return <DeanSettings {...commonProps} />;
      default: return <DeanOverview {...commonProps} />;
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'allocations', label: '📚 Course Allocations' },
    { id: 'workload', label: '⚖️ Workload' },
    { id: 'leave-approvals', label: '📝 Leave Approvals' },
    { id: 'appeals', label: '💬 Appeals' },
    { id: 'timetable', label: '📅 Timetable' },
    { id: 'exam-results', label: '📝 Exam Results' },
    { id: 'appraisals', label: '⭐ Appraisals' },
    { id: 'budget', label: '💰 Budget' },
    { id: 'curriculum', label: '📋 Curriculum' },
    { id: 'quality', label: '✅ QA' },
    { id: 'admissions', label: '🎓 Admissions' },
    { id: 'disciplinary', label: '⚖️ Disciplinary' },
    { id: 'postgraduate', label: '🎯 Postgraduate' },
    { id: 'reports', label: '📄 Reports' },
    { id: 'hods', label: '👨‍💼 HODs' },
    { id: 'departments', label: '🏢 Departments' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="dean-dashboard">
      <header className="dean-header">
        <div className="dean-header-left">
          <h1>🎓 Dean Dashboard</h1>
          <p>{facultyName}</p>
        </div>
        <div className="dean-header-right">
          <button className="dean-admin-chat-btn" onClick={openAdminChat} title="Chat with Admin">
            👤
            <span className="dean-admin-badge">A</span>
          </button>

          {/* ===== NOTIFICATIONS - FIXED ===== */}
          <div className="dean-notification-wrapper">
            <button 
              className="dean-notification-btn" 
              onClick={() => setShowNotifications(v => !v)}
            >
              🔔
              {unreadCount > 0 && (
                <span className="dean-notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <DeanNotifications
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={async (id) => {
                  await supabase.from('chat_messages').update({ is_read: true }).eq('id', id);
                  fetchNotifications();
                }}
                onMarkAllRead={async () => {
                  await supabase.from('chat_messages').update({ is_read: true }).eq('receiver_email', deanEmail).eq('is_read', false);
                  fetchNotifications();
                }}
                onNotificationClick={(notif) => {
                  setShowNotifications(false);
                  const user = {
                    email: notif.sender_email,
                    role: notif.sender_role || 'user',
                    name: notif.sender_name || notif.sender_email,
                    display_name: notif.sender_name || notif.sender_email,
                    department_id: notif.department_id || null,
                    id: notif.sender_id || null,
                  };
                  openChatWithUser(user, notif.sender_role || 'user');
                }}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          <div className="dean-user-info">
            <div className="dean-avatar" onClick={() => setActiveTab('settings')}>
              {(profilePicUrl || profile?.profile_picture_url) ? (
                <img 
                  src={`${profilePicUrl || profile.profile_picture_url}?t=${profileVersion}`} 
                  alt="" 
                  className="dean-avatar-img" 
                />
              ) : (
                <span>{deanName[0]?.toUpperCase() || 'D'}</span>
              )}
            </div>
            <div>
              <span className="dean-user-name">{deanName}</span>
              <span className="dean-user-role">Dean</span>
            </div>
          </div>
          <button className="dean-logout-btn" onClick={() => { signOut(); navigate('/login'); }}>Sign Out</button>
        </div>
      </header>

      <nav className="dean-nav">
        {tabs.map((t) => (
          <button 
            key={t.id} 
            className={`dean-nav-btn ${activeTab === t.id ? 'active' : ''}`} 
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="dean-content">
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {renderContent()}
        </div>
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        )}
      </main>

      {showChat && selectedUser && (
        <DeanChat
          selectedUser={selectedUser}
          selectedUserType={selectedUserType}
          messages={chatMessages}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          sendMessage={sendMessage}
          sendingMessage={sendingMessage}
          onClose={() => setShowChat(false)}
          chatEndRef={chatEndRef}
        />
      )}
    </div>
  );
};

export default DeanDashboard;