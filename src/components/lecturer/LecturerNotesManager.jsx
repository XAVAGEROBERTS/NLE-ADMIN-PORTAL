// LecturerNotesManager.jsx - Full version with document viewer + video modal
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import Modal from 'react-modal';

if (typeof window !== 'undefined') {
  Modal.setAppElement('#root');
}

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

  // Video Modal
  const [activeVideo, setActiveVideo] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  // Document View Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [noteContent, setNoteContent] = useState(null);

  const [selectedCohort, setSelectedCohort] = useState({
    academic_year: '',
    year_of_study: 1,
    semester: 1,
  });

  useEffect(() => {
    if (profile?.id) fetchUploadedNotes();
  }, [profile?.id]);

  // ==================== FETCH ====================
  const fetchUploadedNotes = async () => {
    if (!profile?.id) return;
    setLoadingNotes(true);

    try {
      const allFiles = [];

      // Notes bucket
      {
        const lecturerPrefix = `notes/${profile.id}`;
        const recurse = async (path = lecturerPrefix) => {
          const { data: items, error } = await supabase.storage
            .from('Notes')
            .list(path, { limit: 1000 });
          if (error || !items) return;

          for (const item of items) {
            if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
            const fullPath = `${path}/${item.name}`;
            if (item.id || item.metadata) {
              const { data: urlData } = supabase.storage.from('Notes').getPublicUrl(fullPath);
              allFiles.push({
                ...item,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: item.metadata?.size || 0,
                bucket: 'Notes',
                isVideo: false,
              });
            } else {
              await recurse(fullPath);
            }
          }
        };
        await recurse();
      }

      // Tutorials bucket
      {
        const lecturerPrefix = `tutorials/${profile.id}`;
        const recurse = async (path = lecturerPrefix) => {
          const { data: items, error } = await supabase.storage
            .from('Tutorials')
            .list(path, { limit: 1000 });
          if (error || !items) return;

          for (const item of items) {
            if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
            const fullPath = `${path}/${item.name}`;
            if (item.id || item.metadata) {
              const { data: urlData } = supabase.storage.from('Tutorials').getPublicUrl(fullPath);
              allFiles.push({
                ...item,
                fullPath,
                publicUrl: urlData.publicUrl,
                size: item.metadata?.size || 0,
                bucket: 'Tutorials',
                isVideo: true,
              });
            } else {
              await recurse(fullPath);
            }
          }
        };
        await recurse();
      }

      const processed = allFiles.map((file) => {
        const pathParts = (file.fullPath || file.name || '').split('/');
        const lastPart = pathParts[pathParts.length - 1] || file.name;

        const title = lastPart
          .replace(/\.[^.]+$/, '')
          .replace(/_\d{13}(_\d+)?$/, '')
          .replace(/_/g, ' ')
          .trim();

        let course = 'Unknown';
        let academicYear = '';
        let cohort = '';

        if (pathParts.length >= 8) {
          course = pathParts[3] || 'Unknown';
          const startYear = pathParts[4] || '';
          const endYear = pathParts[5] || '';
          academicYear = startYear && endYear ? `${startYear}/${endYear}` : '';
          cohort = pathParts[6] || '';
        }

        const fileSize = file.size || file.metadata?.size || 0;
        const uploadDate = file.created_at || new Date().toISOString();
        const fileExt = lastPart.split('.').pop()?.toLowerCase() || '';

        return {
          id: file.id || file.fullPath || file.name,
          name: file.fullPath || file.name,
          title: title || lastPart,
          course,
          academicYear,
          cohort,
          fileSize,
          fileSizeFormatted: formatFileSize(fileSize),
          uploadDate,
          uploadDateFormatted: new Date(uploadDate).toLocaleDateString(),
          downloadUrl: file.publicUrl,
          fileType: fileExt,
          icon: file.isVideo ? '🎬' : getFileIcon(lastPart),
          isVideo: !!file.isVideo,
          isViewable: isViewable(lastPart),
          bucket: file.bucket,
        };
      });

      processed.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
      setUploadedNotes(processed);
    } catch (error) {
      console.error('Error fetching notes:', error);
      showToast('Failed to load materials', 'error');
    } finally {
      setLoadingNotes(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    const iconMap = {
      pdf: '📄', doc: '📝', docx: '📝', ppt: '📊', pptx: '📊',
      xls: '📊', xlsx: '📊', txt: '📃', zip: '📦',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
      mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    };
    return iconMap[ext] || '📎';
  };

  const isViewable = (fileName) => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'doc', 'docx', 'ppt', 'pptx'].includes(ext);
  };

  const getFileExt = (fileName) => (fileName || '').split('.').pop()?.toLowerCase() || '';

  // ==================== DOCUMENT VIEWER ====================
  const handleViewNote = async (note) => {
    const fileType = note.fileType || getFileExt(note.name);

    if (!isViewable(note.name)) {
      showToast('This file type cannot be previewed. Opening download...', 'info');
      window.open(note.downloadUrl, '_blank');
      return;
    }

    setSelectedNote(note);
    setIsDocModalOpen(true);
    setIsNoteLoading(true);
    setNoteContent(null);

    try {
      // PDF / images / text
      if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'].includes(fileType)) {
        let fileUrl = note.downloadUrl;

        try {
          const { data: signed, error } = await supabase.storage
            .from(note.bucket || 'Notes')
            .createSignedUrl(note.name, 3600);
          if (!error && signed?.signedUrl) fileUrl = signed.signedUrl;
        } catch (_) {}

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to load: ${response.status}`);

        const blob = await response.blob();

        if (fileType === 'pdf') {
          setNoteContent({ type: 'pdf', url: URL.createObjectURL(blob) });
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
          setNoteContent({ type: 'image', url: URL.createObjectURL(blob) });
        } else if (fileType === 'txt') {
          setNoteContent({ type: 'text', content: await blob.text() });
        }
      }
      // Office → Microsoft Office Online Viewer
      else if (['doc', 'docx', 'ppt', 'pptx'].includes(fileType)) {
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(note.downloadUrl)}`;
        setNoteContent({
          type: 'office',
          url: officeViewerUrl,
          originalUrl: note.downloadUrl,
          fileType,
        });
      } else {
        setNoteContent({ type: 'unsupported', message: 'This file type cannot be previewed.' });
      }
    } catch (err) {
      console.error('Error loading note:', err);
      setNoteContent({
        type: 'error',
        message: 'Failed to load the document. Please try downloading it.',
      });
    } finally {
      setIsNoteLoading(false);
    }
  };

  const closeDocModal = () => {
    // Revoke blob URLs to free memory
    if (noteContent?.url && noteContent.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(noteContent.url);
      } catch (_) {}
    }
    setIsDocModalOpen(false);
    setSelectedNote(null);
    setNoteContent(null);
    setIsNoteLoading(false);
  };

  // ==================== VIDEO MODAL ====================
  const openVideoPlayer = (note) => {
    if (!note.downloadUrl) {
      showToast('Video source not available', 'error');
      return;
    }
    setActiveVideo(note);
    setIsModalOpen(true);
    setIsVideoLoading(true);
    setVideoError(false);
  };

  const closeModal = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsModalOpen(false);
    setActiveVideo(null);
    setIsVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoLoaded = () => {
    setIsVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setIsVideoLoading(false);
    setVideoError(true);
  };

  const downloadFile = (url, title, ext = '') => {
    if (!url) return;
    const safeTitle = (title || 'file')
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 100)
      .trim();
    const fileName = ext ? `${safeTitle}.${ext}` : safeTitle;

    const link = document.createElement('a');
    link.href = `${url}?download=${encodeURIComponent(fileName)}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Download started: ${fileName}`, 'success');
  };

  // ==================== UPLOAD / DELETE ====================
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
        .select('course_code, program_code')
        .eq('id', noteCourseId)
        .single();

      if (courseError || !courseData?.course_code) {
        showToast('Failed to fetch course details', 'error');
        return;
      }

      const courseCode = courseData.course_code;
      const programCode = courseData.program_code || 'GENERAL';
      const cleanCourseCode = courseCode.replace(/\s+/g, '');
      const academicYear = selectedCohort.academic_year.trim();
      const year = selectedCohort.year_of_study || 1;
      const semester = selectedCohort.semester || 1;
      const cohortString = `YEAR${year}_SEM${semester}`;
      const [startYear = '', endYear = ''] = academicYear.split('/').map((s) => s.trim());
      const timestamp = Date.now();

      for (let i = 0; i < notesFiles.length; i++) {
        if (notesUploadCancelledRef.current) {
          showToast('Upload cancelled', 'info');
          break;
        }

        const file = notesFiles[i];
        const fileExt = file.name.split('.').pop().toLowerCase();
        const originalName = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
        const safeFileName = `${originalName}_${timestamp}_${i}.${fileExt}`;

        let bucketName, fileName;
        if (noteMaterialType === 'video') {
          bucketName = 'Tutorials';
          fileName = `tutorials/${lecturerId}/${programCode}/${cleanCourseCode}/${startYear}/${endYear}/${cohortString}/${safeFileName}`;
        } else {
          bucketName = 'Notes';
          fileName = `notes/${lecturerId}/${programCode}/${cleanCourseCode}/${startYear}/${endYear}/${cohortString}/${safeFileName}`;
        }

        const { data: signedData, error: signError } = await supabase.storage
          .from(bucketName)
          .createSignedUploadUrl(fileName);

        if (signError || !signedData?.signedUrl) {
          showToast(`Failed to prepare upload for "${file.name}"`, 'error');
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
                setNotesUploadProgress(
                  Math.min(Math.round(((i + fileProgress) / notesFiles.length) * 100), 99)
                );
              }
            });
            xhr.addEventListener('load', () => {
              notesUploadXhrRef.current = null;
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Status ${xhr.status}`));
            });
            xhr.addEventListener('error', () => {
              notesUploadXhrRef.current = null;
              reject(new Error('Network error'));
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
          showToast(`Upload failed for "${file.name}"`, 'error');
        }
      }

      if (uploadedPaths.length > 0) {
        showToast(`✅ Successfully uploaded ${uploadedPaths.length} file(s)!`, 'success');
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
      const { error } = await supabase.storage.from(note.bucket).remove([note.name]);
      if (error) throw error;
      showToast('✅ Material deleted successfully!', 'success');
      fetchUploadedNotes();
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    } finally {
      setDeletingNoteId(null);
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <div>
          <h2>📚 Course Materials</h2>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>
            Share lecture notes, study materials, and tutorial videos with your students
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="lecturer-refresh-btn"
            onClick={fetchUploadedNotes}
            disabled={loadingNotes}
          >
            🔄 {loadingNotes ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="lecturer-add-btn"
            onClick={() => setShowNotesUpload(!showNotesUpload)}
          >
            {showNotesUpload ? '✕ Close' : '+ Upload Materials'}
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showNotesUpload && (
        <div
          style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '2px solid #e9ecef',
          }}
        >
          <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>📤 Upload New Materials</h3>

          <div className="lecturer-modal-form">
            <div className="lecturer-form-group">
              <label>Material Type *</label>
              <select
                value={noteMaterialType}
                onChange={(e) => setNoteMaterialType(e.target.value)}
                className="lecturer-form-select"
              >
                <option value="notes">📄 Notes / Documents</option>
                <option value="video">🎬 Video Tutorials</option>
              </select>
            </div>

            <div
              className="lecturer-form-group"
              style={{ background: '#e3f2fd', padding: '16px', borderRadius: '10px' }}
            >
              <label>Course *</label>
              <select
                value={noteCourseId}
                onChange={(e) => setNoteCourseId(e.target.value)}
                className="lecturer-form-select"
                required
              >
                <option value="">-- Select a course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                background: '#f0fff4',
                padding: '16px',
                borderRadius: '10px',
                border: '2px solid #388e3c',
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', color: '#388e3c' }}>🎯 Target Cohort *</h4>
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={selectedCohort.academic_year}
                    onChange={(e) =>
                      setSelectedCohort({
                        ...selectedCohort,
                        academic_year: e.target.value.trim(),
                      })
                    }
                    placeholder="e.g. 2025/2029"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Year *</label>
                  <select
                    value={selectedCohort.year_of_study}
                    onChange={(e) =>
                      setSelectedCohort({
                        ...selectedCohort,
                        year_of_study: parseInt(e.target.value),
                      })
                    }
                    className="lecturer-form-select"
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Semester *</label>
                  <select
                    value={selectedCohort.semester}
                    onChange={(e) =>
                      setSelectedCohort({
                        ...selectedCohort,
                        semester: parseInt(e.target.value),
                      })
                    }
                    className="lecturer-form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="lecturer-form-group">
              <label>{noteMaterialType === 'notes' ? 'Files *' : 'Video Files *'}</label>
              <div
                className="lecturer-file-upload-area"
                onClick={() => notesFileInputRef.current?.click()}
                style={{
                  border: '2px dashed #007bff',
                  padding: '40px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#f8f9fa',
                }}
              >
                <input
                  type="file"
                  ref={notesFileInputRef}
                  multiple
                  accept={
                    noteMaterialType === 'notes'
                      ? '.pdf,.doc,.docx,.ppt,.pptx,.zip,.txt'
                      : '.mp4,.mov,.avi,.mkv,.webm'
                  }
                  onChange={(e) => setNotesFiles(Array.from(e.target.files || []))}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                  {noteMaterialType === 'notes' ? '📄' : '🎬'}
                </div>
                <p>
                  <strong>Drop files here or click to browse</strong>
                </p>
              </div>

              {uploadingNotes && (
                <div style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      background: '#e0e0e0',
                      borderRadius: '4px',
                      height: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${notesUploadProgress}%`,
                        background: '#1976d2',
                        height: '100%',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <p style={{ textAlign: 'center', marginTop: '4px', fontSize: '13px' }}>
                    {notesUploadProgress}%
                  </p>
                </div>
              )}

              {notesFiles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {notesFiles.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        background: '#f1f3f5',
                        borderRadius: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      <span>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <button
                        onClick={() =>
                          setNotesFiles((p) => p.filter((_, i) => i !== index))
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lecturer-modal-actions">
              <button
                className="lecturer-cancel-btn"
                onClick={() => {
                  if (uploadingNotes) cancelNotesUpload();
                  setShowNotesUpload(false);
                  setNotesFiles([]);
                }}
              >
                {uploadingNotes ? 'Stop Upload' : 'Cancel'}
              </button>
              <button
                className="lecturer-confirm-btn"
                onClick={uploadNotes}
                disabled={
                  uploadingNotes ||
                  notesFiles.length === 0 ||
                  !noteCourseId ||
                  !selectedCohort.academic_year?.trim()
                }
              >
                {uploadingNotes ? 'Uploading...' : '📤 Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials List */}
      {loadingNotes ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading materials...</p>
        </div>
      ) : uploadedNotes.length === 0 ? (
        <div
          className="lecturer-empty-state"
          style={{
            background: 'white',
            padding: '60px',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.4 }}>📚</div>
          <h3>No materials uploaded yet</h3>
          <p style={{ color: '#777' }}>
            Upload notes, documents, or videos for your students
          </p>
        </div>
      ) : (
        <>
          {/* Notes section */}
          <div style={{ marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '3px solid #1976d2',
              }}
            >
              <h3 style={{ margin: 0, color: '#1565c0', fontSize: '18px' }}>
                📄 Notes / Documents
              </h3>
              <span
                style={{
                  background: '#1976d2',
                  color: 'white',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {uploadedNotes.filter((n) => !n.isVideo).length}
              </span>
            </div>

            {uploadedNotes.filter((n) => !n.isVideo).length === 0 ? (
              <div
                style={{
                  background: '#f8f9fa',
                  padding: '30px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                No notes uploaded yet
              </div>
            ) : (
              <div className="lecturer-courses-grid">
                {uploadedNotes
                  .filter((n) => !n.isVideo)
                  .map((note) => (
                    <div key={note.id} className="lecturer-course-card">
                      <div className="lecturer-course-header">
                        <h3 style={{ fontSize: '16px' }}>
                          {note.icon} {note.title}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#999' }}>
                          {note.uploadDateFormatted}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        <span>📂 {note.course}</span>
                        <span style={{ marginLeft: '12px' }}>
                          📄 {note.fileSizeFormatted}
                        </span>
                      </div>
                      {note.academicYear && note.cohort && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#388e3c',
                            marginTop: '8px',
                          }}
                        >
                          🎯 {note.academicYear} • {note.cohort.replace('_', ' ')}
                        </div>
                      )}
                      <div className="lecturer-course-actions">
                        <button
                          className="lecturer-course-btn"
                          onClick={() => handleViewNote(note)}
                          style={{ background: '#1976d2', color: 'white' }}
                        >
                          👁️ View
                        </button>
                        <button
                          className="lecturer-course-btn"
                          onClick={() =>
                            downloadFile(note.downloadUrl, note.title, note.fileType)
                          }
                          style={{ background: '#28a745', color: 'white' }}
                        >
                          ⬇️ Download
                        </button>
                        <button
                          className="lecturer-course-btn"
                          onClick={() => handleDeleteNote(note)}
                          disabled={deletingNoteId === note.id}
                          style={{ background: '#dc3545' }}
                        >
                          {deletingNoteId === note.id ? '...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Videos section */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '3px solid #7b1fa2',
              }}
            >
              <h3 style={{ margin: 0, color: '#6a1b9a', fontSize: '18px' }}>
                🎬 Tutorials / Videos
              </h3>
              <span
                style={{
                  background: '#7b1fa2',
                  color: 'white',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {uploadedNotes.filter((n) => n.isVideo).length}
              </span>
            </div>

            {uploadedNotes.filter((n) => n.isVideo).length === 0 ? (
              <div
                style={{
                  background: '#f8f9fa',
                  padding: '30px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: '#777',
                }}
              >
                No tutorials / videos uploaded yet
              </div>
            ) : (
              <div className="lecturer-courses-grid">
                {uploadedNotes
                  .filter((n) => n.isVideo)
                  .map((note) => (
                    <div key={note.id} className="lecturer-course-card">
                      <div className="lecturer-course-header">
                        <h3 style={{ fontSize: '16px' }}>
                          {note.icon} {note.title}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#999' }}>
                          {note.uploadDateFormatted}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        <span>📂 {note.course}</span>
                        <span style={{ marginLeft: '12px' }}>
                          📄 {note.fileSizeFormatted}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#7b1fa2' }}>
                          🎬 Video
                        </span>
                      </div>
                      {note.academicYear && note.cohort && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#388e3c',
                            marginTop: '8px',
                          }}
                        >
                          🎯 {note.academicYear} • {note.cohort.replace('_', ' ')}
                        </div>
                      )}
                      <div className="lecturer-course-actions">
                        <button
                          className="lecturer-course-btn"
                          onClick={() => openVideoPlayer(note)}
                          style={{ background: '#7b1fa2', color: 'white' }}
                        >
                          ▶️ Play
                        </button>
                        <button
                          className="lecturer-course-btn"
                          onClick={() =>
                            downloadFile(note.downloadUrl, note.title, 'mp4')
                          }
                          style={{ background: '#28a745', color: 'white' }}
                        >
                          ⬇️ Download
                        </button>
                        <button
                          className="lecturer-course-btn"
                          onClick={() => handleDeleteNote(note)}
                          disabled={deletingNoteId === note.id}
                          style={{ background: '#dc3545' }}
                        >
                          {deletingNoteId === note.id ? '...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== DOCUMENT VIEW MODAL ==================== */}
      <Modal
        isOpen={isDocModalOpen}
        onRequestClose={closeDocModal}
        className="lecturer-doc-modal"
        overlayClassName="lecturer-doc-modal-overlay"
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
      >
        {selectedNote && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '950px',
              width: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                background: '#f8f9fa',
                borderBottom: '1px solid #e9ecef',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <h2
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#1a1a1a',
                  }}
                >
                  {selectedNote.title}
                </h2>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#666',
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>📂 {selectedNote.course}</span>
                  <span>📎 {(selectedNote.fileType || '').toUpperCase()}</span>
                  {selectedNote.academicYear && (
                    <span>
                      🎯 {selectedNote.academicYear} •{' '}
                      {(selectedNote.cohort || '').replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() =>
                    downloadFile(
                      selectedNote.downloadUrl,
                      selectedNote.title,
                      selectedNote.fileType
                    )
                  }
                  style={{
                    padding: '6px 12px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={closeDocModal}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: '#6c757d',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px', flex: 1, overflow: 'auto', background: '#fff' }}>
              {isNoteLoading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '65vh',
                    gap: '12px',
                  }}
                >
                  <div className="lecturer-spinner" />
                  <p>Loading document...</p>
                </div>
              ) : noteContent ? (
                <>
                  {noteContent.type === 'pdf' && (
                    <iframe
                      src={noteContent.url}
                      title={selectedNote.title}
                      style={{
                        width: '100%',
                        height: '70vh',
                        border: 'none',
                        borderRadius: '8px',
                      }}
                    />
                  )}
                  {noteContent.type === 'image' && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '70vh',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                      }}
                    >
                      <img
                        src={noteContent.url}
                        alt={selectedNote.title}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  )}
                  {noteContent.type === 'text' && (
                    <div
                      style={{
                        padding: '20px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        maxHeight: '70vh',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontSize: '14px',
                        lineHeight: 1.6,
                      }}
                    >
                      {noteContent.content}
                    </div>
                  )}
                  {noteContent.type === 'office' && (
                    <iframe
                      src={noteContent.url}
                      title={selectedNote.title}
                      style={{
                        width: '100%',
                        height: '70vh',
                        border: 'none',
                        borderRadius: '8px',
                      }}
                      allowFullScreen
                    />
                  )}
                  {(noteContent.type === 'unsupported' ||
                    noteContent.type === 'error') && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '50vh',
                        textAlign: 'center',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '48px' }}>
                        {noteContent.type === 'error' ? '⚠️' : '📄'}
                      </div>
                      <h3>{noteContent.message}</h3>
                      <button
                        onClick={() =>
                          downloadFile(
                            selectedNote.downloadUrl,
                            selectedNote.title,
                            selectedNote.fileType
                          )
                        }
                        style={{
                          padding: '10px 20px',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ⬇️ Download Instead
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== VIDEO MODAL ==================== */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        className="lecturer-video-modal"
        overlayClassName="lecturer-video-modal-overlay"
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
      >
        {activeVideo && (
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '900px',
              width: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                padding: '16px 24px',
                background: '#f8f9fa',
                borderBottom: '1px solid #e9ecef',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <h2
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {activeVideo.title}
                </h2>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  📂 {activeVideo.course}
                  {activeVideo.academicYear && (
                    <span>
                      {' '}
                      • 🎯 {activeVideo.academicYear} •{' '}
                      {(activeVideo.cohort || '').replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() =>
                    downloadFile(activeVideo.downloadUrl, activeVideo.title, 'mp4')
                  }
                  style={{
                    padding: '6px 12px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={closeModal}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', background: '#000', paddingTop: '56.25%' }}>
              {isVideoLoading && !videoError && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    zIndex: 2,
                    background: '#000',
                  }}
                >
                  <div
                    className="lecturer-spinner"
                    style={{
                      borderColor: 'rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                    }}
                  />
                  <p style={{ color: 'white', margin: 0 }}>Loading video...</p>
                </div>
              )}

              {videoError ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    color: 'white',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '48px' }}>⚠️</div>
                  <h3 style={{ margin: 0 }}>Video Playback Error</h3>
                  <button
                    onClick={() =>
                      downloadFile(activeVideo.downloadUrl, activeVideo.title, 'mp4')
                    }
                    style={{
                      padding: '8px 16px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ⬇️ Download Video
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={activeVideo.downloadUrl}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: isVideoLoading ? 0 : 1,
                    transition: 'opacity 0.2s',
                  }}
                  controls
                  preload="metadata"
                  playsInline
                  onLoadedData={handleVideoLoaded}
                  onCanPlay={handleVideoLoaded}
                  onError={handleVideoError}
                  autoPlay
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .lecturer-video-modal-overlay,
        .lecturer-doc-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .lecturer-video-modal,
        .lecturer-doc-modal {
          outline: none;
          border: none;
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default LecturerNotesManager;