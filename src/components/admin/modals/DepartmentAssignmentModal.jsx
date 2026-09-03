import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import '../AdminDashboardStyles.css';

const DepartmentAssignmentModal = ({ lecturer, onClose, onAssign }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [primaryDepartment, setPrimaryDepartment] = useState(null);
  const [saving, setSaving] = useState(false);

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

      // Get primary department from lecturers table
      const { data: lecturerData, error: lecturerError } = await supabase
        .from('lecturers')
        .select('primary_department_code')
        .eq('id', lecturer.id)
        .single();

      if (lecturerError && lecturerError.code !== 'PGRST116') {
        console.error('Error fetching lecturer primary dept:', lecturerError);
      }

      if (lecturerData) {
        setPrimaryDepartment(lecturerData.primary_department_code);
        console.log('Primary department from DB:', lecturerData.primary_department_code);
      }

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
        // If removing the primary department, clear it
        if (primaryDepartment === deptCode) {
          setPrimaryDepartment(null);
        }
        return prev.filter(code => code !== deptCode);
      } else {
        // If adding first department, make it primary automatically
        if (prev.length === 0) {
          setPrimaryDepartment(deptCode);
        }
        return [...prev, deptCode];
      }
    });
  };

  const handleSetPrimary = (deptCode) => {
    if (!selectedDepartments.includes(deptCode)) {
      alert('Please assign this department first before setting it as primary.');
      return;
    }
    setPrimaryDepartment(deptCode);
  };

  const handleDeleteDepartment = async (departmentId, departmentCode) => {
    if (!window.confirm('Are you sure you want to remove this department assignment?')) {
      return;
    }

    try {
      setIsDeleting(true);
      console.log('Deleting department assignment ID:', departmentId);
      
      // If deleting the primary department, clear it
      if (primaryDepartment === departmentCode) {
        setPrimaryDepartment(null);
      }

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
    if (selectedDepartments.length === 0) {
      alert('Please select at least one department.');
      return;
    }

    if (!primaryDepartment) {
      alert('Please select a primary department.');
      return;
    }

    if (!selectedDepartments.includes(primaryDepartment)) {
      alert('Primary department must be one of the assigned departments.');
      return;
    }

    setSaving(true);
    
    try {
      console.log('Assigning departments:', selectedDepartments);
      console.log('Primary department:', primaryDepartment);
      
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
        const adminId = JSON.parse(localStorage.getItem('adminProfile'))?.id || null;
        
        const assignments = toAdd.map(deptCode => {
          const dept = availableDepartments.find(d => d.code === deptCode);
          return {
            lecturer_id: lecturer.id,
            department_code: deptCode,
            department_name: dept?.name || deptCode,
            assigned_by: adminId,
            is_active: true,
            assigned_at: new Date().toISOString(),
            is_primary: deptCode === primaryDepartment // Mark if this is primary
          };
        });

        const { error: insertError } = await supabase
          .from('lecturer_departments')
          .insert(assignments);

        if (insertError) throw insertError;
        console.log('Added departments:', toAdd);
      }

      // Update primary department in lecturers table
      if (primaryDepartment) {
        const { error: updateError } = await supabase
          .from('lecturers')
          .update({ 
            primary_department_code: primaryDepartment,
            updated_at: new Date().toISOString()
          })
          .eq('id', lecturer.id);

        if (updateError) {
          console.error('Error updating primary department:', updateError);
          // Don't throw here, just warn
        } else {
          console.log('Primary department updated to:', primaryDepartment);
        }
      }

      // Also update is_primary flag in lecturer_departments table
      const { error: flagError } = await supabase
        .from('lecturer_departments')
        .update({ is_primary: false })
        .eq('lecturer_id', lecturer.id);

      if (flagError) {
        console.error('Error resetting primary flags:', flagError);
      }

      // Set the new primary
      if (primaryDepartment) {
        const { error: setPrimaryError } = await supabase
          .from('lecturer_departments')
          .update({ is_primary: true })
          .eq('lecturer_id', lecturer.id)
          .eq('department_code', primaryDepartment);

        if (setPrimaryError) {
          console.error('Error setting primary flag:', setPrimaryError);
        }
      }

      alert('✅ Department assignments updated successfully!');
      onAssign();
      fetchData(); // Refresh to show changes
      
    } catch (error) {
      console.error('Error assigning departments:', error);
      alert('Error assigning departments. Please try again.');
    } finally {
      setSaving(false);
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

    // Add to available departments
    const newDept = { code: deptCode, name: deptName };
    setAvailableDepartments(prev => [...prev, newDept]);
    
    // Auto-select and make primary if no departments
    setSelectedDepartments(prev => [...prev, deptCode]);
    if (selectedDepartments.length === 0) {
      setPrimaryDepartment(deptCode);
    }

    try {
      const adminId = JSON.parse(localStorage.getItem('adminProfile'))?.id || null;
      
      const { error } = await supabase
        .from('lecturer_departments')
        .insert({
          lecturer_id: lecturer.id,
          department_code: deptCode,
          department_name: deptName,
          assigned_by: adminId,
          is_active: true,
          assigned_at: new Date().toISOString(),
          is_primary: selectedDepartments.length === 0 // Primary if first
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
      <div className="modal" style={{ maxWidth: '700px' }}>
        <h3>📁 Department Assignment: {lecturer.full_name}</h3>
        <p className="lecturer-id">Lecturer ID: {lecturer.lecturer_id}</p>
        
        {/* Primary Department Info */}
        <div className="primary-dept-info" style={{ 
          background: '#e3f2fd', 
          padding: '10px 15px', 
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #90caf9'
        }}>
          <strong>⭐ Primary Department:</strong>{' '}
          {primaryDepartment ? (
            <span style={{ color: '#1565c0', fontWeight: 'bold' }}>
              {departments.find(d => d.department_code === primaryDepartment)?.department_name || primaryDepartment}
              {' ('}{primaryDepartment}{')'}
            </span>
          ) : (
            <span style={{ color: '#f44336' }}>Not set - Please select a primary department</span>
          )}
          <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
            (Leave requests will go to the primary department)
          </span>
        </div>

        <div className="current-departments-section mt-20">
          <h4>📋 Currently Assigned Departments:</h4>
          {departments.length > 0 ? (
            <div className="departments-list">
              {departments.map((dept) => (
                <div key={dept.id} className="department-item" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: dept.department_code === primaryDepartment ? '#e8f5e9' : '#f5f5f5',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  border: dept.department_code === primaryDepartment ? '2px solid #4caf50' : '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="department-info">
                      <strong>{dept.department_code}</strong> - {dept.department_name}
                      {!dept.is_active && ' (Inactive)'}
                    </span>
                    {dept.department_code === primaryDepartment && (
                      <span style={{ 
                        background: '#4caf50', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        ⭐ Primary
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {dept.department_code !== primaryDepartment && departments.length > 1 && (
                      <button
                        className="set-primary-btn"
                        onClick={() => handleSetPrimary(dept.department_code)}
                        style={{
                          padding: '4px 12px',
                          background: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Set as Primary
                      </button>
                    )}
                    <button
                      className="delete-department-btn"
                      onClick={() => handleDeleteDepartment(dept.id, dept.department_code)}
                      disabled={isDeleting}
                      title="Remove department assignment"
                      style={{
                        padding: '4px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No departments assigned yet</p>
          )}
        </div>

        <div className="assign-departments-section mt-20">
          <h4>➕ Assign New Departments:</h4>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
            Check departments to assign. The first department selected will be the primary.
          </p>
          <div className="available-departments-list" style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '8px'
          }}>
            {availableDepartments.length > 0 ? (
              availableDepartments.map(dept => {
                const isAssigned = departments.some(d => d.department_code === dept.code);
                const isSelected = selectedDepartments.includes(dept.code);
                const isPrimary = primaryDepartment === dept.code;
                
                return (
                  <div key={dept.code} className="department-option" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: isPrimary ? '#e8f5e9' : 'transparent',
                    borderRadius: '4px',
                    marginBottom: '2px'
                  }}>
                    <label className="department-checkbox" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: isAssigned ? 'not-allowed' : 'pointer',
                      flex: 1
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDepartmentToggle(dept.code)}
                        disabled={isAssigned}
                      />
                      <span className="dept-code" style={{ fontWeight: 'bold' }}>{dept.code}</span>
                      <span className="dept-name" style={{ color: '#555' }}>{dept.name}</span>
                      {isAssigned && (
                        <span className="already-assigned" style={{ color: '#999', fontSize: '12px' }}>
                          (Already assigned)
                        </span>
                      )}
                      {isPrimary && (
                        <span style={{ 
                          background: '#4caf50', 
                          color: 'white', 
                          padding: '1px 8px', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          marginLeft: 'auto'
                        }}>
                          ⭐ Primary
                        </span>
                      )}
                    </label>
                  </div>
                );
              })
            ) : (
              <p className="text-muted">No available departments found</p>
            )}
          </div>
        </div>

        <div className="modal-actions mt-20" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <button 
            className="cancel-button"
            onClick={onClose}
            disabled={isDeleting || saving}
            style={{
              padding: '8px 20px',
              background: '#e0e0e0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          <button 
            className="action-btn dept"
            onClick={handleManualAddDepartment}
            disabled={isDeleting || saving}
            style={{
              padding: '8px 20px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ➕ Add Custom
          </button>
          
          <button 
            className="confirm-button"
            onClick={handleAssignDepartments}
            disabled={isDeleting || saving || selectedDepartments.length === 0 || !primaryDepartment}
            style={{
              padding: '8px 20px',
              background: (isDeleting || saving || selectedDepartments.length === 0 || !primaryDepartment) ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (isDeleting || saving || selectedDepartments.length === 0 || !primaryDepartment) ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentAssignmentModal;