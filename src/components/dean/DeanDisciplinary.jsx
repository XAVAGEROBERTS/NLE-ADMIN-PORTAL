// dean/DeanDisciplinary.jsx - WITH EDIT HEARING
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanDisciplinary = ({ departments, fetchDeanData, setStats }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');
  const [actionType, setActionType] = useState('resolve');
  const [viewingDetails, setViewingDetails] = useState(false);
  const [decision, setDecision] = useState('');
  const [sanctions, setSanctions] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [editingHearing, setEditingHearing] = useState(false);
  const [hearingVenue, setHearingVenue] = useState('Dean\'s Office');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchCases = useCallback(async () => {
    if (deptCodes.length === 0) {
      setCases([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('disciplinary_cases')
        .select('*')
        .in('department_code', deptCodes)
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
      
      if (setStats) {
        const active = (data || []).filter(c => 
          c.status === 'pending' || c.status === 'investigating' || 
          c.status === 'hearing_scheduled' || c.status === 'pending_decision'
        ).length;
        setStats(prev => ({ ...prev, activeDisciplinary: active }));
      }
    } catch (err) {
      console.error('Error fetching disciplinary cases:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, setStats]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleUpdateStatus = async (id, status, data = {}) => {
    try {
      const updateData = {
        status: status,
        updated_at: new Date().toISOString(),
        ...data
      };

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = 'Dean';
      }

      if (data.dean_notes) {
        updateData.dean_notes = data.dean_notes;
      }

      const { error } = await supabase
        .from('disciplinary_cases')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      alert(`✅ Case ${status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'updated'} successfully!`);
      setShowModal(false);
      setDeanNotes('');
      setDecision('');
      setSanctions('');
      setHearingDate('');
      setEditingHearing(false);
      await fetchCases();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error updating case: ' + err.message);
    }
  };

  // NEW: Edit Hearing function
  const handleEditHearing = async (id) => {
    if (!hearingDate) {
      alert('Please select a hearing date');
      return;
    }

    try {
      const { error } = await supabase
        .from('disciplinary_cases')
        .update({
          hearing_date: new Date(hearingDate).toISOString(),
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('⚖️ Hearing updated successfully!');
      setShowModal(false);
      setDeanNotes('');
      setHearingDate('');
      setEditingHearing(false);
      await fetchCases();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error updating hearing: ' + err.message);
    }
  };

  const handleScheduleHearing = async (id) => {
    if (!hearingDate) {
      alert('Please select a hearing date');
      return;
    }

    try {
      const { error } = await supabase
        .from('disciplinary_cases')
        .update({
          status: 'hearing_scheduled',
          hearing_date: new Date(hearingDate).toISOString(),
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('⚖️ Hearing scheduled successfully!');
      setShowModal(false);
      setDeanNotes('');
      setHearingDate('');
      setEditingHearing(false);
      await fetchCases();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error scheduling hearing: ' + err.message);
    }
  };

  const handleResolve = async (id) => {
    if (!decision.trim()) {
      alert('Please provide a decision');
      return;
    }

    await handleUpdateStatus(id, 'resolved', {
      decision: decision.trim(),
      sanctions: sanctions.trim() || null,
      dean_notes: deanNotes || null
    });
  };

  const handleDismiss = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for dismissal');
      return;
    }

    await handleUpdateStatus(id, 'dismissed', {
      dean_notes: deanNotes
    });
  };

  const openModal = (caseItem, action) => {
    setSelectedCase(caseItem);
    setActionType(action);
    setDeanNotes('');
    setDecision('');
    setSanctions('');
    setHearingDate(caseItem.hearing_date || '');
    setEditingHearing(false);
    setViewingDetails(false);
    setShowModal(true);
  };

  const openEditHearing = (caseItem) => {
    setSelectedCase(caseItem);
    setActionType('edit_hearing');
    setDeanNotes(caseItem.dean_notes || '');
    setHearingDate(caseItem.hearing_date || '');
    setEditingHearing(true);
    setViewingDetails(false);
    setShowModal(true);
  };

  const openViewDetails = (caseItem) => {
    setSelectedCase(caseItem);
    setViewingDetails(true);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: '⏳ Pending', color: '#ffa726', bg: '#fff3e0' },
      'investigating': { label: '🔍 Investigating', color: '#42a5f5', bg: '#e3f2fd' },
      'hearing_scheduled': { label: '⚖️ Hearing Scheduled', color: '#ab47bc', bg: '#f3e5f5' },
      'pending_decision': { label: '📋 Pending Decision', color: '#ff7043', bg: '#fbe9e7' },
      'resolved': { label: '✅ Resolved', color: '#2e7d32', bg: '#e8f5e9' },
      'dismissed': { label: '❌ Dismissed', color: '#ef5350', bg: '#ffebee' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999', bg: '#f5f5f5' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'academic': '📚 Academic',
      'conduct': '👤 Conduct',
      'plagiarism': '📝 Plagiarism',
      'cheating': '📖 Cheating',
      'misconduct': '⚠️ Misconduct',
      'other': '📋 Other',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.respondent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [cases, filter, searchTerm]);

  const activeCount = useMemo(() => {
    return cases.filter(c => 
      c.status === 'pending' || c.status === 'investigating' || 
      c.status === 'hearing_scheduled' || c.status === 'pending_decision'
    ).length;
  }, [cases]);

  const isActionable = (status) => {
    return status !== 'resolved' && status !== 'dismissed';
  };

  const hasHearingScheduled = (caseItem) => {
    return caseItem.status === 'hearing_scheduled' && caseItem.hearing_date;
  };

  // Button styles
  const actionButtonsStyle = {
    display: 'flex',
    gap: '4px',
    flexWrap: 'nowrap',
    alignItems: 'center',
    minWidth: '0'
  };

  const actionBtnStyle = {
    padding: '4px 8px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    flexShrink: '1',
    minWidth: '0'
  };

  const viewBtnStyle = {
    ...actionBtnStyle,
    background: '#e8eaf6',
    color: '#1a237e'
  };

  const resolveBtnStyle = {
    ...actionBtnStyle,
    background: '#2e7d32',
    color: 'white'
  };

  const hearingBtnStyle = {
    ...actionBtnStyle,
    background: '#7b1fa2',
    color: 'white'
  };

  const dismissBtnStyle = {
    ...actionBtnStyle,
    background: '#c62828',
    color: 'white'
  };

  const editHearingBtnStyle = {
    ...actionBtnStyle,
    background: '#ff8f00',
    color: 'white'
  };

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">⚖️ Disciplinary Cases</h2>
        <span className="dean-badge dean-badge-pending">{activeCount} Active</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search cases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All Cases ({cases.length})</option>
          <option value="pending">⏳ Pending</option>
          <option value="investigating">🔍 Investigating</option>
          <option value="hearing_scheduled">⚖️ Hearing Scheduled</option>
          <option value="pending_decision">📋 Pending Decision</option>
          <option value="resolved">✅ Resolved</option>
          <option value="dismissed">❌ Dismissed</option>
        </select>
        <button className="dean-refresh-btn" onClick={fetchCases}>
          🔄 Refresh
        </button>
      </div>

      <div className="dean-table-container">
        {loading ? (
          <div className="dean-loading">Loading cases...</div>
        ) : filteredCases.length === 0 ? (
          <div className="dean-empty">
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>⚖️</span>
            <h3>No Disciplinary Cases Found</h3>
            <p style={{ color: '#666' }}>No cases have been reported yet.</p>
          </div>
        ) : (
          <table className="dean-table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Title</th>
                <th>Type</th>
                <th>Respondent</th>
                <th>Department</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ minWidth: '340px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                const statusInfo = getStatusBadge(c.status);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.case_number}</strong>
                    </td>
                    <td>
                      <strong>{c.title}</strong>
                      <br />
                      <small style={{ color: '#666', fontSize: '12px' }}>
                        {c.description?.substring(0, 50)}
                        {c.description?.length > 50 ? '...' : ''}
                      </small>
                    </td>
                    <td>{getTypeLabel(c.case_type)}</td>
                    <td>
                      {c.respondent_name}
                      <br />
                      <small style={{ color: '#999', fontSize: '11px' }}>{c.respondent_type}</small>
                    </td>
                    <td>{c.department_code}</td>
                    <td>
                      <span style={{
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'inline-block',
                        border: `1px solid ${statusInfo.color}`
                      }}>
                        {statusInfo.label}
                      </span>
                      {c.hearing_date && (
                        <>
                          <br />
                          <small style={{ color: '#7b1fa2', fontSize: '10px' }}>
                            📅 {new Date(c.hearing_date).toLocaleString()}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>
                        {new Date(c.reported_at).toLocaleDateString()}
                      </small>
                    </td>
                    <td>
                      <div style={actionButtonsStyle}>
                        {/* View Button - Always shown */}
                        <button
                          style={viewBtnStyle}
                          onClick={() => openViewDetails(c)}
                        >
                          📋 View
                        </button>
                        
                        {/* Action buttons - only for actionable cases */}
                        {isActionable(c.status) && (
                          <>
                            {/* Edit Hearing - only if hearing is scheduled */}
                            {hasHearingScheduled(c) && (
                              <button
                                style={editHearingBtnStyle}
                                onClick={() => openEditHearing(c)}
                              >
                                📅 Edit Hearing
                              </button>
                            )}
                            
                            {/* Schedule Hearing - only if no hearing scheduled */}
                            {!hasHearingScheduled(c) && (
                              <button
                                style={hearingBtnStyle}
                                onClick={() => openModal(c, 'hearing')}
                              >
                                ⚖️ Hearing
                              </button>
                            )}
                            
                            <button
                              style={resolveBtnStyle}
                              onClick={() => openModal(c, 'resolve')}
                            >
                              ✅ Resolve
                            </button>
                            <button
                              style={dismissBtnStyle}
                              onClick={() => openModal(c, 'dismiss')}
                            >
                              ❌ Dismiss
                            </button>
                          </>
                        )}
                        
                        {/* Status indicators for non-actionable cases */}
                        {c.status === 'resolved' && (
                          <span style={{ 
                            color: '#2e7d32', 
                            fontWeight: '600', 
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}>
                            ✅ Done
                          </span>
                        )}
                        {c.status === 'dismissed' && (
                          <span style={{ 
                            color: '#c62828', 
                            fontWeight: '600', 
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}>
                            ❌ Dismissed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedCase && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal dean-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>
                {viewingDetails ? '📋 Case Details' :
                 actionType === 'edit_hearing' ? '📅 Edit Hearing' :
                 actionType === 'resolve' ? '✅ Resolve Case' :
                 actionType === 'dismiss' ? '❌ Dismiss Case' :
                 '⚖️ Schedule Hearing'}
              </h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              {/* Case Details */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Case Number</strong>
                    <p style={{ margin: '4px 0', color: '#1a237e', fontWeight: '500' }}>{selectedCase.case_number}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Status</strong>
                    <p style={{ margin: '4px 0' }}>
                      <span style={{
                        background: getStatusBadge(selectedCase.status).bg,
                        color: getStatusBadge(selectedCase.status).color,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {getStatusBadge(selectedCase.status).label}
                      </span>
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Title</strong>
                    <p style={{ margin: '4px 0', color: '#1a237e', fontWeight: '500' }}>{selectedCase.title}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Type</strong>
                    <p style={{ margin: '4px 0', color: '#1a237e', fontWeight: '500' }}>{getTypeLabel(selectedCase.case_type)}</p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Respondent</strong>
                    <p style={{ margin: '4px 0', color: '#1a237e', fontWeight: '500' }}>
                      {selectedCase.respondent_name} ({selectedCase.respondent_type})
                    </p>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Department</strong>
                    <p style={{ margin: '4px 0', color: '#1a237e', fontWeight: '500' }}>{selectedCase.department_code}</p>
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' }}>Description</strong>
                  <p style={{ margin: '4px 0', color: '#333' }}>{selectedCase.description}</p>
                </div>
                {selectedCase.hearing_date && (
                  <div style={{ marginTop: '8px', background: '#f3e5f5', padding: '8px 12px', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '12px', color: '#7b1fa2' }}>⚖️ Current Hearing Date:</strong>
                    <span style={{ marginLeft: '8px', color: '#4a148c' }}>{new Date(selectedCase.hearing_date).toLocaleString()}</span>
                  </div>
                )}
                {selectedCase.decision && (
                  <div style={{ marginTop: '8px', background: '#e8f5e9', padding: '8px 12px', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '12px', color: '#2e7d32' }}>Decision:</strong>
                    <span style={{ marginLeft: '8px', color: '#1b5e20' }}>{selectedCase.decision}</span>
                  </div>
                )}
                {selectedCase.sanctions && (
                  <div style={{ marginTop: '8px', background: '#fff3e0', padding: '8px 12px', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '12px', color: '#e65100' }}>Sanctions:</strong>
                    <span style={{ marginLeft: '8px', color: '#bf360c' }}>{selectedCase.sanctions}</span>
                  </div>
                )}
                {selectedCase.dean_notes && (
                  <div style={{ marginTop: '8px', background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '12px', color: '#1565c0' }}>👨‍🏫 Dean's Notes:</strong>
                    <span style={{ marginLeft: '8px', color: '#0d47a1' }}>{selectedCase.dean_notes}</span>
                  </div>
                )}
              </div>

              {/* Action Forms */}
              {!viewingDetails && (
                <>
                  {/* Hearing Form - for both scheduling and editing */}
                  {(actionType === 'hearing' || actionType === 'edit_hearing') && (
                    <div className="dean-form-group">
                      <label>
                        {actionType === 'edit_hearing' ? 'Update Hearing Date *' : 'Schedule Hearing Date *'}
                      </label>
                      <input
                        type="datetime-local"
                        value={hearingDate}
                        onChange={(e) => setHearingDate(e.target.value)}
                        className="dean-input"
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      />
                      {actionType === 'edit_hearing' && (
                        <small style={{ color: '#7b1fa2' }}>
                          Current hearing: {selectedCase.hearing_date ? new Date(selectedCase.hearing_date).toLocaleString() : 'Not set'}
                        </small>
                      )}
                    </div>
                  )}

                  {actionType === 'resolve' && (
                    <>
                      <div className="dean-form-group">
                        <label>Decision *</label>
                        <select
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                          className="dean-select"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="">Select decision...</option>
                          <option value="guilty">Guilty - Found responsible</option>
                          <option value="not_guilty">Not Guilty - Found not responsible</option>
                          <option value="partially_guilty">Partially Guilty - Partially responsible</option>
                        </select>
                      </div>
                      <div className="dean-form-group">
                        <label>Sanctions</label>
                        <textarea
                          value={sanctions}
                          onChange={(e) => setSanctions(e.target.value)}
                          className="dean-textarea"
                          placeholder="Describe the sanctions applied..."
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '14px',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    </>
                  )}

                  <div className="dean-form-group">
                    <label>
                      {actionType === 'dismiss' ? 'Reason for Dismissal *' :
                       actionType === 'edit_hearing' ? 'Update Notes' :
                       actionType === 'resolve' ? 'Dean\'s Notes (Optional)' :
                       'Dean\'s Notes (Optional)'}
                    </label>
                    <textarea
                      value={deanNotes}
                      onChange={(e) => setDeanNotes(e.target.value)}
                      className="dean-textarea"
                      placeholder={
                        actionType === 'dismiss' 
                          ? 'Explain why this case is being dismissed...'
                          : actionType === 'edit_hearing'
                          ? 'Add notes about the hearing change...'
                          : 'Add any notes about this case...'
                      }
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                    {actionType === 'dismiss' && (
                      <small style={{ color: '#c62828' }}>Reason is required for dismissal</small>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              {!viewingDetails && (
                <>
                  {actionType === 'hearing' && (
                    <button
                      className="dean-approve-btn"
                      onClick={() => handleScheduleHearing(selectedCase.id)}
                      style={{
                        padding: '8px 24px',
                        background: '#7b1fa2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ⚖️ Schedule Hearing
                    </button>
                  )}
                  {actionType === 'edit_hearing' && (
                    <button
                      className="dean-approve-btn"
                      onClick={() => handleEditHearing(selectedCase.id)}
                      style={{
                        padding: '8px 24px',
                        background: '#ff8f00',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      📅 Update Hearing
                    </button>
                  )}
                  {actionType === 'resolve' && (
                    <button
                      className="dean-approve-btn"
                      onClick={() => handleResolve(selectedCase.id)}
                      style={{
                        padding: '8px 24px',
                        background: '#2e7d32',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ✅ Resolve Case
                    </button>
                  )}
                  {actionType === 'dismiss' && (
                    <button
                      className="dean-reject-btn"
                      onClick={() => handleDismiss(selectedCase.id)}
                      style={{
                        padding: '8px 24px',
                        background: '#c62828',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ❌ Dismiss Case
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanDisciplinary;