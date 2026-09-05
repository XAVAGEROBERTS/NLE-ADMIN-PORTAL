// HODDashboard.jsx - COMPLETE WITH EXAM RESULTS TAB
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

  // ===== NOTIFICATIONS - FIXED COUNTER =====
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
    // Mark all chat messages as read
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('receiver_email', hodEmail)
      .eq('is_read', false);

    // Clear local state
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

  // ===== FETCH PENDING LEAVE REQUESTS =====
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
      
      // Create notification objects from pending leave requests (marked as unread)
      const leaveNotifications = (data || []).map(request => ({
        id: `leave-${request.id}`,
        type: 'leave_pending',
        title: `📋 New Leave Request`,
        message: `${request.lecturer_name || request.lecturer?.full_name || 'A lecturer'} has requested ${request.days} days of ${request.leave_type} leave`,
        is_read: false, // Always false for new leave requests
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

      // Get existing read state for leave notifications from localStorage or state
      setNotifications(prev => {
        // Keep chat notifications and update leave notifications
        const chatNotifs = prev.filter(n => n.id?.startsWith('chat-'));
        
        // For leave notifications, preserve read state if they already exist
        const existingLeaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
        const existingLeaveMap = {};
        existingLeaveNotifs.forEach(n => {
          existingLeaveMap[n.id] = n.is_read;
        });
        
        // Merge: use existing read state if available, otherwise false
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

      // Courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('department_code', deptCode)
        .order('course_code');
      if (isMounted) setCourses(coursesData || []);

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
      if (isMounted) setStudents(enrichedStudents);

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
      if (isMounted) setLecturers(lectList);

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

  // ==================== NOTIFICATIONS ====================
  const fetchNotifications = useCallback(async () => {
    if (!hodEmail || !isMounted) return;
    try {
      // Fetch chat messages
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
          // Keep leave notifications, update chat notifications
          const leaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
          const all = [...leaveNotifs, ...chatNotifications];
          return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
      }

    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [hodEmail, isMounted]);

  // ===== CALCULATE UNREAD COUNT - FIXED =====
  const calculateUnreadCount = useCallback(() => {
    if (!isMounted) return;
    
    // Only count notifications that are explicitly marked as unread
    const unread = notifications.filter(n => n.is_read === false).length;
    setUnreadCount(unread);
    console.log('📊 Unread count calculated:', unread);
  }, [notifications, isMounted]);

  // Update unread count whenever notifications change
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
      
      // Update local state - mark as read
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      
      // Also update leave requests in pendingLeaveRequests if applicable
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

  const markAllNotificationsRead = useCallback(async () => {
    try {
      // Mark chat messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_email', hodEmail)
        .eq('is_read', false);
      
      // Mark all notifications as read in state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      // Update pending leave requests
      setPendingLeaveRequests(prev => 
        prev.map(r => ({ ...r, is_read: true }))
      );
      
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [hodEmail]);

  // ===== SETUP SUBSCRIPTIONS =====
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
          () => {
            if (isMounted) {
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
            if (isMounted && payload.new?.status === 'pending') {
              // Add new notification as unread
              const newNotification = {
                id: `leave-${payload.new.id}`,
                type: 'leave_pending',
                title: `📋 New Leave Request`,
                message: `${payload.new.lecturer_name || 'A lecturer'} has requested ${payload.new.days} days of ${payload.new.leave_type} leave`,
                is_read: false,
                created_at: payload.new.created_at,
                sender_email: payload.new.lecturer_email,
                sender_name: payload.new.lecturer_name,
                sender_role: 'lecturer',
                metadata: {
                  leave_id: payload.new.id,
                  department_code: payload.new.department_code,
                  days: payload.new.days,
                  leave_type: payload.new.leave_type
                }
              };
              
              setNotifications(prev => {
                // Check if already exists
                const exists = prev.some(n => n.id === newNotification.id);
                if (exists) return prev;
                
                const updated = [newNotification, ...prev];
                return updated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              });
              
              showLeaveNotificationToast(payload.new);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Error setting up leave subscription:', err);
    }
  }, [hodEmail, departmentCode, isMounted, cleanupSubscriptions, fetchNotifications]);

  // ===== TOAST =====
const showToast = (message, type = 'success') => {
  // You can implement a toast notification here
  // For now, just use alert or console.log
  if (type === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
};
  // ===== SHOW TOAST =====
  const showLeaveNotificationToast = (leaveData) => {
    if (!leaveData || !isMounted) return;
    
    const message = `📋 ${leaveData.lecturer_name || 'A lecturer'} has submitted a leave request (${leaveData.days} days)`;
    
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
        // Also update chat notifications to read
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

    // Refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      if (isMounted) {
        fetchPendingLeaveRequests();
        fetchNotifications();
      }
    }, 30000);

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
      showToast={showToast || (() => {})}
    />;
        case 'qa': 
      return <HODQualityAssurance 
        departmentCode={departmentCode}
        departmentName={departmentName}
        hodEmail={hodEmail}
        hodName={hodName}
        profile={profile}
        showToast={showToast}
      />;
    case 'disciplinary': 
  return <HODDisciplinaryCases 
    departmentCode={departmentCode}
    departmentName={departmentName}
    hodEmail={hodEmail}
    hodName={hodName}
    profile={profile}
    showToast={showToast}
  />;
    case 'budget': return <HODBudgetRequests {...commonProps} />;
    case 'attendance': return <HODAttendance {...commonProps} />;
    case 'reports': 
  return <ReportViewer 
    departmentCode={departmentCode}
    showToast={showToast} 
      />;
    case 'module-evaluation': 
  return <HODModuleEvaluation 
    departmentCode={departmentCode}
    departmentName={departmentName}
    hodEmail={hodEmail}
    hodName={hodName}
    profile={profile}
    courses={courses}
    students={students}
    showToast={showToast}
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

          {/* ===== NOTIFICATIONS - FIXED COUNTER ===== */}
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

      {/* CSS for notifications */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .hod-notification-wrapper {
          position: relative;
          display: inline-block;
        }
        .hod-notification-btn {
          background: transparent;
          border: none;
          font-size: 22px;
          cursor: pointer;
          position: relative;
          padding: 8px;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .hod-notification-btn:hover {
          background: rgba(0,0,0,0.05);
        }
        .hod-notification-badge {
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
        .hod-notification-dropdown {
          position: absolute;
          top: 45px;
          right: 0;
          width: 380px;
          max-height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          z-index: 1000;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .hod-notification-header {
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
        }
        .hod-notification-header h4 {
          margin: 0;
          font-size: 14px;
          color: #1a237e;
        }
        .hod-notification-mark-all {
          background: transparent;
          border: none;
          color: #1976d2;
          font-size: 12px;
          cursor: pointer;
          font-weight: 600;
        }
        .hod-notification-list {
          overflow-y: auto;
          max-height: 400px;
          padding: 4px 0;
        }
        .hod-notification-item {
          padding: 10px 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          cursor: pointer;
          border-bottom: 1px solid #f5f5f5;
          transition: background 0.2s;
        }
        .hod-notification-item:hover {
          background: #f5f7fa;
        }
        .hod-notification-item.unread {
          background: #e3f2fd;
        }
        .hod-notification-empty {
          text-align: center;
          padding: 30px;
          color: #999;
        }
        .hod-notification-empty span {
          font-size: 36px;
          display: block;
          margin-bottom: 8px;
        }
        .hod-notification-empty p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default HODDashboard;