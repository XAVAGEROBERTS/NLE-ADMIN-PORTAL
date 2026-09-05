// dean/DeanBudget.jsx - FIXED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanBudget = ({ departments, fetchDeanData, setStats }) => {
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');
  const [totalBudget, setTotalBudget] = useState(0);
  const [approvedBudget, setApprovedBudget] = useState(0);
  const [pendingBudget, setPendingBudget] = useState(0);

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchBudgetRequests = useCallback(async () => {
    if (deptCodes.length === 0) {
      setBudgetRequests([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_requests')
        .select('*')
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgetRequests(data || []);
    } catch (err) {
      console.error('Error fetching budget requests:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  const calculateBudgetTotals = useCallback(() => {
    // Calculate from the current budgetRequests state
    const total = budgetRequests.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    // Only count approved_by_dean as approved
    const approved = budgetRequests
      .filter(r => r.faculty_status === 'approved_by_dean' || r.status === 'funded')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    
    // Only count pending_dean as pending
    const pending = budgetRequests
      .filter(r => r.faculty_status === 'pending_dean' || r.status === 'pending')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    setTotalBudget(total);
    setApprovedBudget(approved);
    setPendingBudget(pending);
  }, [budgetRequests]);

  // Recalculate when budgetRequests changes
  useEffect(() => {
    calculateBudgetTotals();
  }, [calculateBudgetTotals]);

  useEffect(() => {
    fetchBudgetRequests();
  }, [fetchBudgetRequests]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('budget_requests')
        .update({
          faculty_status: 'approved_by_dean',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'dean',
          dean_notes: deanNotes || null,
          status: 'approved', // Also update the main status
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Budget request approved!');
      setShowModal(false);
      setDeanNotes('');
      await fetchBudgetRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error approving budget: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_requests')
        .update({
          faculty_status: 'rejected_by_dean',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
          status: 'rejected', // Also update the main status
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Budget request rejected');
      setShowModal(false);
      setDeanNotes('');
      await fetchBudgetRequests();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting budget: ' + err.message);
    }
  };

  const filteredRequests = useMemo(() => {
    return budgetRequests.filter((r) => {
      let matchFilter = true;
      if (filter === 'pending') {
        matchFilter = r.faculty_status === 'pending_dean' || r.status === 'pending';
      } else if (filter === 'approved') {
        matchFilter = r.faculty_status === 'approved_by_dean' || r.status === 'approved';
      } else if (filter === 'rejected') {
        matchFilter = r.faculty_status === 'rejected_by_dean' || r.status === 'rejected';
      } else if (filter === 'funded') {
        matchFilter = r.status === 'funded';
      }

      const matchSearch =
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department_code?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [budgetRequests, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return budgetRequests.filter(r => r.faculty_status === 'pending_dean' || r.status === 'pending').length;
  }, [budgetRequests]);

  const getStatusDisplay = (request) => {
    if (request.faculty_status === 'approved_by_dean' || request.status === 'approved') {
      return { label: '✅ Dean Approved', class: 'dean-status-approved' };
    }
    if (request.faculty_status === 'rejected_by_dean' || request.status === 'rejected') {
      return { label: '❌ Rejected', class: 'dean-status-rejected' };
    }
    if (request.status === 'funded') {
      return { label: '💰 Funded', class: 'dean-status-approved' };
    }
    if (request.faculty_status === 'pending_dean' || request.status === 'pending') {
      return { label: '⏳ Pending Dean', class: 'dean-status-pending' };
    }
    return { label: request.status || 'Unknown', class: 'dean-status-pending' };
  };

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">💰 Faculty Budget & Resource Allocation</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending</span>
      </div>

      <div className="dean-budget-summary">
        <div className="dean-budget-card dean-budget-total">
          <h4>Total Requested</h4>
          <p>${totalBudget.toLocaleString()}</p>
        </div>
        <div className="dean-budget-card dean-budget-approved">
          <h4>Approved</h4>
          <p>${approvedBudget.toLocaleString()}</p>
        </div>
        <div className="dean-budget-card dean-budget-pending">
          <h4>Pending</h4>
          <p>${pendingBudget.toLocaleString()}</p>
        </div>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search budget requests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All Requests ({budgetRequests.length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="funded">Funded</option>
        </select>
      </div>

      <div className="dean-budget-grid">
        {loading ? (
          <div className="dean-loading">Loading budget requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="dean-empty">
            <span>📭</span>
            <h3>No budget requests found</h3>
          </div>
        ) : (
          filteredRequests.map((r) => {
            const statusInfo = getStatusDisplay(r);
            return (
              <div key={r.id} className="dean-budget-card-item">
                <div className="dean-budget-header">
                  <h3>{r.title}</h3>
                  <span className={`dean-budget-priority dean-priority-${r.priority}`}>
                    {r.priority}
                  </span>
                </div>
                <div className="dean-budget-meta">
                  <span>🏢 {r.department_code}</span>
                  <span>📂 {r.category}</span>
                  <span className="dean-budget-amount">${r.amount.toLocaleString()}</span>
                </div>
                <p className="dean-budget-description">{r.description}</p>
                {r.justification && (
                  <p className="dean-budget-justification">
                    <strong>Justification:</strong> {r.justification}
                  </p>
                )}
                {r.dean_notes && (
                  <p className="dean-budget-dean-notes">
                    <strong>Dean's Notes:</strong> {r.dean_notes}
                  </p>
                )}
                <div className="dean-budget-footer">
                  <span className={`dean-status ${statusInfo.class}`}>
                    {statusInfo.label}
                  </span>
                  {(r.faculty_status === 'pending_dean' || r.status === 'pending') && (
                    <button
                      className="dean-review-btn"
                      onClick={() => {
                        setSelectedRequest(r);
                        setShowModal(true);
                      }}
                    >
                      📝 Review
                    </button>
                  )}
                  {(r.faculty_status === 'approved_by_dean' || r.status === 'approved') && (
                    <span className="dean-approved-label">✅ Dean Approved</span>
                  )}
                  {r.status === 'funded' && (
                    <span className="dean-funded-label">💰 Funded</span>
                  )}
                  {(r.faculty_status === 'rejected_by_dean' || r.status === 'rejected') && (
                    <span className="dean-rejected-label">❌ Rejected</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && selectedRequest && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>💰 Review Budget Request</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-budget-details">
                <p><strong>Title:</strong> {selectedRequest.title}</p>
                <p><strong>Department:</strong> {selectedRequest.department_code}</p>
                <p><strong>Category:</strong> {selectedRequest.category}</p>
                <p><strong>Amount:</strong> ${selectedRequest.amount.toLocaleString()}</p>
                <p><strong>Priority:</strong> {selectedRequest.priority}</p>
                <p><strong>Description:</strong> {selectedRequest.description}</p>
                {selectedRequest.justification && (
                  <p><strong>Justification:</strong> {selectedRequest.justification}</p>
                )}
              </div>
              <div className="dean-form-group">
                <label>Dean's Notes</label>
                <textarea
                  value={deanNotes}
                  onChange={(e) => setDeanNotes(e.target.value)}
                  className="dean-textarea"
                  placeholder="Add your notes or feedback..."
                  rows={3}
                />
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button className="dean-reject-btn" onClick={() => handleReject(selectedRequest.id)}>
                ❌ Reject
              </button>
              <button className="dean-approve-btn" onClick={() => handleApprove(selectedRequest.id)}>
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanBudget;