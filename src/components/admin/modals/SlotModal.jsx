// src/components/admin/SlotModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase'; // adjust path if needed

const SlotModal = ({
  showSlotModal,
  setShowSlotModal,
  newSlot,
  setNewSlot,
  editingSlot,
  handleSaveSlot,
  lecturersList = [],          // full list (fallback)
  selectedTimetable
}) => {
  const [allowedLecturers, setAllowedLecturers] = useState([]);
  const [loadingLecturers, setLoadingLecturers] = useState(false);
  const [courseLookupMsg, setCourseLookupMsg] = useState('');

  // ==================== Fetch lecturers assigned to this course ====================
  const fetchAllowedLecturers = useCallback(async (courseCode) => {
    if (!courseCode || courseCode.trim().length < 3) {
      setAllowedLecturers([]);
      setCourseLookupMsg('');
      // Clear course_id when code is cleared
      setNewSlot(prev => ({ ...prev, course_id: null }));
      return;
    }

    setLoadingLecturers(true);
    setCourseLookupMsg('Looking up course...');

    try {
      // 1. Find the course by code
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, course_code, course_name')
        .eq('course_code', courseCode.trim().toUpperCase())
        .maybeSingle();

      if (courseError) throw courseError;

      if (!course) {
        setAllowedLecturers([]);
        setCourseLookupMsg('⚠️ Course not found. Please check the course code.');
        setNewSlot(prev => ({ ...prev, course_id: null }));
        return;
      }

      // Auto-fill course_id and course_name (nice UX)
      setNewSlot(prev => ({
        ...prev,
        course_id: course.id,
        course_name: prev.course_name || course.course_name || '',
      }));

      // 2. Get approved allocations for this course
      const { data: allocations, error: allocError } = await supabase
        .from('course_allocations')
        .select(`
          lecturer_id,
          status,
          lecturers:lecturer_id (
            id,
            full_name
          )
        `)
        .eq('course_id', course.id)
        .eq('status', 'approved');

      if (allocError) throw allocError;

      const lecturers = (allocations || [])
        .map(a => a.lecturers)
        .filter(l => l && l.id);

      setAllowedLecturers(lecturers);

      if (lecturers.length === 0) {
        setCourseLookupMsg('⚠️ No lecturer is currently assigned to this course. Assign the course first in Course Allocations.');
      } else {
        setCourseLookupMsg(`✅ ${lecturers.length} lecturer(s) assigned to this course`);
      }

      // If the currently selected lecturer is no longer allowed, clear it
      setNewSlot(prev => {
        if (prev.lecturer_id && !lecturers.some(l => l.id === prev.lecturer_id)) {
          return { ...prev, lecturer_id: '' };
        }
        return prev;
      });

    } catch (err) {
      console.error('Error looking up course/lecturers:', err);
      setCourseLookupMsg('Error: ' + err.message);
      setAllowedLecturers([]);
    } finally {
      setLoadingLecturers(false);
    }
  }, [setNewSlot]);

  // Trigger lookup when course_code changes
  useEffect(() => {
    if (!showSlotModal) return;

    const timer = setTimeout(() => {
      fetchAllowedLecturers(newSlot.course_code);
    }, 400); // small debounce

    return () => clearTimeout(timer);
  }, [newSlot.course_code, showSlotModal, fetchAllowedLecturers]);

  // When modal opens for editing, also run the lookup
  useEffect(() => {
    if (showSlotModal && editingSlot && newSlot.course_code) {
      fetchAllowedLecturers(newSlot.course_code);
    }
  }, [showSlotModal, editingSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decide which list to show in the dropdown
  const lecturerOptions = allowedLecturers.length > 0
    ? allowedLecturers
    : []; // Only show assigned lecturers. Do NOT fall back to full list.

  return (
    <>
      <div className="modal-overlay" onClick={() => setShowSlotModal(false)}>
        <div className="modal slot-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>⏰ {editingSlot ? "Edit" : "Add New"} Time Slot</h3>
            <button className="close-btn" onClick={() => setShowSlotModal(false)}>✕</button>
          </div>

          {selectedTimetable && (
            <div className="timetable-context">
              <span className="context-label">Timetable:</span>
              <span className="context-value">
                {selectedTimetable.programs?.name || 'Unknown'} - Year {selectedTimetable.year_of_study}, Semester {selectedTimetable.semester}
              </span>
            </div>
          )}

          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Course Code *</label>
                <input
                  type="text"
                  value={newSlot.course_code || ''}
                  onChange={(e) =>
                    setNewSlot({
                      ...newSlot,
                      course_code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. CSE1101"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input
                  type="text"
                  value={newSlot.course_name || ''}
                  onChange={(e) => setNewSlot({ ...newSlot, course_name: e.target.value })}
                  placeholder="Auto-filled if course exists"
                  className="form-input"
                />
              </div>
            </div>

            {/* Feedback message */}
            {courseLookupMsg && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  background: courseLookupMsg.startsWith('✅')
                    ? '#e8f5e9'
                    : courseLookupMsg.startsWith('⚠️')
                    ? '#fff3e0'
                    : '#ffebee',
                  color: courseLookupMsg.startsWith('✅')
                    ? '#2e7d32'
                    : courseLookupMsg.startsWith('⚠️')
                    ? '#e65100'
                    : '#c62828',
                }}
              >
                {loadingLecturers ? '🔄 Checking course...' : courseLookupMsg}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Lecturer{' '}
                {allowedLecturers.length > 0 && (
                  <span style={{ fontWeight: 400, color: '#666' }}>
                    (only assigned lecturers shown)
                  </span>
                )}
              </label>
              <select
                value={newSlot.lecturer_id || ''}
                onChange={(e) => setNewSlot({ ...newSlot, lecturer_id: e.target.value })}
                className="form-select"
                disabled={loadingLecturers || allowedLecturers.length === 0}
              >
                <option value="">
                  {allowedLecturers.length === 0
                    ? 'No assigned lecturer available'
                    : 'Select Lecturer'}
                </option>
                {lecturerOptions.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.full_name}
                  </option>
                ))}
              </select>

              {allowedLecturers.length === 0 && newSlot.course_code && (
                <small style={{ color: '#e65100', marginTop: 6, display: 'block' }}>
                  Go to <strong>Course Allocations</strong> and assign a lecturer to this course first.
                </small>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Day</label>
                <select
                  value={newSlot.day_of_week || 1}
                  onChange={(e) =>
                    setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })
                  }
                  className="form-select"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  value={newSlot.start_time || ''}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Time</label>
                <input
                  type="time"
                  value={newSlot.end_time || ''}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Room</label>
                <input
                  type="text"
                  value={newSlot.room_number || ''}
                  onChange={(e) => setNewSlot({ ...newSlot, room_number: e.target.value })}
                  placeholder="e.g. 101"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Building</label>
                <input
                  type="text"
                  value={newSlot.building || ''}
                  onChange={(e) => setNewSlot({ ...newSlot, building: e.target.value })}
                  placeholder="e.g. CS Building"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  value={newSlot.slot_type || 'lecture'}
                  onChange={(e) => setNewSlot({ ...newSlot, slot_type: e.target.value })}
                  className="form-select"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="practical">Practical</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={() => setShowSlotModal(false)}>
              Cancel
            </button>
            <button
              className="confirm-button"
              onClick={handleSaveSlot}
              disabled={
                !newSlot.course_code ||
                (allowedLecturers.length > 0 && !newSlot.lecturer_id) // force selection if lecturers exist
              }
            >
              {editingSlot ? 'Update' : 'Add'} Slot
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          backdrop-filter: blur(5px);
        }

        .modal {
          background: white;
          border-radius: 20px;
          padding: 35px;
          max-width: 750px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
          animation: modalSlideUp 0.4s ease-out;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e8ecf1;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          color: #1a1a2e;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
          padding: 5px;
        }

        .close-btn:hover {
          color: #dc3545;
          transform: scale(1.1);
        }

        .timetable-context {
          background: #f0f7ff;
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #667eea;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .context-label {
          font-weight: 600;
          color: #1a1a2e;
        }

        .context-value {
          color: #6b7280;
        }

        .modal-body {
          max-height: 55vh;
          overflow-y: auto;
          padding-right: 5px;
        }

        .modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 3px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .form-label {
          font-weight: 600;
          color: #1a1a2e;
          font-size: 14px;
        }

        .form-input,
        .form-select {
          padding: 12px 16px;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s;
          background: #fafbfc;
          font-family: inherit;
          width: 100%;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .form-input:disabled,
        .form-select:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e8ecf1;
        }

        .cancel-button {
          padding: 12px 25px;
          background: transparent;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          color: #6b7280;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .cancel-button:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }

        .confirm-button {
          padding: 12px 30px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .confirm-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }

        .confirm-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .modal {
            padding: 25px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column;
          }

          .modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default SlotModal;