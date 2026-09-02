import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import './LecturerSettings.css';

const LecturerSettings = ({ profile, showToast, onProfileUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [updatingPhone, setUpdatingPhone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profilePicture, setProfilePicture] = useState(profile?.profile_picture_url || null);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Modal state
  const [modal, setModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success',
    onConfirm: null,
    confirmText: 'OK'
  });

  // Show modal
  const showModal = (title, message, type = 'success', onConfirm = null, confirmText = 'OK') => {
    setModal({
      show: true,
      title,
      message,
      type,
      onConfirm,
      confirmText
    });
  };

  // Close modal
  const closeModal = () => {
    setModal({
      show: false,
      title: '',
      message: '',
      type: 'success',
      onConfirm: null,
      confirmText: 'OK'
    });
  };

  // Handle modal confirm
  const handleModalConfirm = () => {
    if (modal.onConfirm) {
      modal.onConfirm();
    }
    closeModal();
  };

  // Refresh profile data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data: lecturerData, error } = await supabase
        .from('lecturers')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (error) throw error;

      setProfilePicture(lecturerData?.profile_picture_url || null);
      setPhoneNumber(lecturerData?.phone || '');
      
      if (onProfileUpdate) {
        onProfileUpdate({
          profile_picture_url: lecturerData?.profile_picture_url,
          phone: lecturerData?.phone
        });
      }

      showModal('✅ Success', 'Profile data refreshed successfully!', 'success');
    } catch (error) {
      console.error('Refresh error:', error);
      showModal('❌ Error', 'Failed to refresh profile data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle phone number update
  const handlePhoneUpdate = async () => {
    if (!phoneNumber.trim()) {
      showModal('⚠️ Validation Error', 'Please enter a phone number', 'error');
      return;
    }

    const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      showModal('⚠️ Validation Error', 'Please enter a valid phone number (10-15 digits)', 'error');
      return;
    }

    setUpdatingPhone(true);
    try {
      const { error: updateError } = await supabase
        .from('lecturers')
        .update({ phone: phoneNumber.trim() })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      if (onProfileUpdate) {
        onProfileUpdate({ phone: phoneNumber.trim() });
      }

      showModal('✅ Success', `Phone number updated successfully to: ${phoneNumber.trim()}`, 'success');
    } catch (error) {
      console.error('Phone update error:', error);
      showModal('❌ Error', `Failed to update phone: ${error.message}`, 'error');
    } finally {
      setUpdatingPhone(false);
    }
  };

// Update the handlePasswordChange function to use the new RPC

const handlePasswordChange = async (e) => {
  e.preventDefault();
  
  if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
    showModal('⚠️ Validation Error', 'Please fill in all password fields', 'error');
    return;
  }

  if (passwordData.newPassword.length < 6) {
    showModal('⚠️ Validation Error', 'New password must be at least 6 characters', 'error');
    return;
  }

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    showModal('⚠️ Validation Error', 'New passwords do not match', 'error');
    return;
  }

  setLoading(true);
  try {
    // First verify current password by trying to authenticate
    const { data: authData, error: authError } = await supabase.rpc('authenticate_user', {
      user_email: profile.email,
      user_password: passwordData.currentPassword
    });

    if (authError || !authData || authData.length === 0) {
      showModal('❌ Error', 'Current password is incorrect. Please try again.', 'error');
      setLoading(false);
      return;
    }

    // Update password using the new RPC function
    const { data: updateResult, error: updateError } = await supabase.rpc('update_user_password', {
      p_user_email: profile.email,
      p_new_password: passwordData.newPassword
    });

    if (updateError) {
      console.error('Update error:', updateError);
      showModal('❌ Error', `Failed to update password: ${updateError.message}`, 'error');
      setLoading(false);
      return;
    }

    if (updateResult && updateResult.success === false) {
      showModal('❌ Error', updateResult.message || 'Failed to update password', 'error');
      setLoading(false);
      return;
    }

    showModal('✅ Success', 'Password updated successfully! Please use your new password to log in.', 'success');
    
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });

  } catch (error) {
    console.error('Password change error:', error);
    showModal('❌ Error', error.message || 'Failed to update password', 'error');
  } finally {
    setLoading(false);
  }
};

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showModal('⚠️ Validation Error', 'Please upload a valid image (JPEG, PNG, GIF, or WebP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showModal('⚠️ Validation Error', 'Image size must be less than 5MB', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${Date.now()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('admin profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        showModal('❌ Upload Error', `Upload failed: ${uploadError.message}`, 'error');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('admin profiles')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('lecturers')
        .update({ profile_picture_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        showModal('❌ Update Error', `Update failed: ${updateError.message}`, 'error');
        return;
      }

      setProfilePicture(publicUrl);
      
      if (onProfileUpdate) {
        onProfileUpdate({ profile_picture_url: publicUrl });
      }

      showModal('✅ Success', 'Profile picture updated successfully!', 'success');

    } catch (error) {
      showModal('❌ Error', error.message || 'Failed to upload profile picture', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove profile picture
  const handleRemoveProfilePicture = async () => {
    if (!profilePicture) return;

    setUploadingImage(true);
    try {
      const { error: updateError } = await supabase
        .from('lecturers')
        .update({ profile_picture_url: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfilePicture(null);
      
      if (onProfileUpdate) {
        onProfileUpdate({ profile_picture_url: null });
      }

      showModal('✅ Success', 'Profile picture removed successfully', 'success');

    } catch (error) {
      showModal('❌ Error', error.message || 'Failed to remove profile picture', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Get modal icon based on type
  const getModalIcon = () => {
    switch (modal.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '✅';
    }
  };

  return (
    <div className="lecturer-settings">
      {/* Confirmation Modal */}
      {modal.show && (
        <div className="lecturer-modal-overlay" onClick={closeModal}>
          <div className="lecturer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="lecturer-modal-header">
              <span className="lecturer-modal-icon">{getModalIcon()}</span>
              <h3>{modal.title}</h3>
              {modal.type !== 'info' && (
                <button className="lecturer-modal-close" onClick={closeModal}>×</button>
              )}
            </div>
            <div className="lecturer-modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{modal.message}</p>
            </div>
            <div className="lecturer-modal-footer">
              <button 
                className={`lecturer-modal-btn lecturer-modal-btn-${modal.type}`}
                onClick={handleModalConfirm}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lecturer-settings-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>⚙️ Settings</h2>
            <p>Manage your account settings and preferences</p>
          </div>
          <button 
            className="lecturer-settings-btn lecturer-settings-btn-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span style={{ 
              display: 'inline-block',
              animation: refreshing ? 'spin 1s linear infinite' : 'none'
            }}>
              🔄
            </span>
            {refreshing ? 'Refreshing...' : 'Refresh Profile'}
          </button>
        </div>
      </div>

      <div className="lecturer-settings-grid">
        {/* Profile Picture Section */}
        <div className="lecturer-settings-card">
          <h3>📸 Profile Picture</h3>
          <div className="lecturer-profile-picture-section">
            <div className="lecturer-profile-picture-container">
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile" 
                  className="lecturer-profile-picture-large"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'lecturer-profile-picture-placeholder';
                    placeholder.textContent = profile?.full_name?.[0]?.toUpperCase() || 'U';
                    parent.appendChild(placeholder);
                  }}
                />
              ) : (
                <div className="lecturer-profile-picture-placeholder">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div className="lecturer-profile-picture-actions">
              <button 
                className="lecturer-settings-btn lecturer-settings-btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? 'Uploading...' : '📸 Upload New Picture'}
              </button>
              {profilePicture && (
                <button 
                  className="lecturer-settings-btn lecturer-settings-btn-danger"
                  onClick={handleRemoveProfilePicture}
                  disabled={uploadingImage}
                >
                  🗑️ Remove Picture
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePictureUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            <p className="lecturer-settings-hint">
              Supported formats: JPEG, PNG, GIF, WebP • Max size: 5MB
            </p>
          </div>
        </div>

        {/* Phone Number Section */}
        <div className="lecturer-settings-card">
          <h3>📱 Phone Number</h3>
          <div className="lecturer-phone-section">
            <div className="lecturer-form-group">
              <label>Phone Number</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number (e.g., +1234567890)"
                  className="lecturer-settings-input"
                  style={{ flex: 1 }}
                />
                <button 
                  className="lecturer-settings-btn lecturer-settings-btn-primary"
                  onClick={handlePhoneUpdate}
                  disabled={updatingPhone || phoneNumber === profile?.phone}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {updatingPhone ? 'Updating...' : '💾 Save'}
                </button>
              </div>
              <p className="lecturer-settings-hint">
                Enter a valid phone number with country code (e.g., +1 234 567 8900)
              </p>
              <p className="lecturer-settings-hint" style={{ color: '#999', fontSize: '11px' }}>
                {profile?.phone ? `Current: ${profile.phone}` : 'No phone number set'}
              </p>
            </div>
          </div>
        </div>

        {/* Password Change Section */}
        <div className="lecturer-settings-card" style={{ gridColumn: '1 / -1' }}>
          <h3>🔒 Change Password</h3>
          <div style={{ 
            background: '#fff3cd', 
            border: '1px solid #ffc107', 
            borderRadius: '8px', 
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'none',
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
              ⚠️ <strong>Important:</strong> The current password for all lecturers is <strong>"Lecturer123!"</strong>. 
              Please enter this as your current password to change it.
            </p>
          </div>
          
          <form onSubmit={handlePasswordChange} className="lecturer-password-form">
            <div className="lecturer-form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  currentPassword: e.target.value
                })}
                placeholder="Enter current password"
                className="lecturer-settings-input"
                required
              />
             
            </div>

            <div className="lecturer-form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  newPassword: e.target.value
                })}
                placeholder="Enter new password (min 6 characters)"
                className="lecturer-settings-input"
                required
                minLength={6}
              />
            </div>

            <div className="lecturer-form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({
                  ...passwordData,
                  confirmPassword: e.target.value
                })}
                placeholder="Confirm new password"
                className="lecturer-settings-input"
                required
              />
            </div>

            <button 
              type="submit" 
              className="lecturer-settings-btn lecturer-settings-btn-success"
              disabled={loading}
            >
              {loading ? 'Updating...' : '🔒 Update Password'}
            </button>
            <p className="lecturer-settings-hint" style={{ color: '#999', fontSize: '11px', textAlign: 'center' }}>
              Password must be at least 6 characters long
            </p>
          </form>
        </div>
      </div>

      {/* Account Information Section */}
      <div className="lecturer-settings-card lecturer-settings-info-card">
        <h3>📋 Account Information</h3>
        <div className="lecturer-account-info-grid">
          <div className="lecturer-account-info-item">
            <label>Full Name</label>
            <p>{profile?.full_name || 'N/A'}</p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Email</label>
            <p>{profile?.email || 'N/A'}</p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Phone</label>
            <p>{profile?.phone || 'Not set'}</p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Role</label>
            <p><span className="lecturer-role-badge">LECTURER</span></p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Department</label>
            <p>{profile?.department || profile?.primary_department || 'N/A'}</p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Department Code</label>
            <p>{profile?.department_code || profile?.primary_department_code || 'N/A'}</p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Status</label>
            <p>
              <span className={`lecturer-status-badge ${profile?.status === 'active' ? 'active' : 'inactive'}`}>
                {profile?.status || 'Active'}
              </span>
            </p>
          </div>
          <div className="lecturer-account-info-item">
            <label>Profile Picture</label>
            <p>
              <span className={`lecturer-status-badge ${profilePicture ? 'active' : 'inactive'}`}>
                {profilePicture ? '✅ Set' : '❌ Not Set'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Spinning animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LecturerSettings;