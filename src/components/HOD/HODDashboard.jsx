// HODDashboard.jsx - Main Orchestrator
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';

// Import all components
import HODOverview from './HODOverview';
import HODCourseAllocations from './HODCourseAllocations';
import HODWorkload from './HODWorkload';
import HODLeaveRequests from './HODLeaveRequests';
import HODComplaints from './HODComplaints';
import HODTimetable from './HODTimetable';
import HODExamModeration from './HODExamModeration';
import HODStaffAppraisal from './HODStaffAppraisal';
import HODBudgetRequests from './HODBudgetRequests';
import HODAttendance from './HODAttendance';
import HODSettings from './HODSettings';
import HODChat from './HODChat';
import HODNotifications from './HODNotifications';

import './HODDashboard.css';

const HODDashboard = () => {
  const { profile, signOut } = useAdminAuth();
  const navigate = useNavigate();

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [deanInfo, setDeanInfo] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileVersion, setProfileVersion] = useState(0);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalLecturers: 0,
    attendanceRate: 0,
    pendingLeaveRequests: 0,
    pendingComplaints: 0,
    pendingAllocations: 0,
  });

  // Chat State
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

  // Derived
  const departmentId = profile?.department_id || profile?.id || profile?.table_id;
  const departmentName = departmentInfo?.department_name || profile?.department_name || 'Department';
  const departmentCode = departmentInfo?.department_code || profile?.department_code || '';
  const hodEmail = profile?.email || '';
  const hodName = profile?.full_name || departmentInfo?.head_of_department || 'HOD';

  // ==================== DATA FETCHING ====================
  const fetchAdmins = useCallback(async () => {
    try {
      const { data: adminRoles, error } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url, full_name')
        .eq('role', 'admin')
        .limit(10);

      if (error) throw error;

      const list = (adminRoles || []).map((a) => ({
        ...a,
        display_name: a.full_name || a.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Admin',
        full_name: a.full_name || a.email?.split('@')[0] || 'Admin',
      }));

      setAdmins(list);
      return list;
    } catch (err) {
      console.error('Error fetching admins:', err);
      setAdmins([]);
      return [];
    }
  }, []);

  const fetchDeanInfo = useCallback(async () => {
    let facultyId = profile?.faculty_id || departmentInfo?.faculty_id;

    if (!facultyId && departmentId) {
      const { data: dept } = await supabase
        .from('departments')
        .select('faculty_id')
        .eq('id', departmentId)
        .single();
      facultyId = dept?.faculty_id;
    }

    if (!facultyId) return;

    try {
      const { data: deanRoles, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'dean')
        .eq('faculty_id', facultyId)
        .limit(1);

      if (error) throw error;

      if (deanRoles?.length > 0) {
        const d = deanRoles[0];

        let faculty = null;
        if (d.faculty_id) {
          const { data: fac } = await supabase
            .from('faculties')
            .select('faculty_code, faculty_name, dean, contact_email, contact_phone')
            .eq('id', d.faculty_id)
            .single();
          faculty = fac;
        }

        setDeanInfo({
          id: d.id,
          email: d.email,
          faculty_id: d.faculty_id,
          profile_picture_url: d.profile_picture_url || null,
          faculty_name: faculty?.faculty_name || 'Faculty',
          faculty_code: faculty?.faculty_code || '',
          display_name: faculty?.dean || d.full_name || d.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || d.email,
          full_name: faculty?.dean || d.full_name || d.email,
          contact_email: faculty?.contact_email,
          contact_phone: faculty?.contact_phone,
        });
      }
    } catch (err) {
      console.error('Error fetching dean:', err);
    }
  }, [profile?.faculty_id, departmentId, departmentInfo]);

  const fetchHODData = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    try {
      // Department
      const { data: dept } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (!dept) {
        setLoading(false);
        return;
      }

      setDepartmentInfo(dept);
      const deptCode = dept.department_code;

      // Courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('department_code', deptCode)
        .order('course_code');
      setCourses(coursesData || []);

      // Students
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('department_code', deptCode)
        .order('full_name');

      const enrichedStudents = await Promise.all(
        (studentsData || []).map(async (student) => {
          let profilePic = student.profile_picture_url || null;
          if (!profilePic && student.email) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('profile_picture_url')
              .eq('email', student.email)
              .maybeSingle();
            if (roleData?.profile_picture_url) {
              profilePic = roleData.profile_picture_url;
            }
          }
          return { ...student, profile_picture_url: profilePic };
        })
      );
      setStudents(enrichedStudents);

      // Lecturers
      const { data: lecturerDepts } = await supabase
        .from('lecturer_departments')
        .select('lecturer_id')
        .eq('department_code', deptCode);

      const lecturerIds = [...new Set((lecturerDepts || []).map((ld) => ld.lecturer_id).filter(Boolean))];
      let lectList = [];

      if (lecturerIds.length > 0) {
        const { data: lects } = await supabase
          .from('lecturers')
          .select('*')
          .in('id', lecturerIds)
          .order('full_name');

        lectList = await Promise.all(
          (lects || []).map(async (lecturer) => {
            let profilePic = lecturer.profile_picture_url || null;
            if (!profilePic && lecturer.email) {
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('profile_picture_url')
                .eq('email', lecturer.email)
                .eq('role', 'lecturer')
                .maybeSingle();
              if (roleData?.profile_picture_url) {
                profilePic = roleData.profile_picture_url;
              }
            }
            return { ...lecturer, profile_picture_url: profilePic };
          })
        );
      }
      setLecturers(lectList);

      // Attendance
      const courseIds = (coursesData || []).map((c) => c.id);
      if (courseIds.length > 0) {
        const { data: attendance } = await supabase
          .from('attendance_records')
          .select(`
            id, date, status, student_id, course_id,
            students:student_id (full_name, student_id),
            courses:course_id (course_code, course_name)
          `)
          .in('course_id', courseIds)
          .order('date', { ascending: false })
          .limit(100);

        setRecentAttendance(attendance || []);
        if (attendance?.length > 0) {
          const present = attendance.filter((a) => a.status === 'present').length;
          setStats((prev) => ({
            ...prev,
            attendanceRate: Math.round((present / attendance.length) * 100),
          }));
        }
      }

      // Fetch pending counts for HOD responsibilities
      await fetchPendingCounts(deptCode);

      setStats((prev) => ({
        ...prev,
        totalCourses: coursesData?.length || 0,
        totalStudents: studentsData?.length || 0,
        totalLecturers: lectList.length,
      }));

      // Profile picture
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('profile_picture_url')
        .eq('email', hodEmail)
        .eq('role', 'hod')
        .maybeSingle();

      if (roleData?.profile_picture_url) {
        profile.profile_picture_url = roleData.profile_picture_url;
        setProfileVersion(Date.now());
      }
    } catch (err) {
      console.error('Error fetching HOD data:', err);
    } finally {
      setLoading(false);
    }
  }, [departmentId, hodEmail, profile]);

  const fetchPendingCounts = async (deptCode) => {
    try {
      // Leave requests
      const { count: leaveCount } = await supabase
        .from('lecturer_leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending');

      // Complaints
      const { count: complaintCount } = await supabase
        .from('student_complaints')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending');

      // Course allocations pending
      const { count: allocationCount } = await supabase
        .from('course_allocations')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending');

      setStats((prev) => ({
        ...prev,
        pendingLeaveRequests: leaveCount || 0,
        pendingComplaints: complaintCount || 0,
        pendingAllocations: allocationCount || 0,
      }));
    } catch (err) {
      console.error('Error fetching pending counts:', err);
    }
  };

  // ==================== NOTIFICATIONS ====================
  const fetchNotifications = useCallback(async () => {
    if (!hodEmail) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', hodEmail)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read)?.length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [hodEmail]);

  const setupNotificationSubscription = () => {
    if (notificationSubscriptionRef.current) {
      notificationSubscriptionRef.current.unsubscribe();
    }

    const subscription = supabase
      .channel('hod-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_email=eq.${hodEmail}`,
        },
        (payload) => {
          fetchNotifications();
        }
      )
      .subscribe();

    notificationSubscriptionRef.current = subscription;
  };

  const markNotificationRead = async (id) => {
    try {
      await supabase.from('chat_messages').update({ is_read: true }).eq('id', id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', hodEmail)
        .eq('is_read', false);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // ==================== CHAT ====================
  const fetchChatMessages = useCallback(async (userEmail) => {
    if (!hodEmail || !userEmail) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_email.eq.${hodEmail},receiver_email.eq.${userEmail}),` +
          `and(sender_email.eq.${userEmail},receiver_email.eq.${hodEmail})`
        )
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setChatMessages(data || []);

      const unread = (data || []).filter(
        (m) => m.receiver_email === hodEmail && !m.is_read
      );
      for (const msg of unread) {
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
      }
      fetchNotifications();

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (err) {
      console.error('Error fetching chat:', err);
    }
  }, [hodEmail, fetchNotifications]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    const tempId = `temp-${Date.now()}`;
    const messageText = newMessage.trim();

    const optimisticMsg = {
      id: tempId,
      sender_email: hodEmail,
      sender_role: 'hod',
      sender_name: hodName,
      receiver_email: selectedUser.email,
      receiver_role: selectedUserType,
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
          sender_id: profile?.id || departmentId,
          sender_email: hodEmail,
          sender_role: 'hod',
          sender_name: hodName,
          receiver_email: selectedUser.email,
          receiver_role: selectedUserType,
          message: messageText,
          faculty_id: profile?.faculty_id || departmentInfo?.faculty_id,
          department_id: departmentId,
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
      alert('Failed to send message: ' + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const openChatWithUser = (user, type) => {
    if (!user?.email) return;
    setSelectedUser({
      email: user.email,
      role: type,
      name: user.display_name || user.full_name || user.name || user.email,
      display_name: user.display_name || user.full_name || user.name || user.email,
      id: user.id,
    });
    setSelectedUserType(type);
    setShowChat(true);
    setChatMessages([]);
    fetchChatMessages(user.email);
  };

  const openAdminChat = async () => {
    let list = admins;
    if (list.length === 0) {
      list = await fetchAdmins();
    }
    if (list.length > 0) {
      openChatWithUser(list[0], 'admin');
    } else {
      alert('No system administrators available.');
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchHODData();
    fetchAdmins();
    fetchNotifications();
    setupNotificationSubscription();

    return () => {
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchHODData, fetchAdmins, fetchNotifications]);

  useEffect(() => {
    if (departmentInfo) {
      fetchDeanInfo();
    }
  }, [departmentInfo, fetchDeanInfo]);

  // ==================== RENDER ====================
  const renderContent = () => {
    const commonProps = {
      departmentId,
      departmentCode,
      departmentName,
      hodEmail,
      hodName,
      courses,
      students,
      lecturers,
      recentAttendance,
      stats,
      deanInfo,
      admins,
      openChatWithUser,
      openAdminChat,
      profile,
      profileVersion,
      loading,
      searchTerm,
      setSearchTerm,
      fetchHODData,
      setStats,
    };

    switch (activeTab) {
      case 'overview':
        return <HODOverview {...commonProps} />;
      case 'allocations':
        return <HODCourseAllocations {...commonProps} />;
      case 'workload':
        return <HODWorkload {...commonProps} />;
      case 'leave':
        return <HODLeaveRequests {...commonProps} />;
      case 'complaints':
        return <HODComplaints {...commonProps} />;
      case 'timetable':
        return <HODTimetable {...commonProps} />;
      case 'exam-moderation':
        return <HODExamModeration {...commonProps} />;
      case 'appraisal':
        return <HODStaffAppraisal {...commonProps} />;
      case 'budget':
        return <HODBudgetRequests {...commonProps} />;
      case 'attendance':
        return <HODAttendance {...commonProps} />;
      case 'settings':
        return <HODSettings {...commonProps} />;
      default:
        return <HODOverview {...commonProps} />;
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'allocations', label: '📚 Course Allocations' },
    { id: 'workload', label: '⚖️ Workload' },
    { id: 'leave', label: '📝 Leave Requests' },
    { id: 'complaints', label: '💬 Complaints' },
    { id: 'timetable', label: '📅 Timetable' },
    { id: 'exam-moderation', label: '📝 Exam Moderation' },
    { id: 'appraisal', label: '⭐ Staff Appraisal' },
    { id: 'budget', label: '💰 Budget' },
    { id: 'attendance', label: '✅ Attendance' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="hod-dashboard">
      {/* HEADER */}
      <header className="hod-header">
        <div className="hod-header-left">
          <h1>🏢 HOD Dashboard</h1>
          <p>{departmentName} ({departmentCode})</p>
        </div>

        <div className="hod-header-right">
          <button className="hod-admin-chat-btn" onClick={openAdminChat} title="Chat with Admin">
            👤
            <span className="hod-admin-badge">A</span>
          </button>

          <div className="hod-notification-wrapper">
            <button
              className="hod-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {unreadCount > 0 && <span className="hod-notification-badge">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <HODNotifications
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onNotificationClick={(notif) => {
                  markNotificationRead(notif.id);
                  setShowNotifications(false);
                  openChatWithUser(
                    { email: notif.sender_email, name: notif.sender_name },
                    notif.sender_role
                  );
                }}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          <div className="hod-user-info">
            <div className="hod-avatar" onClick={() => setActiveTab('settings')}>
              {profile?.profile_picture_url ? (
                <img
                  src={`${profile.profile_picture_url}?t=${profileVersion}`}
                  alt={hodName}
                  className="hod-avatar-img"
                />
              ) : (
                <span>{hodName?.[0]?.toUpperCase() || 'H'}</span>
              )}
            </div>
            <div>
              <span className="hod-user-name">{hodName}</span>
              <span className="hod-user-role">HOD</span>
            </div>
          </div>

          <button className="hod-logout-btn" onClick={() => { signOut(); navigate('/login'); }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* NAV */}
      <nav className="hod-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`hod-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className="hod-content">
        {renderContent()}
      </main>

      {/* CHAT MODAL */}
      {showChat && selectedUser && (
        <HODChat
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

export default HODDashboard;