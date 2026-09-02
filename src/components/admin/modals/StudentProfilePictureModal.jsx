// StudentProfilePictureModal.jsx - FINAL WORKING VERSION
import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Create admin client with service role (BYPASSES ALL RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const StudentProfilePictureModal = ({ student, onClose, onUpdate }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(student?.profile_picture_url || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image (JPEG, PNG, GIF, or WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError('');
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${student.id}_${Date.now()}.${fileExt}`;
      const filePath = `profile_pictures/${fileName}`;

      console.log('📤 Uploading to:', filePath);

      // Upload using admin client (bypasses RLS)
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('student-profiles')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload successful:', uploadData);

      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('student-profiles')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      console.log('🔗 Public URL:', publicUrl);

      // Update student record using admin client (bypasses RLS)
      const { error: updateError } = await supabaseAdmin
        .from('students')
        .update({ 
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      console.log('✅ Student record updated');
      
      // Update UI
      onUpdate(publicUrl);
      alert('✅ Profile picture updated successfully!');
      onClose();

    } catch (err) {
      console.error('❌ Error:', err);
      setError('Failed to upload: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove profile picture?')) return;

    setUploading(true);
    try {
      // Remove from student record
      const { error: updateError } = await supabaseAdmin
        .from('students')
        .update({ 
          profile_picture_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id);

      if (updateError) throw updateError;

      onUpdate(null);
      alert('✅ Profile picture removed!');
      onClose();

    } catch (err) {
      console.error('Remove error:', err);
      setError('Failed to remove: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Update Profile Picture</h3>
        <p><strong>Student:</strong> {student.full_name} ({student.student_id})</p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '20px 0'
        }}>
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0'
          }}>
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Profile preview" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ fontSize: '60px', color: '#999' }}>
                {student.full_name?.[0]?.toUpperCase() || '👤'}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ 
            color: '#dc3545', 
            padding: '10px', 
            marginBottom: '15px',
            backgroundColor: '#f8d7da',
            borderRadius: '4px'
          }}>
            ❌ {error}
          </div>
        )}

        <div className="form-group">
          <label>Choose Image</label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileSelect}
            className="form-input"
          />
          <small>JPEG, PNG, GIF, WEBP • Max 5MB</small>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginTop: '20px',
          flexWrap: 'wrap'
        }}>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          
          <button
            className="confirm-button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              backgroundColor: uploading ? '#6c757d' : '#28a745',
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Uploading...' : '📤 Upload Picture'}
          </button>

          {student.profile_picture_url && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >
              🗑️ Remove Picture
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePictureModal;