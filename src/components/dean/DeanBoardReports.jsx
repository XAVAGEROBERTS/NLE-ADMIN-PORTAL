// dean/DeanBoardReports.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanBoardReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [newReport, setNewReport] = useState({
    title: '',
    report_type: 'monthly',
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    semester: 1,
    content: '',
    sections: { overview: '', achievements: '', challenges: '', recommendations: '' },
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faculty_board_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreateReport = async () => {
    if (!newReport.title.trim() || !newReport.content.trim()) {
      alert('Please enter a title and content');
      return;
    }

    try {
      const { error } = await supabase
        .from('faculty_board_reports')
        .insert([{
          ...newReport,
          status: 'draft',
          prepared_by: 'dean',
        }]);

      if (error) throw error;

      alert('✅ Report created successfully!');
      setShowModal(false);
      setNewReport({
        title: '',
        report_type: 'monthly',
        academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
        semester: 1,
        content: '',
        sections: { overview: '', achievements: '', challenges: '', recommendations: '' },
      });
      await fetchReports();
    } catch (err) {
      alert('Error creating report: ' + err.message);
    }
  };

  const handlePublish = async (id) => {
    if (!window.confirm('Publish this report?')) return;

    try {
      const { error } = await supabase
        .from('faculty_board_reports')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Report published!');
      await fetchReports();
    } catch (err) {
      alert('Error publishing: ' + err.message);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filter === 'all') return true;
      return r.status === filter;
    });
  }, [reports, filter]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">📄 Faculty Board Reports</h2>
        <button className="dean-primary-btn" onClick={() => setShowModal(true)}>
          ➕ Create Report
        </button>
      </div>

      <div className="dean-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All Reports ({reports.length})</option>
          <option value="draft">Drafts</option>
          <option value="review">In Review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
        <button className="dean-refresh-btn" onClick={fetchReports}>
          🔄 Refresh
        </button>
      </div>

      <div className="dean-reports-grid">
        {loading ? (
          <div className="dean-loading">Loading reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="dean-empty">
            <span>📭</span>
            <h3>No reports found</h3>
            <p>Create a new report for the Faculty Board</p>
          </div>
        ) : (
          filteredReports.map((r) => (
            <div key={r.id} className="dean-report-card">
              <div className="dean-report-header">
                <h3>{r.title}</h3>
                <span className={`dean-status ${
                  r.status === 'published' ? 'dean-status-approved' :
                  r.status === 'approved' ? 'dean-status-approved' :
                  r.status === 'review' ? 'dean-status-in-progress' :
                  'dean-status-pending'
                }`}>
                  {r.status}
                </span>
              </div>
              <p className="dean-report-meta">
                📅 {r.academic_year} • Semester {r.semester} • {r.report_type}
              </p>
              <p className="dean-report-content">{r.content?.substring(0, 150)}...</p>
              <div className="dean-report-footer">
                <span className="dean-report-date">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                {r.status === 'draft' && (
                  <button
                    className="dean-approve-btn"
                    onClick={() => handlePublish(r.id)}
                  >
                    📤 Publish
                  </button>
                )}
                {r.status === 'published' && (
                  <span className="dean-approved-label">📤 Published</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal dean-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>📄 Create Board Report</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={newReport.title}
                  onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                  className="dean-input"
                  placeholder="Enter report title"
                />
              </div>
              <div className="dean-form-row">
                <div className="dean-form-group">
                  <label>Report Type</label>
                  <select
                    value={newReport.report_type}
                    onChange={(e) => setNewReport({ ...newReport, report_type: e.target.value })}
                    className="dean-select"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="special">Special</option>
                  </select>
                </div>
                <div className="dean-form-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    value={newReport.academic_year}
                    onChange={(e) => setNewReport({ ...newReport, academic_year: e.target.value })}
                    className="dean-input"
                    placeholder="e.g., 2024/2025"
                  />
                </div>
                <div className="dean-form-group">
                  <label>Semester</label>
                  <select
                    value={newReport.semester}
                    onChange={(e) => setNewReport({ ...newReport, semester: parseInt(e.target.value) })}
                    className="dean-select"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>
              <div className="dean-form-group">
                <label>Content</label>
                <textarea
                  value={newReport.content}
                  onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
                  className="dean-textarea"
                  placeholder="Enter report content..."
                  rows={6}
                />
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-save-btn" onClick={handleCreateReport}>
                Create Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanBoardReports;