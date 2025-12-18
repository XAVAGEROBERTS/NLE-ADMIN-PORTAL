import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import './AdminDashboardStyles.css';

const DepartmentAssignmentModal = ({ lecturer, onClose, onAssign }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching data for lecturer:', lecturer);
      
      // Get lecturer's current departments from lecturer_departments
      const { data: currentDepts, error: deptError } = await supabase
        .from('lecturer_departments')
        .select('*')
        .eq('lecturer_id', lecturer.id);

      if (deptError) throw deptError;

      console.log('Current departments from DB:', currentDepts);

      const currentCodes = currentDepts?.map(dept => dept.department_code) || [];
      console.log('Current department codes:', currentCodes);
      setSelectedDepartments(currentCodes);
      setDepartments(currentDepts || []);

      // Get all unique departments from courses for available options
      const { data: allDepts, error: courseError } = await supabase
        .from('courses')
        .select('department_code, department')
        .not('department_code', 'is', null)
        .order('department_code');

      if (courseError) throw courseError;

      // Get unique departments
      const uniqueDepts = [...new Map(allDepts?.map(dept => 
        [dept.department_code, { 
          code: dept.department_code, 
          name: dept.department || dept.department_code 
        }]
      )).values()];

      console.log('Available unique departments:', uniqueDepts);
      setAvailableDepartments(uniqueDepts);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading department data');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentToggle = (deptCode) => {
    setSelectedDepartments(prev => {
      if (prev.includes(deptCode)) {
        return prev.filter(code => code !== deptCode);
      } else {
        return [...prev, deptCode];
      }
    });
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (!window.confirm('Are you sure you want to remove this department assignment?')) {
      return;
    }

    try {
      setIsDeleting(true);
      console.log('Deleting department assignment ID:', departmentId);
      
      const { error } = await supabase
        .from('lecturer_departments')
        .delete()
        .eq('id', departmentId);

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      console.log('Department deleted successfully');
      alert('Department assignment removed successfully!');
      
      // Refresh the data
      fetchData();
      
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Error deleting department assignment. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssignDepartments = async () => {
    try {
      console.log('Assigning departments:', selectedDepartments);
      
      // Get current assignments to see what needs to be added/removed
      const currentCodes = departments.map(dept => dept.department_code);
      const toAdd = selectedDepartments.filter(code => !currentCodes.includes(code));
      const toRemove = currentCodes.filter(code => !selectedDepartments.includes(code));

      console.log('To add:', toAdd);
      console.log('To remove:', toRemove);

      // Remove departments that are no longer selected
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('lecturer_departments')
          .delete()
          .eq('lecturer_id', lecturer.id)
          .in('department_code', toRemove);

        if (deleteError) throw deleteError;
        console.log('Removed departments:', toRemove);
      }

      // Add new departments
      if (toAdd.length > 0) {
        const assignments = toAdd.map(deptCode => {
          const dept = availableDepartments.find(d => d.code === deptCode);
          return {
            lecturer_id: lecturer.id,
            department_code: deptCode,
            department_name: dept?.name || deptCode,
            assigned_by: (JSON.parse(localStorage.getItem('adminProfile'))?.id || null),
            is_active: true,
            assigned_at: new Date().toISOString()
          };
        });

        const { error: insertError } = await supabase
          .from('lecturer_departments')
          .insert(assignments);

        if (insertError) throw insertError;
        console.log('Added departments:', toAdd);
      }

      alert('Department assignments updated successfully!');
      onAssign();
      fetchData(); // Refresh to show changes
      
    } catch (error) {
      console.error('Error assigning departments:', error);
      alert('Error assigning departments. Please try again.');
    }
  };

  const handleManualAddDepartment = async () => {
    const deptCode = prompt('Enter department code (e.g., CS, MATH):');
    if (!deptCode) return;

    const deptName = prompt('Enter department name:') || deptCode;

    // Check if already assigned
    if (departments.some(dept => dept.department_code === deptCode)) {
      alert('This department is already assigned to the lecturer.');
      return;
    }

    try {
      const { error } = await supabase
        .from('lecturer_departments')
        .insert({
          lecturer_id: lecturer.id,
          department_code: deptCode,
          department_name: deptName,
          assigned_by: (JSON.parse(localStorage.getItem('adminProfile'))?.id || null),
          is_active: true,
          assigned_at: new Date().toISOString()
        });

      if (error) throw error;

      alert('Department added successfully!');
      fetchData(); // Refresh the list
      
    } catch (error) {
      console.error('Error adding department:', error);
      alert('Error adding department. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading departments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>📁 Department Assignment: {lecturer.full_name}</h3>
        <p className="lecturer-id">Lecturer ID: {lecturer.lecturer_id}</p>
        
        <div className="current-departments-section mt-20">
          <h4>📋 Currently Assigned Departments:</h4>
          {departments.length > 0 ? (
            <div className="departments-list">
              {departments.map((dept) => (
                <div key={dept.id} className="department-item">
                  <span className="department-info">
                    <strong>{dept.department_code}</strong> - {dept.department_name}
                    {!dept.is_active && ' (Inactive)'}
                  </span>
                  <button
                    className="delete-department-btn"
                    onClick={() => handleDeleteDepartment(dept.id)}
                    disabled={isDeleting}
                    title="Remove department assignment"
                  >
                    🗑️ Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No departments assigned yet</p>
          )}
        </div>

        <div className="assign-departments-section mt-20">
          <h4>➕ Assign New Departments:</h4>
          <div className="available-departments-list">
            {availableDepartments.length > 0 ? (
              availableDepartments.map(dept => (
                <div key={dept.code} className="department-option">
                  <label className="department-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDepartments.includes(dept.code)}
                      onChange={() => handleDepartmentToggle(dept.code)}
                      disabled={departments.some(d => d.department_code === dept.code)}
                    />
                    <span className="dept-code">{dept.code}</span>
                    <span className="dept-name">{dept.name}</span>
                    {departments.some(d => d.department_code === dept.code) && 
                      <span className="already-assigned">(Already assigned)</span>
                    }
                  </label>
                </div>
              ))
            ) : (
              <p className="text-muted">No available departments found</p>
            )}
          </div>
        </div>

        <div className="modal-actions mt-20">
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          
          <button 
            className="action-btn dept"
            onClick={handleManualAddDepartment}
            disabled={isDeleting}
          >
            ➕ Add Custom Department
          </button>
          
          <button 
            className="confirm-button"
            onClick={handleAssignDepartments}
            disabled={isDeleting || selectedDepartments.length === 0}
          >
            💾 Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentAssignmentModal;