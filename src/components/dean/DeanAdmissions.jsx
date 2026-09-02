// dean/DeanAdmissions.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanAdmissions = ({ departments }) => {
  const [admissionsData, setAdmissionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchAdmissionsData = useCallback(async () => {
    if (deptCodes.length === 0) {
      setAdmissionsData([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('id, full_name, student_id, program, department_code, year_of_study, semester, status, created_at');

      if (selectedDepartment !== 'all') {
        query = query.eq('department_code', selectedDepartment);
      } else {
        query = query.in('department_code', deptCodes);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setAdmissionsData(data || []);
    } catch (err) {
      console.error('Error fetching admissions data:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, selectedDepartment]);

  useEffect(() => {
    fetchAdmissionsData();
  }, [fetchAdmissionsData]);

  const departmentStats = useMemo(() => {
    const stats = {};
    admissionsData.forEach(s => {
      const dept = s.department_code || 'Unknown';
      if (!stats[dept]) {
        stats[dept] = { total: 0, year1: 0, year2: 0, year3: 0, year4: 0 };
      }
      stats[dept].total++;
      const year = s.year_of_study || 1;
      if (year === 1) stats[dept].year1++;
      else if (year === 2) stats[dept].year2++;
      else if (year === 3) stats[dept].year3++;
      else if (year === 4) stats[dept].year4++;
    });
    return stats;
  }, [admissionsData]);

  return (
    <div className="dean-section">
      <h2 className="dean-section-title">🎓 Student Admissions & Progression</h2>

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
        <button className="dean-refresh-btn" onClick={fetchAdmissionsData}>
          🔄 Refresh
        </button>
      </div>

      <div className="dean-stats-grid" style={{ marginBottom: '20px' }}>
        <div className="dean-stat-card dean-stat-blue">
          <h3>{admissionsData.length}</h3>
          <p>Total Students</p>
        </div>
        <div className="dean-stat-card dean-stat-green">
          <h3>{Object.keys(departmentStats).length}</h3>
          <p>Departments</p>
        </div>
        <div className="dean-stat-card dean-stat-orange">
          <h3>{admissionsData.filter(s => s.status === 'active').length}</h3>
          <p>Active Students</p>
        </div>
      </div>

      <div className="dean-card" style={{ marginBottom: '20px' }}>
        <h3 className="dean-card-title">📊 Department Breakdown</h3>
        <table className="dean-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Total</th>
              <th>Year 1</th>
              <th>Year 2</th>
              <th>Year 3</th>
              <th>Year 4</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(departmentStats).map(([dept, stats]) => (
              <tr key={dept}>
                <td><strong>{dept}</strong></td>
                <td>{stats.total}</td>
                <td>{stats.year1}</td>
                <td>{stats.year2}</td>
                <td>{stats.year3}</td>
                <td>{stats.year4}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dean-card">
        <h3 className="dean-card-title">👨‍🎓 Student List</h3>
        {loading ? (
          <div className="dean-loading">Loading students...</div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Program</th>
                <th>Department</th>
                <th>Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {admissionsData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No students found
                  </td>
                </tr>
              ) : (
                admissionsData.slice(0, 50).map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.student_id}</strong></td>
                    <td>{s.full_name}</td>
                    <td>{s.program || 'N/A'}</td>
                    <td>{s.department_code || 'N/A'}</td>
                    <td>Year {s.year_of_study || 1}</td>
                    <td>
                      <span className={`dean-status ${s.status === 'active' ? 'active' : 'inactive'}`}>
                        {s.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DeanAdmissions;