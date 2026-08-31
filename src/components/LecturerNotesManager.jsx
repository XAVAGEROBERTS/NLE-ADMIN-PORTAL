// LecturerNotesManager.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const LecturerNotesManager = ({ profile, courses, showToast }) => {
  const [uploadedNotes, setUploadedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [showNotesUpload, setShowNotesUpload] = useState(false);
  const [uploadingNotes, setUploadingNotes] = useState(false);
  const [notesUploadProgress, setNotesUploadProgress] = useState(0);
  const [notesFiles, setNotesFiles] = useState([]);
  const [noteCourseId, setNoteCourseId] = useState('');
  const [noteMaterialType, setNoteMaterialType] = useState('notes');
  const notesFileInputRef = useRef(null);
  const notesUploadXhrRef = useRef(null);
  const notesUploadCancelledRef = useRef(false);

  const [selectedCohort, setSelectedCohort] = useState({
    academic_year: "",
    year_of_study: 1,
    semester: 1,
  });

  useEffect(() => {
    if (profile?.id) {
      fetchUploadedNotes();
    }
  }, [profile?.id]);

  const fetchUploadedNotes = async () => {
    if (!profile?.id) return;
    setLoadingNotes(true);
    try {
      const allFiles = [];

      // Fetch from Notes bucket
      const { data: notesData } = await supabase.storage
        .from('Notes')
        .list('', { limit: 1000 });

      if (notesData) {
        notesData.forEach(file => {
          if (file.name === '.emptyFolderPlaceholder') return;
          if (file.name.includes(profile.id)) {
            allFiles.push({ ...file, _bucket: 'Notes', _isVideo: false });
          }
        });
      }

      // Fetch from Tutorials bucket
      const { data: videoData } = await supabase.storage
        .from('Tutorials')
        .list('', { limit: 1000 });

      if (videoData) {
        videoData.forEach(file => {
          if (file.name === '.emptyFolderPlaceholder') return;
          if (file.name.includes(profile.id)) {
            allFiles.push({ ...file, _bucket: 'Tutorials', _isVideo: true });
          }
        });
      }

      const processed = allFiles.map(file => {
        const isVideo = file._isVideo;
        const bucketName = file._bucket;
        const filePath = file.name;

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        // Extract info from path
        const pathParts = file.name.split('/');
        const lastPart = pathParts[pathParts.length - 1] || file.name;
        const title = lastPart.replace(/\.[^.]+$/, '')
          .replace(/_\d{13}$/, '')
          .replace(/_/g, ' ');

        let course = 'Unknown';
        let category = 'General';
        let academicYear = '';
        let cohort = '';

        if (pathParts.length >= 3) {
          if (pathParts[0] === 'notes' || pathParts[0] === 'tutorials') {
            // Format: notes/lecturerId/programCode/courseCode/startYear/endYear/YEARX_SEMY/filename
            if (pathParts.length >= 8) {
              course = pathParts[3] || 'Unknown';
              const startYear = pathParts[4] || '';
              const endYear = pathParts[5] || '';
              academicYear = `${startYear}/${endYear}`;
              cohort = pathParts[6] || '';
            }
          }
        }

        const fileSize = file.metadata?.size || 0;
        const uploadDate = file.created_at || new Date().toISOString();

        return {
          id: file.id || file.name,
          name: file.name,
          title: title || file.name,
          category: category,
          course: course,
          academicYear: academicYear,
          cohort: cohort,
          fileSize: fileSize,
          fileSizeFormatted: formatFileSize(fileSize),
          uploadDate: uploadDate,
          uploadDateFormatted: new Date(uploadDate).toLocaleDateString(),
          downloadUrl: urlData.publicUrl,
          fileType: file.name.split('.').pop().toLowerCase(),
          icon: isVideo ? '🎬' : getFileIcon(file.name),
          isVideo: isVideo,
          bucket: bucketName,
        };
      });

      const sorted = processed.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
      setUploadedNotes(sorted);
    } catch (error) {
      console.error("Error fetching notes:", error);
      showToast("Failed to load materials", 'error');
    } finally {
      setLoadingNotes(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: '📄', doc: '📝', docx: '📝', ppt: '📊', pptx: '📊',
      xls: '📊', xlsx: '📊', txt: '📃', zip: '📦', rar: '📦',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
      mp4: '🎬', mp3: '🎵',
    };
    return iconMap[ext] || '📎';
  };

  const cancelNotesUpload = () => {
    notesUploadCancelledRef.current = true;
    if (notesUploadXhrRef.current) {
      try {
        notesUploadXhrRef.current.abort();
      } catch (_) {}
      notesUploadXhrRef.current = null;
    }
    setUploadingNotes(false);
    setNotesUploadProgress(0);
    showToast('Upload cancelled', 'info');
  };

const uploadNotes = async () => {
    if (notesFiles.length === 0) {
      showToast('Please select at least one file', 'error');
      return;
    }

    if (!noteCourseId) {
      showToast('Please select a course', 'error');
      return;
    }

    if (!selectedCohort.academic_year?.trim()) {
      showToast('Please enter the academic year', 'error');
      return;
    }

    notesUploadCancelledRef.current = false;
    setUploadingNotes(true);
    setNotesUploadProgress(0);

    try {
      const lecturerId = profile.id;
      const uploadedPaths = [];

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('course_code, program_code, course_name')
        .eq('id', noteCourseId)
        .single();

      if (courseError || !courseData?.course_code) {
        showToast('Failed to fetch course details', 'error');
        return;
      }

      let courseCode = courseData.course_code;
      let programCode = courseData.program_code || 'GENERAL';
      const cleanCourseCode = courseCode.replace(/\s+/g, '');
      const academicYear = selectedCohort.academic_year?.trim();
      const year = selectedCohort.year_of_study || 1;
      const semester = selectedCohort.semester || 1;
      const cohortString = `YEAR${year}_SEM${semester}`;
      const academicParts = academicYear.split('/');
      const startYear = academicParts[0]?.trim();
      const endYear = academicParts[1]?.trim();
      
      // Generate a unique timestamp for this upload session
      const timestamp = Date.now();

      for (let i = 0; i < notesFiles.length; i++) {
        if (notesUploadCancelledRef.current) {
          showToast('Upload cancelled', 'info');
          break;
        }

        const file = notesFiles[i];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        // Clean filename - remove all special characters
        const originalName = file.name
          .replace(/\.[^.]+$/, '') // Remove extension
          .replace(/[^a-zA-Z0-9]/g, '_') // Replace ALL non-alphanumeric chars with underscore
          .replace(/_+/g, '_') // Remove duplicate underscores
          .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
        
        // Add timestamp to make filename unique
        const safeFileName = `${originalName}_${timestamp}_${i}.${fileExt}`;

        let bucketName, fileName;

        if (noteMaterialType === 'video') {
          bucketName = 'Tutorials';
          fileName = `tutorials/${lecturerId}/${programCode}/${cleanCourseCode}/${startYear}/${endYear}/${cohortString}/${safeFileName}`;
        } else {
          bucketName = 'Notes';
          fileName = `notes/${lecturerId}/${programCode}/${cleanCourseCode}/${startYear}/${endYear}/${cohortString}/${safeFileName}`;
        }

        console.log('📤 Uploading to path:', fileName);

        // Try to check if file exists first (optional)
        const { data: existingFile } = await supabase.storage
          .from(bucketName)
          .list(fileName.split('/').slice(0, -1).join('/'), {
            search: safeFileName
          });

        if (existingFile && existingFile.length > 0) {
          console.log('⚠️ File already exists, removing it first...');
          const { error: removeError } = await supabase.storage
            .from(bucketName)
            .remove([fileName]);
          
          if (removeError) {
            console.warn('Could not remove existing file:', removeError);
          }
        }

        const { data: signedData, error: signError } = await supabase.storage
          .from(bucketName)
          .createSignedUploadUrl(fileName);

        if (signError || !signedData?.signedUrl) {
          console.error('❌ Sign error:', signError);
          showToast(`Failed to prepare upload for "${file.name}": ${signError?.message || 'Unknown error'}`, 'error');
          continue;
        }

        if (notesUploadCancelledRef.current) break;

        try {
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            notesUploadXhrRef.current = xhr;

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const fileProgress = e.loaded / e.total;
                const overall = Math.round(((i + fileProgress) / notesFiles.length) * 100);
                setNotesUploadProgress(Math.min(overall, 99));
              }
            });

            xhr.addEventListener('load', () => {
              notesUploadXhrRef.current = null;
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                console.error('❌ Upload failed with status:', xhr.status, xhr.responseText);
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            });

            xhr.addEventListener('error', () => {
              notesUploadXhrRef.current = null;
              reject(new Error('Network error during upload'));
            });

            xhr.addEventListener('abort', () => {
              notesUploadXhrRef.current = null;
              reject(new Error('Upload cancelled'));
            });

            xhr.open('PUT', signedData.signedUrl);
            xhr.timeout = 30 * 60 * 1000;
            xhr.send(file);
          });

          if (notesUploadCancelledRef.current) break;

          uploadedPaths.push(fileName);
          setNotesUploadProgress(Math.round(((i + 1) / notesFiles.length) * 100));
        } catch (uploadErr) {
          if (notesUploadCancelledRef.current || uploadErr.message === 'Upload cancelled') {
            showToast('Upload cancelled', 'info');
            break;
          }
          console.error('❌ Upload error:', uploadErr);
          showToast(`Upload failed for "${file.name}": ${uploadErr.message}`, 'error');
        }
      }

      if (uploadedPaths.length > 0) {
        const materialType = noteMaterialType === 'video' ? 'video(s)' : 'note(s)';
        showToast(`✅ Successfully uploaded ${uploadedPaths.length} ${materialType}!`, 'success');
        setNotesUploadProgress(100);

        setNotesFiles([]);
        setNoteCourseId('');
        setShowNotesUpload(false);
        setSelectedCohort({ academic_year: '', year_of_study: 1, semester: 1 });
        fetchUploadedNotes();
      } else if (!notesUploadCancelledRef.current) {
        showToast('No files were uploaded successfully', 'error');
      }
    } catch (err) {
      if (!notesUploadCancelledRef.current) {
        console.error('❌ Upload error:', err);
        showToast('Upload failed: ' + err.message, 'error');
      }
    } finally {
      notesUploadXhrRef.current = null;
      setUploadingNotes(false);
      setTimeout(() => setNotesUploadProgress(0), 800);
    }
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm(`Delete "${note.title}" permanently?`)) return;

    setDeletingNoteId(note.id);
    try {
      const { error } = await supabase.storage
        .from(note.bucket)
        .remove([note.name]);

      if (error) throw error;

      showToast('✅ Material deleted successfully!', 'success');
      fetchUploadedNotes();
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Failed to delete: ' + error.message, 'error');
    } finally {
      setDeletingNoteId(null);
    }
  };

  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <div>
          <h2>📚 Course Materials</h2>
          <p style={{ color: "#666", margin: "4px 0 0 0" }}>
            Share lecture notes, study materials, and tutorial videos with your students
          </p>
        </div>
        <button className="lecturer-add-btn" onClick={() => setShowNotesUpload(!showNotesUpload)}>
          {showNotesUpload ? '✕ Close' : '+ Upload Materials'}
        </button>
      </div>

      {/* Upload Form */}
      {showNotesUpload && (
        <div style={{ background: "white", padding: "24px", borderRadius: "12px", marginBottom: "24px", border: "2px solid #e9ecef" }}>
          <h3 style={{ marginBottom: "20px", color: "#2c3e50" }}>📤 Upload New Materials</h3>

          <div className="lecturer-modal-form">
            {/* Material Type */}
            <div className="lecturer-form-group">
              <label>Material Type *</label>
              <select
                value={noteMaterialType}
                onChange={(e) => setNoteMaterialType(e.target.value)}
                className="lecturer-form-select"
              >
                <option value="notes">📄 Notes / Documents (PDF, DOC, etc.)</option>
                <option value="video">🎬 Video Tutorials (MP4, etc.)</option>
              </select>
            </div>

            {/* Course Selection */}
            <div className="lecturer-form-group" style={{ background: "#e3f2fd", padding: "16px", borderRadius: "10px" }}>
              <label>Course *</label>
              <select
                value={noteCourseId}
                onChange={(e) => setNoteCourseId(e.target.value)}
                className="lecturer-form-select"
                required
              >
                <option value="">-- Select a course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code} - {course.course_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cohort Selection for ALL materials */}
            <div style={{ background: "#f0fff4", padding: "16px", borderRadius: "10px", border: "2px solid #388e3c" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#388e3c" }}>🎯 Target Cohort *</h4>
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={selectedCohort.academic_year}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Year *</label>
                  <select
                    value={selectedCohort.year_of_study}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, year_of_study: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Semester *</label>
                  <select
                    value={selectedCohort.semester}
                    onChange={(e) => setSelectedCohort({ ...selectedCohort, semester: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="lecturer-form-group">
              <label>{noteMaterialType === 'notes' ? 'Files *' : 'Video Files *'}</label>
              <div
                className="lecturer-file-upload-area"
                onClick={() => notesFileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#1976d2"; }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#007bff"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#007bff";
                  setNotesFiles(Array.from(e.dataTransfer.files));
                }}
                style={{
                  border: "2px dashed #007bff",
                  padding: "40px",
                  textAlign: "center",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: "#f8f9fa",
                }}
              >
                <input
                  type="file"
                  ref={notesFileInputRef}
                  multiple
                  accept={noteMaterialType === 'notes' ? '.pdf,.doc,.docx,.ppt,.pptx,.zip,.txt' : '.mp4,.mov,.avi,.mkv,.webm'}
                  onChange={(e) => setNotesFiles(Array.from(e.target.files || []))}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                  {noteMaterialType === 'notes' ? '📄' : '🎬'}
                </div>
                <p><strong>Drop files here or click to browse</strong></p>
                <p style={{ fontSize: "12px", color: "#999" }}>
                  {noteMaterialType === 'notes' ? 'PDF, DOC, DOCX, PPT, PPTX, ZIP' : 'MP4, MOV, AVI, MKV, WebM'}
                </p>
              </div>

              {uploadingNotes && (
                <div className="lecturer-upload-progress" style={{ marginTop: "12px" }}>
                  <div className="lecturer-progress-bar" style={{ background: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                    <div className="lecturer-progress-fill" style={{ width: `${notesUploadProgress}%`, background: "#1976d2", height: "100%", transition: "width 0.3s" }}></div>
                  </div>
                  <p style={{ textAlign: "center", marginTop: "4px", fontSize: "13px" }}>{notesUploadProgress}%</p>
                </div>
              )}

              {notesFiles.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <h4 style={{ fontSize: "14px" }}>Selected Files ({notesFiles.length})</h4>
                  {notesFiles.map((file, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#f1f3f5", borderRadius: "6px", marginBottom: "4px" }}>
                      <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <button onClick={() => setNotesFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lecturer-modal-actions">
              <button className="lecturer-cancel-btn" onClick={() => {
                if (uploadingNotes) cancelNotesUpload();
                setShowNotesUpload(false);
                setNotesFiles([]);
                setNoteCourseId('');
              }}>
                {uploadingNotes ? 'Stop Upload' : 'Cancel'}
              </button>
              <button
                className="lecturer-confirm-btn"
                onClick={uploadNotes}
                disabled={uploadingNotes || notesFiles.length === 0 || !noteCourseId || !selectedCohort.academic_year?.trim()}
              >
                {uploadingNotes ? 'Uploading...' : `📤 Upload ${noteMaterialType === 'video' ? 'Video' : 'Notes'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Materials List */}
      {loadingNotes ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading materials...</p>
        </div>
      ) : uploadedNotes.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.4 }}>📚</div>
          <h3>No materials uploaded yet</h3>
          <p style={{ color: "#777" }}>Upload notes, documents, or videos for your students</p>
        </div>
      ) : (
        <div className="lecturer-courses-grid">
          {uploadedNotes.map((note) => (
            <div key={note.id} className="lecturer-course-card">
              <div className="lecturer-course-header">
                <h3 style={{ fontSize: "16px" }}>
                  {note.icon} {note.title}
                </h3>
                <span style={{ fontSize: "12px", color: "#999" }}>
                  {note.uploadDateFormatted}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>
                <span>📂 {note.course}</span>
                <span style={{ marginLeft: "12px" }}>📄 {note.fileSizeFormatted}</span>
                {note.isVideo && <span style={{ marginLeft: "12px", color: "#1976d2" }}>🎬 Video</span>}
              </div>
              {note.academicYear && note.cohort && (
                <div style={{ fontSize: "12px", color: "#388e3c", marginTop: "8px" }}>
                  🎯 {note.academicYear} • {note.cohort.replace('_', ' ')}
                </div>
              )}
              <div className="lecturer-course-actions">
                <a
                  href={note.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="lecturer-course-btn"
                >
                  👁️ View
                </a>
                <button
                  className="lecturer-course-btn"
                  onClick={() => handleDeleteNote(note)}
                  disabled={deletingNoteId === note.id}
                  style={{ background: "#dc3545" }}
                >
                  {deletingNoteId === note.id ? "..." : "🗑️ Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LecturerNotesManager;