import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export const useLecturerDepartments = (lecturerId) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lecturerId) {
      fetchDepartments();
    } else {
      setLoading(false);
    }
  }, [lecturerId]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lecturer_departments')
        .select('department_code, department_name, access_level')
        .eq('lecturer_id', lecturerId)
        .eq('is_active', true);

      if (error) throw error;
      setDepartments(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError('Failed to load department access');
    } finally {
      setLoading(false);
    }
  };

  return { 
    departments, 
    loading, 
    error,
    refetch: fetchDepartments,
    departmentCodes: departments.map(d => d.department_code)
  };
};

// Higher Order Component for department filtering
export const withDepartmentFilter = (Component) => {
  return function DepartmentFilterWrapper(props) {
    const { profile, isLecturer } = props;
    const { departments, loading, error, departmentCodes } = useLecturerDepartments(profile?.id);

    // Component styles
    const styles = `
      .department-filter-wrapper {
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .restricted-access-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .restricted-access-card {
        background: white;
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        animation: slideUp 0.5s ease-out;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .restricted-access-icon {
        font-size: 80px;
        margin-bottom: 20px;
        animation: bounce 2s infinite;
      }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }

      .restricted-access-card h2 {
        color: #e74c3c;
        margin: 0 0 15px 0;
        font-size: 28px;
      }

      .restricted-access-card p {
        color: #7f8c8d;
        margin: 10px 0;
        line-height: 1.6;
      }

      .department-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #3498db;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin: 5px;
      }

      .loading-departments {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: 20px;
      }

      .department-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .department-info-bar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        margin: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 15px;
      }

      .department-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .department-status {
        background: rgba(255, 255, 255, 0.2);
        padding: 5px 15px;
        border-radius: 15px;
        font-size: 14px;
        font-weight: 600;
      }

      .no-access-message {
        background: #fff5f5;
        border: 2px solid #fed7d7;
        border-radius: 12px;
        padding: 20px;
        margin: 20px;
        text-align: center;
        color: #c53030;
      }
    `;

    if (loading) {
      return (
        <>
          <style>{styles}</style>
          <div className="loading-departments">
            <div className="department-spinner"></div>
            <p>Loading department access...</p>
          </div>
        </>
      );
    }

    if (error) {
      return (
        <>
          <style>{styles}</style>
          <div className="no-access-message">
            <h3>⚠️ Error Loading Access</h3>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              style={{ marginTop: '15px', padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        </>
      );
    }

    // If lecturer has no departments, show restricted view
    if (isLecturer && departments.length === 0) {
      return (
        <>
          <style>{styles}</style>
          <div className="restricted-access-container">
            <div className="restricted-access-card">
              <div className="restricted-access-icon">🔒</div>
              <h2>No Department Access</h2>
              <p>You haven't been assigned to any academic departments yet.</p>
              <p>This means you won't be able to view courses, students, or assignments.</p>
              <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
                <p style={{ color: '#7f8c8d', fontSize: '14px', margin: 0 }}>
                  Please contact the system administrator to request department access.
                </p>
              </div>
              <button 
                onClick={() => supabase.auth.signOut()}
                style={{ marginTop: '25px', padding: '12px 30px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
              >
                Logout
              </button>
            </div>
          </div>
        </>
      );
    }

    // Filter data based on departments
    const filterDataByDepartment = (data, dataType) => {
      if (!isLecturer || departments.length === 0) return data || [];

      const allowedDeptCodes = departmentCodes;
      
      switch (dataType) {
        case 'courses':
          return (data || []).filter(course => 
            allowedDeptCodes.includes(course.department_code) ||
            allowedDeptCodes.includes(course.department) ||
            allowedDeptCodes.some(code => 
              course.department_name?.includes(code) || 
              course.program?.includes(code)
            )
          );
        
        case 'students':
          return (data || []).filter(student => 
            student.department_code ? 
            allowedDeptCodes.includes(student.department_code) : 
            student.program ? 
            allowedDeptCodes.some(code => student.program.includes(code)) : 
            true
          );
        
        case 'assignments':
          return (data || []).filter(assignment => {
            const assignmentDept = assignment.courses?.department_code || 
                                  assignment.department_code ||
                                  assignment.courses?.department;
            return allowedDeptCodes.includes(assignmentDept) ||
                   allowedDeptCodes.some(code => 
                     assignment.courses?.department_name?.includes(code) ||
                     assignment.courses?.program?.includes(code)
                   );
          });
        
        case 'lectures':
          return (data || []).filter(lecture => {
            const lectureDept = lecture.courses?.department_code || 
                               lecture.department_code;
            return allowedDeptCodes.includes(lectureDept);
          });
        
        default:
          return data || [];
      }
    };

    // Helper to check if data belongs to allowed department
    const hasDepartmentAccess = (item, field = 'department_code') => {
      if (!isLecturer || departments.length === 0) return true;
      const allowedDeptCodes = departmentCodes;
      return allowedDeptCodes.includes(item[field]) ||
             allowedDeptCodes.some(code => 
               item.department_name?.includes(code) ||
               item.program?.includes(code)
             );
    };

    // Department info component
    const DepartmentInfo = () => (
      <div className="department-info-bar">
        <div>
          <strong>👨‍🏫 Lecturer Access</strong>
          <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
            {profile?.full_name} • {departments.length} Department{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="department-list">
          {departments.map((dept, index) => (
            <span key={index} className="department-badge">
              🏛️ {dept.department_code}
              <span style={{ fontSize: '12px', opacity: 0.9 }}>({dept.access_level})</span>
            </span>
          ))}
          {departments.length > 0 && (
            <span className="department-status">
              {departments.length} of 12 departments
            </span>
          )}
        </div>
      </div>
    );

    return (
      <>
        <style>{styles}</style>
        <div className="department-filter-wrapper">
          {isLecturer && departments.length > 0 && <DepartmentInfo />}
          <Component 
            {...props}
            allowedDepartments={departments}
            departmentCodes={departmentCodes}
            filterDataByDepartment={filterDataByDepartment}
            hasDepartmentAccess={hasDepartmentAccess}
          />
        </div>
      </>
    );
  };
};

// Department context for child components
export const DepartmentContext = React.createContext();

export const DepartmentProvider = ({ children, lecturerId }) => {
  const departmentData = useLecturerDepartments(lecturerId);
  
  return (
    <DepartmentContext.Provider value={departmentData}>
      {children}
    </DepartmentContext.Provider>
  );
};

export default useLecturerDepartments;