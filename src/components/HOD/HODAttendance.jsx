// HODAttendance.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODAttendance = ({ departmentCode, courses, students, fetchHODData }) => {
  const [todayLectures, setTodayLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  useEffect(() => {
    fetchTodayLectures();
  }, [departmentCode]);

  const fetchTodayLectures = async () => {
    setLoadingLectures(true);
    const dayOfWeek = new Date().getDay();
    try {
      const { data: timetables } = await supabase
        .from('program_timetables')
        .select('id')
        .eq('department_code', departmentCode)
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

      // Get lecturer names
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
          course_name: courses.find(c => c.course_code === slot.course_code)?.course_name || slot.course_code,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLectures(false);
    }
  };

  const fetchEnrolledStudents = async (slot) => {
    if (!slot?.course_code) return;
    
    try {
      // Find the course by code
      const course = courses.find(c => c.course_code === slot.course_code);
      if (!course) {
        alert('Course not found');
        return;
      }

      const { data: studentCourses } = await supabase
        .from('student_courses')
        .select('student_id')
        .eq('course_id', course.id)
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
        .eq('course_id', course.id)
        .eq('date', today)
        .in('student_id', studentIds);

      if (existing) {
        existing.forEach((r) => (initial[r.student_id] = r.status));
        setAttendanceStatus({ ...initial });
      }

      setSelectedLecture(slot);
      setShowAttendanceModal(true);
    } catch (err) {
      console.error(err);
      alert('Error fetching students: ' + err.message);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedLecture?.course_code) return;
    
    setSavingAttendance(true);
    try {
      const course = courses.find(c => c.course_code === selectedLecture.course_code);
      if (!course) {
        alert('Course not found');
        setSavingAttendance(false);
        return;
      }

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
          .eq('course_id', course.id)
          .eq('date', today)
          .maybeSingle();

        const record = {
          student_id: student.id,
          course_id: course.id,
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

  return (
    <div className="hod-section">
      <h2 className="hod-section-title">✅ Record Attendance</h2>
      
      <div className="hod-section-actions">
        <button className="hod-refresh-btn" onClick={fetchTodayLectures}>
          🔄 Refresh
        </button>
      </div>

      {loadingLectures ? (
        <div className="hod-loading">Loading lectures...</div>
      ) : todayLectures.length === 0 ? (
        <div className="hod-empty">
          <span>📭</span>
          <h3>No Lectures Today</h3>
          <p>No lectures scheduled for today in your department</p>
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
                onClick={() => fetchEnrolledStudents(slot)}
              >
                📝 Record
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedLecture && (
        <div className="hod-modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="hod-modal hod-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📝 Record Attendance – {selectedLecture.course_code}</h3>
              <button onClick={() => setShowAttendanceModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-attendance-actions">
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
                >
                  ❌ All Absent
                </button>
                <span className="hod-attendance-count">
                  {enrolledStudents.length} students
                </span>
              </div>

              {enrolledStudents.length === 0 ? (
                <div className="hod-empty">
                  <span>📭</span>
                  <h3>No Students Enrolled</h3>
                  <p>No students are enrolled in this course</p>
                </div>
              ) : (
                <div className="hod-attendance-table-wrapper">
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
                              className="hod-attendance-select"
                            >
                              <option value="present">✅ Present</option>
                              <option value="absent">❌ Absent</option>
                              <option value="late">🕒 Late</option>
                              <option value="excused">📝 Excused</option>
                              <option value="medical">🏥 Medical</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowAttendanceModal(false)}>Cancel</button>
              <button 
                className="hod-save-btn" 
                onClick={handleSaveAttendance} 
                disabled={savingAttendance || enrolledStudents.length === 0}
              >
                {savingAttendance ? 'Saving...' : '💾 Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODAttendance;