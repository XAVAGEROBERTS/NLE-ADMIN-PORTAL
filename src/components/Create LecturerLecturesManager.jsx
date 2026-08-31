// LecturerLecturesManager.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const LecturerLecturesManager = ({ profile, courses, showToast }) => {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState(null);

  const [newLecture, setNewLecture] = useState({
    course_id: "",
    title: "",
    description: "",
    google_meet_link: "",
    scheduled_date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "11:00",
    status: "scheduled",
  });

  const [editLecture, setEditLecture] = useState({
    title: "",
    description: "",
    google_meet_link: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
  });

  // Cohort selection
  const [selectedCohort, setSelectedCohort] = useState({
    academic_year: "",
    year_of_study: 1,
    semester: 1,
  });
  const [cohortError, setCohortError] = useState("");

  useEffect(() => {
    fetchLectures();
  }, [profile?.id]);

  const fetchLectures = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lectures")
        .select(`
          *,
          courses (id, course_code, course_name, department_code)
        `)
        .eq("lecturer_id", profile.id)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Process lectures
      const processed = (data || []).map(lecture => {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const isToday = lecture.scheduled_date === today;

        let status = lecture.status || "scheduled";
        if (isToday && status === "scheduled") {
          const startMinutes = parseInt(lecture.start_time.split(":")[0]) * 60 + parseInt(lecture.start_time.split(":")[1] || 0);
          const endMinutes = parseInt(lecture.end_time.split(":")[0]) * 60 + parseInt(lecture.end_time.split(":")[1] || 0);
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
            status = "ongoing";
          }
        }

        const lectureDate = new Date(lecture.scheduled_date);
        const formattedDate = lectureDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const formatTime = (timeStr) => {
          if (!timeStr) return "TBD";
          const [hours, minutes] = timeStr.split(":");
          const hourNum = parseInt(hours);
          const minuteStr = minutes || "00";
          const ampm = hourNum >= 12 ? "PM" : "AM";
          const displayHour = hourNum % 12 || 12;
          return `${displayHour}:${minuteStr.padStart(2, "0")} ${ampm}`;
        };

        return {
          ...lecture,
          formattedDate,
          formattedTime: `${formatTime(lecture.start_time)} - ${formatTime(lecture.end_time)}`,
          status: status,
          isLiveNow: status === "ongoing",
        };
      });

      setLectures(processed);
    } catch (error) {
      console.error("Error fetching lectures:", error);
      showToast("Failed to load lectures", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLecture = async () => {
    if (!selectedCohort.academic_year?.trim()) {
      setCohortError("Academic Year required");
      return;
    }

    try {
      const start = new Date(`${newLecture.scheduled_date}T${newLecture.start_time}`);
      const end = new Date(`${newLecture.scheduled_date}T${newLecture.end_time}`);
      const durationMinutes = Math.round((end - start) / (1000 * 60));

      if (durationMinutes <= 0) {
        showToast("End time must be after start time", 'error');
        return;
      }

      const { data: courseData } = await supabase
        .from("courses")
        .select("department_code")
        .eq("id", newLecture.course_id)
        .single();

      const lectureData = {
        ...newLecture,
        lecturer_id: profile.id,
        duration_minutes: durationMinutes,
        lecturer_department_code: courseData?.department_code || null,
        target_academic_year: selectedCohort.academic_year.trim(),
        target_year_of_study: selectedCohort.year_of_study,
        target_semester: selectedCohort.semester,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("lectures").insert([lectureData]);
      if (error) throw error;

      showToast("✅ Lecture scheduled successfully!", 'success');
      setShowLectureModal(false);
      setNewLecture({
        course_id: "",
        title: "",
        description: "",
        google_meet_link: "",
        scheduled_date: new Date().toISOString().slice(0, 10),
        start_time: "09:00",
        end_time: "11:00",
        status: "scheduled",
      });
      setSelectedCohort({ academic_year: "", year_of_study: 1, semester: 1 });
      setCohortError("");
      fetchLectures();
    } catch (error) {
      console.error("Error adding lecture:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const handleStartLecture = async (lectureId) => {
    try {
      const { error } = await supabase
        .from("lectures")
        .update({ status: "ongoing", updated_at: new Date().toISOString() })
        .eq("id", lectureId);
      if (error) throw error;
      showToast("Lecture started!", 'success');
      fetchLectures();
    } catch (error) {
      console.error("Error starting lecture:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const handleEndLecture = async (lectureId) => {
    try {
      const { error } = await supabase
        .from("lectures")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", lectureId);
      if (error) throw error;
      showToast("Lecture ended!", 'success');
      fetchLectures();
    } catch (error) {
      console.error("Error ending lecture:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm("Delete this lecture?")) return;

    try {
      const { error } = await supabase
        .from("lectures")
        .delete()
        .eq("id", lectureId)
        .eq("lecturer_id", profile.id);
      if (error) throw error;
      showToast("Lecture deleted", 'success');
      fetchLectures();
    } catch (error) {
      console.error("Error deleting lecture:", error);
      showToast("Error: " + error.message, 'error');
    }
  };

  const liveLectures = lectures.filter(l => l.status === "ongoing");
  const upcomingLectures = lectures.filter(l => l.status === "scheduled");
  const pastLectures = lectures.filter(l => l.status === "completed");

  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>🎓 My Lectures</h2>
        <button className="lecturer-add-btn" onClick={() => setShowLectureModal(true)}>
          + Schedule Lecture
        </button>
      </div>

      {loading ? (
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading lectures...</p>
        </div>
      ) : (
        <>
          {/* Live Lectures */}
          {liveLectures.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ color: "#d32f2f" }}>🔴 Live Lectures</h3>
              <div className="lecturer-courses-grid">
                {liveLectures.map(lecture => (
                  <div key={lecture.id} className="lecturer-course-card" style={{ border: "2px solid #d32f2f" }}>
                    <div className="lecturer-course-header">
                      <h3>{lecture.courses?.course_code}: {lecture.title}</h3>
                      <span className="lecturer-status-badge" style={{ background: "#d32f2f", color: "white" }}>🔴 LIVE</span>
                    </div>
                    <p>{lecture.description}</p>
                    <div className="lecturer-course-details">
                      <span>📅 {lecture.formattedDate}</span>
                      <span>⏰ {lecture.formattedTime}</span>
                      <span>🏛️ {lecture.courses?.department_code}</span>
                    </div>
                    <div className="lecturer-course-actions">
                      {lecture.google_meet_link && (
                        <a href={lecture.google_meet_link} target="_blank" rel="noreferrer" className="lecturer-course-btn" style={{ background: "#28a745" }}>
                          🎥 Join Meet
                        </a>
                      )}
                      <button className="lecturer-course-btn" onClick={() => handleEndLecture(lecture.id)} style={{ background: "#dc3545" }}>
                        End
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Lectures */}
          <div style={{ marginBottom: "24px" }}>
            <h3>📅 Upcoming Lectures</h3>
            {upcomingLectures.length === 0 ? (
              <p style={{ color: "#999", padding: "20px" }}>No upcoming lectures</p>
            ) : (
              <div className="lecturer-courses-grid">
                {upcomingLectures.map(lecture => (
                  <div key={lecture.id} className="lecturer-course-card">
                    <div className="lecturer-course-header">
                      <h3>{lecture.courses?.course_code}: {lecture.title}</h3>
                      <span className="lecturer-status-badge" style={{ background: "#1976d2", color: "white" }}>SCHEDULED</span>
                    </div>
                    <p>{lecture.description}</p>
                    <div className="lecturer-course-details">
                      <span>📅 {lecture.formattedDate}</span>
                      <span>⏰ {lecture.formattedTime}</span>
                      <span>🏛️ {lecture.courses?.department_code}</span>
                    </div>
                    <div className="lecturer-course-actions">
                      <button className="lecturer-course-btn" onClick={() => handleStartLecture(lecture.id)} style={{ background: "#28a745" }}>
                        Start Now
                      </button>
                      <button className="lecturer-course-btn" onClick={() => handleDeleteLecture(lecture.id)} style={{ background: "#dc3545" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Lectures */}
          {pastLectures.length > 0 && (
            <div>
              <h3>✅ Past Lectures</h3>
              <div className="lecturer-table-container">
                <table className="lecturer-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Course</th>
                      <th>Title</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastLectures.slice(0, 10).map(lecture => (
                      <tr key={lecture.id}>
                        <td>{lecture.formattedDate}</td>
                        <td>{lecture.courses?.course_code}</td>
                        <td>{lecture.title}</td>
                        <td>{lecture.formattedTime}</td>
                        <td><span className="lecturer-status-badge completed">✅ Completed</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Schedule Lecture Modal */}
      {showLectureModal && (
        <div className="lecturer-modal-overlay" onClick={() => setShowLectureModal(false)}>
          <div className="lecturer-modal" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <h3>Schedule New Lecture</h3>

            {/* Cohort Selection */}
            <div style={{ background: "#f0fff4", padding: "16px", borderRadius: "10px", marginBottom: "20px", border: "2px solid #388e3c" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#388e3c" }}>🎯 Target Cohort</h4>
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
              {cohortError && <p style={{ color: "#d32f2f" }}>⚠️ {cohortError}</p>}
            </div>

            <div className="lecturer-modal-form">
              <div className="lecturer-form-group">
                <label>Course *</label>
                <select
                  value={newLecture.course_id}
                  onChange={(e) => setNewLecture({ ...newLecture, course_id: e.target.value })}
                  className="lecturer-form-select"
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
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
                  value={newLecture.title}
                  onChange={(e) => setNewLecture({ ...newLecture, title: e.target.value })}
                  placeholder="Lecture title"
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-form-group">
                <label>Description</label>
                <textarea
                  value={newLecture.description}
                  onChange={(e) => setNewLecture({ ...newLecture, description: e.target.value })}
                  placeholder="Lecture description"
                  rows="2"
                  className="lecturer-form-textarea"
                />
              </div>

              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={newLecture.scheduled_date}
                    onChange={(e) => setNewLecture({ ...newLecture, scheduled_date: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    value={newLecture.start_time}
                    onChange={(e) => setNewLecture({ ...newLecture, start_time: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
                <div className="lecturer-form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    value={newLecture.end_time}
                    onChange={(e) => setNewLecture({ ...newLecture, end_time: e.target.value })}
                    className="lecturer-form-input"
                  />
                </div>
              </div>

              <div className="lecturer-form-group">
                <label>Google Meet Link (Optional)</label>
                <input
                  type="url"
                  value={newLecture.google_meet_link}
                  onChange={(e) => setNewLecture({ ...newLecture, google_meet_link: e.target.value })}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="lecturer-form-input"
                />
              </div>

              <div className="lecturer-modal-actions">
                <button className="lecturer-cancel-btn" onClick={() => setShowLectureModal(false)}>
                  Cancel
                </button>
                <button className="lecturer-confirm-btn" onClick={handleAddLecture}>
                  Schedule Lecture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerLecturesManager;