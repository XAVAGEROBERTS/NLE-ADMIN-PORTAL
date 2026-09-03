// dean/DeanTimetable.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanTimetable = ({ departments }) => {
  const [rawTimetables, setRawTimetables] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const deptCodes = useMemo(() => {
    return (departments || []).map(d => d.department_code).filter(Boolean);
  }, [departments]);

  // ---------- Helpers ----------
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

  // ---------- Fetch ----------
  const fetchTimetables = useCallback(async () => {
    if (deptCodes.length === 0) {
      setRawTimetables([]);
      setConflicts([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('program_timetables')
        .select(`
          id,
          program_id,
          academic_year,
          semester,
          year_of_study,
          is_active,
          department_code,
          programs (name, code),
          program_timetable_slots (
            id,
            course_code,
            course_name,
            lecturer_id,
            day_of_week,
            start_time,
            end_time,
            room_number,
            building,
            slot_type,
            is_active,
            lecturers (full_name)
          )
        `)
        .eq('is_active', true);

      if (selectedDepartment !== 'all') {
        query = query.eq('department_code', selectedDepartment);
      } else {
        query = query.in('department_code', deptCodes);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRawTimetables(data || []);

      // ---------- Conflict detection ----------
      const conflictsFound = [];
      const slotMap = {};

      (data || []).forEach(tt => {
        (tt.program_timetable_slots || []).forEach(slot => {
          if (slot.is_active === false) return;
          const key = `${slot.day_of_week}-${String(slot.start_time).slice(0,5)}-${String(slot.end_time).slice(0,5)}`;
          if (!slotMap[key]) slotMap[key] = [];
          slotMap[key].push({
            ...slot,
            department_code: tt.department_code,
            program_name: tt.programs?.name,
            program_code: tt.programs?.code,
            year_of_study: tt.year_of_study,
            semester: tt.semester,
          });
        });
      });

      Object.keys(slotMap).forEach(key => {
        if (slotMap[key].length > 1) {
          conflictsFound.push({
            time: key,
            slots: slotMap[key],
          });
        }
      });

      setConflicts(conflictsFound);
    } catch (err) {
      console.error('Error fetching timetables:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, selectedDepartment]);

  useEffect(() => {
    fetchTimetables();
  }, [fetchTimetables]);

  // ---------- Build grid data for selected program / all ----------
  const gridData = useMemo(() => {
    // Filter by selected program if needed
    let filtered = rawTimetables;
    if (selectedProgram !== 'all') {
      filtered = rawTimetables.filter(tt => tt.id === selectedProgram);
    }

    // Collect all slots
    const allSlots = [];
    filtered.forEach(tt => {
      (tt.program_timetable_slots || []).forEach(slot => {
        if (slot.is_active === false) return;
        allSlots.push({
          ...slot,
          program_name: tt.programs?.name,
          program_code: tt.programs?.code,
          department_code: tt.department_code,
          year_of_study: tt.year_of_study,
          semester: tt.semester,
          academic_year: tt.academic_year,
        });
      });
    });

    if (allSlots.length === 0) {
      return { days: [], timeColumns: [], matrix: {} };
    }

    // Unique time columns
    const timeSet = new Map();
    allSlots.forEach(s => {
      const start = String(s.start_time).slice(0, 5);
      const end = String(s.end_time).slice(0, 5);
      const key = `${start}-${end}`;
      if (!timeSet.has(key)) {
        timeSet.set(key, {
          start,
          end,
          label: `${formatTime(start)} - ${formatTime(end)}`,
        });
      }
    });

    const timeColumns = Array.from(timeSet.values()).sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    // Days (Mon–Sat)
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const allDays = dayNames.map((name, idx) => ({
      name,
      dayOfWeek: idx + 1, // 1=Mon ... 6=Sat
    }));

    // Matrix
    const matrix = {};
    allDays.forEach(d => {
      matrix[d.dayOfWeek] = {};
      timeColumns.forEach(tc => {
        matrix[d.dayOfWeek][`${tc.start}-${tc.end}`] = [];
      });
    });

    allSlots.forEach(slot => {
      const day = slot.day_of_week;
      if (day < 1 || day > 6) return;

      const start = String(slot.start_time).slice(0, 5);
      const end = String(slot.end_time).slice(0, 5);
      const key = `${start}-${end}`;

      if (matrix[day] && matrix[day][key] !== undefined) {
        matrix[day][key].push({
          courseCode: slot.course_code || 'N/A',
          courseName: slot.course_name || '',
          lecturer: slot.lecturers?.full_name || 'Not Assigned',
          room: slot.room_number
            ? `${slot.room_number}${slot.building ? ', ' + slot.building : ''}`
            : 'TBA',
          slotType: slot.slot_type === 'lab' ? 'LAB' : slot.slot_type?.toUpperCase() || '',
          program: slot.program_code || slot.program_name,
          year: slot.year_of_study,
          department: slot.department_code,
        });
      }
    });

    // Only keep days that have at least one lecture
    const days = allDays.filter(day => {
      const daySlots = matrix[day.dayOfWeek] || {};
      return Object.values(daySlots).some(arr => arr.length > 0);
    });

    return { days, timeColumns, matrix };
  }, [rawTimetables, selectedProgram]);

  // Unique programs for the filter
const programOptions = useMemo(() => {
  return rawTimetables.map(tt => ({
    id: tt.id,
    label: `${tt.programs?.code || 'PRG'} - ${tt.programs?.name || 'Unknown'} (Y${tt.year_of_study} Sem ${tt.semester} • ${tt.academic_year})`,
  }));
}, [rawTimetables]);

  const { days, timeColumns, matrix } = gridData;

  return (
    <div className="dean-section" style={{ padding: isMobile ? '12px 8px' : 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>📅 Faculty Timetable Overview</h2>
          <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            Grid view across all departments
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {conflicts.length > 0 && (
            <button
              onClick={() => setShowConflictModal(true)}
              style={{
                background: '#fff3e0',
                color: '#e65100',
                border: '1px solid #ffcc80',
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ⚠️ {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={fetchTimetables}
            style={{
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value);
            setSelectedProgram('all');
          }}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, minWidth: 180 }}
        >
          <option value="all">All Departments</option>
          {(departments || []).map(d => (
            <option key={d.id} value={d.department_code}>
              {d.department_code} – {d.department_name}
            </option>
          ))}
        </select>

        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, minWidth: 260 }}
        >
          <option value="all">All Programs</option>
          {programOptions.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', height: 200, alignItems: 'center' }}>
          <div className="timetable-spinner" />
        </div>
      ) : days.length === 0 || timeColumns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#f8f9fa', borderRadius: 10 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>No timetable data found for the selected filters.</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th
                  style={{
                    background: '#1e88e5',
                    color: 'white',
                    padding: '12px 10px',
                    textAlign: 'left',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    minWidth: 100,
                  }}
                >
                  Day
                </th>
                {timeColumns.map((tc) => (
                  <th
                    key={tc.start + tc.end}
                    style={{
                      background: '#1e88e5',
                      color: 'white',
                      padding: '12px 10px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tc.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, dayIdx) => (
                <tr key={day.dayOfWeek} style={{ background: dayIdx % 2 === 0 ? '#ffffff' : '#e3f2fd' }}>
                  <td
                    style={{
                      padding: '14px 12px',
                      fontWeight: 600,
                      borderBottom: '1px solid #e0e0e0',
                      position: 'sticky',
                      left: 0,
                      background: dayIdx % 2 === 0 ? '#ffffff' : '#e3f2fd',
                      zIndex: 1,
                    }}
                  >
                    {day.name}
                  </td>

                  {timeColumns.map((tc) => {
                    const key = `${tc.start}-${tc.end}`;
                    const lectures = matrix[day.dayOfWeek]?.[key] || [];

                    return (
                      <td
                        key={key}
                        style={{
                          padding: 8,
                          borderBottom: '1px solid #e0e0e0',
                          verticalAlign: 'top',
                          minWidth: 180,
                        }}
                      >
                        {lectures.length === 0 ? (
                          <div style={{ color: '#ccc', textAlign: 'center', padding: 12 }}>—</div>
                        ) : (
                          lectures.map((lecture, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: lecture.slotType === 'LAB' ? '#fff5f5' : '#f0f7ff',
                                borderLeft: `4px solid ${lecture.slotType === 'LAB' ? '#e74c3c' : '#3498db'}`,
                                borderRadius: 6,
                                padding: '10px 8px',
                                fontSize: 13,
                                lineHeight: 1.35,
                                marginBottom: lectures.length > 1 ? 8 : 0,
                              }}
                            >
                              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                {lecture.courseCode}
                                {lecture.slotType && (
                                  <span style={{ color: '#e74c3c', marginLeft: 4, fontSize: 11 }}>
                                    {lecture.slotType}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#555', fontSize: 12, marginBottom: 2 }}>
                                {lecture.courseName}
                              </div>
                              <div style={{ color: '#666', fontSize: 12 }}>
                                {lecture.lecturer}
                              </div>
                              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                                {lecture.room}
                              </div>
                              {/* Extra info for Dean */}
                              <div style={{ color: '#999', fontSize: 11, marginTop: 4, borderTop: '1px dashed #eee', paddingTop: 4 }}>
                                {lecture.program} • Y{lecture.year} • {lecture.department}
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowConflictModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              maxWidth: 600,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>⚠️ Timetable Conflicts ({conflicts.length})</h3>
              <button
                onClick={() => setShowConflictModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div>
              {conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#fff8e1',
                    borderLeft: '4px solid #ff9800',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ margin: '0 0 12px 0', color: '#e65100' }}>
                    Conflict at {conflict.time}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {conflict.slots.map((slot) => (
                      <li key={slot.id} style={{ marginBottom: 10 }}>
                        <strong>{slot.course_code}</strong> – {slot.course_name}
                        <br />
                        <small>
                          {slot.program_code || slot.program_name} • Y{slot.year_of_study} Sem {slot.semester}
                          <br />
                          Dept: {slot.department_code} • Lecturer: {slot.lecturers?.full_name || 'Not Assigned'}
                          <br />
                          Room: {slot.room_number || 'No Room'}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button
                onClick={() => setShowConflictModal(false)}
                style={{
                  padding: '8px 20px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .timetable-spinner {
          width: 40px; height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .table-container::-webkit-scrollbar { height: 8px; }
        .table-container::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default DeanTimetable;