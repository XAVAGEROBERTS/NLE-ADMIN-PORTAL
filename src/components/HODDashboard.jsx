// HODDashboard.jsx - COMPLETE WITH INSTANT NOTIFICATIONS
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';

// HOD Components
import HODOverview from './HOD/HODOverview';
import HODCourseAllocations from './HOD/HODCourseAllocations';
import HODWorkload from './HOD/HODWorkload';
import HODLeaveRequests from './HOD/HODLeaveRequests';
import HODComplaints from './HOD/HODComplaints';
import HODTimetable from './HOD/HODTimetable';
import HODExamModeration from './HOD/HODExamModeration';
import HODExamResultsApproval from './HOD/HODExamResultsApproval';
import HODStaffAppraisal from './HOD/HODStaffAppraisal';
import HODBudgetRequests from './HOD/HODBudgetRequests';
import HODAttendance from './HOD/HODAttendance';
import HODSettings from './HOD/HODSettings';
import HODChat from './HOD/HODChat';
import HODNotifications from './HOD/HODNotifications';
import HOStatsCards from './HOD/HOStatsCards';
import HODStudents from './HOD/HODStudents';
import HODCurriculumManagement from './HOD/HODCurriculumManagement'; 
import HODQualityAssurance from './HOD/HODQualityAssurance';
import HODDisciplinaryCases from './HOD/HODDisciplinaryCases';
import ReportViewer from './shared/ReportViewer';
import HODModuleEvaluation from './HOD/HODModuleEvaluation';
import './HOD/HODDashboard.css';

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
  const [isMounted, setIsMounted] = useState(true);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserType, setSelectedUserType] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // ===== NOTIFICATIONS - INSTANT UPDATES =====
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState([]);
  const notificationSubscriptionRef = useRef(null);
  const leaveSubscriptionRef = useRef(null);
  const intervalRef = useRef(null);

  // Derived
  const departmentId = profile?.department_id || profile?.id || profile?.table_id;
  const departmentName = departmentInfo?.department_name || profile?.department_name || 'Department';
  const departmentCode = departmentInfo?.department_code || profile?.department_code || '';
  const hodEmail = profile?.email || '';
  const hodName = profile?.full_name || departmentInfo?.head_of_department || 'HOD';

  // ==================== CLEANUP ====================
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

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', hodEmail)
        .eq('is_read', false);

      setNotifications([]);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }, [hodEmail]);

  // ==================== DATA FETCHING ====================
  const fetchAdmins = useCallback(async () => {
    if (!isMounted) return [];
    try {
      const { data: adminRoles, error } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url, table_id, user_id, created_at')
        .eq('role', 'admin')
        .limit(10);

      if (error) {
        console.error('Error fetching admins:', error);
        if (isMounted) setAdmins([]);
        return [];
      }

      if (!adminRoles || adminRoles.length === 0) {
        if (isMounted) setAdmins([]);
        return [];
      }

      const list = adminRoles.map((a) => {
        const displayName = a.email?.split('@')[0]
          ?.replace(/\./g, ' ')
          ?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Admin';
        
        return {
          ...a,
          display_name: displayName,
          full_name: displayName,
          name: displayName,
        };
      });

      if (isMounted) setAdmins(list);
      return list;
    } catch (err) {
      console.error('Error fetching admins:', err);
      if (isMounted) setAdmins([]);
      return [];
    }
  }, [isMounted]);

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

        if (isMounted) {
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
      }
    } catch (err) {
      console.error('Error fetching dean:', err);
    }
  }, [profile?.faculty_id, departmentId, departmentInfo, isMounted]);

  // ===== FETCH PENDING LEAVE REQUESTS - INSTANT =====
  const fetchPendingLeaveRequests = useCallback(async () => {
    if (!departmentCode || !isMounted) return;

    try {
      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          id,
          lecturer_id,
          lecturer_name,
          lecturer_email,
          department_code,
          leave_type,
          start_date,
          end_date,
          days,
          reason,
          status,
          created_at,
          lecturer:lecturer_id (full_name, email)
        `)
        .eq('department_code', departmentCode)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!isMounted) return;
      setPendingLeaveRequests(data || []);
      
      const leaveNotifications = (data || []).map(request => ({
        id: `leave-${request.id}`,
        type: 'leave_pending',
        title: `📋 New Leave Request`,
        message: `${request.lecturer_name || request.lecturer?.full_name || 'A lecturer'} has requested ${request.days} days of ${request.leave_type} leave`,
        is_read: false,
        created_at: request.created_at,
        sender_email: request.lecturer_email,
        sender_name: request.lecturer_name || request.lecturer?.full_name,
        sender_role: 'lecturer',
        metadata: {
          leave_id: request.id,
          department_code: request.department_code,
          days: request.days,
          leave_type: request.leave_type
        }
      }));

      setNotifications(prev => {
        const chatNotifs = prev.filter(n => n.id?.startsWith('chat-'));
        const existingLeaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
        const existingLeaveMap = {};
        existingLeaveNotifs.forEach(n => {
          existingLeaveMap[n.id] = n.is_read;
        });
        
        const mergedLeaveNotifs = leaveNotifications.map(n => ({
          ...n,
          is_read: existingLeaveMap[n.id] !== undefined ? existingLeaveMap[n.id] : false
        }));
        
        const all = [...chatNotifs, ...mergedLeaveNotifs];
        return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });

    } catch (error) {
      console.error('Error fetching pending leave requests:', error);
    }
  }, [departmentCode, isMounted]);

  // ===== FETCH CHAT NOTIFICATIONS - INSTANT =====
  const fetchNotifications = useCallback(async () => {
    if (!hodEmail || !isMounted) return;
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', hodEmail)
        .order('created_at', { ascending: false })
        .limit(50);

      if (chatError) throw chatError;

      const chatNotifications = (chatData || []).map(msg => ({
        id: `chat-${msg.id}`,
        type: 'message',
        title: `💬 Message from ${msg.sender_name || msg.sender_role || 'Someone'}`,
        message: msg.message,
        is_read: msg.is_read || false,
        created_at: msg.created_at,
        sender_email: msg.sender_email,
        sender_name: msg.sender_name,
        sender_role: msg.sender_role,
        metadata: {
          chat_id: msg.id
        }
      }));

      if (isMounted) {
        setNotifications(prev => {
          const leaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
          const all = [...leaveNotifs, ...chatNotifications];
          return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
      }

    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [hodEmail, isMounted]);

  // ===== CALCULATE UNREAD COUNT =====
  const calculateUnreadCount = useCallback(() => {
    if (!isMounted) return;
    const unread = notifications.filter(n => n.is_read === false).length;
    setUnreadCount(unread);
  }, [notifications, isMounted]);

  useEffect(() => {
    calculateUnreadCount();
  }, [notifications, calculateUnreadCount]);

  // ===== MARK NOTIFICATION AS READ =====
  const markNotificationRead = useCallback(async (id) => {
    try {
      if (id?.startsWith('chat-')) {
        const chatId = id.replace('chat-', '');
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', chatId);
      }
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      
      if (id?.startsWith('leave-')) {
        const leaveId = id.replace('leave-', '');
        setPendingLeaveRequests(prev => 
          prev.map(r => r.id === leaveId ? { ...r, is_read: true } : r)
        );
      }
      
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  // ===== MARK ALL AS READ =====
  const markAllNotificationsRead = useCallback(async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', hodEmail)
        .eq('is_read', false);
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      setPendingLeaveRequests(prev => 
        prev.map(r => ({ ...r, is_read: true }))
      );
      
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [hodEmail]);

  // ===== SETUP SUBSCRIPTIONS - INSTANT =====
  const setupNotificationSubscriptions = useCallback(() => {
    cleanupSubscriptions();

    if (!hodEmail || !departmentCode || !isMounted) return;

    // Subscribe to chat messages
    try {
      notificationSubscriptionRef.current = supabase
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
            console.log('💬 New chat notification (INSTANT):', payload);
            if (isMounted) {
              const msg = payload.new;
              const newNotif = {
                id: `chat-${msg.id}`,
                type: 'message',
                title: `💬 Message from ${msg.sender_name || msg.sender_role || 'Someone'}`,
                message: msg.message,
                is_read: false,
                created_at: msg.created_at,
                sender_email: msg.sender_email,
                sender_name: msg.sender_name,
                sender_role: msg.sender_role,
                metadata: { chat_id: msg.id }
              };
              
              setNotifications(prev => {
                const exists = prev.some(n => n.id === newNotif.id);
                if (exists) return prev;
                const updated = [newNotif, ...prev];
                return updated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              });
              
              fetchNotifications();
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
        .channel('hod-leave-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lecturer_leave_requests',
            filter: `department_code=eq.${departmentCode}`,
          },
          (payload) => {
            console.log('📋 New leave request (INSTANT):', payload);
            if (isMounted && payload.new?.status === 'pending') {
              fetchPendingLeaveRequests();
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Error setting up leave subscription:', err);
    }
  }, [hodEmail, departmentCode, isMounted, cleanupSubscriptions, fetchNotifications, fetchPendingLeaveRequests]);

  // ===== SHOW TOAST =====
// HODDashboard.jsx - Replace showLeaveNotificationToast
const showLeaveNotificationToast = (data, type = 'info') => {
  if (!data || !isMounted) return;
  
  // Check if data is a string (message) or object (leave data)
  if (typeof data === 'string') {
    // This is a simple message - show generic toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#1976d2'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      cursor: pointer;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div>
          <span style="font-size: 14px;">${data}</span>
        </div>
        <button style="background: transparent; border: none; color: white; font-size: 18px; cursor: pointer;">✕</button>
      </div>
    `;
    
    toast.querySelector('button').onclick = () => toast.remove();
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
    return;
  }
  
  // Original leave request notification logic
  if (data && typeof data === 'object' && 'days' in data) {
    const message = `📋 ${data.lecturer_name || 'A lecturer'} has submitted a leave request (${data.days} days)`;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1976d2;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      cursor: pointer;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">📋</span>
        <div>
          <strong style="display: block;">New Leave Request</strong>
          <span style="font-size: 14px;">${message}</span>
        </div>
        <button style="background: transparent; border: none; color: white; font-size: 18px; cursor: pointer;">✕</button>
      </div>
    `;
    
    toast.onclick = (e) => {
      if (e.target.tagName !== 'BUTTON' && isMounted) {
        setActiveTab('leave');
        setShowNotifications(true);
        toast.remove();
      }
    };
    
    toast.querySelector('button').onclick = () => toast.remove();
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 8000);
  }
};
  const fetchHODData = useCallback(async () => {
    if (!departmentId || !isMounted) return;

    setLoading(true);
    try {
      const { data: dept } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (!dept) {
        setLoading(false);
        return;
      }

      if (isMounted) setDepartmentInfo(dept);
      const deptCode = dept.department_code;

      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('department_code', deptCode)
        .order('course_code');
      if (isMounted) setCourses(coursesData || []);

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
      if (isMounted) setStudents(enrichedStudents);

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
      if (isMounted) setLecturers(lectList);

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

        if (isMounted) setRecentAttendance(attendance || []);
        if (attendance?.length > 0) {
          const present = attendance.filter((a) => a.status === 'present').length;
          setStats((prev) => ({
            ...prev,
            attendanceRate: Math.round((present / attendance.length) * 100),
          }));
        }
      }

      await fetchPendingCounts(deptCode);
      await fetchPendingLeaveRequests();

      if (isMounted) {
        setStats((prev) => ({
          ...prev,
          totalCourses: coursesData?.length || 0,
          totalStudents: studentsData?.length || 0,
          totalLecturers: lectList.length,
        }));

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
      }
    } catch (err) {
      console.error('Error fetching HOD data:', err);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [departmentId, hodEmail, profile, isMounted, fetchPendingLeaveRequests]);

  const fetchPendingCounts = async (deptCode) => {
    try {
      const { count: leaveCount } = await supabase
        .from('lecturer_leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending')
        .catch(() => ({ count: 0 }));

      const { count: complaintCount } = await supabase
        .from('student_complaints')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending')
        .catch(() => ({ count: 0 }));

      const { count: allocationCount } = await supabase
        .from('course_allocations')
        .select('id', { count: 'exact', head: true })
        .eq('department_code', deptCode)
        .eq('status', 'pending')
        .catch(() => ({ count: 0 }));

      if (isMounted) {
        setStats((prev) => ({
          ...prev,
          pendingLeaveRequests: leaveCount || 0,
          pendingComplaints: complaintCount || 0,
          pendingAllocations: allocationCount || 0,
        }));
      }
    } catch (err) {
      console.error('Error fetching pending counts:', err);
    }
  };

  // ==================== CHAT ====================
  const fetchChatMessages = useCallback(async (userEmail) => {
    if (!hodEmail || !userEmail || !isMounted) return;
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
      if (isMounted) setChatMessages(data || []);

      const unread = (data || []).filter(
        (m) => m.receiver_email === hodEmail && !m.is_read
      );
      for (const msg of unread) {
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
      }
      if (isMounted) {
        fetchNotifications();
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
  }, [hodEmail, isMounted, fetchNotifications]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !isMounted) return;

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

      if (isMounted) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data : m))
        );
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
  };

  const openChatWithUser = (user, type) => {
    if (!user?.email || !isMounted) return;
    setSelectedUser({
      email: user.email,
      role: type,
      name: user.display_name || user.full_name || user.name || user.email,
      display_name: user.display_name || user.full_name || user.name || user.email,
      id: user.id,
      department_id: user.department_id || null,
      faculty_id: user.faculty_id || null,
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
    if (list.length > 0 && isMounted) {
      openChatWithUser(list[0], 'admin');
    } else if (isMounted) {
      alert('No system administrators available.');
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    setIsMounted(true);
    
    fetchHODData();
    fetchAdmins();
    fetchNotifications();
    setupNotificationSubscriptions();

    // REFRESH EVERY 5 SECONDS - INSTANT UPDATES
    intervalRef.current = setInterval(() => {
      if (isMounted) {
        fetchPendingLeaveRequests();
        fetchNotifications();
      }
    }, 5000);

    return () => {
      setIsMounted(false);
      cleanupSubscriptions();
    };
  }, []);

  useEffect(() => {
    if (departmentInfo && isMounted) {
      fetchDeanInfo();
    }
  }, [departmentInfo, fetchDeanInfo, isMounted]);

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
      case 'overview': return <HODOverview {...commonProps} />;
      case 'students': return <HODStudents {...commonProps} />;
      case 'allocations': return <HODCourseAllocations {...commonProps} />;
      case 'workload': return <HODWorkload {...commonProps} />;
      case 'leave': return <HODLeaveRequests {...commonProps} />;
      case 'complaints': return <HODComplaints {...commonProps} />;
      case 'timetable': return <HODTimetable {...commonProps} />;
      case 'exam-moderation': return <HODExamModeration {...commonProps} />;
      case 'exam-results': return <HODExamResultsApproval 
        departmentCode={departmentCode} 
        courses={courses} 
        fetchHODData={fetchHODData} 
        setStats={setStats} 
      />;
      case 'appraisal': return <HODStaffAppraisal {...commonProps} />;
      case 'curriculum': return <HODCurriculumManagement 
        departmentCode={departmentCode}
        departmentName={departmentName}
        hodEmail={hodEmail}
        hodName={hodName}
        profile={profile}
        showToast={showLeaveNotificationToast}
      />;
      case 'qa': return <HODQualityAssurance 
        departmentCode={departmentCode}
        departmentName={departmentName}
        hodEmail={hodEmail}
        hodName={hodName}
        profile={profile}
        showToast={showLeaveNotificationToast}
      />;
      case 'disciplinary': return <HODDisciplinaryCases 
        departmentCode={departmentCode}
        departmentName={departmentName}
        hodEmail={hodEmail}
        hodName={hodName}
        profile={profile}
        showToast={showLeaveNotificationToast}
      />;
      case 'budget': return <HODBudgetRequests {...commonProps} />;
      case 'attendance': return <HODAttendance {...commonProps} />;
      case 'reports': return <ReportViewer 
        departmentCode={departmentCode}
        showToast={showLeaveNotificationToast} 
      />;
      case 'module-evaluation': return <HODModuleEvaluation 
        departmentCode={departmentCode}
        departmentName={departmentName}
        hodEmail={hodEmail}
        hodName={hodName}
        profile={profile}
        courses={courses}
        students={students}
        showToast={showLeaveNotificationToast}
      />;
      case 'settings': return <HODSettings {...commonProps} />;
      default: return <HODOverview {...commonProps} />;
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'students', label: '👥 Students' },
    { id: 'allocations', label: '📚 Course Allocations' },
    { id: 'workload', label: '⚖️ Workload' },
    { id: 'leave', label: '📝 Leave Requests' },
    { id: 'complaints', label: '💬 Complaints' },
    { id: 'timetable', label: '📅 Timetable' },
    { id: 'exam-moderation', label: '📝 Exam Moderation' },
    { id: 'exam-results', label: '📝 Exam Results Approval' },
    { id: 'appraisal', label: '⭐ Staff Appraisal' },
    { id: 'curriculum', label: '📋 Curriculum' },
    { id: 'qa', label: '📋 Quality Assurance' },
    { id: 'disciplinary', label: '⚖️ Disciplinary' },
    { id: 'budget', label: '💰 Budget' },
    { id: 'attendance', label: '✅ Attendance' },
    { id: 'reports', label: '📄 Reports' },
    { id: 'module-evaluation', label: '📋 Module Evaluation' },
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

          {/* ===== NOTIFICATIONS - INSTANT ===== */}
          <div className="hod-notification-wrapper">
            <button
              className="hod-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {unreadCount > 0 && (
                <span className="hod-notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <HODNotifications
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onClearAll={clearAllNotifications}
                onNotificationClick={(notif) => {
                  setShowNotifications(false);
                  markNotificationRead(notif.id);

                  if (notif.id?.startsWith('leave-') || notif.type === 'leave_pending') {
                    setActiveTab('leave');
                    return;
                  }

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
          hodEmail={hodEmail}
          hodName={hodName}
          profile={profile}
        />
      )}
    </div>
  );
};

export default HODDashboard;