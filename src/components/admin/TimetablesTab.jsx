// src/components/admin/TimetablesTab.jsx
import React from 'react';
import './TimetablesTab.css';

const TimetablesTab = ({
  timetables, expandedTimetableId, setExpandedTimetableId,
  setShowTimetableModal, setNewTimetable, setSelectedTimetable,
  setEditingSlot, setNewSlot, setShowSlotModal, handleDeleteSlot
}) => {
  return (
    <div className="timetables-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>⏰ Timetable Management</h2>
          <span className="record-count">{timetables.length} timetables</span>
        </div>
        <button className="add-button" onClick={() => { 
          setNewTimetable({ program_id: "", academic_year: "2024/2025", semester: 1, year_of_study: 1, is_active: true }); 
          setShowTimetableModal(true); 
        }}>+ Create New Timetable</button>
      </div>

      <div className="timetables-grid">
        {timetables.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📅</span>
            <p>No timetables created yet</p>
          </div>
        ) : (
          timetables.map((tt) => (
            <div key={tt.id} className="timetable-card">
              <div className="timetable-header">
                <h3>{tt.programs?.name || "Unknown Program"} - Year {tt.year_of_study}</h3>
                <div className="timetable-badges">
                  <span className="semester-badge">Semester {tt.semester}</span>
                  <span className={`status-badge ${tt.is_active ? "active" : "inactive"}`}>
                    {tt.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <p className="timetable-year">{tt.academic_year}</p>
              <p className="slot-count">{tt.program_timetable_slots?.length || 0} slot{(tt.program_timetable_slots?.length || 0) !== 1 ? "s" : ""}</p>
              <button 
                className={`expand-btn ${expandedTimetableId === tt.id ? 'expanded' : ''}`} 
                onClick={() => setExpandedTimetableId(expandedTimetableId === tt.id ? null : tt.id)}
              >
                {expandedTimetableId === tt.id ? "↑ Hide Slots" : "↓ View & Edit Slots"}
              </button>
              {expandedTimetableId === tt.id && (
                <div className="expanded-slots">
                  <div className="slots-header">
                    <h4>Time Slots</h4>
                    <button className="add-button small" onClick={() => { 
                      setSelectedTimetable(tt); 
                      setEditingSlot(null); 
                      setNewSlot({ course_code: "", course_name: "", lecturer_id: "", day_of_week: 1, start_time: "08:00", end_time: "10:00", room_number: "", building: "CS Building", slot_type: "lecture" }); 
                      setShowSlotModal(true); 
                    }}>+ Add Slot</button>
                  </div>
                  {tt.program_timetable_slots?.length > 0 ? (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Course</th>
                            <th>Lecturer</th>
                            <th>Location</th>
                            <th>Type</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tt.program_timetable_slots.map((slot) => (
                            <tr key={slot.id}>
                              <td className="day">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][slot.day_of_week]}</td>
                              <td className="time">{slot.start_time} – {slot.end_time}</td>
                              <td>
                                <strong className="course-code">{slot.course_code}</strong>
                                <br />
                                <small className="course-name">{slot.course_name}</small>
                              </td>
                              <td>{slot.lecturers?.full_name || "Not Assigned"}</td>
                              <td>{slot.room_number} {slot.building}</td>
                              <td><span className="slot-type-badge">{slot.slot_type}</span></td>
                              <td>
                                <div className="slot-actions">
                                  <button className="action-btn edit small" onClick={() => { 
                                    setSelectedTimetable(tt); 
                                    setEditingSlot(slot); 
                                    setNewSlot({ 
                                      course_code: slot.course_code, 
                                      course_name: slot.course_name, 
                                      lecturer_id: slot.lecturer_id || "", 
                                      day_of_week: slot.day_of_week, 
                                      start_time: slot.start_time, 
                                      end_time: slot.end_time, 
                                      room_number: slot.room_number, 
                                      building: slot.building, 
                                      slot_type: slot.slot_type 
                                    }); 
                                    setShowSlotModal(true); 
                                  }}>✏️</button>
                                  <button className="action-btn delete small" onClick={() => handleDeleteSlot(slot.id)}>🗑️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-slots">No slots added yet.</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimetablesTab;