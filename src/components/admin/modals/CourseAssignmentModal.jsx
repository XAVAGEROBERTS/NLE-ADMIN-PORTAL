// src/components/admin/modals/CourseAssignmentModal.jsx - FIXED
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import '../AdminDashboardStyles.css';

const CourseAssignmentModal = ({ lecturer, onClose, onAssign }) => {
  const [availableCourses, setAvailableCourses] = useState([]);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedForUnassign, setSelectedForUnassign] = useState([]);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1));
  const [semester, setSemester] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lecturer?.id) {
      fetchData();
    }
  }, [lecturer?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get all active courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, course_code, course_name, department_code, year, semester, is_active')
        .eq('is_active', true)
        .order('course_code');

      if (coursesError) throw coursesError;

      // Get current allocations for this lecturer
      const { data: allocationsData, error: allocError } = await supabase
        .from('course_allocations')
        .select(`
          id,
          course_id,
          academic_year,
          semester,
          status,
          notes,
          created_at,
          courses:course_id (
            id,
            course_code,
            course_name,
            department_code
          )
        `)
        .eq('lecturer_id', lecturer.id)
        .in('status', ['approved', 'pending']);

      if (allocError) throw allocError;

      // Get course IDs that are already allocated
      const allocatedCourseIds = (allocationsData || [])
        .filter(a => a.status === 'approved' || a.status === 'pending')
        .map(a => a.course_id);

      // Separate assigned and available courses
      const assigned = coursesData.filter(c => allocatedCourseIds.includes(c.id));
      const available = coursesData.filter(c => !allocatedCourseIds.includes(c.id));

      // Merge allocation info with assigned courses
      const assignedWithAlloc = assigned.map(course => {
        const allocation = allocationsData.find(a => a.course_id === course.id);
        return {
          ...course,
          allocation_id: allocation?.id,
          allocation_status: allocation?.status,
          allocation_notes: allocation?.notes,
          allocation_academic_year: allocation?.academic_year,
          allocation_semester: allocation?.semester,
        };
      });

      setAssignedCourses(assignedWithAlloc);
      setAvailableCourses(available);
      setSelectedForUnassign([]);

    } catch (err) {
      console.error("Error loading courses:", err);
      alert("Error loading courses: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedCourse) return alert('Select a course');
    if (!academicYear.trim()) {
      alert('Please enter Academic Year');
      return;
    }

    setSubmitting(true);

    try {
      // Find the selected course to get its department_code
      const selectedCourseData = availableCourses.find(c => c.id === selectedCourse);
      
      if (!selectedCourseData) {
        throw new Error('Course not found');
      }

      // Get the lecturer's department if not available on the course
      let departmentCode = selectedCourseData.department_code;
      
      // If course doesn't have department_code, try to get from lecturer's departments
      if (!departmentCode) {
        const { data: lecturerDepts } = await supabase
          .from('lecturer_departments')
          .select('department_code')
          .eq('lecturer_id', lecturer.id)
          .eq('is_active', true)
          .limit(1);
          
        if (lecturerDepts && lecturerDepts.length > 0) {
          departmentCode = lecturerDepts[0].department_code;
        }
      }

      // If still no department_code, try to get from lecturer's primary department
      if (!departmentCode && lecturer.department) {
        departmentCode = lecturer.department;
      }

      // If still no department_code, use a default or prompt
      if (!departmentCode) {
        const dept = prompt('Please enter the department code for this course (e.g., SCT, ENG, BUS):');
        if (!dept) {
          setSubmitting(false);
          return;
        }
        departmentCode = dept.trim().toUpperCase();
      }

      // ✅ FIXED: Include ALL required fields
      const allocationData = {
        course_id: selectedCourse,
        lecturer_id: lecturer.id,
        department_code: departmentCode,  // ✅ REQUIRED - NOT NULL
        academic_year: academicYear,
        semester: parseInt(semester),
        status: 'approved',  // Admin approval is automatic
        requested_by: 'admin',
        requested_at: new Date().toISOString(),
        approved_by: 'admin',
        approved_at: new Date().toISOString(),
        notes: 'Assigned by System Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: allocData, error: allocError } = await supabase
        .from('course_allocations')
        .insert([allocationData])
        .select()
        .single();

      if (allocError) {
        console.error('Allocation error:', allocError);
        throw new Error(allocError.message);
      }

      alert('✅ Course assigned successfully!');

      // Update the courses table for backward compatibility
      await supabase
        .from('courses')
        .update({ lecturer_id: lecturer.id })
        .eq('id', selectedCourse);

      // Update UI
      const assignedWithAlloc = {
        ...selectedCourseData,
        allocation_id: allocData.id,
        allocation_status: allocData.status,
        allocation_notes: allocData.notes,
        allocation_academic_year: allocData.academic_year,
        allocation_semester: allocData.semester,
      };

      setAssignedCourses(prev => [...prev, assignedWithAlloc]);
      setAvailableCourses(prev => prev.filter(c => c.id !== selectedCourse));
      setSelectedCourse('');
      onAssign();

    } catch (err) {
      console.error('Assignment error:', err);
      alert('Error assigning course: ' + err.message);
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
    if (selectedForUnassign.length === 0) return alert('Select at least one course');
    if (!window.confirm(`Unassign ${selectedForUnassign.length} selected course(s)?`)) return;

    setSubmitting(true);

    try {
      const coursesToUnassign = assignedCourses.filter(c => selectedForUnassign.includes(c.id));
      const allocationIds = coursesToUnassign.map(c => c.allocation_id).filter(Boolean);

      if (allocationIds.length === 0) {
        alert('No allocation records found to delete');
        return;
      }

      // Delete course allocations
      const { error: deleteError } = await supabase
        .from('course_allocations')
        .delete()
        .in('id', allocationIds);

      if (deleteError) throw deleteError;

      // Update courses table to remove lecturer_id
      const { error: updateError } = await supabase
        .from('courses')
        .update({ lecturer_id: null })
        .in('id', selectedForUnassign);

      if (updateError) throw updateError;

      alert(`✅ ${selectedForUnassign.length} course(s) unassigned successfully!`);

      const unassignedCourses = assignedCourses.filter(c => selectedForUnassign.includes(c.id));
      setAssignedCourses(prev => prev.filter(c => !selectedForUnassign.includes(c.id)));
      setAvailableCourses(prev => [...prev, ...unassignedCourses.map(c => ({ ...c, allocation_id: null }))]);
      setSelectedForUnassign([]);
      onAssign();

    } catch (err) {
      console.error('Unassignment error:', err);
      alert('Error unassigning courses: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignSingle = async (courseId) => {
    const course = assignedCourses.find(c => c.id === courseId);
    if (!course) return;

    if (!window.confirm(`Unassign ${course.course_code} from ${lecturer.full_name}?`)) return;

    setSubmitting(true);

    try {
      if (course.allocation_id) {
        const { error: deleteError } = await supabase
          .from('course_allocations')
          .delete()
          .eq('id', course.allocation_id);

        if (deleteError) throw deleteError;
      }

      await supabase        .from('courses')
        .update({ lecturer_id: null })
        .eq('id', courseId);

      alert(`✅ ${course.course_code} unassigned successfully!`);

      setAssignedCourses(prev => prev.filter(c => c.id !== courseId));
      setAvailableCourses(prev => [...prev, { ...course, allocation_id: null }]);
      onAssign();

    } catch (err) {
      console.error('Unassignment error:', err);
      alert('Error unassigning course: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssignedCourseRow = (course) => {
    const statusColors = {
      approved: '#28a745',
      pending: '#ffc107',
      rejected: '#dc3545',
    };

    return (
      <tr key={course.id}>
        <td>
          <input
            type="checkbox"
            checked={selectedForUnassign.includes(course.id)}
            onChange={() => toggleSelectForUnassign(course.id)}
            disabled={submitting}
          />
        </td>
        <td>
          <strong>{course.course_code}</strong>
        </td>
        <td>{course.course_name}</td>
        <td>
          <span className="dept-badge">{course.department_code || 'N/A'}</span>
        </td>
        <td>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: statusColors[course.allocation_status] || '#6c757d',
            color: 'white'
          }}>
            {course.allocation_status || 'approved'}
          </span>
        </td>
        <td>
          {course.allocation_academic_year || academicYear}
          {course.allocation_semester ? ` - Sem ${course.allocation_semester}` : ''}
        </td>
        <td>
          <button
            className="action-btn delete small"
            onClick={() => handleUnassignSingle(course.id)}
            disabled={submitting}
            title="Unassign this course"
          >
            🗑️
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="modal large-modal course-assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📚 Course Assignment</h3>
          <button className="close-btn" onClick={onClose} disabled={submitting}>✕</button>
        </div>
        
        <div className="lecturer-info">
          <span className="lecturer-name">{lecturer.full_name}</span>
          <span className="lecturer-id-badge">{lecturer.lecturer_id || lecturer.email}</span>
        </div>

        {loading ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading courses...</p>
          </div>
        ) : (
          <div className="modal-body">
            {/* Assign New Course Section */}
            <div className="assign-section">
              <h4>➕ Assign New Course</h4>
              <div className="assign-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Academic Year</label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="e.g. 2024/2025"
                      className="form-input"
                      disabled={submitting}
                    />
                  </div>
                  <div className="form-group">
                    <label>Semester</label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(parseInt(e.target.value))}
                      className="form-select"
                      disabled={submitting}
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Select Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="form-select"
                    disabled={submitting}
                  >
                    <option value="">— Select course —</option>
                    {availableCourses.length === 0 ? (
                      <option value="" disabled>No available courses</option>
                    ) : (
                      availableCourses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.course_code} — {c.course_name} ({c.department_code || 'No Dept'})
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
                  {submitting ? 'Assigning...' : '📥 Assign Course'}
                </button>
              </div>
            </div>

            {/* Assigned Courses Section */}
            <div className="assigned-section">
              <div className="assigned-header">
                <h4>📋 Assigned Courses ({assignedCourses.length})</h4>
                {assignedCourses.length > 0 && (
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={selectedForUnassign.length === assignedCourses.length && assignedCourses.length > 0}
                      onChange={selectAllForUnassign}
                      disabled={submitting}
                    />
                    Select All
                  </label>
                )}
              </div>

              {assignedCourses.length === 0 ? (
                <p className="empty-text">No courses assigned to this lecturer.</p>
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
                          <th></th>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Department</th>
                          <th>Status</th>
                          <th>Academic Year</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedCourses.map(renderAssignedCourseRow)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Allocation Summary */}
            <div className="allocation-summary">
              <div className="summary-item">
                <span>Total Assigned:</span>
                <strong>{assignedCourses.length}</strong>
              </div>
              <div className="summary-item">
                <span>Available Courses:</span>
                <strong>{availableCourses.length}</strong>
              </div>
              <div className="summary-item">
                <span>Academic Year:</span>
                <strong>{academicYear}</strong>
              </div>
              <div className="summary-item">
                <span>Semester:</span>
                <strong>{semester}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button className="refresh-button" onClick={fetchData} disabled={loading || submitting}>
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseAssignmentModal;