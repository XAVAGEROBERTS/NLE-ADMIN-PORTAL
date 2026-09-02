// dean/DeanSettings.jsx - HARDENED
import React, { useState } from 'react';
import { supabase } from '../../services/supabase';

const DeanSettings = ({
  profile,
  deanName,
  deanEmail,
  facultyName,
  facultyId,
  profileVersion,
  setProfileVersion,
  fetchDeanData,
  profilePicUrl,
}) => {
  const [contactEmail, setContactEmail] = useState(profile?.contact_email || '');
  const [contactPhone, setContactPhone] = useState(profile?.contact_phone || '');
  const [updatingContact, setUpdatingContact] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handleContactUpdate = async () => {
    if (!contactEmail.trim()) {
      alert('Please enter a contact email');
      return;
    }

    setUpdatingContact(true);
    try {
      const { error } = await supabase
        .from('faculties')
        .update({
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
        })
        .eq('id', facultyId);

      if (error) throw error;
      alert('✅ Contact information updated!');
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setUpdatingContact(false);
    }
  };

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
        .eq('email', deanEmail)
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

  const displayPicture = profilePicUrl || profile?.profile_picture_url;

  return (
    <div className="dean-settings-panel">
      <div className="dean-settings-header">
        <h2>⚙️ Settings</h2>
      </div>

      <div className="dean-settings-body">
        <div className="dean-setting-group">
          <h3>Profile Picture</h3>
          <div className="dean-profile-picture-section">
            <div className="dean-profile-picture-container">
              {displayPicture ? (
                <img
                  src={`${displayPicture}?t=${profileVersion}`}
                  alt={deanName}
                  className="dean-profile-picture"
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
                  if (file) await handleProfilePictureUpdate(file);
                };
                input.click();
              }}
            >
              📸 Upload New Picture
            </button>
          </div>
        </div>

        <div className="dean-setting-group">
          <h3>🏛️ Faculty Contact Information</h3>
          <p className="dean-settings-hint">This information is shown publicly for the faculty</p>
          <div className="dean-form-group">
            <label>Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="dean-settings-input"
              placeholder="faculty@university.edu"
            />
          </div>
          <div className="dean-form-group">
            <label>Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="dean-settings-input"
              placeholder="+254 7XX XXX XXX"
            />
          </div>
          <button
            className="dean-save-btn"
            onClick={handleContactUpdate}
            disabled={updatingContact}
          >
            {updatingContact ? 'Saving...' : 'Save Contact Info'}
          </button>
        </div>

        <div className="dean-setting-group">
          <h3>🔒 Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="dean-form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="dean-settings-input"
                required
              />
            </div>
            <div className="dean-form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
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
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="dean-settings-input"
                required
              />
            </div>
            <button type="submit" className="dean-save-btn" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : '🔒 Update Password'}
            </button>
          </form>
        </div>

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
              <p><span className="dean-role-badge">Dean</span></p>
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
};

export default DeanSettings;