// HODCourseAllocations.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODCourseAllocations = ({ departmentCode, courses, lecturers, fetchHODData, setStats }) => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllocations();
  }, [departmentCode]);

  const fetchAllocations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_allocations')
        .select(`
          *,
          courses:course_id (course_code, course_name, credits),
          lecturers:lecturer_id (full_name, email)
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllocations(data || []);
    } catch (err) {
      console.error('Error fetching allocations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('course_allocations')
        .update({ 
          status: 'approved',
          approved_by: 'hod',
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchAllocations();
      await fetchHODData();
    } catch (err) {
      alert('Error approving allocation: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    try {
      const { error } = await supabase
        .from('course_allocations')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchAllocations();
      await fetchHODData();
    } catch (err) {
      alert('Error rejecting allocation: ' + err.message);
    }
  };

  const handleCreateAllocation = async () => {
    if (!selectedCourse || !selectedLecturer) {
      alert('Please select both course and lecturer');
      return;
    }

    try {
      const { error } = await supabase
        .from('course_allocations')
        .insert([{
          course_id: selectedCourse,
          lecturer_id: selectedLecturer,
          department_code: departmentCode,
          status: 'pending',
          requested_by: 'hod',
        }]);

      if (error) throw error;
      await fetchAllocations();
      setShowModal(false);
      setSelectedCourse(null);
      setSelectedLecturer('');
    } catch (err) {
      alert('Error creating allocation: ' + err.message);
    }
  };

  const filteredAllocations = allocations.filter((a) => {
    const matchFilter = filter === 'all' || a.status === filter;
    const matchSearch = 
      a.courses?.course_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.courses?.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.lecturers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = allocations.filter(a => a.status === 'pending').length;

  const statusColors = {
    pending: 'hod-status-pending',
    approved: 'hod-status-approved',
    rejected: 'hod-status-rejected',
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📚 Course Allocations</h2>
        <div className="hod-section-actions">
          <button className="hod-primary-btn" onClick={() => setShowModal(true)}>
            ➕ New Allocation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="hod-filters">
        <input
          type="text"
          placeholder="Search allocations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All ({allocations.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="hod-card">
        {loading ? (
          <div className="hod-loading">Loading allocations...</div>
        ) : (
          <table className="hod-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Lecturer</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                    No allocations found
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.courses?.course_code}</strong>
                      <br />
                      <small>{a.courses?.course_name}</small>
                    </td>
                    <td>
                      {a.lecturers?.full_name}
                      <br />
                      <small>{a.lecturers?.email}</small>
                    </td>
                    <td>
                      <span className={`hod-status ${statusColors[a.status] || ''}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>
                      {a.status === 'pending' && (
                        <div className="hod-action-buttons">
                          <button 
                            className="hod-approve-btn"
                            onClick={() => handleApprove(a.id)}
                          >
                            ✅ Approve
                          </button>
                          <button 
                            className="hod-reject-btn"
                            onClick={() => handleReject(a.id)}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {a.status === 'approved' && (
                        <span className="hod-approved-label">✓ Approved</span>
                      )}
                      {a.status === 'rejected' && (
                        <span className="hod-rejected-label">✗ Rejected</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Allocation Modal */}
      {showModal && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📚 Create Course Allocation</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-form-group">
                <label>Course</label>
                <select
                  value={selectedCourse || ''}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="hod-select"
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_code} - {c.course_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hod-form-group">
                <label>Lecturer</label>
                <select
                  value={selectedLecturer || ''}
                  onChange={(e) => setSelectedLecturer(e.target.value)}
                  className="hod-select"
                >
                  <option value="">Select Lecturer</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} - {l.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="hod-save-btn" onClick={handleCreateAllocation}>
                Create Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODCourseAllocations;