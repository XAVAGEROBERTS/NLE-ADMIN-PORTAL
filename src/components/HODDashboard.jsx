// HODDashboard.jsx - Full Featured (same level as DeanDashboard)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import './HODDashboard.css';

const HODDashboard = () => {
  const { profile, signOut } = useAdminAuth();
  const navigate = useNavigate();

  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalLecturers: 0,
    attendanceRate: 0,
  });
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [deanInfo, setDeanInfo] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileVersion, setProfileVersion] = useState(0);

  // Settings
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [updatingContact, setUpdatingContact] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Attendance
  const [todayLectures, setTodayLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [loadingLectures, setLoadingLectures] = useState(false);

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

  // Derived
  const departmentId = profile?.department_id || profile?.id || profile?.table_id;
  const departmentName = departmentInfo?.department_name || profile?.department_name || 'Department';
  const departmentCode = departmentInfo?.department_code || profile?.department_code || '';
  const hodEmail = profile?.email || '';
  const hodName = profile?.full_name || departmentInfo?.head_of_department || 'HOD';

  // ==================== FETCH ADMINS ====================
  const fetchAdmins = useCallback(async () => {
    try {
      const { data: adminRoles, error } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url')
        .eq('role', 'admin')
        .limit(10);

      if (error) throw error;

      const list = (adminRoles || []).map((a) => ({
        ...a,
        display_name: a.email?.split('@')[0]?.replace(/\./g, ' ')?.replace(/\b\w/g, (l) => l.toUpperCase()) || 'Admin',
        full_name: a.email?.split('@')[0] || 'Admin',
      }));

      setAdmins(list);
      return list;
    } catch (err) {
      console.error('Error fetching admins:', err);
      setAdmins([]);
      return [];
    }
  }, []);

  // ==================== FETCH DEAN ====================
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
      const { data: deanRoles } = await supabase
        .from('user_roles')
        .select(`
          id, email, role, faculty_id, profile_picture_url,
          faculties:faculty_id (faculty_code, faculty_name, dean)
        `)
        .eq('role', 'dean')
        .eq('faculty_id', facultyId)
        .limit(1);

      if (deanRoles?.length > 0) {
        const d = deanRoles[0];
        setDeanInfo({
          id: d.id,
          email: d.email,
          faculty_name: d.faculties?.faculty_name || 'Faculty',
          faculty_code: d.faculties?.faculty_code || '',
          display_name: d.faculties?.dean || d.email,
          profile_picture_url: d.profile_picture_url,
        });
      }
    } catch (err) {
      console.error('Error fetching dean:', err);
    }
  }, [profile?.faculty_id, departmentId, departmentInfo]);

  // ==================== MAIN DATA ====================
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
      setContactEmail(dept.contact_email || '');
      setContactPhone(dept.contact_phone || '');

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
      setStudents(studentsData || []);

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
        lectList = lects || [];
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
  }, [departmentId, hodEmail]);

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
          // Optional toast
          // alert(`📩 New message from ${payload.new.sender_name || payload.new.sender_email}`);
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
// ==================== CHAT (FULLY REAL-TIME) ====================
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

    // Mark as read
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

  // Optimistic UI
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

    // Replace temp message with real one
    setChatMessages((prev) =>
      prev.map((m) => (m.id === tempId ? data : m))
    );
  } catch (err) {
    console.error('Send error:', err);
    // Remove optimistic message on failure
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

// ==================== REAL-TIME FOR OPEN CHAT ====================
useEffect(() => {
  if (!showChat || !selectedUser?.email || !hodEmail) return;

  console.log('[HOD CHAT] Setting up realtime:', hodEmail, '↔', selectedUser.email);

  const channel = supabase
    .channel(`hod-chat-${hodEmail}-${selectedUser.email}`)
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
          (msg.sender_email === hodEmail && msg.receiver_email === selectedUser.email) ||
          (msg.sender_email === selectedUser.email && msg.receiver_email === hodEmail);

        if (!isThisChat) return;

        if (payload.eventType === 'INSERT') {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;

            // Remove any temporary optimistic message
            const cleaned = prev.filter(
              (m) => !(typeof m.id === 'string' && m.id.startsWith('temp-') && m.message === msg.message)
            );
            return [...cleaned, msg];
          });

          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          fetchNotifications();
        }
      }
    )
    .subscribe((status) => {
      console.log('[HOD CHAT] Realtime status:', status);
    });

  // Fallback polling every 6 seconds while chat is open
  const pollInterval = setInterval(() => {
    fetchChatMessages(selectedUser.email);
  }, 6000);

  return () => {
    supabase.removeChannel(channel);
    clearInterval(pollInterval);
  };
}, [showChat, selectedUser?.email, hodEmail, fetchChatMessages]);

  // ==================== PROFILE PICTURE ====================
  const handleProfilePictureUpdate = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin profiles')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        alert('Upload failed: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('admin profiles')
        .getPublicUrl(filePath);

      await supabase
        .from('user_roles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', profile.id);

      profile.profile_picture_url = publicUrl;
      setProfileVersion(Date.now());
      alert('✅ Profile picture updated!');
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  // ==================== CONTACT UPDATE ====================
  const handleContactUpdate = async () => {
    if (!contactEmail.trim()) {
      alert('Please enter a contact email');
      return;
    }
    setUpdatingContact(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
        })
        .eq('id', departmentId);

      if (error) throw error;
      alert('✅ Contact information updated!');
      await fetchHODData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setUpdatingContact(false);
    }
  };

  // ==================== PASSWORD CHANGE ====================
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill all fields');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { data: userData } = await supabase
        .from('user_roles')
        .select('id, password_hash')
        .eq('email', hodEmail)
        .maybeSingle();

      if (!userData || userData.password_hash !== passwordData.currentPassword) {
        alert('Current password is incorrect');
        setChangingPassword(false);
        return;
      }

      await supabase
        .from('user_roles')
        .update({ password_hash: passwordData.newPassword })
        .eq('id', userData.id);

      alert('✅ Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // ==================== TODAY'S LECTURES ====================
  const fetchTodayLectures = useCallback(async () => {
    if (!departmentCode) return;
    setLoadingLectures(true);
    const dayOfWeek = new Date().getDay();
    try {
      const { data: timetables } = await supabase
        .from('program_timetables')
        .select('id')
        .eq('is_active', true);

      const timetableIds = timetables?.map((t) => t.id) || [];
      if (timetableIds.length === 0) {
        setTodayLectures([]);
        setLoadingLectures(false);
        return;
      }

      const { data: slots } = await supabase
        .from('program_timetable_slots')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .in('program_timetable_id', timetableIds);

      // Filter by department courses
      const deptCourseCodes = courses.map((c) => c.course_code);
      const filtered = (slots || []).filter((s) => deptCourseCodes.includes(s.course_code));

      const lecturerIds = [...new Set(filtered.map((s) => s.lecturer_id).filter(Boolean))];
      let lecturerMap = {};
      if (lecturerIds.length > 0) {
        const { data: lects } = await supabase.from('lecturers').select('id, full_name').in('id', lecturerIds);
        lects?.forEach((l) => (lecturerMap[l.id] = l));
      }

      setTodayLectures(
        filtered.map((slot) => ({
          ...slot,
          lecturer_name: lecturerMap[slot.lecturer_id]?.full_name || 'Not Assigned',
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLectures(false);
    }
  }, [departmentCode, courses]);

  // ==================== ATTENDANCE ====================
  const fetchEnrolledStudents = async (slot) => {
    if (!slot?.course_id) return;
    try {
      const { data: studentCourses } = await supabase
        .from('student_courses')
        .select('student_id')
        .eq('course_id', slot.course_id)
        .eq('status', 'enrolled');

      const studentIds = studentCourses?.map((sc) => sc.student_id) || [];
      if (studentIds.length === 0) {
        setEnrolledStudents([]);
        return;
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name, student_id')
        .in('id', studentIds)
        .order('full_name');

      setEnrolledStudents(studentsData || []);
      const initial = {};
      studentsData?.forEach((s) => (initial[s.id] = 'present'));
      setAttendanceStatus(initial);

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('course_id', slot.course_id)
        .eq('date', today)
        .in('student_id', studentIds);

      if (existing) {
        existing.forEach((r) => (initial[r.student_id] = r.status));
        setAttendanceStatus({ ...initial });
      }

      setShowAttendanceModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedLecture?.course_id) return;
    setSavingAttendance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 8);
      let created = 0;
      let updated = 0;

      for (const student of enrolledStudents) {
        const status = attendanceStatus[student.id] || 'present';
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('student_id', student.id)
          .eq('course_id', selectedLecture.course_id)
          .eq('date', today)
          .maybeSingle();

        const record = {
          student_id: student.id,
          course_id: selectedLecture.course_id,
          date: today,
          status,
          check_in_time: now,
          day_of_week: new Date().getDay(),
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from('attendance_records').update(record).eq('id', existing.id);
          updated++;
        } else {
          record.created_at = new Date().toISOString();
          await supabase.from('attendance_records').insert([record]);
          created++;
        }
      }

      alert(`✅ Attendance saved!\n${created} new • ${updated} updated`);
      setShowAttendanceModal(false);
      setSelectedLecture(null);
      await fetchHODData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSavingAttendance(false);
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
      fetchTodayLectures();
    }
  }, [departmentInfo, fetchDeanInfo, fetchTodayLectures]);

  // ==================== FILTERS ====================
  const filteredStudents = students.filter((s) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return s.full_name?.toLowerCase().includes(t) || s.student_id?.toLowerCase().includes(t);
  });

  const filteredCourses = courses.filter((c) => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return c.course_code?.toLowerCase().includes(t) || c.course_name?.toLowerCase().includes(t);
  });

  // ==================== SETTINGS RENDER ====================
  const renderSettings = () => (
    <div className="hod-settings-panel">
      <div className="hod-settings-header">
        <h2>⚙️ Settings</h2>
      </div>

      <div className="hod-settings-body">
        {/* Profile Picture */}
        <div className="hod-setting-group">
          <h3>Profile Picture</h3>
          <div className="hod-profile-picture-section">
            <div className="hod-profile-picture-container">
              {profile?.profile_picture_url ? (
                <img
                  src={`${profile.profile_picture_url}?t=${profileVersion}`}
                  alt={hodName}
                  className="hod-profile-picture"
                />
              ) : (
                <div className="hod-profile-picture-placeholder">
                  {hodName?.[0]?.toUpperCase() || 'H'}
                </div>
              )}
            </div>
            <button
              className="hod-upload-btn"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (file) await handleProfilePictureUpdate(file);
                };
                input.click();
              }}
            >
              📸 Upload New Picture
            </button>
          </div>
        </div>

        {/* Department Contact */}
        <div className="hod-setting-group">
          <h3>🏢 Department Contact Information</h3>
          <p className="hod-settings-hint">This information is shown publicly for the department</p>
          <div className="hod-form-group">
            <label>Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="hod-settings-input"
              placeholder="department@university.edu"
            />
          </div>
          <div className="hod-form-group">
            <label>Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="hod-settings-input"
              placeholder="+254 7XX XXX XXX"
            />
          </div>
          <button
            className="hod-save-btn"
            onClick={handleContactUpdate}
            disabled={updatingContact}
          >
            {updatingContact ? 'Saving...' : 'Save Contact Info'}
          </button>
        </div>

        {/* Password */}
        <div className="hod-setting-group">
          <h3>🔒 Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="hod-form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="hod-settings-input"
                required
              />
            </div>
            <div className="hod-form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="hod-settings-input"
                required
                minLength={6}
              />
            </div>
            <div className="hod-form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="hod-settings-input"
                required
              />
            </div>
            <button type="submit" className="hod-save-btn" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : '🔒 Update Password'}
            </button>
          </form>
        </div>

        {/* Account Info */}
        <div className="hod-setting-group">
          <h3>Account Information</h3>
          <div className="hod-account-info">
            <div className="hod-info-item">
              <label>Name</label>
              <p>{hodName}</p>
            </div>
            <div className="hod-info-item">
              <label>Email</label>
              <p>{hodEmail}</p>
            </div>
            <div className="hod-info-item">
              <label>Role</label>
              <p><span className="hod-role-badge">HOD</span></p>
            </div>
            <div className="hod-info-item">
              <label>Department</label>
              <p>{departmentName} ({departmentCode})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className="hod-dashboard">
      {/* HEADER */}
      <header className="hod-header">
        <div className="hod-header-left">
          <h1>🏢 HOD Dashboard</h1>
          <p>{departmentName} ({departmentCode})</p>
        </div>

        <div className="hod-header-right">
          {/* Admin Chat Button */}
          <button className="hod-admin-chat-btn" onClick={openAdminChat} title="Chat with Admin">
            👤
            <span className="hod-admin-badge">A</span>
          </button>

          {/* Notification Bell */}
          <div className="hod-notification-wrapper">
            <button
              className="hod-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {unreadCount > 0 && <span className="hod-notification-badge">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="hod-notification-dropdown">
                <div className="hod-notification-header">
                  <h4>Notifications ({unreadCount} unread)</h4>
                  {unreadCount > 0 && (
                    <button className="hod-mark-all-read" onClick={markAllNotificationsRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="hod-notification-list">
                  {notifications.length === 0 ? (
                    <div className="hod-notification-empty">No notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`hod-notification-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          setShowNotifications(false);
                          openChatWithUser(
                            { email: notif.sender_email, name: notif.sender_name },
                            notif.sender_role
                          );
                        }}
                      >
                        <div className="hod-notification-content">
                          <strong>{notif.sender_name || notif.sender_email}</strong>
                          <p>{notif.message}</p>
                          <small>{new Date(notif.created_at).toLocaleString()}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
        <button className={`hod-nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 Overview
        </button>
        <button className={`hod-nav-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => { setActiveTab('attendance'); fetchTodayLectures(); }}>
          📅 Record Attendance
        </button>
        <button className={`hod-nav-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>
          📚 Courses ({courses.length})
        </button>
        <button className={`hod-nav-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
          👨‍🎓 Students ({students.length})
        </button>
        <button className={`hod-nav-btn ${activeTab === 'lecturers' ? 'active' : ''}`} onClick={() => setActiveTab('lecturers')}>
          👨‍🏫 Lecturers ({lecturers.length})
        </button>
        <button className={`hod-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📊 Attendance History
        </button>
        <button className={`hod-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </button>
      </nav>

      {/* CONTENT */}
      <main className="hod-content">
        {activeTab === 'settings' ? (
          renderSettings()
        ) : (
          <>
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Department Overview – {departmentName}</h2>

                <div className="hod-stats-grid">
                  <div className="hod-stat-card hod-stat-green">
                    <h3>{stats.totalCourses}</h3>
                    <p>Courses</p>
                  </div>
                  <div className="hod-stat-card hod-stat-orange">
                    <h3>{stats.totalStudents}</h3>
                    <p>Students</p>
                  </div>
                  <div className="hod-stat-card hod-stat-purple">
                    <h3>{stats.totalLecturers}</h3>
                    <p>Lecturers</p>
                  </div>
                  <div className="hod-stat-card hod-stat-blue">
                    <h3>{stats.attendanceRate}%</h3>
                    <p>Attendance Rate</p>
                  </div>
                  <div className="hod-stat-card hod-stat-teal" style={{ cursor: 'pointer' }} onClick={openAdminChat}>
                    <h3>👤</h3>
                    <p>Chat with Admin</p>
                  </div>
                </div>

                {/* Dean Card */}
                {deanInfo && (
                  <div className="hod-dean-card">
                    <div className="hod-dean-card-header">
                      <span className="hod-dean-icon">👔</span>
                      <div>
                        <h3>Your Dean</h3>
                        <p>{deanInfo.display_name} – {deanInfo.faculty_name}</p>
                      </div>
                    </div>
                    <p className="hod-dean-email">📧 {deanInfo.email}</p>
                    <button className="hod-dean-chat-btn" onClick={() => openChatWithUser(deanInfo, 'dean')}>
                      💬 Message Dean
                    </button>
                  </div>
                )}

                {/* Admins */}
                {admins.length > 0 && (
                  <div className="hod-card" style={{ marginTop: 20 }}>
                    <h3 className="hod-card-title">👤 System Administrators</h3>
                    <table className="hod-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map((admin) => (
                          <tr key={admin.id}>
                            <td><strong>{admin.display_name}</strong></td>
                            <td>{admin.email}</td>
                            <td>
                              <button className="hod-chat-btn" onClick={() => openChatWithUser(admin, 'admin')}>
                                💬 Message Admin
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ATTENDANCE */}
            {activeTab === 'attendance' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Record Attendance</h2>
                {loadingLectures ? (
                  <div className="hod-loading">Loading lectures...</div>
                ) : todayLectures.length === 0 ? (
                  <div className="hod-empty">
                    <span>📭</span>
                    <h3>No Lectures Today</h3>
                  </div>
                ) : (
                  <div className="hod-lectures-grid">
                    {todayLectures.map((slot) => (
                      <div key={slot.id} className="hod-lecture-card">
                        <h3>{slot.course_code}</h3>
                        <p>{slot.course_name}</p>
                        <p>👨‍🏫 {slot.lecturer_name}</p>
                        <p>🕐 {slot.start_time} – {slot.end_time}</p>
                        <button
                          className="hod-record-btn"
                          onClick={() => {
                            setSelectedLecture(slot);
                            fetchEnrolledStudents(slot);
                          }}
                        >
                          📝 Record
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* COURSES */}
            {activeTab === 'courses' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Courses ({filteredCourses.length})</h2>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="hod-search-input"
                />
                <div className="hod-card">
                  <table className="hod-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Dept</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.course_code}</strong></td>
                          <td>{c.course_name}</td>
                          <td><span className="hod-badge">{c.department_code}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STUDENTS */}
            {activeTab === 'students' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Students ({filteredStudents.length})</h2>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="hod-search-input"
                />
                <div className="hod-card">
                  <table className="hod-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.id}>
                          <td><strong>{s.student_id}</strong></td>
                          <td>{s.full_name}</td>
                          <td>{s.year_of_study || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LECTURERS */}
            {activeTab === 'lecturers' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Lecturers ({lecturers.length})</h2>
                <div className="hod-card">
                  <table className="hod-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lecturers.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.full_name}</strong></td>
                          <td>{l.email}</td>
                          <td>
                            <button className="hod-chat-btn" onClick={() => openChatWithUser(l, 'lecturer')}>
                              💬 Message
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* HISTORY */}
            {activeTab === 'history' && (
              <div className="hod-section">
                <h2 className="hod-section-title">Attendance History</h2>
                <div className="hod-card">
                  <table className="hod-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Student</th>
                        <th>Course</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttendance.map((r) => (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>{r.students?.full_name}</td>
                          <td>{r.courses?.course_code}</td>
                          <td>
                            <span className={`hod-status ${r.status}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ATTENDANCE MODAL */}
      {showAttendanceModal && selectedLecture && (
        <div className="hod-modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📝 Record Attendance – {selectedLecture.course_code}</h3>
              <button onClick={() => setShowAttendanceModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div style={{ marginBottom: 15 }}>
                <button
                  className="hod-btn-all-present"
                  onClick={() => {
                    const s = {};
                    enrolledStudents.forEach((x) => (s[x.id] = 'present'));
                    setAttendanceStatus(s);
                  }}
                >
                  ✅ All Present
                </button>
                <button
                  className="hod-btn-all-absent"
                  onClick={() => {
                    const s = {};
                    enrolledStudents.forEach((x) => (s[x.id] = 'absent'));
                    setAttendanceStatus(s);
                  }}
                  style={{ marginLeft: 10 }}
                >
                  ❌ All Absent
                </button>
              </div>
              <table className="hod-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((s) => (
                    <tr key={s.id}>
                      <td>{s.student_id}</td>
                      <td>{s.full_name}</td>
                      <td>
                        <select
                          value={attendanceStatus[s.id] || 'present'}
                          onChange={(e) =>
                            setAttendanceStatus({ ...attendanceStatus, [s.id]: e.target.value })
                          }
                        >
                          <option value="present">✅ Present</option>
                          <option value="absent">❌ Absent</option>
                          <option value="late">🕒 Late</option>
                          <option value="excused">📝 Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowAttendanceModal(false)}>Cancel</button>
              <button className="hod-save-btn" onClick={handleSaveAttendance} disabled={savingAttendance}>
                {savingAttendance ? 'Saving...' : '💾 Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {showChat && selectedUser && (
        <div className="hod-chat-overlay" onClick={() => setShowChat(false)}>
          <div className="hod-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-chat-header">
              <div>
                <h3>💬 Chat with {selectedUserType?.toUpperCase()}</h3>
                <p>{selectedUser.display_name || selectedUser.email}</p>
              </div>
              <button className="hod-chat-close" onClick={() => setShowChat(false)}>✕</button>
            </div>

            <div className="hod-chat-body">
              {chatMessages.length === 0 ? (
                <div className="hod-chat-empty">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`hod-chat-message ${msg.sender_role === 'hod' ? 'sent' : 'received'}`}
                  >
                    <div className="hod-chat-meta">
                      <strong>{msg.sender_name || msg.sender_email}</strong>
                      <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                    </div>
                    <p>{msg.message}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="hod-chat-footer">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage) sendMessage();
                }}
                placeholder="Type your message..."
                className="hod-chat-input"
              />
              <button
                className="hod-chat-send"
                onClick={sendMessage}
                disabled={sendingMessage || !newMessage.trim()}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODDashboard;