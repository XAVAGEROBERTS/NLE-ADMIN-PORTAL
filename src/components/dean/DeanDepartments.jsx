// dean/DeanDepartments.jsx
import React from 'react';

const DeanDepartments = ({ departments, hods }) => {
  return (
    <div className="dean-section">
      <h2 className="dean-section-title">🏢 Departments</h2>

      <div className="dean-card">
        <table className="dean-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Department Name</th>
              <th>Head of Department</th>
              <th>HOD Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                  No departments found in this faculty
                </td>
              </tr>
            ) : (
              departments.map((dept) => {
                const hod = hods.find(h => h.department_id === dept.id);
                return (
                  <tr key={dept.id}>
                    <td><strong>{dept.department_code}</strong></td>
                    <td>{dept.department_name}</td>
                    <td>{dept.head_of_department || '—'}</td>
                    <td>{hod?.email || '—'}</td>
                    <td>
                      <span className={`dean-status ${dept.is_active !== false ? 'active' : 'inactive'}`}>
                        {dept.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeanDepartments;