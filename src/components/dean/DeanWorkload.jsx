// dean/DeanWorkload.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanWorkload = ({ departments }) => {
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchWorkload = useCallback(async () => {
    if (deptCodes.length === 0) {
      setWorkload([]);
      return;
    }

    setLoading(true);
    try {
      const { data: lecturerDepts } = await supabase
        .from('lecturer_departments')
        .select('lecturer_id, department_code')
        .in('department_code', deptCodes);

      const lecturerIds = [...new Set(lecturerDepts?.map(ld => ld.lecturer_id) || [])];

      if (lecturerIds.length === 0) {
        setWorkload([]);
        setLoading(false);
        return;
      }

      const [lecturersRes, allocationsRes] = await Promise.all([
        supabase.from('lecturers').select('id, full_name, email, specialization').in('id', lecturerIds),
        supabase.from('course_allocations').select('course_id, lecturer_id, department_code, status').in('lecturer_id', lecturerIds).eq('status', 'approved'),
      ]);

      const lecturers = lecturersRes.data || [];
      const allocations = allocationsRes.data || [];

      const courseIds = [...new Set(allocations?.map(a => a.course_id) || [])];
      let coursesData = [];
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id, course_code, course_name, credits, department_code')
          .in('id', courseIds);
        coursesData = courses || [];
      }

      const workloadMap = {};
      lecturers.forEach(lecturer => {
        workloadMap[lecturer.id] = {
          lecturer,
          courses: [],
          totalCredits: 0,
          totalCourses: 0,
          departments: [],
        };
      });

      (lecturerDepts || []).forEach(ld => {
        if (workloadMap[ld.lecturer_id]) {
          workloadMap[ld.lecturer_id].departments.push(ld.department_code);
        }
      });

      (allocations || []).forEach(a => {
        const course = coursesData.find(c => c.id === a.course_id);
        if (course && workloadMap[a.lecturer_id]) {
          workloadMap[a.lecturer_id].courses.push(course);
          workloadMap[a.lecturer_id].totalCredits += course.credits || 3;
          workloadMap[a.lecturer_id].totalCourses += 1;
        }
      });

      let workloadList = Object.values(workloadMap);

      if (selectedDepartment !== 'all') {
        workloadList = workloadList.filter(w =>
          w.departments.includes(selectedDepartment)
        );
      }

      setWorkload(workloadList);
    } catch (err) {
      console.error('Error fetching workload:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, selectedDepartment]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  const filteredWorkload = useMemo(() => {
    return workload.filter((w) => {
      const matchFilter = filter === 'all' ||
        (filter === 'heavy' && w.totalCredits > 15) ||
        (filter === 'medium' && w.totalCredits >= 8 && w.totalCredits <= 15) ||
        (filter === 'light' && w.totalCredits < 8);

      const matchSearch = w.lecturer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.lecturer?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [workload, filter, searchTerm]);

  const getWorkloadStatus = (credits) => {
    if (credits > 15) return { label: 'Heavy', color: 'red' };
    if (credits >= 8) return { label: 'Medium', color: 'orange' };
    return { label: 'Light', color: 'green' };
  };

  return (
    <div className="dean-section">
      <h2 className="dean-section-title">⚖️ Faculty Workload</h2>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search lecturers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
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
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All Workloads</option>
          <option value="heavy">Heavy (&gt;15 credits)</option>
          <option value="medium">Medium (8-15 credits)</option>
          <option value="light">Light (&lt;8 credits)</option>
        </select>
      </div>

      <div className="dean-workload-grid">
        {loading ? (
          <div className="dean-loading">Loading workload data...</div>
        ) : filteredWorkload.length === 0 ? (
          <div className="dean-empty">
            <span>📭</span>
            <h3>No workload data found</h3>
          </div>
        ) : (
          filteredWorkload.map((w) => {
            const status = getWorkloadStatus(w.totalCredits);
            return (
              <div key={w.lecturer?.id} className="dean-workload-card">
                <div className="dean-workload-header">
                  <h3>{w.lecturer?.full_name}</h3>
                  <span className={`dean-workload-badge dean-badge-${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="dean-workload-email">{w.lecturer?.email}</p>
                <div className="dean-workload-depts">
                  {w.departments.map((dept, idx) => (
                    <span key={idx} className="dean-badge">{dept}</span>
                  ))}
                </div>
                <div className="dean-workload-stats">
                  <span>📚 {w.totalCourses} courses</span>
                  <span>📊 {w.totalCredits} credits</span>
                </div>
                <div className="dean-workload-courses">
                  <h4>Assigned Courses:</h4>
                  <ul>
                    {w.courses.map((c, idx) => (
                      <li key={idx}>
                        <strong>{c.course_code}</strong> - {c.course_name} ({c.credits} credits)
                        <br />
                        <small>{c.department_code}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DeanWorkload;