// dean/DeanTimetable.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanTimetable = ({ departments }) => {
  const [timetables, setTimetables] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showConflictModal, setShowConflictModal] = useState(false);

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchTimetables = useCallback(async () => {
    if (deptCodes.length === 0) {
      setTimetables([]);
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
      setTimetables(data || []);

      const conflictsFound = [];
      const slotMap = {};

      (data || []).forEach(tt => {
        (tt.program_timetable_slots || []).forEach(slot => {
          const key = `${slot.day_of_week}-${slot.start_time}-${slot.end_time}`;
          if (!slotMap[key]) {
            slotMap[key] = [];
          }
          slotMap[key].push({
            ...slot,
            department_code: tt.department_code,
            program_name: tt.programs?.name,
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

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📅 Faculty Timetable Overview</h2>
        {conflicts.length > 0 && (
          <button
            className="dean-warning-btn"
            onClick={() => setShowConflictModal(true)}
          >
            ⚠️ {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="dean-filters">
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.department_code}>
              {d.department_code} - {d.department_name}
            </option>
          ))}
        </select>
        <button className="dean-refresh-btn" onClick={fetchTimetables}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="dean-loading">Loading timetables...</div>
      ) : (
        <div className="dean-timetable-grid">
          {timetables.length === 0 ? (
            <div className="dean-empty">
              <span>📭</span>
              <h3>No timetables found</h3>
            </div>
          ) : (
            timetables.map((tt) => (
              <div key={tt.id} className="dean-timetable-card">
                <div className="dean-timetable-header">
                  <h3>{tt.programs?.name || 'Unknown Program'}</h3>
                  <div>
                    <span className="dean-badge">Year {tt.year_of_study}</span>
                    <span className="dean-badge">Sem {tt.semester}</span>
                    <span className={`dean-status ${tt.is_active ? 'active' : 'inactive'}`}>
                      {tt.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="dean-timetable-meta">
                  📅 {tt.academic_year} • 🏢 {tt.department_code}
                </p>
                <p className="dean-timetable-slots-count">
                  {tt.program_timetable_slots?.length || 0} slots
                </p>
                <div className="dean-timetable-slots">
                  {(tt.program_timetable_slots || []).slice(0, 5).map((slot) => (
                    <div key={slot.id} className="dean-timetable-slot">
                      <span className="dean-timetable-day">{days[slot.day_of_week]}</span>
                      <span className="dean-timetable-time">{slot.start_time} - {slot.end_time}</span>
                      <span className="dean-timetable-course">{slot.course_code}</span>
                      <span className="dean-timetable-room">{slot.room_number}</span>
                    </div>
                  ))}
                  {(tt.program_timetable_slots?.length || 0) > 5 && (
                    <p className="dean-timetable-more">
                      +{(tt.program_timetable_slots?.length || 0) - 5} more slots
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showConflictModal && (
        <div className="dean-modal-overlay" onClick={() => setShowConflictModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>⚠️ Timetable Conflicts</h3>
              <button onClick={() => setShowConflictModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className="dean-conflict-item">
                  <h4>Conflict at {conflict.time}</h4>
                  <ul>
                    {conflict.slots.map((slot) => (
                      <li key={slot.id}>
                        <strong>{slot.course_code}</strong> - {slot.course_name}
                        <br />
                        <small>Department: {slot.department_code}</small>
                        <br />
                        <small>Program: {slot.program_name}</small>
                        <br />
                        <small>Lecturer: {slot.lecturers?.full_name || 'Not Assigned'}</small>
                        <br />
                        <small>Room: {slot.room_number || 'No Room'}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowConflictModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanTimetable;