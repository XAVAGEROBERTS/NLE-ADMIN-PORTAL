// HODComplaints.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODComplaints = ({ departmentCode, fetchHODData, setStats }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, [departmentCode]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_complaints')
        .select(`
          *,
          students:student_id (id, full_name, student_id, email)
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      alert('Please provide a response');
      return;
    }

    try {
      const { error } = await supabase
        .from('student_complaints')
        .update({ 
          status: 'resolved',
          response: responseText,
          responded_by: 'hod',
          responded_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint?.id);

      if (error) throw error;
      await fetchComplaints();
      await fetchHODData();
      setShowModal(false);
      setSelectedComplaint(null);
      setResponseText('');
    } catch (err) {
      alert('Error responding to complaint: ' + err.message);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchFilter = filter === 'all' || c.status === filter;
    const matchSearch = 
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.students?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = complaints.filter(c => c.status === 'pending').length;

  const statusColors = {
    pending: 'hod-status-pending',
    'in-progress': 'hod-status-in-progress',
    resolved: 'hod-status-approved',
    rejected: 'hod-status-rejected',
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">💬 Student Complaints</h2>
        <span className="hod-badge hod-badge-pending">{pendingCount} pending</span>
      </div>

      <div className="hod-filters">
        <input
          type="text"
          placeholder="Search complaints..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="hod-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All ({complaints.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="hod-card">
        {loading ? (
          <div className="hod-loading">Loading complaints...</div>
        ) : (
          <table className="hod-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Title</th>
                <th>Category</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    No complaints found
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.students?.full_name}</strong>
                      <br />
                      <small>{c.students?.student_id}</small>
                    </td>
                    <td>{c.title}</td>
                    <td>
                      <span className="hod-badge">{c.category}</span>
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`hod-status ${statusColors[c.status] || ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      {(c.status === 'pending' || c.status === 'in-progress') && (
                        <button 
                          className="hod-primary-btn"
                          onClick={() => {
                            setSelectedComplaint(c);
                            setShowModal(true);
                          }}
                        >
                          💬 Respond
                        </button>
                      )}
                      {c.status === 'resolved' && (
                        <span className="hod-approved-label">✓ Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Response Modal */}
      {showModal && selectedComplaint && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>Respond to Complaint</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-complaint-details">
                <p><strong>Student:</strong> {selectedComplaint.students?.full_name}</p>
                <p><strong>Title:</strong> {selectedComplaint.title}</p>
                <p><strong>Description:</strong></p>
                <p className="hod-complaint-description">{selectedComplaint.description}</p>
              </div>
              <div className="hod-form-group">
                <label>Your Response</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="hod-textarea"
                  placeholder="Provide your response to this complaint..."
                  rows={4}
                />
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="hod-save-btn" onClick={handleRespond}>
                Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODComplaints;