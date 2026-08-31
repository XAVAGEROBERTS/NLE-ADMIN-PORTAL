// DeanDashboard.jsx - Complete Professional Dashboard with Admin Chat
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { supabase } from '../services/supabase';
import './DeanDashboard.css';

const DeanDashboard = () => {
  const { profile, signOut } = useAdminAuth();
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDepartments: 0,
    totalCourses: 0,
    totalStudents: 0,
    totalLecturers: 0,
    totalHODs: 0,
  });
  const [departments, setDepartments] = useState([]);
  const [hods, setHODs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileVersion, setProfileVersion] = useState(0);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [updatingContact, setUpdatingContact] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserType, setSelectedUserType] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationSubscriptionRef = useRef(null);

  const facultyId = profile?.faculty_id || profile?.id || profile?.table_id;
  const facultyName = profile?.faculty_name || 'Faculty';
  const deanEmail = profile?.email || '';
  const deanName = profile?.full_name || 'Dean';

  // ==================== FETCH ADMINS ====================
  const fetchAdmins = useCallback(async () => {
    try {
      setLoadingAdmins(true);
      console.log('🔍 Fetching admins...');
      
      // Fetch admins from user_roles
      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url, table_id')
        .eq('role', 'admin')
        .limit(10);

      if (adminError) {
        console.error('❌ Error fetching admins:', adminError);
        setAdmins([]);
        return [];
      }

      console.log('📊 Admin roles found:', adminRoles);

      if (!adminRoles || adminRoles.length === 0) {
        console.log('⚠️ No admins found in user_roles');
        setAdmins([]);
        
        // Check if there are any users with admin-like roles
        const { data: allUsers, error: allError } = await supabase
          .from('user_roles')
          .select('id, email, role')
          .in('role', ['admin', 'system_admin', 'super_admin']);
        
        if (!allError && allUsers && allUsers.length > 0) {
          console.log('📊 Found admin-like users:', allUsers);
          const adminsWithNames = allUsers.map(admin => ({
            ...admin,
            display_name: admin.email?.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Admin',
            head_name: admin.email?.split('@')[0] || 'System Admin',
            full_name: admin.email?.split('@')[0] || 'Admin'
          }));
          setAdmins(adminsWithNames);
          return adminsWithNames;
        }
        
        return [];
      }

      // Get admin names from various sources
      const adminsWithNames = await Promise.all(
        adminRoles.map(async (admin) => {
          let displayName = admin.email?.split('@')[0] || 'Admin';
          
          // Try to get name from faculties table if admin is a dean
          if (admin.table_id) {
            try {
              const { data: facultyData } = await supabase
                .from('faculties')
                .select('dean, faculty_name')
                .eq('id', admin.table_id)
                .maybeSingle();
              
              if (facultyData?.dean) {
                displayName = facultyData.dean;
              } else if (facultyData?.faculty_name) {
                displayName = `Dean of ${facultyData.faculty_name}`;
              }
            } catch (err) {
              // Fallback to email
            }
          }
          
          return {
            ...admin,
            display_name: displayName,
            head_name: displayName,
            full_name: displayName
          };
        })
      );
      
      console.log('✅ Admins with names:', adminsWithNames);
      setAdmins(adminsWithNames);
      return adminsWithNames;
      
    } catch (error) {
      console.error('❌ Error in fetchAdmins:', error);
      setAdmins([]);
      return [];
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  // ==================== DEBUG FUNCTION ====================
  const debugProfilePictures = async () => {
    console.log('🔍 Debugging profile pictures...');
    
    const { data: deanData, error: deanError } = await supabase
      .from('user_roles')
      .select('id, email, role, profile_picture_url, faculty_id')
      .eq('faculty_id', facultyId)
      .eq('role', 'dean');
    
    console.log('👤 Dean data:', deanData);
    if (deanError) console.log('Dean error:', deanError);
    
    const { data: hodsData, error: hodsError } = await supabase
      .from('user_roles')
      .select('id, email, role, profile_picture_url, department_id')
      .eq('role', 'hod')
      .eq('faculty_id', facultyId);
    
    console.log('👨‍💼 HODs profiles:', hodsData);
    if (hodsError) console.log('HODs error:', hodsError);
  };

  // ==================== PROFILE PICTURE UPDATE ====================
  const handleProfilePictureUpdate = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        alert('Upload failed: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('admin profiles')
        .getPublicUrl(filePath);

      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', profile.id);

      if (roleUpdateError) {
        alert('Update failed: ' + roleUpdateError.message);
        return;
      }

      profile.profile_picture_url = publicUrl;
      setProfileVersion(Date.now());
      
      alert('✅ Profile picture updated successfully!');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile picture: ' + error.message);
    }
  };

  // ==================== PASSWORD CHANGE ====================
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      console.log('🔍 Attempting to change password for:', deanEmail);

      const { data: userData, error: userError } = await supabase
        .from('user_roles')
        .select('id, email, password_hash')
        .eq('email', deanEmail)
        .maybeSingle();

      if (userError) {
        console.error('❌ Error finding user:', userError);
        alert('User not found. Please contact support.');
        setChangingPassword(false);
        return;
      }

      if (!userData) {
        console.error('❌ No user found with email:', deanEmail);
        alert('User not found. Please contact support.');
        setChangingPassword(false);
        return;
      }

      console.log('✅ User found:', userData);

      if (userData.password_hash !== passwordData.currentPassword) {
        console.log('❌ Current password does not match');
        alert('Current password is incorrect. Please try again.');
        setChangingPassword(false);
        return;
      }

      console.log('✅ Current password verified, updating...');

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ 
          password_hash: passwordData.newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      if (updateError) {
        console.error('❌ Error updating password:', updateError);
        alert('Failed to update password: ' + updateError.message);
        setChangingPassword(false);
        return;
      }

      console.log('✅ Password updated successfully!');
      alert('✅ Password updated successfully! Please use your new password to log in.');
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

    } catch (error) {
      console.error('❌ Password change error:', error);
      alert('Failed to update password: ' + error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // ==================== CONTACT INFO UPDATE ====================
  const handleContactUpdate = async () => {
    if (!contactEmail.trim()) {
      alert('Please enter a contact email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    if (contactPhone.trim() && !/^[0-9+\-\s()]{10,15}$/.test(contactPhone.trim())) {
      alert('Please enter a valid phone number (10-15 digits)');
      return;
    }

    setUpdatingContact(true);
    try {
      const { error: updateError } = await supabase
        .from('faculties')
        .update({
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
        })
        .eq('id', facultyId);

      if (updateError) throw updateError;

      alert('✅ Contact information updated successfully!');
      await fetchDeanData();
      
    } catch (error) {
      console.error('Contact update error:', error);
      alert('Failed to update contact information: ' + error.message);
    } finally {
      setUpdatingContact(false);
    }
  };

  // ==================== NOTIFICATIONS ====================
  const fetchNotifications = async () => {
    if (!deanEmail) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', deanEmail)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read)?.length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const setupNotificationSubscription = () => {
    if (notificationSubscriptionRef.current) {
      notificationSubscriptionRef.current.unsubscribe();
    }

    const subscription = supabase
      .channel('dean-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `receiver_email=eq.${deanEmail}`,
      }, (payload) => {
        fetchNotifications();
        const msg = payload.new;
        alert(`📩 New message from ${msg.sender_name || msg.sender_email}`);
      })
      .subscribe();

    notificationSubscriptionRef.current = subscription;
  };

  const markNotificationRead = async (id) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', id);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  // ==================== CHAT FUNCTIONS (FULLY REAL-TIME) ====================
const fetchChatMessages = useCallback(async (userEmail) => {
  if (!deanEmail || !userEmail) return;

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
    setChatMessages(data || []);

    // Mark unread as read
    const unreadMessages = (data || []).filter(
      (msg) => msg.receiver_email === deanEmail && !msg.is_read
    );

    for (const msg of unreadMessages) {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', msg.id);
    }

    fetchNotifications();

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
  }
}, [deanEmail]);

const sendMessage = async () => {
  if (!newMessage.trim() || !selectedUser) return;

  const tempId = `temp-${Date.now()}`;
  const messageText = newMessage.trim();

  // Optimistic UI
  const optimisticMsg = {
    id: tempId,
    sender_email: deanEmail,
    sender_role: 'dean',
    sender_name: deanName,
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
        sender_id: profile?.id || facultyId,
        sender_email: deanEmail,
        sender_role: 'dean',
        sender_name: deanName,
        receiver_email: selectedUser.email,
        receiver_role: selectedUserType,
        message: messageText,
        faculty_id: facultyId,
        department_id: selectedUser.department_id || null,
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
    console.error('Error sending message:', err);
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
    name: user.display_name || user.full_name || user.name || user.head_name || user.email,
    display_name: user.display_name || user.full_name || user.name || user.head_name || user.email,
    department_id: user.department_id || null,
    id: user.id,
  });
  setSelectedUserType(type);
  setShowChat(true);
  setChatMessages([]);
  fetchChatMessages(user.email);
};

// ==================== OPEN ADMIN CHAT ====================
const openAdminChat = async () => {
  let list = admins;
  if (list.length === 0) {
    list = await fetchAdmins();
  }

  if (list && list.length > 0) {
    openChatWithUser(list[0], 'admin');
  } else {
    alert('No system administrators available.');
  }
  };

useEffect(() => {
  if (!showChat || !selectedUser?.email || !deanEmail) return;

  console.log('[DEAN CHAT] Setting up realtime:', deanEmail, '↔', selectedUser.email);

  const channel = supabase
    .channel(`dean-chat-${deanEmail}-${selectedUser.email}`)
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
          (msg.sender_email === deanEmail && msg.receiver_email === selectedUser.email) ||
          (msg.sender_email === selectedUser.email && msg.receiver_email === deanEmail);

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
      console.log('[DEAN CHAT] Realtime status:', status);
    });

  // Fallback polling every 6 seconds while chat is open
  const pollInterval = setInterval(() => {
    fetchChatMessages(selectedUser.email);
  }, 6000);

  return () => {
    supabase.removeChannel(channel);
    clearInterval(pollInterval);
  };
}, [showChat, selectedUser?.email, deanEmail, fetchChatMessages]);

  // ==================== FETCH DATA ====================
  const fetchHODs = useCallback(async () => {
    if (!facultyId) return [];
    
    try {
      const { data: hodRoles, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          email,
          role,
          department_id,
          faculty_id,
          profile_picture_url,
          departments:department_id (
            id,
            department_code,
            department_name,
            head_of_department,
            contact_email,
            contact_phone,
            is_active
          )
        `)
        .eq('role', 'hod')
        .eq('faculty_id', facultyId);

      if (error) throw error;

      const hodList = (hodRoles || []).map(hod => ({
        id: hod.id,
        email: hod.email,
        role: hod.role,
        department_id: hod.department_id,
        department_code: hod.departments?.department_code || '',
        department_name: hod.departments?.department_name || '',
        head_name: hod.departments?.head_of_department || hod.email,
        contact_email: hod.departments?.contact_email || hod.email,
        contact_phone: hod.departments?.contact_phone || '',
        is_active: hod.departments?.is_active ?? true,
        profile_picture_url: hod.profile_picture_url || null,
      }));

      setHODs(hodList);
      return hodList;
    } catch (err) {
      console.error('Error fetching HODs:', err);
      return [];
    }
  }, [facultyId]);

  const fetchDepartments = useCallback(async () => {
    if (!facultyId) return [];
    
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('faculty_id', facultyId)
      .order('department_code');
    
    if (error) return [];
    setDepartments(data || []);
    return data || [];
  }, [facultyId]);

  const fetchDeanData = useCallback(async () => {
    if (!facultyId) return;
    
    setLoading(true);
    try {
      // Fetch Dean's profile picture from user_roles
      const { data: deanRole, error: deanRoleError } = await supabase
        .from('user_roles')
        .select('id, email, role, profile_picture_url')
        .eq('faculty_id', facultyId)
        .eq('role', 'dean')
        .single();
    
      if (deanRoleError) {
        console.error('❌ Error fetching Dean role:', deanRoleError);
      }
    
      if (deanRole) {
        if (deanRole.profile_picture_url) {
          profile.profile_picture_url = deanRole.profile_picture_url;
          setProfileVersion(Date.now());
        }
      }

      // Fetch faculty contact info from faculties table
      const { data: facultyData, error: facultyError } = await supabase
        .from('faculties')
        .select('contact_email, contact_phone')
        .eq('id', facultyId)
        .single();

      if (!facultyError && facultyData) {
        setContactEmail(facultyData.contact_email || '');
        setContactPhone(facultyData.contact_phone || '');
      }

      // Fetch admins for chat
      await fetchAdmins();

      const depts = await fetchDepartments();
      const hodList = await fetchHODs();
      const deptCodes = depts.map(d => d.department_code).filter(Boolean);

      if (deptCodes.length > 0) {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .in('department_code', deptCodes)
          .order('course_code');
        setCourses(coursesData || []);

        const { data: studentsData } = await supabase
          .from('students')
          .select('*')
          .in('department_code', deptCodes)
          .order('full_name');
        setStudents(studentsData || []);

        const { data: lecturerDepts } = await supabase
          .from('lecturer_departments')
          .select('lecturer_id')
          .in('department_code', deptCodes);
        
        const lecturerIds = [...new Set(lecturerDepts?.map(ld => ld.lecturer_id) || [])];
        if (lecturerIds.length > 0) {
          const { data: lects } = await supabase
            .from('lecturers')
            .select('*')
            .in('id', lecturerIds)
            .order('full_name');
          setLecturers(lects || []);
        }

        const courseIds = (coursesData || []).map(c => c.id);
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
            .limit(50);
          
          setRecentAttendance(attendance || []);
        }

        setStats({
          totalDepartments: depts.length,
          totalCourses: coursesData?.length || 0,
          totalStudents: studentsData?.length || 0,
          totalLecturers: lecturerIds.length,
          totalHODs: hodList.length,
        });
      }

      setTimeout(() => {
        debugProfilePictures();
      }, 1000);

    } catch (err) {
      console.error('Error fetching dean data:', err);
    } finally {
      setLoading(false);
    }
  }, [facultyId, fetchDepartments, fetchHODs, fetchAdmins]);

  useEffect(() => {
    fetchDeanData();
    fetchNotifications();
    setupNotificationSubscription();

    return () => {
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchDeanData]);

  // Filter functions
  const filteredStudents = students.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(term) ||
      s.student_id?.toLowerCase().includes(term)
    );
  });

  const filteredCourses = courses.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.course_code?.toLowerCase().includes(term) ||
      c.course_name?.toLowerCase().includes(term)
    );
  });

  // ==================== SETTINGS RENDER ====================
  const renderSettings = () => (
    <div className="dean-settings-panel">
      <div className="dean-settings-header">
        <h2>⚙️ Settings</h2>
        
      </div>
      
      <div className="dean-settings-body">
        {/* Profile Picture */}
        <div className="dean-setting-group">
          <h3>Profile Picture</h3>
          <div className="dean-profile-picture-section">
            <div className="dean-profile-picture-container">
              {profile?.profile_picture_url ? (
                <img 
                  src={`${profile.profile_picture_url}?t=${profileVersion}`} 
                  alt={deanName}
                  className="dean-profile-picture"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'dean-profile-picture-placeholder';
                    placeholder.textContent = deanName?.[0]?.toUpperCase() || 'D';
                    parent.appendChild(placeholder);
                  }}
                />
              ) : (
                <div className="dean-profile-picture-placeholder">
                  {deanName?.[0]?.toUpperCase() || 'D'}
                </div>
              )}
            </div>
            <button 
              className="dean-upload-btn"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    await handleProfilePictureUpdate(file);
                  }
                };
                input.click();
              }}
            >
              📸 Upload New Picture
            </button>
          </div>
        </div>

        {/* Faculty Contact Information */}
        <div className="dean-setting-group">
          <h3>🏛️ Faculty Contact Information</h3>
          <p className="dean-settings-hint" style={{ marginBottom: '12px' }}>
            This information will be displayed publicly for the faculty
          </p>
          <div className="dean-phone-section">
            <div className="dean-form-group">
              <label>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Enter faculty contact email"
                className="dean-settings-input"
              />
            </div>
            <div className="dean-form-group">
              <label>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Enter faculty contact phone"
                className="dean-settings-input"
              />
            </div>
          </div>
          <button 
            className="dean-save-btn"
            onClick={handleContactUpdate}
            disabled={updatingContact}
            style={{ marginTop: '12px' }}
          >
            {updatingContact ? 'Saving...' : 'Save Contact Info'}
          </button>
        </div>

        {/* Password Change */}
        <div className="dean-setting-group">
          <h3>🔒 Change Password</h3>
          <form onSubmit={handlePasswordChange} className="dean-password-form">
            <div className="dean-form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  currentPassword: e.target.value
                })}
                placeholder="Enter current password"
                className="dean-settings-input"
                required
              />
            </div>
            <div className="dean-form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  newPassword: e.target.value
                })}
                placeholder="Enter new password (min 6 characters)"
                className="dean-settings-input"
                required
                minLength={6}
              />
            </div>
            <div className="dean-form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  confirmPassword: e.target.value
                })}
                placeholder="Confirm new password"
                className="dean-settings-input"
                required
              />
            </div>
            <button 
              type="submit" 
              className="dean-save-btn"
              disabled={changingPassword}
              style={{ marginTop: '12px' }}
            >
              {changingPassword ? 'Updating...' : '🔒 Update Password'}
            </button>
            <p className="dean-settings-hint">Password must be at least 6 characters long</p>
          </form>
        </div>

        {/* Account Info */}
        <div className="dean-setting-group">
          <h3>Account Information</h3>
          <div className="dean-account-info">
            <div className="dean-info-item">
              <label>Name</label>
              <p>{deanName}</p>
            </div>
            <div className="dean-info-item">
              <label>Email</label>
              <p>{deanEmail}</p>
            </div>
            <div className="dean-info-item">
              <label>Role</label>
              <p><span className="dean-role-badge">DEAN</span></p>
            </div>
            <div className="dean-info-item">
              <label>Faculty</label>
              <p>{facultyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className="dean-dashboard">
      {/* Header */}
      <header className="dean-header">
        <div className="dean-header-left">
          <h1>🎓 Dean Dashboard</h1>
          <p>Faculty of {facultyName}</p>
        </div>
        <div className="dean-header-right">
          {/* Admin Chat Button */}
          <button 
            className="dean-admin-chat-btn"
            onClick={openAdminChat}
            title="Chat with Admin"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              marginRight: '10px',
              position: 'relative'
            }}
          >
            👤
            <span style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              fontSize: '10px',
              background: '#4CAF50',
              color: 'white',
              borderRadius: '50%',
              padding: '2px 4px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              A
            </span>
          </button>

          {/* Notification Bell */}
          <div className="dean-notification-wrapper">
            <button 
              className="dean-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {unreadCount > 0 && (
                <span className="dean-notification-badge">{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className="dean-notification-dropdown">
                <div className="dean-notification-header">
                  <h4>Notifications ({unreadCount} unread)</h4>
                  {unreadCount > 0 && (
                    <button 
                      className="dean-mark-all-read"
                      onClick={() => {
                        notifications.forEach(n => markNotificationRead(n.id));
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="dean-notification-list">
                  {notifications.length === 0 ? (
                    <div className="dean-notification-empty">No notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className={`dean-notification-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          setShowNotifications(false);
                          if (notif.sender_role === 'admin' || notif.sender_role === 'hod') {
                            openChatWithUser(
                              { email: notif.sender_email, name: notif.sender_name },
                              notif.sender_role
                            );
                          }
                        }}
                      >
                        <div className="dean-notification-content">
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

          <div className="dean-user-info">
            <div 
              className="dean-avatar"
              onClick={() => setShowSettings(true)}
              style={{ cursor: 'pointer' }}
            >
              {profile?.profile_picture_url ? (
                <img 
                  src={`${profile.profile_picture_url}?t=${profileVersion}`} 
                  alt={deanName}
                  className="dean-avatar-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.textContent = deanName?.[0]?.toUpperCase() || 'D';
                  }}
                />
              ) : (
                <span>{deanName?.[0]?.toUpperCase() || 'D'}</span>
              )}
            </div>
            <div>
              <span className="dean-user-name">{deanName}</span>
              <span className="dean-user-role">Dean</span>
            </div>
          </div>
          <button className="dean-logout-btn" onClick={() => {
            signOut();
            navigate('/login');
          }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dean-nav">
        <button className={`dean-nav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 Overview
        </button>
        <button className={`dean-nav-btn ${activeTab === 'hods' ? 'active' : ''}`} onClick={() => setActiveTab('hods')}>
          👨‍💼 HODs ({hods.length})
        </button>
        <button className={`dean-nav-btn ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
          🏢 Departments ({departments.length})
        </button>
        <button className={`dean-nav-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>
          📚 Courses ({courses.length})
        </button>
        <button className={`dean-nav-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
          👨‍🎓 Students ({students.length})
        </button>
        <button className={`dean-nav-btn ${activeTab === 'lecturers' ? 'active' : ''}`} onClick={() => setActiveTab('lecturers')}>
          👨‍🏫 Lecturers ({lecturers.length})
        </button>
        <button className={`dean-nav-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
          📅 Attendance
        </button>
        <button className={`dean-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings        </button>
      </nav>

      {/* Content */}
      <main className="dean-content">
        {activeTab === 'settings' ? (
          renderSettings()
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Faculty Overview - {facultyName}</h2>
                
                <div className="dean-stats-grid">
                  <div className="dean-stat-card dean-stat-blue">
                    <h3>{stats.totalDepartments}</h3>
                    <p>Departments</p>
                  </div>
                  <div className="dean-stat-card dean-stat-green">
                    <h3>{stats.totalCourses}</h3>
                    <p>Courses</p>
                  </div>
                  <div className="dean-stat-card dean-stat-orange">
                    <h3>{stats.totalStudents}</h3>
                    <p>Students</p>
                  </div>
                  <div className="dean-stat-card dean-stat-purple">
                    <h3>{stats.totalLecturers}</h3>
                    <p>Lecturers</p>
                  </div>
                  <div className="dean-stat-card dean-stat-teal">
                    <h3>{stats.totalHODs || hods.length}</h3>
                    <p>HODs</p>
                  </div>
                  <div className="dean-stat-card dean-stat-red" style={{ cursor: 'pointer' }} onClick={openAdminChat}>
                    <h3>👤</h3>
                    <p>Chat with Admin</p>
                    <small style={{ fontSize: '10px', opacity: 0.7 }}>Click to message</small>
                  </div>
                </div>

                {hods.length > 0 && (
                  <div className="dean-card">
                    <h3 className="dean-card-title">Department Heads (HODs)</h3>
                    <div className="dean-table-wrapper">
                      <table className="dean-table">
                        <thead>
                          <tr>
                            <th>Department</th>
                            <th>HOD</th>
                            <th>Contact</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hods.map(hod => (
                            <tr key={hod.id}>
                              <td>
                                <strong>{hod.department_code}</strong>
                                <br />
                                <small>{hod.department_name}</small>
                              </td>
                              <td>{hod.head_name || '—'}</td>
                              <td>{hod.contact_phone || hod.contact_email || '—'}</td>
                              <td>
                                <button 
                                  className="dean-chat-btn"
                                  onClick={() => openChatWithUser(hod, 'hod')}
                                >
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

                {/* Admin Chat Section */}
                {admins.length > 0 && (
                  <div className="dean-card" style={{ marginTop: '20px' }}>
                    <h3 className="dean-card-title">👤 System Administrators</h3>
                    <div className="dean-table-wrapper">
                      <table className="dean-table">
                        <thead>
                          <tr>
                            <th>Photo</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admins.map(admin => (
                            <tr key={admin.id}>
                              <td>
                                {admin.profile_picture_url ? (
                                  <img 
                                    src={admin.profile_picture_url} 
                                    alt={admin.display_name}
                                    className="dean-avatar-small"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="dean-avatar-small dean-avatar-placeholder">
                                    {admin.display_name?.[0]?.toUpperCase() || 'A'}
                                  </div>
                                )}
                              </td>
                              <td>
                                <strong>{admin.display_name}</strong>
                              </td>
                              <td>{admin.email}</td>
                              <td>
                                <button 
                                  className="dean-chat-btn"
                                  onClick={() => openChatWithUser(admin, 'admin')}
                                >
                                  💬 Message Admin
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HODs Tab */}
            {activeTab === 'hods' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Department Heads (HODs) - {facultyName}</h2>
                <div className="dean-card">
                  <div className="dean-table-wrapper">
                    <table className="dean-table">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>Department</th>
                          <th>HOD Email</th>
                          <th>Head Name</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hods.map(hod => (
                          <tr key={hod.id}>
                            <td>
                              {hod.profile_picture_url ? (
                                <img 
                                  src={hod.profile_picture_url} 
                                  alt={hod.head_name}
                                  className="dean-avatar-small"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="dean-avatar-small dean-avatar-placeholder">
                                  {hod.head_name?.[0]?.toUpperCase() || 'H'}
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>{hod.department_code}</strong>
                              <br />
                              <small>{hod.department_name}</small>
                            </td>
                            <td>{hod.email}</td>
                            <td>{hod.head_name || '—'}</td>
                            <td>{hod.contact_phone || '—'}</td>
                            <td>
                              <span className={`dean-status ${hod.is_active ? 'active' : 'inactive'}`}>
                                {hod.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="dean-chat-btn"
                                onClick={() => openChatWithUser(hod, 'hod')}
                              >
                                💬 Message
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Departments Tab */}
            {activeTab === 'departments' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Departments & HODs</h2>
                <div className="dean-card">
                  <div className="dean-table-wrapper">
                    <table className="dean-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Department Name</th>
                          <th>Head of Department</th>
                          <th>HOD Email</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map(dept => {
                          const hod = hods.find(h => h.department_id === dept.id);
                          return (
                            <tr key={dept.id}>
                              <td><strong>{dept.department_code}</strong></td>
                              <td>{dept.department_name}</td>
                              <td>{dept.head_of_department || '—'}</td>
                              <td>{hod?.email || '—'}</td>
                              <td>
                                <span className={`dean-status ${dept.is_active ? 'active' : 'inactive'}`}>
                                  {dept.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Courses Tab */}
            {activeTab === 'courses' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Faculty Courses ({filteredCourses.length})</h2>
                <div className="dean-search-wrapper">
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="dean-search-input"
                  />
                </div>
                <div className="dean-card">
                  <div className="dean-table-wrapper">
                    <table className="dean-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Course Name</th>
                          <th>Department</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCourses.map(course => (
                          <tr key={course.id}>
                            <td><strong>{course.course_code}</strong></td>
                            <td>{course.course_name}</td>
                            <td><span className="dean-badge">{course.department_code}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Students ({filteredStudents.length})</h2>
                <div className="dean-search-wrapper">
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="dean-search-input"
                  />
                </div>
                <div className="dean-card">
                  <div className="dean-table-wrapper">
                    <table className="dean-table">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Full Name</th>
                          <th>Department</th>
                          <th>Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(student => (
                          <tr key={student.id}>
                            <td><strong>{student.student_id}</strong></td>
                            <td>{student.full_name}</td>
                            <td>{student.department_code}</td>
                            <td>{student.year_of_study || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Lecturers Tab */}
            {activeTab === 'lecturers' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Lecturers ({lecturers.length})</h2>
                <div className="dean-card">
                  <div className="dean-table-wrapper">
                    <table className="dean-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Qualification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lecturers.map(lecturer => (
                          <tr key={lecturer.id}>
                            <td><strong>{lecturer.full_name}</strong></td>
                            <td>{lecturer.email}</td>
                            <td>{lecturer.phone || '—'}</td>
                            <td>{lecturer.qualification || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div className="dean-section">
                <h2 className="dean-section-title">Recent Attendance</h2>
                {recentAttendance.length === 0 ? (
                  <div className="dean-empty">
                    <p>No attendance records found for your faculty.</p>
                  </div>
                ) : (
                  <div className="dean-card">
                    <div className="dean-table-wrapper">
                      <table className="dean-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Course</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAttendance.map(record => (
                            <tr key={record.id}>
                              <td>{record.date}</td>
                              <td>
                                <strong>{record.students?.full_name || 'Unknown'}</strong>
                                <br />
                                <small>{record.students?.student_id}</small>
                              </td>
                              <td>{record.courses?.course_code}</td>
                              <td>
                                <span className={`dean-status ${record.status}`}>
                                  {record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Chat Modal */}
      {showChat && selectedUser && (
        <div className="dean-chat-overlay" onClick={() => setShowChat(false)}>
          <div className="dean-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-chat-header">
              <div>
                <h3>💬 Chat with {selectedUserType?.toUpperCase()}</h3>
                <p style={{ fontSize: '12px', color: '#666' }}>
                  {selectedUser.display_name || 
                   selectedUser.full_name || 
                   selectedUser.email || 
                   selectedUser.head_name ||
                   'User'}
                </p>
              </div>
              <button className="dean-chat-close" onClick={() => setShowChat(false)}>✕</button>
            </div>
            
            <div className="dean-chat-body">
              {chatMessages.length === 0 ? (
                <div className="dean-chat-empty">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`dean-chat-message ${msg.sender_role === 'dean' ? 'sent' : 'received'}`}
                  >
                    <div className="dean-chat-meta">
                      <strong>{msg.sender_name || msg.sender_email}</strong>
                      <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                    </div>
                    <p>{msg.message}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="dean-chat-footer">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage) {
                    sendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="dean-chat-input"
              />
              <button
                className="dean-chat-send"
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

export default DeanDashboard;