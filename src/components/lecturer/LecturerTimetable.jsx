// LecturerTimetable.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import './LecturerTimetable.css';

const LecturerTimetable = ({ profile, showToast }) => {
  const [loading, setLoading] = useState(true);
  const [gridData, setGridData] = useState({ days: [], timeColumns: [], matrix: {} });
  const [assignedCourseIds, setAssignedCourseIds] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');

  // ==================== HELPERS ====================
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${(m || '00').padStart(2, '0')}${ampm}`;
  };

  const timeToMinutes = (t) => {
    if (!t) return 0;
    const [h, m] = String(t).split(':');
    return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
  };

  // ==================== FETCH ASSIGNED COURSES ====================
  const fetchAssignedCourses = useCallback(async () => {
    if (!profile?.id) {
      return { courseIds: [], courseList: [], courseCodes: [] };
    }

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
        .eq('lecturer_id', profile.id)
        .eq('status', 'approved');

      if (error) throw error;

      if (!allocated || allocated.length === 0) {
        return { courseIds: [], courseList: [], courseCodes: [] };
      }

      const courseIds = allocated.map(a => a.course_id).filter(Boolean);
      const courseList = allocated.map(a => a.courses).filter(c => c?.id);
      const courseCodes = courseList.map(c => c.course_code).filter(Boolean);

      return { courseIds, courseList, courseCodes };
    } catch (err) {
      console.error('Error fetching assigned courses:', err);
      throw err;
    }
  }, [profile?.id]);

  // ==================== FETCH TIMETABLE ====================
  const fetchTimetableData = useCallback(async () => {
    if (!profile?.id) {
      throw new Error('No lecturer logged in');
    }

    setDebugInfo('🔍 Loading assigned courses...');

    const { courseIds, courseList, courseCodes } = await fetchAssignedCourses();

    // Update state for UI
    setAssignedCourseIds(courseIds);
    setAssignedCourses(courseList);

    if (courseIds.length === 0) {
      setDebugInfo('❌ No approved course allocations found');
      return { days: [], timeColumns: [], matrix: {} };
    }

    setDebugInfo(`📚 ${courseIds.length} course(s) assigned. Fetching slots...`);

    let slots = [];

    // 1. Fetch by course_id (preferred)
    if (courseIds.length > 0) {
      const { data: byId, error: err1 } = await supabase
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
          program_timetables:program_timetable_id (
            id,
            academic_year,
            semester,
            year_of_study,
            department_code,
            programs:program_id (
              id,
              name,
              code
            )
          )
        `)
        .in('course_id', courseIds)
        .eq('is_active', true);

      if (err1) {
        console.error('Error fetching by course_id:', err1);
      } else if (byId) {
        slots = byId;
      }
    }

    // 2. Also fetch by course_code (fallback when course_id is null in slots)
    if (courseCodes.length > 0) {
      const { data: byCode, error: err2 } = await supabase
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
          program_timetables:program_timetable_id (
            id,
            academic_year,
            semester,
            year_of_study,
            department_code,
            programs:program_id (
              id,
              name,
              code
            )
          )
        `)
        .in('course_code', courseCodes)
        .eq('is_active', true);

      if (!err2 && byCode) {
        const existingIds = new Set(slots.map(s => s.id));
        byCode.forEach(s => {
          if (!existingIds.has(s.id)) {
            slots.push(s);
          }
        });
      }
    }

    if (slots.length === 0) {
      setDebugInfo(`❌ No timetable slots found for your ${courseIds.length} assigned course(s)`);
      return { days: [], timeColumns: [], matrix: {} };
    }

    setDebugInfo(`✅ Found ${slots.length} slot(s)`);

    // ===== Build time columns =====
    const timeSet = new Map();
    slots.forEach((s) => {
      const start = String(s.start_time).slice(0, 5);
      const end = String(s.end_time).slice(0, 5);
      const key = `${start}-${end}`;
      if (!timeSet.has(key)) {
        timeSet.set(key, {
          start,
          end,
          label: `${formatTime(start)}-${formatTime(end)}`,
        });
      }
    });

    const timeColumns = Array.from(timeSet.values()).sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    // Days: 1 = Monday ... 7 = Sunday
    const dayNames = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const allDays = dayNames.map((name, idx) => ({
      name,
      dayOfWeek: idx + 1,
    }));

    // ===== Build matrix =====
    const matrix = {};
    allDays.forEach((d) => {
      matrix[d.dayOfWeek] = {};
      timeColumns.forEach((tc) => {
        matrix[d.dayOfWeek][`${tc.start}-${tc.end}`] = null;
      });
    });

    slots.forEach((slot) => {
      const day = Number(slot.day_of_week);
      if (day < 1 || day > 7) return;

      const start = String(slot.start_time).slice(0, 5);
      const end = String(slot.end_time).slice(0, 5);
      const key = `${start}-${end}`;

      if (matrix[day] && matrix[day][key] !== undefined) {
        matrix[day][key] = {
          courseCode: slot.course_code || 'N/A',
          courseName: slot.course_name || '',
          lecturer: profile?.full_name || 'You',
          room: slot.room_number
            ? `${slot.room_number}${slot.building ? ', ' + slot.building : ''}`
            : 'TBA',
          slotType:
            slot.slot_type === 'lab'
              ? 'LAB'
              : slot.slot_type === 'tutorial'
              ? 'TUT'
              : slot.slot_type === 'practical'
              ? 'PRAC'
              : '',
          startTime: slot.start_time,
          endTime: slot.end_time,
          program: slot.program_timetables?.programs?.name || '',
          programCode: slot.program_timetables?.programs?.code || '',
          yearOfStudy: slot.program_timetables?.year_of_study || '',
          semester: slot.program_timetables?.semester || '',
        };
      }
    });

    // Only keep days that have at least one lecture
    const days = allDays.filter((day) => {
      const daySlots = matrix[day.dayOfWeek] || {};
      return Object.values(daySlots).some((lecture) => lecture !== null);
    });

    setDebugInfo(`✅ Showing ${days.length} day(s) • ${slots.length} slot(s)`);
    return { days, timeColumns, matrix };
  }, [profile?.id, profile?.full_name, fetchAssignedCourses]);

  // ==================== LOAD DATA ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setDebugInfo('');
    try {
      const data = await fetchTimetableData();
      setGridData(data);
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setDebugInfo('❌ Error: ' + err.message);
      showToast?.('Error loading timetable: ' + err.message, 'error');
      setGridData({ days: [], timeColumns: [], matrix: {} });
    } finally {
      setLoading(false);
    }
  }, [fetchTimetableData, showToast]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    } else {
      setGridData({ days: [], timeColumns: [], matrix: {} });
      setLoading(false);
    }
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== RENDER ====================
  const { days: rawDays, timeColumns, matrix } = gridData;

  const days = (rawDays || []).filter((day) => {
    const daySlots = matrix?.[day.dayOfWeek] || {};
    return Object.values(daySlots).some((lecture) => lecture !== null);
  });

  if (loading) {
    return (
      <div className="lecturer-timetable-container">
        <h2>📅 My Timetable</h2>
        {debugInfo && (
          <div
            style={{
              padding: '8px 16px',
              background: '#e3f2fd',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '13px',
              color: '#1565c0',
              fontFamily: 'monospace',
            }}
          >
            {debugInfo}
          </div>
        )}
        <div className="lecturer-loading-content">
          <div className="lecturer-spinner"></div>
          <p>Loading timetable...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lecturer-timetable-container">
      <div className="lecturer-timetable-header">
        <div>
          <h2>📅 My Timetable</h2>
          <div className="subtitle">
            {assignedCourseIds.length} course(s) assigned • Week of{' '}
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="lecturer-timetable-actions">
          <button className="lecturer-refresh-btn" onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Optional debug bar - remove in production */}
      {debugInfo && (
        <div
          style={{
            padding: '8px 16px',
            background: '#e3f2fd',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#1565c0',
            fontFamily: 'monospace',
          }}
        >
          {debugInfo}
        </div>
      )}

      {days.length === 0 || timeColumns.length === 0 ? (
        <div className="lecturer-empty-state">
          <span className="empty-icon">📅</span>
          <h3>No Timetable Slots</h3>
          <p>
            {assignedCourseIds.length === 0
              ? 'You have no approved course allocations yet. Contact your HOD for course allocations.'
              : 'No timetable slots found for your assigned courses.'}
          </p>

          {assignedCourseIds.length > 0 && (
            <div className="assigned-courses">
              <p className="assigned-courses-label">
                Your approved courses ({assignedCourseIds.length}):
              </p>
              <div className="course-tags">
                {assignedCourses.slice(0, 12).map((c) => (
                  <span key={c.id} className="course-tag">
                    {c.course_code}
                  </span>
                ))}
                {assignedCourses.length > 12 && (
                  <span>+{assignedCourses.length - 12} more</span>
                )}
              </div>
            </div>
          )}

          {assignedCourseIds.length === 0 && (
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#e65100' }}>
              <p>⚠️ No approved course allocations.</p>
              <p>Contact your HOD to request course allocations.</p>
            </div>
          )}

          <button
            className="lecturer-refresh-btn"
            onClick={fetchData}
            style={{ marginTop: '16px' }}
          >
            🔄 Refresh Timetable
          </button>
        </div>
      ) : (
        <div className="lecturer-timetable-wrapper">
          <div className="lecturer-timetable-scroll">
            <table className="lecturer-timetable-table">
              <thead>
                <tr>
                  <th className="time-header">Day</th>
                  {timeColumns.map((tc) => (
                    <th key={`${tc.start}-${tc.end}`} className="day-header">
                      {tc.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.dayOfWeek}>
                    <td className="day-cell">{day.name}</td>

                    {timeColumns.map((tc) => {
                      const key = `${tc.start}-${tc.end}`;
                      const lecture = matrix[day.dayOfWeek]?.[key];

                      return (
                        <td key={key} className="time-slot-cell">
                          {lecture ? (
                            <div
                              className={`slot-card ${
                                lecture.slotType
                                  ? lecture.slotType.toLowerCase()
                                  : 'lecture'
                              }`}
                            >
                              <div className="slot-course-code">
                                {lecture.courseCode}
                                {lecture.slotType && (
                                  <span
                                    className={`slot-type-badge ${lecture.slotType.toLowerCase()}`}
                                  >
                                    {lecture.slotType}
                                  </span>
                                )}
                              </div>
                              <div className="slot-course-name">
                                {lecture.courseName}
                              </div>
                              <div className="slot-lecturer">
                                {lecture.lecturer}
                              </div>
                              <div className="slot-room">{lecture.room}</div>
                              {lecture.programCode && (
                                <div className="slot-program-info">
                                  {lecture.programCode} • Y{lecture.yearOfStudy} • S
                                  {lecture.semester}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="empty-cell">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerTimetable;