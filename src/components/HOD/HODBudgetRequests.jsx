// HODBudgetRequests.jsx - FIXED
import React, { useState, useEffect } from 'react';
import { supabase } from "../../services/supabase";

const HODBudgetRequests = ({ departmentCode }) => {
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'equipment',
    amount: '',
    priority: 'medium',
    justification: '',
    requested_by: 'hod',
  });

  useEffect(() => {
    fetchBudgetRequests();
  }, [departmentCode]);

  const fetchBudgetRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_requests')
        .select('*')
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgetRequests(data || []);
    } catch (err) {
      console.error('Error fetching budget requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_requests')
        .insert([{
          ...formData,
          department_code: departmentCode,
          amount: parseFloat(formData.amount),
          status: 'pending',
          faculty_status: 'pending_dean', // Add this for Dean
          requested_by: 'hod',
          requested_at: new Date().toISOString(),
        }]);

      if (error) throw error;
      await fetchBudgetRequests();
      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        category: 'equipment',
        amount: '',
        priority: 'medium',
        justification: '',
        requested_by: 'hod',
      });
    } catch (err) {
      alert('Error submitting budget request: ' + err.message);
    }
  };

  const filteredRequests = budgetRequests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending' || r.faculty_status === 'pending_dean';
    return r.status === filter || r.faculty_status === filter;
  });

  const pendingCount = budgetRequests.filter(r => r.status === 'pending' || r.faculty_status === 'pending_dean').length;

  const getPriorityLabel = (priority) => {
    const map = {
      high: '🔴 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };
    return map[priority] || priority;
  };

  const getCategoryIcon = (category) => {
    const map = {
      equipment: '🔧',
      consumables: '📦',
      software: '💻',
      maintenance: '🔨',
      training: '📚',
      other: '📋',
    };
    return map[category] || '📋';
  };

  const getStatusDisplay = (request) => {
    // Check faculty_status first (from Dean)
    if (request.faculty_status === 'approved_by_dean') return { label: '✅ Dean Approved', class: 'hod-status-approved' };
    if (request.faculty_status === 'rejected_by_dean') return { label: '❌ Rejected by Dean', class: 'hod-status-rejected' };
    if (request.status === 'funded') return { label: '💰 Funded', class: 'hod-status-approved' };
    if (request.faculty_status === 'pending_dean' || request.status === 'pending') return { label: '⏳ Pending', class: 'hod-status-pending' };
    return { label: request.status || 'Unknown', class: 'hod-status-pending' };
  };

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">💰 Budget & Resource Requests</h2>
        <button className="hod-primary-btn" onClick={() => setShowModal(true)}>
          ➕ New Request
        </button>
      </div>

      <div className="hod-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All Requests ({budgetRequests.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved_by_dean">Dean Approved</option>
          <option value="rejected_by_dean">Rejected</option>
          <option value="funded">Funded</option>
        </select>
      </div>

      <div className="hod-budget-grid">
        {loading ? (
          <div className="hod-loading">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="hod-empty">
            <span>📭</span>
            <h3>No budget requests found</h3>
          </div>
        ) : (
          filteredRequests.map((r) => {
            const statusInfo = getStatusDisplay(r);
            return (
              <div key={r.id} className="hod-budget-card">
                <div className="hod-budget-header">
                  <h3>{r.title}</h3>
                  <span className={`hod-budget-priority hod-priority-${r.priority}`}>
                    {getPriorityLabel(r.priority)}
                  </span>
                </div>
                <div className="hod-budget-meta">
                  <span>{getCategoryIcon(r.category)} {r.category}</span>
                  <span className="hod-budget-amount">${r.amount.toLocaleString()}</span>
                </div>
                <p className="hod-budget-description">{r.description}</p>
                {r.justification && (
                  <p className="hod-budget-justification">
                    <strong>Justification:</strong> {r.justification}
                  </p>
                )}
                <div className="hod-budget-footer">
                  <span className={`hod-status ${statusInfo.class}`}>
                    {statusInfo.label}
                  </span>
                  <button 
                    className="hod-detail-btn"
                    onClick={() => {
                      setSelectedRequest(r);
                      setShowDetailModal(true);
                    }}
                  >
                    📋 Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Request Modal - same as before */}
      {showModal && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal hod-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>💰 New Budget Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="hod-input"
                  placeholder="e.g., Lab Equipment for Computer Science"
                />
              </div>

              <div className="hod-form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="hod-select"
                >
                  <option value="equipment">🔧 Equipment</option>
                  <option value="consumables">📦 Consumables</option>
                  <option value="software">💻 Software</option>
                  <option value="maintenance">🔨 Maintenance</option>
                  <option value="training">📚 Training</option>
                  <option value="other">📋 Other</option>
                </select>
              </div>

              <div className="hod-form-row">
                <div className="hod-form-group">
                  <label>Amount *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="hod-input"
                    placeholder="0.00"
                  />
                </div>
                <div className="hod-form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="hod-select"
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div className="hod-form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="hod-textarea"
                  placeholder="Describe what you need and why..."
                  rows={3}
                />
              </div>

              <div className="hod-form-group">
                <label>Justification</label>
                <textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  className="hod-textarea"
                  placeholder="Explain the necessity and expected impact..."
                  rows={3}
                />
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="hod-save-btn" onClick={handleSubmit}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="hod-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="hod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>📋 Request Details</h3>
              <button onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-detail-item">
                <label>Title</label>
                <p>{selectedRequest.title}</p>
              </div>
              <div className="hod-detail-item">
                <label>Category</label>
                <p>{getCategoryIcon(selectedRequest.category)} {selectedRequest.category}</p>
              </div>
              <div className="hod-detail-item">
                <label>Amount</label>
                <p className="hod-amount">${selectedRequest.amount.toLocaleString()}</p>
              </div>
              <div className="hod-detail-item">
                <label>Priority</label>
                <p>{getPriorityLabel(selectedRequest.priority)}</p>
              </div>
              <div className="hod-detail-item">
                <label>Status</label>
                <p>
                  <span className={`hod-status ${getStatusDisplay(selectedRequest).class}`}>
                    {getStatusDisplay(selectedRequest).label}
                  </span>
                </p>
              </div>
              <div className="hod-detail-item">
                <label>Description</label>
                <p>{selectedRequest.description}</p>
              </div>
              {selectedRequest.justification && (
                <div className="hod-detail-item">
                  <label>Justification</label>
                  <p>{selectedRequest.justification}</p>
                </div>
              )}
              {selectedRequest.dean_notes && (
                <div className="hod-detail-item">
                  <label>Dean's Notes</label>
                  <p>{selectedRequest.dean_notes}</p>
                </div>
              )}
              <div className="hod-detail-item">
                <label>Requested</label>
                <p>{new Date(selectedRequest.created_at).toLocaleString()}</p>
              </div>
              {selectedRequest.dean_approved_at && (
                <div className="hod-detail-item">
                  <label>Reviewed by Dean</label>
                  <p>{new Date(selectedRequest.dean_approved_at).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODBudgetRequests;