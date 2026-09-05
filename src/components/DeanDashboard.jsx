// DeanDashboard.jsx - COMPLETE WITH ALL NOTIFICATIONS
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import useNotifications from '../hooks/useNotifications';

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
import DeanFacultyBoardReports from './dean/DeanFacultyBoardReports';
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
  const [isMounted, setIsMounted] = useState(true);

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

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserType, setSelectedUserType] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // ===== NOTIFICATIONS - USING THE HOOK =====
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationSubscriptionRef = useRef(null);
  const leaveSubscriptionRef = useRef(null);

  // Stable derived
  const facultyId = profile?.faculty_id || profile?.id || profile?.table_id || null;
  const facultyName = profile?.faculty_name || 'Faculty';
  const deanEmail = profile?.email || '';
  const deanName = profile?.full_name || 'Dean';

  // Use the notifications hook
  const {
    notifications,
    unreadCount,
    pendingLeaveRequests,
    fetchAllNotifications,
    fetchPendingLeaveRequests,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    setNotifications,
    readBudgetIds,
    readDisciplinaryIds
  } = useNotifications({
    userEmail: deanEmail,
    userId: profile?.id,
    departments: departments,
    facultyId: facultyId,
    isMounted: isMounted
  });

  // ========== FETCH FUNCTIONS ==========
  const fetchAdmins = useCallback(async () => {
    if (!isMounted) return [];
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url, table_id, user_id, created_at')
        .eq('role', 'admin')
        .limit(10);
      if (error || !data) { 
        if (isMounted) setAdmins([]); 
        return []; 
      }
      const list = data.map((a) => {
        const displayName = a.email?.split('@')[0]
          ?.replace(/\./g, ' ')
          ?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Admin';
        return { ...a, display_name: displayName, full_name: displayName, name: displayName };
      });
      if (isMounted) setAdmins(list);
      return list;
    } catch { 
      if (isMounted) setAdmins([]); 
      return []; 
    }
  }, [isMounted]);

  const fetchHODs = useCallback(async () => {
    if (!facultyId || !isMounted) return [];
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`id, email, role, department_id, faculty_id, profile_picture_url,
          departments:department_id (id, department_code, department_name, head_of_department, contact_email, contact_phone, is_active)`)
        .eq('role', 'hod')
        .eq('faculty_id', facultyId);
      if (error) throw error;
      const list = (data || []).map((h) => ({
        id: h.id, 
        email: h.email, 
        role: h.role, 
        department_id: h.department_id,
        department_code: h.departments?.department_code || '',
        department_name: h.departments?.department_name || '',
        head_name: h.departments?.head_of_department || h.email,
        contact_email: h.departments?.contact_email || h.email,
        contact_phone: h.departments?.contact_phone || '',
        is_active: h.departments?.is_active ?? true,
        profile_picture_url: h.profile_picture_url || null,
      }));
      if (isMounted) setHODs(list);
      return list;
    } catch { 
      if (isMounted) setHODs([]); 
      return []; 
    }
  }, [facultyId, isMounted]);

  const fetchDepartments = useCallback(async () => {
    if (!facultyId || !isMounted) return [];
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('faculty_id', facultyId)
        .order('department_code');
      if (error) throw error;
      if (isMounted) setDepartments(data || []);
      return data || [];
    } catch { 
      if (isMounted) setDepartments([]); 
      return []; 
    }
  }, [facultyId, isMounted]);

  const fetchPendingCounts = useCallback(async (deptCodes) => {
    if (!deptCodes?.length || !isMounted) return;
    try {
      const [a, l, ap, b] = await Promise.all([
        supabase.from('course_allocations').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).eq('status', 'pending'),
        supabase.from('lecturer_leave_requests').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).eq('status', 'approved_by_hod'),
        supabase.from('student_complaints').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).in('status', ['pending', 'in-progress']),
        supabase.from('budget_requests').select('id', { count: 'exact', head: true }).in('department_code', deptCodes).eq('faculty_status', 'pending_dean'),
      ]);
      if (isMounted) {
        setStats((prev) => ({
          ...prev,
          pendingAllocations: a.count || 0,
          pendingLeaveApprovals: l.count || 0,
          pendingAppeals: ap.count || 0,
          pendingBudgetRequests: b.count || 0,
        }));
      }
    } catch {}
  }, [isMounted]);

  // ===== SETUP SUBSCRIPTIONS =====
  const setupSubscriptions = useCallback(() => {
    if (notificationSubscriptionRef.current) {
      try {
        notificationSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error cleaning up notification subscription:', err);
      }
      notificationSubscriptionRef.current = null;
    }

    if (leaveSubscriptionRef.current) {
      try {
        leaveSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error cleaning up leave subscription:', err);
      }
      leaveSubscriptionRef.current = null;
    }

    if (!deanEmail || !facultyId || !isMounted) return;

    // Subscribe to chat messages
    try {
      notificationSubscriptionRef.current = supabase
        .channel('dean-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `receiver_email=eq.${deanEmail}`,
          },
          (payload) => {
            console.log('💬 New chat notification:', payload);
            if (isMounted) {
              fetchAllNotifications();
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Error setting up notification subscription:', err);
    }

    // Subscribe to new leave requests
    try {
      leaveSubscriptionRef.current = supabase
        .channel('dean-leave-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lecturer_leave_requests',
          },
          (payload) => {
            console.log('📋 New leave request:', payload);
            if (isMounted) {
              fetchPendingLeaveRequests();
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Error setting up leave subscription:', err);
    }
  }, [deanEmail, facultyId, isMounted, fetchAllNotifications, fetchPendingLeaveRequests]);

  // ===== CLEANUP =====
  const cleanupSubscriptions = useCallback(() => {
    if (notificationSubscriptionRef.current) {
      try {
        notificationSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error cleaning up notification subscription:', err);
      }
      notificationSubscriptionRef.current = null;
    }

    if (leaveSubscriptionRef.current) {
      try {
        leaveSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error cleaning up leave subscription:', err);
      }
      leaveSubscriptionRef.current = null;
    }
  }, []);

  // ========== MAIN DATA FETCH ==========
  const fetchDeanData = useCallback(async (isInitial = false) => {
    if (!facultyId || !isMounted) return;
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
          if (isMounted) setLecturers(lects || []);
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

      if (isMounted) {
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
        await fetchPendingLeaveRequests();
        await fetchAllNotifications();

        if (deanEmail) {
          const { data: role } = await supabase
            .from('user_roles')
            .select('profile_picture_url')
            .eq('email', deanEmail)
            .eq('role', 'dean')
            .maybeSingle();
          if (role?.profile_picture_url) {
            setProfilePicUrl(role.profile_picture_url);
            setProfileVersion(Date.now());
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial && isMounted) setLoading(false);
    }
  }, [facultyId, deanEmail, isMounted, fetchDepartments, fetchHODs, fetchAdmins, fetchPendingCounts, fetchPendingLeaveRequests, fetchAllNotifications]);

  // ========== CHAT ==========
  const fetchChatMessages = useCallback(async (userEmail) => {
    if (!deanEmail || !userEmail || !isMounted) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_email.eq.${deanEmail},receiver_email.eq.${userEmail}),` +
          `and(sender_email.eq.${userEmail},receiver_email.eq.${deanEmail})`
        )
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      if (isMounted) setChatMessages(data || []);

      const unread = (data || []).filter(
        (m) => m.receiver_email === deanEmail && !m.is_read
      );
      for (const msg of unread) {
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
      }
      if (isMounted) {
        fetchAllNotifications();
        setNotifications(prev => 
          prev.map(n => {
            if (n.id?.startsWith('chat-') && unread.some(m => n.id === `chat-${m.id}`)) {
              return { ...n, is_read: true };
            }
            return n;
          })
        );
      }

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (err) {
      console.error('Error fetching chat:', err);
    }
  }, [deanEmail, isMounted, fetchAllNotifications, setNotifications]);

  const openChatWithUser = useCallback((user, type) => {
    if (!user?.email || !isMounted) return;
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
  }, [fetchChatMessages, isMounted]);

  const openAdminChat = useCallback(async () => {
    let list = admins;
    if (!list.length) list = await fetchAdmins();
    if (list.length && isMounted) openChatWithUser(list[0], 'admin');
    else if (isMounted) alert('No administrators available');
  }, [admins, fetchAdmins, openChatWithUser, isMounted]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedUser || !isMounted) return;
    const text = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    const optimisticMsg = {
      id: tempId,
      sender_email: deanEmail,
      sender_role: 'dean',
      sender_name: deanName,
      receiver_email: selectedUser.email,
      receiver_role: selectedUserType,
      message: text,
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
        }])
        .select()
        .single();

      if (error) throw error;
      if (isMounted) {
        setChatMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      }
    } catch (err) {
      console.error('Send error:', err);
      if (isMounted) {
        setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert('Failed to send message: ' + err.message);
      }
    } finally {
      if (isMounted) setSendingMessage(false);
    }
  }, [newMessage, selectedUser, selectedUserType, deanEmail, deanName, facultyId, profile, isMounted]);

  // ========== EFFECTS ==========
  useEffect(() => {
    setIsMounted(true);
    
    fetchDeanData(true);
    setupSubscriptions();

    return () => {
      setIsMounted(false);
      cleanupSubscriptions();
    };
  }, []);

  useEffect(() => {
    if (departments.length > 0 && isMounted) {
      // Refresh notifications when departments change
      fetchAllNotifications();
    }
  }, [departments, isMounted, fetchAllNotifications]);

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
      case 'appeals': return <DeanAppeals {...commonProps} facultyId={facultyId} />;
      case 'timetable': return <DeanTimetable {...commonProps} />;
      case 'exam-results': return <DeanExamResults {...commonProps} facultyId={facultyId} />;
      case 'appraisals': return <DeanAppraisals {...commonProps} />;
      case 'budget': return <DeanBudget 
        departments={departments} 
        fetchDeanData={fetchDeanData} 
        setStats={setStats}
        deanEmail={deanEmail}
        deanName={deanName}
        onNotificationUpdate={() => {
          console.log('💰 Budget update triggered, fetching notifications...');
          fetchAllNotifications();
        }}
      />;
      case 'curriculum': return <DeanCurriculum {...commonProps} />;
      case 'qa': return <DeanQualityAssurance departments={departments} fetchDeanData={fetchDeanData} setStats={setStats} />;
case 'admissions': return <DeanAdmissions 
  departments={departments}
  onNotificationUpdate={() => {
    console.log('🎓 Admissions update triggered, fetching notifications...');
    fetchAllNotifications();
  }}
/>;
      case 'disciplinary': return <DeanDisciplinary 
        departments={departments} 
        fetchDeanData={fetchDeanData} 
        setStats={setStats}
        onNotificationUpdate={() => {
          console.log('⚖️ Disciplinary update triggered, fetching notifications...');
          fetchAllNotifications();
        }}
      />;
      case 'postgraduate': return <DeanPostgraduate {...commonProps} />;
      case 'reports': return <DeanFacultyBoardReports profile={profile} fetchDeanData={fetchDeanData} setStats={setStats} />;
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
    { id: 'qa', label: '📋 QA & Accreditation' },
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
      {/* HEADER */}
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

          {/* ===== NOTIFICATIONS ===== */}
          <div className="dean-notification-wrapper">
            <button
              className="dean-notification-btn"
              onClick={() => {
                // Toggle notifications
                setShowNotifications(!showNotifications);
                
                // Always fetch when clicking the bell
                console.log('🔔 Fetching notifications on bell click...');
                fetchAllNotifications();
              }}
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
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onClearAll={clearAllNotifications}
// In DeanDashboard.jsx - Complete onNotificationClick handler

onNotificationClick={(notif) => {
  setShowNotifications(false);
  
  markNotificationRead(notif.id);

  // 1. Leave Requests (from lecturer_leave_requests)
  if (notif.id?.startsWith('leave-') || notif.type === 'leave_pending') {
    setActiveTab('leave-approvals');
    return;
  }

  // 2. Budget Requests
  if (notif.id?.startsWith('budget-') || notif.type === 'budget_request') {
    setActiveTab('budget');
    return;
  }

  // 3. Disciplinary Cases
  if (notif.id?.startsWith('disciplinary-') || notif.type === 'disciplinary_case') {
    setActiveTab('disciplinary');
    return;
  }

  // 4. Admissions
  if (notif.id?.startsWith('admission-') || notif.type === 'admission') {
    setActiveTab('admissions');
    return;
  }

  // 5. QA / Accreditation
  if (notif.id?.startsWith('qa-') || notif.type === 'qa') {
    setActiveTab('qa');
    return;
  }

  // 6. Curriculum
  if (notif.id?.startsWith('curriculum-') || notif.type === 'curriculum') {
    setActiveTab('curriculum');
    return;
  }

  // 7. Appraisals
  if (notif.id?.startsWith('appraisal-') || notif.type === 'appraisal') {
    setActiveTab('appraisals');
    return;
  }

  // 8. Exam Results
  if (notif.id?.startsWith('examresult-') || notif.type === 'exam_result') {
    setActiveTab('exam-results');
    return;
  }

  // 9. Appeals
  if (notif.id?.startsWith('appeal-') || notif.type === 'appeal') {
    setActiveTab('appeals');
    return;
  }

  // 10. Course Allocations
  if (notif.id?.startsWith('allocation-') || notif.type === 'course_allocation') {
    setActiveTab('allocations');
    return;
  }

  // 11. Leave Approvals (Dean level)
  if (notif.id?.startsWith('leaveapproval-') || notif.type === 'leave_approval') {
    setActiveTab('leave-approvals');
    return;
  }

  // 12. Chat Messages (Default)
  // Open chat for normal messages
  openChatWithUser(
    {
      email: notif.sender_email,
      name: notif.sender_name,
      display_name: notif.sender_name,
    },
    notif.sender_role || 'user'
  );
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

          <button className="dean-logout-btn" onClick={() => { signOut(); navigate('/login'); }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* NAV */}
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

      {/* CONTENT */}
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

      {/* CHAT MODAL */}
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
          deanEmail={deanEmail}
          deanName={deanName}
          profile={profile}
        />
      )}

      {/* CSS for notifications */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .dean-notification-wrapper {
          position: relative;
          display: inline-block;
        }
        .dean-notification-btn {
          background: transparent;
          border: none;
          font-size: 22px;
          cursor: pointer;
          position: relative;
          padding: 8px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .dean-notification-btn:hover {
          background: rgba(0,0,0,0.05);
        }
        .dean-notification-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #ff1744;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 10px;
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default DeanDashboard;