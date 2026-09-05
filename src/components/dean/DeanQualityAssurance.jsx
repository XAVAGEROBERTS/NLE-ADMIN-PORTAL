// dean/DeanQualityAssurance.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanQualityAssurance = ({ departments, fetchDeanData, setStats }) => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');
  const [actionType, setActionType] = useState('approve');
  const [viewingDetails, setViewingDetails] = useState(false);

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchChecklists = useCallback(async () => {
    if (deptCodes.length === 0) {
      setChecklists([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qa_checklists')
        .select('*')
        .in('department_code', deptCodes)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
      
      if (setStats) {
        const pending = (data || []).filter(c => 
          c.status === 'pending' || c.status === 'in_progress'
        ).length;
        setStats(prev => ({ ...prev, pendingQA: pending }));
      }
    } catch (err) {
      console.error('Error fetching QA checklists:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, setStats]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('qa_checklists')
        .update({
          status: 'approved',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'Dean',
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ QA checklist approved successfully!');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChecklist(null);
      await fetchChecklists();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error approving: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const { error } = await supabase
        .from('qa_checklists')
        .update({
          status: 'rejected',
          dean_notes: deanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ QA checklist rejected');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChecklist(null);
      await fetchChecklists();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting: ' + err.message);
    }
  };

  const handleReturn = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide feedback for the HOD');
      return;
    }

    try {
      const { error } = await supabase
        .from('qa_checklists')
        .update({
          status: 'needs_revision',
          dean_notes: deanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 QA checklist returned for revision');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChecklist(null);
      await fetchChecklists();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error returning: ' + err.message);
    }
  };

  const openModal = (checklist, action) => {
    setSelectedChecklist(checklist);
    setActionType(action);
    setDeanNotes('');
    setViewingDetails(false);
    setShowModal(true);
  };

  const openViewDetails = (checklist) => {
    setSelectedChecklist(checklist);
    setViewingDetails(true);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: '⏳ Pending', color: '#ffa726' },
      'in_progress': { label: '📋 In Progress', color: '#42a5f5' },
      'completed': { label: '✅ Completed', color: '#66bb6a' },
      'approved': { label: '✅ Approved', color: '#2e7d32' },
      'needs_revision': { label: '🔄 Revision Needed', color: '#ff7043' },
      'rejected': { label: '❌ Rejected', color: '#ef5350' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'internal': '📋 Internal QA',
      'external': '🔍 External QA',
      'accreditation': '🎓 Accreditation',
      'program_review': '📊 Program Review',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredChecklists = useMemo(() => {
    return checklists.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.checklist_type?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [checklists, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return checklists.filter(c => c.status === 'pending' || c.status === 'in_progress').length;
  }, [checklists]);

  const canReview = (status) => {
    return status === 'pending' || status === 'in_progress' || status === 'completed';
  };

  const styles = {
    container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid #e8eaf6'
    },
    title: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: 0,
      fontSize: '24px',
      fontWeight: '700',
      color: '#1a237e'
    },
    badge: {
      background: '#ff6f00',
      color: 'white',
      padding: '4px 14px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '600'
    },
    filters: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    search: {
      flex: 1,
      minWidth: '250px',
      padding: '10px 16px',
      border: '1.5px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none'
    },
    select: {
      padding: '10px 16px',
      border: '1.5px solid #d1d5db',
      borderRadius: '8px',
      background: 'white',
      fontSize: '14px',
      cursor: 'pointer',
      minWidth: '200px'
    },
    refreshBtn: {
      padding: '10px 18px',
      background: '#f5f5f5',
      border: '1.5px solid #d1d5db',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500'
    },
    tableContainer: {
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      overflowX: 'auto'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px',
      minWidth: '700px'
    },
    th: {
      padding: '14px 16px',
      textAlign: 'left',
      fontWeight: '600',
      color: '#1a237e',
      fontSize: '13px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: '#f8f9fa',
      borderBottom: '2px solid #e8eaf6'
    },
    td: {
      padding: '14px 16px',
      borderBottom: '1px solid #f0f0f5',
      verticalAlign: 'middle'
    },
    approveBtn: {
      background: '#2e7d32',
      color: 'white',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px',
      marginRight: '4px'
    },
    returnBtn: {
      background: '#e65100',
      color: 'white',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px',
      marginRight: '4px'
    },
    rejectBtn: {
      background: '#c62828',
      color: 'white',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px',
      marginRight: '4px'
    },
    viewBtn: {
      background: '#e8eaf6',
      color: '#1a237e',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px'
    },
    actionButtons: {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    approvedText: { color: '#2e7d32', fontWeight: '600', fontSize: '13px' },
    rejectedText: { color: '#c62828', fontWeight: '600', fontSize: '13px' },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modal: {
      background: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '650px',
      maxHeight: '90vh',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '18px 24px',
      borderBottom: '1px solid #e8eaf6',
      background: '#f8f9fa'
    },
    modalBody: {
      padding: '24px',
      maxHeight: 'calc(90vh - 180px)',
      overflowY: 'auto'
    },
    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '16px 24px',
      borderTop: '1px solid #e8eaf6',
      background: '#f8f9fa'
    },
    details: {
      background: '#f8f9fa',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '16px'
    },
    detailsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px'
    },
    textarea: {
      width: '100%',
      padding: '10px 14px',
      border: '1.5px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'inherit',
      resize: 'vertical',
      outline: 'none'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      background: 'white',
      borderRadius: '12px'
    }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '📋 Quality Assurance & Accreditation'),
      React.createElement('span', { style: styles.badge }, pendingCount, ' Pending')
    ),
    React.createElement(
      'div',
      { style: styles.filters },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search QA checklists...',
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        style: styles.search
      }),
      React.createElement(
        'select',
        {
          value: filter,
          onChange: (e) => setFilter(e.target.value),
          style: styles.select
        },
        React.createElement('option', { value: 'all' }, 'All (', checklists.length, ')'),
        React.createElement('option', { value: 'pending' }, 'Pending'),
        React.createElement('option', { value: 'in_progress' }, 'In Progress'),
        React.createElement('option', { value: 'completed' }, 'Completed'),
        React.createElement('option', { value: 'approved' }, 'Approved'),
        React.createElement('option', { value: 'needs_revision' }, 'Needs Revision'),
        React.createElement('option', { value: 'rejected' }, 'Rejected')
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchChecklists },
        '\uD83D\uDD04 Refresh'
      )
    ),
    React.createElement(
      'div',
      { style: styles.tableContainer },
      loading ? React.createElement(
        'div',
        { style: { textAlign: 'center', padding: '40px', color: '#666' } },
        'Loading QA checklists...'
      ) : filteredChecklists.length === 0 ? React.createElement(
        'div',
        { style: styles.emptyState },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '📋'),
        React.createElement('h3', null, 'No QA Checklists Found'),
        React.createElement('p', { style: { color: '#666' } }, 'No QA checklists have been submitted yet.')
      ) : React.createElement(
        'table',
        { style: styles.table },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement('th', { style: styles.th }, 'Department'),
            React.createElement('th', { style: styles.th }, 'Type'),
            React.createElement('th', { style: styles.th }, 'Academic Year'),
            React.createElement('th', { style: styles.th }, 'Semester'),
            React.createElement('th', { style: styles.th }, 'Status'),
            React.createElement('th', { style: styles.th }, 'Actions')
          )
        ),
        React.createElement(
          'tbody',
          null,
          filteredChecklists.map((c) => {
            const statusInfo = getStatusBadge(c.status);
            return React.createElement(
              'tr',
              { key: c.id },
              React.createElement('td', { style: styles.td },
                React.createElement('strong', null, c.department_code),
                React.createElement('br', null),
                React.createElement('small', { style: { color: '#666', fontSize: '12px' } }, c.title)
              ),
              React.createElement('td', { style: styles.td }, getTypeLabel(c.checklist_type)),
              React.createElement('td', { style: styles.td }, c.academic_year),
              React.createElement('td', { style: styles.td }, 'Sem ', c.semester),
              React.createElement(
                'td',
                { style: styles.td },
                React.createElement('span', {
                  style: {
                    background: statusInfo.color,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'inline-block'
                  }
                }, statusInfo.label)
              ),
              React.createElement(
                'td',
                { style: styles.td },
                React.createElement(
                  'div',
                  { style: styles.actionButtons },
                  React.createElement(
                    'button',
                    { style: styles.viewBtn, onClick: () => openViewDetails(c) },
                    '\uD83D\uDCCB View'
                  ),
                  canReview(c.status) && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'button',
                      { style: styles.approveBtn, onClick: () => openModal(c, 'approve') },
                      '\u2705 Approve'
                    ),
                    React.createElement(
                      'button',
                      { style: styles.returnBtn, onClick: () => openModal(c, 'return') },
                      '\uD83D\uDD04 Revise'
                    ),
                    React.createElement(
                      'button',
                      { style: styles.rejectBtn, onClick: () => openModal(c, 'reject') },
                      '\u274C Reject'
                    )
                  ),
                  c.status === 'approved' && React.createElement(
                    'span',
                    { style: styles.approvedText },
                    '\u2705 Approved'
                  ),
                  c.status === 'rejected' && React.createElement(
                    'span',
                    { style: styles.rejectedText },
                    '\u274C Rejected'
                  )
                )
              )
            );
          })
        )
      )
    ),
    showModal && selectedChecklist && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowModal(false) },
      React.createElement(
        'div',
        { style: styles.modal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: styles.modalHeader },
          React.createElement(
            'h3',
            { style: { margin: 0, fontSize: '18px', color: '#1a237e' } },
            viewingDetails ? '\uD83D\uDCCB QA Checklist Details' :
            actionType === 'approve' ? '\u2705 Approve QA Checklist' :
            actionType === 'reject' ? '\u274C Reject QA Checklist' :
            '\uD83D\uDD04 Return for Revision'
          ),
          React.createElement('button', {
            onClick: () => setShowModal(false),
            style: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        React.createElement(
          'div',
          { style: styles.modalBody },
          React.createElement(
            'div',
            { style: styles.details },
            React.createElement(
              'div',
              { style: styles.detailsGrid },
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Title:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, selectedChecklist.title)
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Type:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, getTypeLabel(selectedChecklist.checklist_type))
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Department:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, selectedChecklist.department_code)
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Academic Year:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, selectedChecklist.academic_year)
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Semester:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, 'Semester ', selectedChecklist.semester)
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Status:'),
                React.createElement(
                  'p',
                  { style: { margin: '4px 0' } },
                  React.createElement('span', {
                    style: {
                      background: getStatusBadge(selectedChecklist.status).color,
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }
                  }, getStatusBadge(selectedChecklist.status).label)
                )
              )
            ),
            selectedChecklist.description && React.createElement(
              'div',
              { style: { marginTop: '12px' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Description:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, selectedChecklist.description)
            ),
            React.createElement(
              'div',
              { style: { marginTop: '12px' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#1a237e', display: 'block', marginBottom: '8px' } }, '📋 Checklist Items:'),
              React.createElement(
                'div',
                { style: { background: '#f8f9fa', borderRadius: '8px', padding: '8px' } },
                (selectedChecklist.items || []).map((item, index) => React.createElement(
                  'div',
                  { key: index, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #eee' } },
                  React.createElement('span', null, (index + 1), '. ', item.criteria),
                  React.createElement('span', {
                    style: {
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: item.status === 'completed' ? '#e8f5e9' : item.status === 'in_progress' ? '#fff3e0' : '#f5f5f5',
                      color: item.status === 'completed' ? '#2e7d32' : item.status === 'in_progress' ? '#e65100' : '#666'
                    }
                  }, item.status || 'pending')
                ))
              )
            ),
            selectedChecklist.dean_notes && React.createElement(
              'div',
              { style: { marginTop: '12px', background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #1976d2' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0', display: 'block' } }, '\uD83D\uDC68\u200D\uD83C\uDFEB Dean\'s Notes:'),
              React.createElement('p', { style: { margin: '4px 0 0 0', fontSize: '13px', color: '#444' } }, selectedChecklist.dean_notes)
            )
          ),
          !viewingDetails && canReview(selectedChecklist.status) && React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'div',
              { style: { marginTop: '16px' } },
              React.createElement('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a237e' } },
                actionType === 'approve' ? 'Dean\'s Notes (Optional)' :
                actionType === 'reject' ? 'Reason for Rejection *' :
                'Feedback for HOD *'
              ),
              React.createElement('textarea', {
                value: deanNotes,
                onChange: (e) => setDeanNotes(e.target.value),
                style: styles.textarea,
                placeholder: actionType === 'approve' 
                  ? 'Add any notes about this approval...' 
                  : actionType === 'reject' 
                  ? 'Explain why this QA checklist is being rejected...' 
                  : 'Provide feedback on what needs to be revised...',
                rows: 4
              }),
              actionType === 'approve' && React.createElement('small', { style: { color: '#999' } }, 'Notes are optional for approval'),
              (actionType === 'reject' || actionType === 'return') && React.createElement('small', { style: { color: '#c62828' } }, 'Feedback is required')
            )
          )
        ),
        React.createElement(
          'div',
          { style: styles.modalFooter },
          React.createElement('button', {
            onClick: () => setShowModal(false),
            style: { padding: '8px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }
          }, viewingDetails ? 'Close' : 'Cancel'),
          !viewingDetails && canReview(selectedChecklist?.status) && React.createElement(
            React.Fragment,
            null,
            actionType === 'approve' && React.createElement('button', {
              onClick: () => handleApprove(selectedChecklist.id),
              style: { padding: '8px 24px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }
            }, '✅ Approve'),
            actionType === 'return' && React.createElement('button', {
              onClick: () => handleReturn(selectedChecklist.id),
              style: { padding: '8px 24px', background: '#e65100', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }
            }, '🔄 Return to HOD'),
            actionType === 'reject' && React.createElement('button', {
              onClick: () => handleReject(selectedChecklist.id),
              style: { padding: '8px 24px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }
            }, '❌ Reject')
          )
        )
      )
    )
  );
};

export default DeanQualityAssurance;