// LecturerExamsManager.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const LecturerExamsManager = ({ profile, courses, programs, programsLoading, showToast }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examFiles, setExamFiles] = useState([]);
  const [uploadingExamFiles, setUploadingExamFiles] = useState(false);
  const [examUploadProgress, setExamUploadProgress] = useState(0);
  const examFileInputRef = useRef(null);

  const [newExam, setNewExam] = useState({
    course_id: "",
    title: "",
    description: "",
    exam_type: "written",
    submission_type: "both",
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    venue: "",
    status: "published",
  });

  const [examTargetProgram, setExamTargetProgram] = useState("");
  const [examTargetCohort, setExamTargetCohort] = useState({
    academic_year: "",
    year_of_study: 1,
    semester: 1,
  });
  const [examCohortError, setExamCohortError] = useState("");
  const [examFilteredCourses, setExamFilteredCourses] = useState([]);

  useEffect(() => {
    fetchExams();
  }, [profile?.id]);

  useEffect(() => {
    if (examTargetProgram) {
      const selectedProg = programs.find(p => p.id === examTargetProgram);
      if (selectedProg?.code) {
        const filtered = courses.filter(
          course => course.program_code === selectedProg.code && course.is_active
        );
        setExamFilteredCourses(filtered);
      }
    } else {
      setExamFilteredCourses([]);
    }
  }, [examTargetProgram, programs, courses]);

  const fetchExams = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("examinations")
        .select(`
          *,
          courses (course_code, course_name, department_code)
        `)
        .eq("lecturer_id", profile.id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error("Error fetching exams:", error);
      showToast("Failed to load exams", 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadExamFiles = async (files) => {
    if (!files || files.length === 0) return [];
    const uploadedPaths = [];
    setUploadingExamFiles(true);
    setExamUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const originalName = file.name;
        const timestamp = Date.now();
        const safeName = originalName.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `${timestamp}_${safeName}`;
        const filePath = `exams/${profile.id}/${fileName}`;

        setExamUploadProgress(Math.round(((i + 1) / files.length) * 100));

        const { error } = await supabase.storage
          .from("Lecturer exam")
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          console.error(`Failed to upload ${originalName}:`, error);
          showToast(`Failed to upload "${originalName}"`, 'error');
          continue;
        }

        uploadedPaths.push(filePath);
      }
      showToast(`✅ Uploaded ${uploadedPaths.length} exam file(s)!`, 'success');
      return uploadedPaths;
    } catch (error) {
      console.error("Exam upload error:", error);
      showToast("Upload failed: " + error.message, 'error');
      return [];
    } finally {
      setUploadingExamFiles(false);
      setExamUploadProgress(0);
    }
  };

  const handleAddExam = async () => {
    if (!examTargetProgram) {
      setExamCohortError("Please select a Program");
      return;
    }
    if (!examTargetCohort.academic_year.trim()) {
      setExamCohortError("Please enter Academic Year");
      return;
    }

    try {
      let uploadedExamFiles = [];
      if (newExam.submission_type === 'file' || newExam.submission_type === 'both') {
        if (examFiles.length > 0) {
          uploadedExamFiles = await uploadExamFiles(examFiles);
        }
      }

      const start = new Date(newExam.start_time);
      const end = new Date(newExam.end_time);
      const durationMinutes = Math.round((end - start) / 60000);

      if (durationMinutes <= 0) {
        showToast("End time must be after start time", 'error');
        return;
      }

      const examData = {
        ...newExam,
        lecturer_id: profile.id,
        status: "published",
        target_academic_year: examTargetCohort.academic_year.trim(),
        target_year_of_study: examTargetCohort.year_of_study,
        target_semester: examTargetCohort.semester,
        target_program_id: examTargetProgram,
        duration_minutes: durationMinutes,
        exam_files: uploadedExamFiles,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("examinations").insert([examData]);
      if (error) throw error;

      showToast("✅ Exam scheduled successfully!", 'success');
      
      setShowExamsModal(false);
      setNewExam({
        course_id: "",
        title: "",
        description: "",
        exam_type: "written",
        submission_type: "both",
        start_time: "",
        end_time: "",
        total_marks: 100,
        venue: "",
        status: "published",
      });
      setExamFiles([]);
      setExamTargetProgram("");
      setExamTargetCohort({ academic_year: "", year_of_study: 1, semester: 1 });
      setExamCohortError("");
      fetchExams();
    } catch (error) {
      console.error("Error scheduling exam:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;

    try {
      const { error } = await supabase
        .from("examinations")
        .delete()
        .eq("id", examId)
        .eq("lecturer_id", profile.id);

      if (error) throw error;
      showToast("Exam deleted successfully!", 'success');
      fetchExams();
    } catch (error) {
      console.error("Error deleting exam:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    if (now >= start && now <= end) return "active";
    if (now < start) return "upcoming";
    return "ended";
  };

  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>🎯 Exam Management</h2>
        <button className="lecturer-add-btn" onClick={() => setShowExamsModal(true)}>
          + Schedule Exam
        </button>
      </div>

      {loading ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: "white", padding: "60px", borderRadius: "12px", textAlign: "center" }}>
          <p>No exams scheduled</p>
          <button className="lecturer-add-btn" onClick={() => setShowExamsModal(true)}>
            Schedule Your First Exam
          </button>
        </div>
      ) : (
        <div className="lecturer-courses-grid">
          {exams.map((exam) => {
            const status = getExamStatus(exam);
            return (
              <div key={exam.id} className="lecturer-course-card">
                <div className="lecturer-course-header">
                  <div>
                    <h3>{exam.title}</h3>
                    <p style={{ fontSize: "14px", color: "#666", margin: "4px 0" }}>
                      {exam.courses?.course_code} - {exam.courses?.course_name}
                    </p>
                  </div>
                  <span className={`lecturer-status-badge ${status}`}>
                    {status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: "8px 0", color: "#555" }}>{exam.description}</p>

                <div className="lecturer-course-details">
                  <span>📅 {new Date(exam.start_time).toLocaleDateString()}</span>
                  <span>⏰ {new Date(exam.start_time).toLocaleTimeString()} - {new Date(exam.end_time).toLocaleTimeString()}</span>
                  <span>📊 {exam.total_marks} marks</span>
                  <span>📍 {exam.venue || "Online"}</span>
                </div>

                <div style={{ fontSize: "13px", color: "#666", margin: "8px 0" }}>
                  🎯 Cohort: {exam.target_academic_year || "N/A"} • Y{exam.target_year_of_study || "?"} S{exam.target_semester || "?"}
                </div>

                <div className="lecturer-course-actions">
                  <button
                    className="lecturer-course-btn"
                    onClick={() => setEditingExam(exam)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="lecturer-course-btn"
                    onClick={() => handleDeleteExam(exam.id)}
                    style={{ background: "#dc3545" }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Exam Modal */}
      {showExamsModal && (
        <div className="lecturer-modal-overlay" onClick={() => setShowExamsModal(false)}>
          <div className="lecturer-modal" style={{ maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
            <h3>Schedule New Exam</h3>

            {/* Target Cohort */}
            <div style={{ background: "#ffebee", padding: "16px", borderRadius: "10px", marginBottom: "20px", border: "2px solid #c62828" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#c62828" }}>🎯 Target Cohort</h4>
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Program *</label>
                  <select
                    value={examTargetProgram}
                    onChange={(e) => {
                      setExamTargetProgram(e.target.value);
                      setNewExam({ ...newExam, course_id: "" });
                    }}
                    className="lecturer-form-select"
                  >
                    <option value="">Select Program</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    value={examTargetCohort.academic_year}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Year *</label>
                  <select
                    value={examTargetCohort.year_of_study}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, year_of_study: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Semester *</label>
                  <select
                    value={examTargetCohort.semester}
                    onChange={(e) => setExamTargetCohort({ ...examTargetCohort, semester: parseInt(e.target.value) })}
                    className="lecturer-form-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
              {examCohortError && <p style={{ color: "#d32f2f", marginTop: "8px" }}>⚠️ {examCohortError}</p>}
            </div>

            <div className="lecturer-modal-form">
              <div className="lecturer-form-group">
                <label>Course *</label>
                <select
                  value={newExam.course_id}
                  onChange={(e) => setNewExam({ ...newExam, course_id: e.target.value })}
                  className="lecturer-form-select"
                  disabled={!examTargetProgram}
                >
                  <option value="">
                    {examTargetProgram ? (examFilteredCourses.length === 0 ? "No courses available" : "Select Course") : "Select Program first"}
                  </option>
                  {examFilteredCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lecturer-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={newExam.title}
                  onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                  placeholder="e.g. Midterm Examination"
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Description</label>
                <textarea
                  value={newExam.description}
                  onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                  placeholder="Brief description"
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newExam.start_time}
                    onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>End Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newExam.end_time}
                    onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    value={newExam.total_marks}
                    onChange={(e) => setNewExam({ ...newExam, total_marks: parseInt(e.target.value) || 100 })}
                    min="1"
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Venue</label>
                  <input
                    type="text"
                    value={newExam.venue}
                    onChange={(e) => setNewExam({ ...newExam, venue: e.target.value })}
                    placeholder="e.g. Main Hall, Online"
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Exam Type</label>
                  <select
                    value={newExam.exam_type}
                    onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                    className="lecturer-form-select"
                  >
                    <option value="written">Written</option>
                    <option value="practical">Practical</option>
                    <option value="online">Online</option>
                    <option value="oral">Oral</option>
                  </select>
                </div>
                <div className="lecturer-form-group">
                  <label>Submission Type</label>
                  <select
                    value={newExam.submission_type}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewExam({ ...newExam, submission_type: value });
                      if (value === 'text') setExamFiles([]);
                    }}
                    className="lecturer-form-select"
                  >
                    <option value="text">📝 Text Answer Only</option>
                    <option value="file">📎 File Upload Only</option>
                    <option value="both">📝 Text + File Upload</option>
                  </select>
                </div>
              </div>

              {newExam.submission_type !== "text" && (
                <div className="lecturer-form-group">
                  <label>Exam Files</label>
                  <div
                    className="lecturer-file-upload-area"
                    onClick={() => examFileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #1976d2",
                      padding: "30px",
                      textAlign: "center",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: "#f8f9fa"
                    }}
                  >
                    <input
                      type="file"
                      ref={examFileInputRef}
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                      onChange={(e) => setExamFiles(Array.from(e.target.files || []))}
                      style={{ display: "none" }}
                    />
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>📤</div>
                    <p><strong>Upload exam papers</strong></p>
                    <p style={{ fontSize: "12px", color: "#999" }}>PDF, Word, PPT, ZIP</p>
                  </div>

                  {uploadingExamFiles && (
                    <div className="lecturer-upload-progress" style={{ marginTop: "12px" }}>
                      <div className="lecturer-progress-bar" style={{ background: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                        <div className="lecturer-progress-fill" style={{ width: `${examUploadProgress}%`, background: "#1976d2", height: "100%", transition: "width 0.3s" }}></div>
                      </div>
                      <p style={{ textAlign: "center", marginTop: "4px", fontSize: "13px" }}>{examUploadProgress}%</p>
                    </div>
                  )}

                  {examFiles.length > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <h4 style={{ fontSize: "14px" }}>Selected Files ({examFiles.length})</h4>
                      {examFiles.map((file, index) => (
                        <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#f1f3f5", borderRadius: "6px", marginBottom: "4px" }}>
                          <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <button onClick={() => setExamFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer" }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="lecturer-modal-actions">
                <button className="lecturer-cancel-btn" onClick={() => setShowExamsModal(false)}>
                  Cancel
                </button>
                <button className="lecturer-confirm-btn" onClick={handleAddExam}>
                  Schedule Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerExamsManager;