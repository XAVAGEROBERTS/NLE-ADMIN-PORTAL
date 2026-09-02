// HODWorkload.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODWorkload = ({ departmentCode, lecturers, courses }) => {
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWorkload();
  }, [departmentCode]);

  const fetchWorkload = async () => {
    setLoading(true);
    try {
      // Fetch all course allocations with lecturer info
      const { data: allocations, error } = await supabase
        .from('course_allocations')
        .select(`
          *,
          courses:course_id (course_code, course_name, credits),
          lecturers:lecturer_id (id, full_name, email)
        `)
        .eq('department_code', departmentCode)
        .eq('status', 'approved');

      if (error) throw error;

      // Calculate workload per lecturer
      const workloadMap = {};
      allocations.forEach((a) => {
        const lecturerId = a.lecturer_id;
        if (!workloadMap[lecturerId]) {
          workloadMap[lecturerId] = {
            lecturer: a.lecturers,
            courses: [],
            totalCredits: 0,
            totalCourses: 0,
          };
        }
        workloadMap[lecturerId].courses.push({
          code: a.courses?.course_code,
          name: a.courses?.course_name,
          credits: a.courses?.credits || 3,
        });
        workloadMap[lecturerId].totalCredits += a.courses?.credits || 3;
        workloadMap[lecturerId].totalCourses += 1;
      });

      setWorkload(Object.values(workloadMap));
    } catch (err) {
      console.error('Error fetching workload:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkload = workload.filter((w) => {
    const matchFilter = filter === 'all' || 
      (filter === 'heavy' && w.totalCredits > 15) ||
      (filter === 'medium' && w.totalCredits >= 8 && w.totalCredits <= 15) ||
      (filter === 'light' && w.totalCredits < 8);
    
    const matchSearch = w.lecturer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.lecturer?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchFilter && matchSearch;
  });

  const getWorkloadStatus = (credits) => {
    if (credits > 15) return { label: 'Heavy', color: 'red' };
    if (credits >= 8) return { label: 'Medium', color: 'orange' };
    return { label: 'Light', color: 'green' };
  };

  return (
    <div className="hod-section">
      <h2 className="hod-section-title">⚖️ Lecturer Workload</h2>

      <div className="hod-filters">
        <input
          type="text"
          placeholder="Search lecturers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All Workloads</option>
          <option value="heavy">Heavy (&gt;15 credits)</option>
          <option value="medium">Medium (8-15 credits)</option>
          <option value="light">Light (&lt;8 credits)</option>
        </select>
      </div>

      <div className="hod-workload-grid">
        {loading ? (
          <div className="hod-loading">Loading workload data...</div>
        ) : filteredWorkload.length === 0 ? (
          <div className="hod-empty">
            <span>📭</span>
            <h3>No workload data found</h3>
          </div>
        ) : (
          filteredWorkload.map((w) => {
            const status = getWorkloadStatus(w.totalCredits);
            return (
              <div key={w.lecturer?.id} className="hod-workload-card">
                <div className="hod-workload-header">
                  <h3>{w.lecturer?.full_name}</h3>
                  <span className={`hod-workload-badge hod-badge-${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="hod-workload-email">{w.lecturer?.email}</p>
                <div className="hod-workload-stats">
                  <span>📚 {w.totalCourses} courses</span>
                  <span>📊 {w.totalCredits} credits</span>
                </div>
                <div className="hod-workload-courses">
                  <h4>Assigned Courses:</h4>
                  <ul>
                    {w.courses.map((c, idx) => (
                      <li key={idx}>
                        <strong>{c.code}</strong> - {c.name} ({c.credits} credits)
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

export default HODWorkload;