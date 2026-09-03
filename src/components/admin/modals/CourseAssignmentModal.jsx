// admin/CourseAssignmentModal.jsx - COMPLETE FIX
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import './CourseAssignmentModal.css';

const CourseAssignmentModal = ({ lecturer, onClose, onAssign }) => {
  const [availableCourses, setAvailableCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedForUnassign, setSelectedForUnassign] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        console.log('🔍 Fetching data for lecturer:', lecturer.id, lecturer.full_name);

        // 1. Get all courses
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('id, course_code, course_name, department_code, is_active')
          .order('course_code', { ascending: true });

        if (coursesError) throw coursesError;

        // 2. ✅ FIXED: Get approved allocations from course_allocations ONLY
        const { data: allocations, error: allocError } = await supabase
          .from('course_allocations')
          .select('course_id, status, created_at, approved_at')
          .eq('lecturer_id', lecturer.id)
          .eq('status', 'approved');

        if (allocError) throw allocError;

        console.log('📋 Allocations found:', allocations);

        // 3. ✅ FIXED: Use allocations to determine assigned courses (NOT courses.lecturer_id)
        const assignedIds = new Set((allocations || []).map(a => a.course_id));

        console.log('📚 Assigned course IDs from allocations:', Array.from(assignedIds));

        // 4. Filter courses based on allocations
        const assigned = coursesData.filter(c => assignedIds.has(c.id));
        const available = coursesData.filter(c => !assignedIds.has(c.id));

        console.log('✅ Assigned courses:', assigned.map(c => c.course_code));
        console.log('✅ Available courses:', available.map(c => c.course_code));

        setAssignedCourses(assigned);
        setAvailableCourses(available);
        setSelectedForUnassign([]);
      } catch (err) {
        console.error("Error loading courses:", err);
        alert("Error loading courses: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (lecturer?.id) {
      fetchData();
    }
  }, [lecturer?.id]);

  const handleAssignCourse = async () => {
    if (!selectedCourse) {
      alert('Please select a course');
      return;
    }

    try {
      setSubmitting(true);

      const selectedCourseData = availableCourses.find(c => c.id === selectedCourse);
      if (!selectedCourseData) {
        alert('Selected course not found');
        return;
      }

      // Check if allocation already exists
      const { data: existing, error: checkError } = await supabase
        .from('course_allocations')
        .select('id, status')
        .eq('course_id', selectedCourse)
        .eq('lecturer_id', lecturer.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Update existing to approved
        const { error: updateError } = await supabase
          .from('course_allocations')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: 'admin',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // Create new allocation - ONLY in course_allocations table
        const { error: insertError } = await supabase
          .from('course_allocations')
          .insert([{
            course_id: selectedCourse,
            lecturer_id: lecturer.id,
            department_code: selectedCourseData.department_code || null,
            status: 'approved',
            requested_by: 'admin',
            approved_by: 'admin',
            approved_at: new Date().toISOString(),
            requested_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (insertError) throw insertError;
      }

      // ⚠️ IMPORTANT: DO NOT update courses.lecturer_id
      // The courses table should NOT be updated here

      alert('✅ Course allocated successfully!');

      // Update local state
      const course = availableCourses.find(c => c.id === selectedCourse);
      setAssignedCourses(prev => [...prev, course]);
      setAvailableCourses(prev => prev.filter(c => c.id !== selectedCourse));
      setSelectedCourse('');
      onAssign();
    } catch (err) {
      alert('Error: ' + err.message);
      console.error('Assign error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectForUnassign = (courseId) => {
    setSelectedForUnassign(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const selectAllForUnassign = () => {
    if (selectedForUnassign.length === assignedCourses.length) {
      setSelectedForUnassign([]);
    } else {
      setSelectedForUnassign(assignedCourses.map(c => c.id));
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedForUnassign.length === 0) {
      alert('Select at least one course to unassign');
      return;
    }

    if (!window.confirm(`Unassign ${selectedForUnassign.length} selected course(s)?`)) return;

    try {
      setSubmitting(true);

      // Update allocations to 'pending' (soft delete)
      const { error } = await supabase
        .from('course_allocations')
        .update({ 
          status: 'pending',
          approved_at: null,
          approved_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('lecturer_id', lecturer.id)
        .in('course_id', selectedForUnassign);

      if (error) throw error;

      alert(`${selectedForUnassign.length} course(s) unassigned successfully!`);

      // Update local state
      setAssignedCourses(prev => prev.filter(c => !selectedForUnassign.includes(c.id)));
      const unassignedCourses = assignedCourses.filter(c => selectedForUnassign.includes(c.id));
      setAvailableCourses(prev => [...prev, ...unassignedCourses]);
      setSelectedForUnassign([]);
      onAssign();
    } catch (err) {
      alert('Error: ' + err.message);
      console.error('Unassign error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal large-modal course-assignment-modal">
        <div className="modal-header">
          <h3>📚 Assign Courses</h3>
          <button className="close-btn" onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div className="lecturer-info">
          <span className="lecturer-name">{lecturer.full_name}</span>
          <span className="lecturer-id-badge">{lecturer.lecturer_id}</span>
          <span style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
            {assignedCourses.length} course(s) assigned
          </span>
        </div>

        {loading ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading courses...</p>
          </div>
        ) : (
          <div className="modal-body">
            {/* Assign Section */}
            <div className="assign-section">
              <h4>➕ Assign New Course</h4>
              <div className="assign-form">
                <div className="form-group">
                  <label>Select Course</label>
                  <select
                    value={selectedCourse}
                    onChange={e => setSelectedCourse(e.target.value)}
                    className="form-select"
                  >
                    <option value="">— Select course —</option>
                    {availableCourses.length === 0 ? (
                      <option value="" disabled>All courses assigned</option>
                    ) : (
                      availableCourses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.course_code} — {c.course_name} ({c.department_code || 'N/A'})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <button
                  className="confirm-button"
                  onClick={handleAssignCourse}
                  disabled={!selectedCourse || submitting}
                >
                  {submitting ? '⏳ Assigning...' : '✅ Assign Course'}
                </button>
              </div>
            </div>

            {/* Assigned Courses Section */}
            <div className="assigned-section">
              <div className="assigned-header">
                <h4>📚 Assigned Courses ({assignedCourses.length})</h4>
                {assignedCourses.length > 0 && (
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={
                        selectedForUnassign.length === assignedCourses.length && 
                        assignedCourses.length > 0
                      }
                      onChange={selectAllForUnassign}
                    />
                    Select All
                  </label>
                )}
              </div>

              {assignedCourses.length === 0 ? (
                <div className="empty-text">
                  <p>No courses assigned to this lecturer.</p>
                  <p style={{ fontSize: '13px', color: '#999' }}>
                    Use the form above to assign courses.
                  </p>
                </div>
              ) : (
                <>
                  {selectedForUnassign.length > 0 && (
                    <button
                      className="unassign-bulk-btn"
                      onClick={handleBulkUnassign}
                      disabled={submitting}
                    >
                      🗑️ Unassign Selected ({selectedForUnassign.length})
                    </button>
                  )}

                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Dept</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedCourses.map(c => (
                          <tr key={c.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedForUnassign.includes(c.id)}
                                onChange={() => toggleSelectForUnassign(c.id)}
                              />
                            </td>
                            <td><strong>{c.course_code}</strong></td>
                            <td>{c.course_name}</td>
                            <td>
                              <span className="dept-badge">{c.department_code || 'N/A'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button 
            className="refresh-button" 
            onClick={() => {
              setLoading(true);
              const fetchData = async () => {
                try {
                  const { data: coursesData } = await supabase
                    .from('courses')
                    .select('id, course_code, course_name, department_code, is_active')
                    .limit(100);

                  const { data: allocations } = await supabase
                    .from('course_allocations')
                    .select('course_id, status, created_at')
                    .eq('lecturer_id', lecturer.id)
                    .eq('status', 'approved');

                  const assignedIds = new Set((allocations || []).map(a => a.course_id));
                  const assigned = coursesData.filter(c => assignedIds.has(c.id));
                  const available = coursesData.filter(c => !assignedIds.has(c.id));

                  setAssignedCourses(assigned);
                  setAvailableCourses(available);
                  setLoading(false);
                } catch (err) {
                  console.error('Refresh error:', err);
                  setLoading(false);
                }
              };
              fetchData();
            }} 
            disabled={submitting}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseAssignmentModal;