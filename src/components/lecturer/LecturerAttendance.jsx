// lecturer/LecturerAttendance.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const LecturerAttendance = ({ profile, courses, showToast }) => {
  // ===== MODE =====
  const [mode, setMode] = useState('record'); // 'record' | 'history'

  // ===== RECORD ATTENDANCE STATE =====
  const [todayLectures, setTodayLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // ===== ASSIGNED COURSES (from course_allocations) =====
  const [assignedCourseIds, setAssignedCourseIds] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]); // full course objects

  // ===== HISTORY STATE =====
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyCourseId, setHistoryCourseId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionStudents, setSessionStudents] = useState([]);

  const lecturerId = profile?.id;

  // ==================== FETCH APPROVED COURSE ALLOCATIONS ====================
  const fetchAssignedCourses = useCallback(async () => {
    if (!lecturerId) return [];

    try {
      const { data: allocated, error } = await supabase
        .from('course_allocations')
        .select(`
          course_id,
          status,
          courses:course_id (
            id,
            course_code,
            course_name,
            department_code,
            is_active
          )
        `)
        .eq('lecturer_id', lecturerId)
        .eq('status', 'approved');

      if (error) throw error;

      if (!allocated || allocated.length === 0) {
        setAssignedCourseIds([]);
        setAssignedCourses([]);
        return [];
      }

      const courseIds = allocated.map(a => a.course_id).filter(Boolean);
      const courseObjs = allocated
        .map(a => a.courses)
        .filter(c => c && c.id);

      setAssignedCourseIds(courseIds);
      setAssignedCourses(courseObjs);
      return courseIds;
    } catch (err) {
      console.error('Error fetching assigned courses:', err);
      showToast?.('Error loading assigned courses: ' + err.message, 'error');
      setAssignedCourseIds([]);
      setAssignedCourses([]);
      return [];
    }
  }, [lecturerId, showToast]);

  // Load assigned courses on mount / profile change
  useEffect(() => {
    if (lecturerId) {
      fetchAssignedCourses();
    }
  }, [lecturerId, fetchAssignedCourses]);

  // ===== RECORD: Fetch lectures for selected date (ONLY assigned courses) =====
  const fetchLectures = useCallback(async () => {
    if (!lecturerId) return;
    setLoading(true);

    try {
      // Always get fresh assigned course IDs
      const courseIds = await fetchAssignedCourses();

      if (courseIds.length === 0) {
        setTodayLectures([]);
        setLoading(false);
        return;
      }

      const dayOfWeek = new Date(selectedDate).getDay(); // 0=Sun ... 6=Sat
      // Note: your timetable uses 1=Mon ... 7=Sun. Adjust if needed.
      // If your day_of_week is 1-7 (Mon-Sun), convert:
      const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      // 1. Timetable slots for assigned courses on this day
      const { data: slots, error: slotsError } = await supabase
        .from('program_timetable_slots')
        .select(`
          id,
          course_id,
          course_code,
          course_name,
          day_of_week,
          start_time,
          end_time,
          room_number,
          building,
          slot_type,
          lecturer_id,
          program_timetable_id,
          program_timetables (
            department_code,
            academic_year,
            semester,
            year_of_study
          )
        `)
        .in('course_id', courseIds)                 // ← CRITICAL: only assigned courses
        .eq('day_of_week', dbDayOfWeek)
        .eq('is_active', true)
        .order('start_time');

      if (slotsError) throw slotsError;

      // 2. Manually created lectures (also restricted to assigned courses)
      const { data: createdLectures, error: lecturesError } = await supabase
        .from('lectures')
        .select(`
          id,
          title,
          course_id,
          scheduled_date,
          start_time,
          end_time,
          courses (course_code, course_name)
        `)
        .eq('lecturer_id', lecturerId)
        .eq('scheduled_date', selectedDate)
        .in('course_id', courseIds);                // ← CRITICAL

      if (lecturesError) throw lecturesError;

      const timetableSlots = (slots || []).map(s => ({
        ...s,
        source: 'timetable',
        displayName: s.course_code,
        courseName: s.course_name,
        lecture_id: null,
      }));

      const manualLectures = (createdLectures || []).map(l => ({
        id: l.id,
        course_code: l.courses?.course_code,
        course_name: l.courses?.course_name,
        start_time: l.start_time,
        end_time: l.end_time,
        source: 'manual',
        lecture_id: l.id,
        course_id: l.course_id,
        displayName: l.courses?.course_code || l.title,
        courseName: l.courses?.course_name || l.title,
      }));

      setTodayLectures([...timetableSlots, ...manualLectures]);
    } catch (err) {
      console.error(err);
      showToast?.('Error loading lectures: ' + err.message, 'error');
      setTodayLectures([]);
    } finally {
      setLoading(false);
    }
  }, [lecturerId, selectedDate, fetchAssignedCourses, showToast]);

  useEffect(() => {
    if (mode === 'record') fetchLectures();
  }, [fetchLectures, mode]);

  // ===== RECORD: Open attendance modal =====
  const openAttendance = async (slot) => {
    try {
      let courseId = slot.course_id;

      // Fallback lookup only if course_id is missing (should be rare now)
      if (!courseId && slot.course_code) {
        const found = assignedCourses.find(c => c.course_code === slot.course_code);
        courseId = found?.id;
      }

      if (!courseId) {
        alert('Could not find the course for this lecture');
        return;
      }

      // Extra safety: only allow if the course is assigned to this lecturer
      if (!assignedCourseIds.includes(courseId)) {
        alert('You are not assigned to this course');
        return;
      }

      const { data: studentCourses } = await supabase
        .from('student_courses')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', 'enrolled');

      const studentIds = studentCourses?.map(sc => sc.student_id) || [];

      if (studentIds.length === 0) {
        setEnrolledStudents([]);
        setSelectedLecture({ ...slot, course_id: courseId });
        setShowModal(true);
        return;
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name, student_id')
        .in('id', studentIds)
        .order('full_name');

      setEnrolledStudents(studentsData || []);

      const initial = {};
      (studentsData || []).forEach(s => (initial[s.id] = 'present'));

      const { data: existing } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('course_id', courseId)
        .eq('date', selectedDate)
        .in('student_id', studentIds);

      if (existing) {
        existing.forEach(r => (initial[r.student_id] = r.status));
      }

      setAttendanceStatus(initial);
      setSelectedLecture({ ...slot, course_id: courseId });
      setShowModal(true);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  };

  // ===== RECORD: Save =====
  const handleSave = async () => {
    if (!selectedLecture?.course_id) return;

    // Final safety check
    if (!assignedCourseIds.includes(selectedLecture.course_id)) {
      alert('You are not assigned to this course');
      return;
    }

    setSaving(true);

    try {
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
          .eq('date', selectedDate)
          .maybeSingle();

        const record = {
          student_id: student.id,
          course_id: selectedLecture.course_id,
          lecture_id: selectedLecture.lecture_id || null,
          date: selectedDate,
          status,
          check_in_time: now,
          day_of_week: new Date(selectedDate).getDay(),
          recorded_by: lecturerId,
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

      showToast?.(`Attendance saved! ${created} new • ${updated} updated`, 'success');
      setShowModal(false);
      setSelectedLecture(null);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ===== HISTORY: Fetch (ONLY assigned courses) =====
  const fetchHistory = useCallback(async () => {
    if (!lecturerId) return;
    setHistoryLoading(true);

    try {
      const courseIds = assignedCourseIds.length > 0
        ? assignedCourseIds
        : await fetchAssignedCourses();

      if (courseIds.length === 0) {
        setHistoryRecords([]);
        setHistoryLoading(false);
        return;
      }

      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          date,
          status,
          check_in_time,
          student_id,
          course_id,
          students (id, full_name, student_id),
          courses (id, course_code, course_name)
        `)
        .in('course_id', courseIds)                 // ← ONLY assigned courses
        .order('date', { ascending: false });

      if (historyCourseId) {
        // Extra safety: only allow filtering by an assigned course
        if (courseIds.includes(historyCourseId)) {
          query = query.eq('course_id', historyCourseId);
        }
      }
      if (historyFrom) query = query.gte('date', historyFrom);
      if (historyTo) query = query.lte('date', historyTo);
      if (historyStatus !== 'all') query = query.eq('status', historyStatus);

      const { data, error } = await query.limit(2000);
      if (error) throw error;

      let records = data || [];

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        records = records.filter(
          r =>
            r.students?.full_name?.toLowerCase().includes(q) ||
            r.students?.student_id?.toLowerCase().includes(q) ||
            r.courses?.course_code?.toLowerCase().includes(q)
        );
      }

      setHistoryRecords(records);
    } catch (err) {
      console.error(err);
      showToast?.('Error loading history: ' + err.message, 'error');
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    lecturerId,
    assignedCourseIds,
    historyCourseId,
    historyFrom,
    historyTo,
    historyStatus,
    historySearch,
    fetchAssignedCourses,
    showToast,
  ]);

  useEffect(() => {
    if (mode === 'history') fetchHistory();
  }, [mode, fetchHistory]);

  // ===== HISTORY: Open session detail =====
  const openSessionDetail = async (date, courseId) => {
    // Safety
    if (!assignedCourseIds.includes(courseId)) {
      alert('You are not assigned to this course');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          check_in_time,
          students (id, full_name, student_id)
        `)
        .eq('date', date)
        .eq('course_id', courseId)
        .order('students(full_name)');

      if (error) throw error;
      setSessionStudents(data || []);
      setSelectedSession({ date, courseId });
    } catch (err) {
      alert('Error loading session: ' + err.message);
    }
  };

  // ===== HISTORY: Summary stats =====
  const stats = React.useMemo(() => {
    const total = historyRecords.length;
    const present = historyRecords.filter(r => r.status === 'present').length;
    const absent = historyRecords.filter(r => r.status === 'absent').length;
    const late = historyRecords.filter(r => r.status === 'late').length;
    const excused = historyRecords.filter(r => r.status === 'excused').length;
    const medical = historyRecords.filter(r => r.status === 'medical').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, excused, medical, rate };
  }, [historyRecords]);

  // Group records by date + course
  const sessions = React.useMemo(() => {
    const map = {};
    historyRecords.forEach(r => {
      const key = `${r.date}_${r.course_id}`;
      if (!map[key]) {
        map[key] = {
          date: r.date,
          course_id: r.course_id,
          course_code: r.courses?.course_code,
          course_name: r.courses?.course_name,
          records: [],
        };
      }
      map[key].records.push(r);
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [historyRecords]);

  return (
    <div className="lecturer-tab-content">
      {/* Header + Mode Tabs */}
      <div className="lecturer-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>✅ Attendance</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMode('record')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: mode === 'record' ? '#1976d2' : '#e0e0e0',
              color: mode === 'record' ? 'white' : '#333',
            }}
          >
            📝 Record
          </button>
          <button
            onClick={() => setMode('history')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: mode === 'history' ? '#1976d2' : '#e0e0e0',
              color: mode === 'history' ? 'white' : '#333',
            }}
          >
            📊 History
          </button>
        </div>
      </div>

      {/* ===================== RECORD MODE ===================== */}
      {mode === 'record' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
            />
            <button onClick={fetchLectures} className="lecturer-refresh-btn">
              🔄 Refresh
            </button>
            {assignedCourseIds.length > 0 && (
              <span style={{ color: '#666', fontSize: 14 }}>
                {assignedCourseIds.length} course(s) assigned
              </span>
            )}
          </div>

          {loading ? (
            <div className="lecturer-loading-content">
              <div className="lecturer-spinner"></div>
              <p>Loading your lectures...</p>
            </div>
          ) : assignedCourseIds.length === 0 ? (
            <div className="lecturer-empty-state">
              <span style={{ fontSize: 48 }}>📭</span>
              <h3>No assigned courses</h3>
              <p>You have no approved course allocations. Contact your HOD.</p>
            </div>
          ) : todayLectures.length === 0 ? (
            <div className="lecturer-empty-state">
              <span style={{ fontSize: 48 }}>📭</span>
              <h3>No lectures found</h3>
              <p>No lectures scheduled for {new Date(selectedDate).toLocaleDateString()} among your assigned courses.</p>
            </div>
          ) : (
            <div className="lecturer-courses-grid">
              {todayLectures.map((slot) => (
                <div key={slot.id || `${slot.course_id}-${slot.start_time}`} className="lecturer-course-card">
                  <div className="lecturer-course-header">
                    <h3>{slot.displayName || slot.course_code}</h3>
                    <span className="lecturer-course-status active">
                      {slot.slot_type || 'Lecture'}
                    </span>
                  </div>
                  <h4>{slot.courseName || slot.course_name}</h4>
                  <p>🕐 {slot.start_time} – {slot.end_time}</p>
                  {slot.room_number && <p>📍 {slot.room_number}</p>}
                  <button
                    className="lecturer-primary-btn"
                    onClick={() => openAttendance(slot)}
                    style={{ marginTop: 12, width: '100%' }}
                  >
                    📝 Record Attendance
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===================== HISTORY MODE ===================== */}
      {mode === 'history' && (
        <>
          {/* Filters */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20,
            padding: 16, background: '#f8f9fa', borderRadius: 8
          }}>
            <select
              value={historyCourseId}
              onChange={(e) => setHistoryCourseId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', minWidth: 180 }}
            >
              <option value="">All My Courses</option>
              {assignedCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.course_code} – {c.course_name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}
            />
            <input
              type="date"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}
            />

            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
              <option value="medical">Medical</option>
            </select>

            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search student / course..."
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', minWidth: 180 }}
            />

            <button
              onClick={fetchHistory}
              style={{
                padding: '8px 16px', background: '#1976d2', color: 'white',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600
              }}
            >
              🔍 Apply
            </button>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 120, padding: 16, background: '#e3f2fd', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
              <div style={{ color: '#555' }}>Total Records</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 16, background: '#e8f5e9', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32' }}>{stats.present}</div>
              <div style={{ color: '#555' }}>Present</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 16, background: '#ffebee', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#c62828' }}>{stats.absent}</div>
              <div style={{ color: '#555' }}>Absent</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 16, background: '#fff3e0', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ef6c00' }}>{stats.late}</div>
              <div style={{ color: '#555' }}>Late</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 16, background: '#f3e5f5', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7b1fa2' }}>{stats.rate}%</div>
              <div style={{ color: '#555' }}>Attendance Rate</div>
            </div>
          </div>

          {historyLoading ? (
            <div className="lecturer-loading-content">
              <div className="lecturer-spinner"></div>
              <p>Loading history...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="lecturer-empty-state">
              <span style={{ fontSize: 48 }}>📭</span>
              <h3>No attendance records found</h3>
              <p>Try adjusting the filters</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>Date</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Course</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Students</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Present</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Absent</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Late</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Rate</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const present = s.records.filter(r => r.status === 'present').length;
                    const absent = s.records.filter(r => r.status === 'absent').length;
                    const late = s.records.filter(r => r.status === 'late').length;
                    const total = s.records.length;
                    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

                    return (
                      <tr key={`${s.date}_${s.course_id}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 12 }}>{new Date(s.date).toLocaleDateString()}</td>
                        <td style={{ padding: 12 }}>
                          <strong>{s.course_code}</strong>
                          <div style={{ fontSize: 12, color: '#666' }}>{s.course_name}</div>
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>{total}</td>
                        <td style={{ padding: 12, textAlign: 'center', color: '#2e7d32' }}>{present}</td>
                        <td style={{ padding: 12, textAlign: 'center', color: '#c62828' }}>{absent}</td>
                        <td style={{ padding: 12, textAlign: 'center', color: '#ef6c00' }}>{late}</td>
                        <td style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>{rate}%</td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <button
                            onClick={() => openSessionDetail(s.date, s.course_id)}
                            style={{
                              padding: '6px 12px', background: '#1976d2', color: 'white',
                              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== RECORD MODAL ===== */}
      {showModal && selectedLecture && (
        <div
          className="lecturer-modal-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, maxWidth: 700, width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: 24
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                📝 Attendance – {selectedLecture.displayName || selectedLecture.course_code}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <p style={{ color: '#666', marginBottom: 16 }}>
              Date: <strong>{new Date(selectedDate).toLocaleDateString()}</strong> •
              Time: {selectedLecture.start_time} – {selectedLecture.end_time}
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const s = {};
                  enrolledStudents.forEach(x => (s[x.id] = 'present'));
                  setAttendanceStatus(s);
                }}
                style={{ padding: '6px 14px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                ✅ All Present
              </button>
              <button
                onClick={() => {
                  const s = {};
                  enrolledStudents.forEach(x => (s[x.id] = 'absent'));
                  setAttendanceStatus(s);
                }}
                style={{ padding: '6px 14px', background: '#f44336', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                ❌ All Absent
              </button>
              <span style={{ marginLeft: 'auto', alignSelf: 'center', color: '#666' }}>
                {enrolledStudents.length} students
              </span>
            </div>

            {enrolledStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <p>No students enrolled in this course</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Student ID</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Name</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 10 }}>{s.student_id}</td>
                      <td style={{ padding: 10 }}>{s.full_name}</td>
                      <td style={{ padding: 10 }}>
                        <select
                          value={attendanceStatus[s.id] || 'present'}
                          onChange={(e) =>
                            setAttendanceStatus({ ...attendanceStatus, [s.id]: e.target.value })
                          }
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd' }}
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
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || enrolledStudents.length === 0}
                style={{
                  padding: '8px 18px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: saving || enrolledStudents.length === 0 ? 0.6 : 1
                }}
              >
                {saving ? 'Saving…' : '💾 Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SESSION DETAIL MODAL (History) ===== */}
      {selectedSession && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20
          }}
          onClick={() => setSelectedSession(null)}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, maxWidth: 600, width: '100%',
              maxHeight: '85vh', overflowY: 'auto', padding: 24
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                📋 Session – {new Date(selectedSession.date).toLocaleDateString()}
              </h3>
              <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 10, textAlign: 'left' }}>Student ID</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Name</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {sessionStudents.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 10 }}>{r.students?.student_id}</td>
                    <td style={{ padding: 10 }}>{r.students?.full_name}</td>
                    <td style={{ padding: 10 }}>
                      {r.status === 'present' && '✅ Present'}
                      {r.status === 'absent' && '❌ Absent'}
                      {r.status === 'late' && '🕒 Late'}
                      {r.status === 'excused' && '📝 Excused'}
                      {r.status === 'medical' && '🏥 Medical'}
                    </td>
                    <td style={{ padding: 10 }}>{r.check_in_time || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                onClick={() => setSelectedSession(null)}
                style={{ padding: '8px 18px', background: '#e0e0e0', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerAttendance;