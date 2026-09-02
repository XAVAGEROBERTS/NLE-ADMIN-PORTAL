// HODTimetable.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODTimetable = ({ departmentCode, courses, lecturers }) => {
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [showConflictModal, setShowConflictModal] = useState(false);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchTimetable();
  }, [departmentCode, selectedDay]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      // Get all program timetables for the department
      const { data: timetables } = await supabase
        .from('program_timetables')
        .select('id')
        .eq('department_code', departmentCode)
        .eq('is_active', true);

      const timetableIds = timetables?.map(t => t.id) || [];

      if (timetableIds.length === 0) {
        setTimetableSlots([]);
        setConflicts([]);
        setLoading(false);
        return;
      }

      // Get slots for the selected day
      const { data: slots } = await supabase
        .from('program_timetable_slots')
        .select(`
          *,
          courses:course_id (course_code, course_name),
          lecturers:lecturer_id (full_name, email)
        `)
        .in('program_timetable_id', timetableIds)
        .eq('day_of_week', selectedDay)
        .eq('is_active', true)
        .order('start_time');

      setTimetableSlots(slots || []);

      // Check for conflicts
      const conflictsFound = [];
      const slotMap = {};

      (slots || []).forEach((slot) => {
        const timeKey = `${slot.start_time}-${slot.end_time}`;
        if (!slotMap[timeKey]) {
          slotMap[timeKey] = [];
        }
        slotMap[timeKey].push(slot);
      });

      Object.keys(slotMap).forEach((timeKey) => {
        if (slotMap[timeKey].length > 1) {
          conflictsFound.push({
            time: timeKey,
            slots: slotMap[timeKey],
          });
        }
      });

      setConflicts(conflictsFound);
    } catch (err) {
      console.error('Error fetching timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📅 Timetable Oversight</h2>
        {conflicts.length > 0 && (
          <button 
            className="hod-warning-btn"
            onClick={() => setShowConflictModal(true)}
          >
            ⚠️ {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="hod-day-selector">
        {days.map((day, index) => (
          <button
            key={index}
            className={`hod-day-btn ${selectedDay === index ? 'active' : ''}`}
            onClick={() => setSelectedDay(index)}
          >
            {day}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="hod-loading">Loading timetable...</div>
      ) : (
        <div className="hod-timetable-grid">
          {timetableSlots.length === 0 ? (
            <div className="hod-empty">
              <span>📭</span>
              <h3>No classes scheduled for {days[selectedDay]}</h3>
            </div>
          ) : (
            timetableSlots.map((slot) => (
              <div key={slot.id} className="hod-timetable-card">
                <div className="hod-timetable-time">
                  <span className="hod-time">{slot.start_time}</span>
                  <span className="hod-time-arrow">→</span>
                  <span className="hod-time">{slot.end_time}</span>
                </div>
                <h3>{slot.courses?.course_code}</h3>
                <p>{slot.courses?.course_name}</p>
                <p className="hod-timetable-lecturer">
                  👨‍🏫 {slot.lecturers?.full_name || 'Not Assigned'}
                </p>
                <div className="hod-timetable-details">
                  <span className="hod-badge">{slot.slot_type}</span>
                  <span className="hod-badge">{slot.room_number || 'No Room'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Conflicts Modal */}
      {showConflictModal && (
        <div className="hod-modal-overlay" onClick={() => setShowConflictModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>⚠️ Timetable Conflicts</h3>
              <button onClick={() => setShowConflictModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className="hod-conflict-item">
                  <h4>Conflict at {conflict.time}</h4>
                  <ul>
                    {conflict.slots.map((slot) => (
                      <li key={slot.id}>
                        <strong>{slot.courses?.course_code}</strong> - {slot.courses?.course_name}
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
            <div className="hod-modal-footer">
              <button onClick={() => setShowConflictModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODTimetable;