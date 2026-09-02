// LecturerTimetable.jsx - FIXED filtering logic
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import './LecturerTimetable.css';

const LecturerTimetable = ({ profile, courses, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [gridData, setGridData] = useState({ days: [], timeColumns: [], matrix: {} });
  const [isMobile, setIsMobile] = useState(false);
  const [assignedCourseIds, setAssignedCourseIds] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');

  // ==================== RESPONSIVE ====================
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // ==================== FETCH ASSIGNED COURSES FROM ALLOCATIONS TABLE ====================
  const fetchAssignedCourses = useCallback(async () => {
    if (!profile?.id) return [];

    setDebugInfo('🔍 Fetching approved course allocations...');
    
    try {
      // Get approved course allocations
      const { data: allocatedCourses, error: allocError } = await supabase
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

      if (allocError) {
        console.error('Error fetching allocated courses:', allocError);
        setDebugInfo('❌ Error: ' + allocError.message);
        return [];
      }

      if (!allocatedCourses || allocatedCourses.length === 0) {
        setDebugInfo('❌ No approved course allocations found');
        setAssignedCourseIds([]);
        return [];
      }

      // Extract course IDs
      const courseIds = allocatedCourses.map(c => c.course_id).filter(id => id);
      
      console.log('📚 Approved course IDs:', courseIds);
      console.log('📚 Approved course details:', allocatedCourses);
      
      setDebugInfo(`✅ Found ${courseIds.length} approved course allocations: ${allocatedCourses.map(c => c.courses?.course_code).filter(Boolean).join(', ')}`);
      
      setAssignedCourseIds(courseIds);
      return courseIds;
      
    } catch (error) {
      console.error('Error fetching assigned courses:', error);
      setDebugInfo('❌ Error: ' + error.message);
      return [];
    }
  }, [profile?.id]);

  // ==================== FETCH TIMETABLE ====================
  const fetchTimetableData = useCallback(async () => {
    if (!profile?.id) {
      throw new Error('No lecturer logged in');
    }

    setDebugInfo('🔍 Fetching timetable...');

    // Get assigned course IDs from course_allocations table
    const courseIds = await fetchAssignedCourses();
    
    if (courseIds.length === 0) {
      setDebugInfo('❌ No approved course allocations found');
      return { days: [], timeColumns: [], matrix: {} };
    }

    setDebugInfo(`📚 Searching for timetable slots for ${courseIds.length} course(s)...`);

    // Get department code from profile
    const deptCode = profile?.department_code || 
                     profile?.primary_department_code;

    // Step 1: Get program timetables for this department
    let query = supabase
      .from('program_timetables')
      .select(`
        id,
        program_id,
        department_code,
        academic_year,
        semester,
        year_of_study,
        is_active,
        programs:program_id (
          id,
          name,
          code
        )
      `)
      .eq('is_active', true);

    if (deptCode) {
      query = query.eq('department_code', deptCode);
    }

    const { data: timetables, error: timetablesError } = await query;

    if (timetablesError) {
      console.error('Error fetching timetables:', timetablesError);
      setDebugInfo('❌ Error: ' + timetablesError.message);
      return { days: [], timeColumns: [], matrix: {} };
    }

    if (!timetables || timetables.length === 0) {
      setDebugInfo('❌ No timetables found for department');
      return { days: [], timeColumns: [], matrix: {} };
    }

    const timetableIds = timetables.map(t => t.id);
    setDebugInfo(`📋 Found ${timetables.length} timetables`);

    // Step 2: Fetch timetable slots
    const { data: slots, error: slotsError } = await supabase
      .from('program_timetable_slots')
      .select(`
        id,
        course_code,
        course_name,
        day_of_week,
        start_time,
        end_time,
        room_number,
        building,
        slot_type,
        lecturer_id,
        course_id,
        program_timetable_id,
        program_timetables:program_timetable_id (
          id,
          program_id,
          academic_year,
          semester,
          year_of_study,
          department_code,
          is_active,
          programs:program_id (
            id,
            name,
            code
          )
        )
      `)
      .in('program_timetable_id', timetableIds)
      .eq('is_active', true);

    if (slotsError) {
      console.error('Error fetching slots:', slotsError);
      setDebugInfo('❌ Error fetching slots: ' + slotsError.message);
      return { days: [], timeColumns: [], matrix: {} };
    }

    if (!slots || slots.length === 0) {
      setDebugInfo('❌ No slots found in timetables');
      return { days: [], timeColumns: [], matrix: {} };
    }

    setDebugInfo(`📅 Found ${slots.length} total slots, filtering by assigned courses...`);

    // Log all slots for debugging
    console.log('📅 All slots:', slots.map(s => ({ 
      id: s.id, 
      course_code: s.course_code, 
      course_id: s.course_id,
      assigned_course_ids: courseIds 
    })));

    // Step 3: CRITICAL - Filter slots to ONLY show courses from course_allocations
    // Using strict course_id matching
    const filteredSlots = slots.filter(slot => {
      const isAssigned = courseIds.includes(slot.course_id);
      console.log(`🔍 Checking slot ${slot.course_code} (${slot.course_id}): isAssigned=${isAssigned}`);
      return isAssigned;
    });

    console.log('✅ Filtered slots:', filteredSlots);

    if (filteredSlots.length === 0) {
      setDebugInfo(`❌ No slots found for assigned courses. Assigned IDs: ${courseIds.join(', ')}`);
      return { days: [], timeColumns: [], matrix: {} };
    }

    setDebugInfo(`✅ Found ${filteredSlots.length} slots for assigned courses: ${filteredSlots.map(s => s.course_code).join(', ')}`);

    // Step 4: Build unique time columns
    const timeSet = new Map();
    filteredSlots.forEach((s) => {
      const start = String(s.start_time).slice(0, 5);
      const end = String(s.end_time).slice(0, 5);
      const key = `${start}-${end}`;
      if (!timeSet.has(key)) {
        timeSet.set(key, { start, end, label: `${formatTime(start)}-${formatTime(end)}` });
      }
    });

    const timeColumns = Array.from(timeSet.values()).sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    // Fixed days (Monday = 1, Sunday = 7)
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const allDays = dayNames.map((name, idx) => ({
      name,
      dayOfWeek: idx + 1,
    }));

    // Step 5: Build matrix
    const matrix = {};
    allDays.forEach((d) => {
      matrix[d.dayOfWeek] = {};
      timeColumns.forEach((tc) => {
        matrix[d.dayOfWeek][`${tc.start}-${tc.end}`] = null;
      });
    });

    filteredSlots.forEach((slot) => {
      const day = slot.day_of_week;
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
          slotType: slot.slot_type === 'lab' ? 'LAB' : 
                    slot.slot_type === 'tutorial' ? 'TUT' :
                    slot.slot_type === 'practical' ? 'PRAC' : '',
          startTime: slot.start_time,
          endTime: slot.end_time,
          program: slot.program_timetables?.programs?.name || '',
          programCode: slot.program_timetables?.programs?.code || '',
          yearOfStudy: slot.program_timetables?.year_of_study || '',
          semester: slot.program_timetables?.semester || '',
        };
      }
    });

    // Step 6: Only keep days that have at least one lecture
    const days = allDays.filter((day) => {
      const daySlots = matrix[day.dayOfWeek] || {};
      return Object.values(daySlots).some((lecture) => lecture !== null);
    });

    setDebugInfo(`✅ Displaying ${days.length} day(s) with ${filteredSlots.length} slots`);
    return { days, timeColumns, matrix };
  }, [profile?.id, profile?.full_name, profile?.department_code, fetchAssignedCourses]);

  // ==================== FETCH ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTimetableData();
      setGridData(data);
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setDebugInfo('❌ Error: ' + err.message);
      if (showToast) {
        showToast('Error loading timetable: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchTimetableData, showToast]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    } else {
      setGridData({ days: [], timeColumns: [], matrix: {} });
    }
  }, [profile?.id]);

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
          <div style={{ 
            padding: '8px 16px', 
            background: '#e3f2fd', 
            borderRadius: '6px', 
            marginBottom: '12px',
            fontSize: '13px',
            color: '#1565c0',
            fontFamily: 'monospace'
          }}>
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
            {assignedCourseIds.length} course(s) assigned • Week of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="lecturer-timetable-actions">
          <button className="lecturer-refresh-btn" onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <div style={{ 
          padding: '8px 16px', 
          background: '#e3f2fd', 
          borderRadius: '6px', 
          marginBottom: '16px',
          fontSize: '13px',
          color: '#1565c0',
          fontFamily: 'monospace'
        }}>
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
              <p className="assigned-courses-label">Your approved courses ({assignedCourseIds.length}):</p>
              <div className="course-tags">
                {courses.filter(c => assignedCourseIds.includes(c.id)).slice(0, 10).map(c => (
                  <span key={c.id} className="course-tag">
                    {c.course_code}
                  </span>
                ))}
                {assignedCourseIds.length > 10 && <span>+{assignedCourseIds.length - 10} more</span>}
              </div>
            </div>
          )}
          {assignedCourseIds.length === 0 && (
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#e65100' }}>
              <p>⚠️ No approved course allocations.</p>
              <p>Contact your HOD to request course allocations.</p>
            </div>
          )}
          {assignedCourseIds.length > 0 && (
            <button 
              className="lecturer-refresh-btn" 
              onClick={fetchData}
              style={{ marginTop: '16px' }}
            >
              🔄 Refresh Timetable
            </button>
          )}
        </div>
      ) : (
        <div className="lecturer-timetable-wrapper">
          <div className="lecturer-timetable-scroll">
            <table className="lecturer-timetable-table">
              <thead>
                <tr>
                  <th className="time-header">Day</th>
                  {timeColumns.map((tc) => (
                    <th key={tc.start + tc.end} className="day-header">
                      {tc.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dayIdx) => (
                  <tr key={day.dayOfWeek}>
                    <td className="day-cell">
                      {day.name}
                    </td>

                    {timeColumns.map((tc) => {
                      const key = `${tc.start}-${tc.end}`;
                      const lecture = matrix[day.dayOfWeek]?.[key];

                      return (
                        <td key={key} className="time-slot-cell">
                          {lecture ? (
                            <div className={`slot-card ${lecture.slotType ? lecture.slotType.toLowerCase() : 'lecture'}`}>
                              <div className="slot-course-code">
                                {lecture.courseCode}
                                {lecture.slotType && (
                                  <span className={`slot-type-badge ${lecture.slotType.toLowerCase()}`}>
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
                              <div className="slot-room">
                                {lecture.room}
                              </div>
                              {lecture.programCode && (
                                <div className="slot-program-info">
                                  {lecture.programCode} • Y{lecture.yearOfStudy} • S{lecture.semester}
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