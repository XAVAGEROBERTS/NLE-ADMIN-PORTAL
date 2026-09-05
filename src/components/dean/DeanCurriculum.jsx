// dean/DeanCurriculum.jsx - CLEAN TABLE, FULL DETAILS IN VIEW MODAL
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanCurriculum = ({ departments, fetchDeanData, setStats }) => {
  const [curriculumChanges, setCurriculumChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState(null);
  const [deanNotes, setDeanNotes] = useState('');
  const [actionType, setActionType] = useState('approve');
  const [viewingDetails, setViewingDetails] = useState(false);

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchCurriculumChanges = useCallback(async () => {
    if (deptCodes.length === 0) {
      setCurriculumChanges([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('curriculum_changes')
        .select('*')
        .in('department_code', deptCodes)
        .order('proposed_at', { ascending: false });

      if (error) throw error;
      setCurriculumChanges(data || []);
      
      if (setStats) {
        const pending = (data || []).filter(c => 
          c.status === 'pending' || c.status === 'pending_dean'
        ).length;
        setStats(prev => ({ ...prev, pendingCurriculum: pending }));
      }
    } catch (err) {
      console.error('Error fetching curriculum changes:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes, setStats]);

  useEffect(() => {
    fetchCurriculumChanges();
  }, [fetchCurriculumChanges]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('curriculum_changes')
        .update({
          status: 'approved',
          dean_approved_at: new Date().toISOString(),
          dean_approved_by: 'Dean',
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Curriculum change approved successfully!');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChange(null);
      await fetchCurriculumChanges();
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
        .from('curriculum_changes')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: deanNotes,
          dean_notes: deanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('❌ Curriculum change rejected');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChange(null);
      await fetchCurriculumChanges();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error rejecting: ' + err.message);
    }
  };

  const handleReturnToHOD = async (id) => {
    if (!deanNotes.trim()) {
      alert('Please provide feedback for the HOD');
      return;
    }

    try {
      const { error } = await supabase
        .from('curriculum_changes')
        .update({
          status: 'needs_revision',
          dean_notes: deanNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('🔄 Curriculum change returned to HOD for revision');
      setShowModal(false);
      setDeanNotes('');
      setSelectedChange(null);
      await fetchCurriculumChanges();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error returning: ' + err.message);
    }
  };

  const openModal = (change, action) => {
    setSelectedChange(change);
    setActionType(action);
    setDeanNotes('');
    setViewingDetails(false);
    setShowModal(true);
  };

  const openViewDetails = (change) => {
    setSelectedChange(change);
    setViewingDetails(true);
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending_hod': { label: '⏳ Pending HOD', color: '#ffa726' },
      'pending': { label: '⏳ Pending', color: '#ffa726' },
      'pending_dean': { label: '📋 Pending Dean', color: '#42a5f5' },
      'approved': { label: '✅ Approved', color: '#66bb6a' },
      'rejected': { label: '❌ Rejected', color: '#ef5350' },
      'needs_revision': { label: '🔄 Revision Needed', color: '#ff7043' },
      'implemented': { label: '🔧 Implemented', color: '#1565c0' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'new_program': '📘 New Program',
      'program_modification': '📝 Program Modification',
      'new_course': '📘 New Course',
      'course_modification': '📝 Course Modification',
      'program_retirement': '🗑️ Program Retirement',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredChanges = useMemo(() => {
    return curriculumChanges.filter((c) => {
      const matchFilter = filter === 'all' || c.status === filter;
      const matchSearch =
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.change_type?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [curriculumChanges, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return curriculumChanges.filter(c => 
      c.status === 'pending' || c.status === 'pending_dean'
    ).length;
  }, [curriculumChanges]);

  const canReview = (status) => {
    return status === 'pending' || status === 'pending_dean';
  };

  // Helper function to render timeline items in correct order
  const renderTimeline = (change) => {
    const items = [];

    // 1. Submitted by HOD
    items.push({
      key: 'submitted',
      label: '📝 Submitted',
      date: change.proposed_at || change.created_at,
      by: change.proposed_by || 'HOD',
      color: '#666',
      icon: '📝'
    });

    // 2. Approved by Dean (if approved or implemented)
    if (change.status === 'approved' || change.status === 'implemented') {
      items.push({
        key: 'approved',
        label: '✅ Approved',
        date: change.dean_approved_at,
        by: change.dean_approved_by || 'Dean',
        color: '#2e7d32',
        icon: '✅'
      });
    }

    // 3. Implemented by System Admin (if implemented)
    if (change.status === 'implemented') {
      items.push({
        key: 'implemented',
        label: '🔧 Implemented',
        date: change.implemented_at,
        by: change.implemented_by || 'System Admin',
        color: '#1565c0',
        icon: '🔧'
      });
    }

    // 4. Rejected (if rejected)
    if (change.status === 'rejected') {
      items.push({
        key: 'rejected',
        label: '❌ Rejected',
        date: change.rejected_at,
        by: 'Dean',
        color: '#c62828',
        icon: '❌'
      });
    }

    return items;
  };

  // Inline styles
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
    implementedText: { color: '#1565c0', fontWeight: '600', fontSize: '13px' },
    pendingText: { color: '#ffa726', fontWeight: '600', fontSize: '13px' },
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
      zIndex: 9999
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
    },
    timelineItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      borderBottom: '1px solid #f0f0f5'
    },
    timelineItemLast: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px'
    },
    timelineIcon: {
      fontSize: '20px',
      width: '36px',
      textAlign: 'center'
    },
    timelineContent: {
      flex: 1
    },
    timelineLabel: {
      fontSize: '13px',
      fontWeight: '600'
    },
    timelineDate: {
      fontSize: '12px',
      color: '#666'
    },
    timelineBy: {
      fontSize: '12px',
      color: '#666'
    }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '📋 Curriculum & Programme Approval'),
      React.createElement('span', { style: styles.badge }, pendingCount, ' Pending')
    ),
    React.createElement(
      'div',
      { style: styles.filters },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search curriculum changes...',
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
        React.createElement('option', { value: 'all' }, 'All (', curriculumChanges.length, ')'),
        React.createElement('option', { value: 'pending' }, 'Pending (', pendingCount, ')'),
        React.createElement('option', { value: 'pending_dean' }, 'Pending Dean'),
        React.createElement('option', { value: 'pending_hod' }, 'Pending HOD'),
        React.createElement('option', { value: 'approved' }, 'Approved'),
        React.createElement('option', { value: 'rejected' }, 'Rejected'),
        React.createElement('option', { value: 'needs_revision' }, 'Needs Revision'),
        React.createElement('option', { value: 'implemented' }, 'Implemented')
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchCurriculumChanges },
        '\uD83D\uDD04 Refresh'
      )
    ),
    React.createElement(
      'div',
      { style: styles.tableContainer },
      loading ? React.createElement(
        'div',
        { style: { textAlign: 'center', padding: '40px', color: '#666' } },
        'Loading curriculum changes...'
      ) : filteredChanges.length === 0 ? React.createElement(
        'div',
        { style: styles.emptyState },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '\uD83D\uDCCB'),
        React.createElement('h3', { style: { color: '#1a237e', margin: '0 0 8px 0' } }, 'No Curriculum Changes'),
        React.createElement(
          'p',
          { style: { color: '#666' } },
          'No curriculum changes found.'
        )
      ) : React.createElement(
        'table',
        { style: styles.table },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement('th', { style: styles.th }, 'Title'),
            React.createElement('th', { style: styles.th }, 'Type'),
            React.createElement('th', { style: styles.th }, 'Department'),
            React.createElement('th', { style: styles.th }, 'Status'),
            React.createElement('th', { style: styles.th }, 'Submitted'),
            React.createElement('th', { style: styles.th }, 'Actions')
          )
        ),
        React.createElement(
          'tbody',
          null,
          filteredChanges.map((c) => {
            const statusInfo = getStatusBadge(c.status);
            return React.createElement(
              'tr',
              { key: c.id },
              React.createElement(
                'td',
                { style: styles.td },
                React.createElement('strong', null, c.title),
                React.createElement('br', null),
                React.createElement(
                  'small',
                  { style: { color: '#666', fontSize: '12px' } },
                  c.description?.substring(0, 50),
                  c.description?.length > 50 ? '...' : ''
                )
              ),
              React.createElement('td', { style: styles.td }, getTypeLabel(c.change_type)),
              React.createElement('td', { style: styles.td }, c.department_code),
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
                  'small',
                  null,
                  new Date(c.proposed_at || c.created_at).toLocaleDateString()
                ),
                c.proposed_by && React.createElement(
                  React.Fragment,
                  null,
                  React.createElement('br', null),
                  React.createElement(
                    'small',
                    { style: { color: '#999' } },
                    'by ',
                    c.proposed_by
                  )
                )
              ),
              React.createElement(
                'td',
                { style: styles.td },
                React.createElement(
                  'div',
                  { style: styles.actionButtons },
                  // View button - always shown
                  React.createElement(
                    'button',
                    { style: styles.viewBtn, onClick: () => openViewDetails(c) },
                    '\uD83D\uDCCB View'
                  ),
                  // Review buttons - only for pending statuses
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
                  // Status indicators for non-pending
                  c.status === 'approved' && React.createElement(
                    'span',
                    { style: styles.approvedText },
                    '\u2705 Approved'
                  ),
                  c.status === 'rejected' && React.createElement(
                    'span',
                    { style: styles.rejectedText },
                    '\u274C Rejected'
                  ),
                  c.status === 'implemented' && React.createElement(
                    'span',
                    { style: styles.implementedText },
                    '\uD83D\uDD27 Implemented'
                  ),
                  c.status === 'pending' || c.status === 'pending_dean' || c.status === 'pending_hod' ? React.createElement(
                    'span',
                    { style: styles.pendingText },
                    '\u23F3 Pending'
                  ) : null
                )
              )
            );
          })
        )
      )
    ),
    showModal && selectedChange && React.createElement(
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
            viewingDetails ? '\uD83D\uDCCB Curriculum Change Details' :
            actionType === 'approve' ? '\u2705 Approve Curriculum Change' :
            actionType === 'reject' ? '\u274C Reject Curriculum Change' :
            '\uD83D\uDD04 Return for Revision'
          ),
          React.createElement(
            'button',
            {
              onClick: () => setShowModal(false),
              style: {
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }
            },
            '\u2715'
          )
        ),
        React.createElement(
          'div',
          { style: styles.modalBody },
          // Basic Details
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
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, selectedChange.title)
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Type:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, getTypeLabel(selectedChange.change_type))
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Department:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, selectedChange.department_code)
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
                      background: getStatusBadge(selectedChange.status).color,
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }
                  }, getStatusBadge(selectedChange.status).label)
                )
              )
            ),
            // Timeline with all events in order
            React.createElement(
              'div',
              { style: { marginTop: '12px' } },
              React.createElement('strong', { style: { fontSize: '13px', color: '#1a237e', display: 'block', marginBottom: '8px' } }, '📋 Timeline'),
              React.createElement(
                'div',
                { style: { background: '#f8f9fa', borderRadius: '8px', overflow: 'hidden' } },
                renderTimeline(selectedChange).map((item, index, array) => {
                  const isLast = index === array.length - 1;
                  return React.createElement(
                    'div',
                    {
                      key: item.key,
                      style: isLast ? styles.timelineItemLast : styles.timelineItem
                    },
                    React.createElement('span', { style: styles.timelineIcon }, item.icon),
                    React.createElement(
                      'div',
                      { style: styles.timelineContent },
                      React.createElement(
                        'div',
                        null,
                        React.createElement('span', { style: { ...styles.timelineLabel, color: item.color } }, item.label),
                        React.createElement(
                          'span',
                          { style: { ...styles.timelineDate, marginLeft: '8px' } },
                          item.date ? new Date(item.date).toLocaleString() : 'N/A'
                        )
                      ),
                      React.createElement(
                        'div',
                        { style: styles.timelineBy },
                        'by ',
                        item.by
                      )
                    )
                  );
                })
              )
            ),
            // Description and other details
            React.createElement(
              'div',
              { style: { marginTop: '12px' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Description:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, selectedChange.description)
            ),
            selectedChange.proposed_changes && React.createElement(
              'div',
              { style: { marginTop: '8px' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Proposed Changes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, selectedChange.proposed_changes)
            ),
            selectedChange.justification && React.createElement(
              'div',
              { style: { marginTop: '8px' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Justification:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, selectedChange.justification)
            ),
            selectedChange.hod_notes && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #1976d2' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0', display: 'block' } }, '\uD83D\uDC68\u200D\uD83C\uDFEB HOD Notes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333', fontSize: '13px' } }, selectedChange.hod_notes)
            ),
            selectedChange.dean_notes && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#e8f5e9', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #2e7d32' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#2e7d32', display: 'block' } }, '\uD83D\uDC68\u200D\uD83C\uDFEB Dean\'s Notes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333', fontSize: '13px' } }, selectedChange.dean_notes)
            ),
            selectedChange.rejection_reason && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#ffebee', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #c62828' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#c62828', display: 'block' } }, '\u274C Rejection Reason:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#c62828' } }, selectedChange.rejection_reason)
            ),
            selectedChange.implementation_notes && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #1565c0' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0', display: 'block' } }, '\uD83D\uDD27 Implementation Notes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333', fontSize: '13px' } }, selectedChange.implementation_notes)
            )
          ),
          !viewingDetails && canReview(selectedChange.status) && React.createElement(
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
                  ? 'Explain why this change is being rejected...' 
                  : 'Provide feedback on what needs to be revised...',
                rows: 4
              }),
              actionType === 'approve' && React.createElement(
                'small',
                { style: { color: '#999' } },
                'Notes are optional for approval'
              ),
              (actionType === 'reject' || actionType === 'return') && React.createElement(
                'small',
                { style: { color: '#c62828' } },
                'Feedback is required'
              )
            )
          )
        ),
        React.createElement(
          'div',
          { style: styles.modalFooter },
          React.createElement(
            'button',
            {
              onClick: () => setShowModal(false),
              style: {
                padding: '8px 20px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }
            },
            viewingDetails ? 'Close' : 'Cancel'
          ),
          !viewingDetails && canReview(selectedChange?.status) && React.createElement(
            React.Fragment,
            null,
            actionType === 'approve' && React.createElement(
              'button',
              {
                onClick: () => handleApprove(selectedChange.id),
                style: {
                  padding: '8px 24px',
                  background: '#2e7d32',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }
              },
              '\u2705 Approve'
            ),
            actionType === 'return' && React.createElement(
              'button',
              {
                onClick: () => handleReturnToHOD(selectedChange.id),
                style: {
                  padding: '8px 24px',
                  background: '#e65100',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }
              },
              '\uD83D\uDD04 Return to HOD'
            ),
            actionType === 'reject' && React.createElement(
              'button',
              {
                onClick: () => handleReject(selectedChange.id),
                style: {
                  padding: '8px 24px',
                  background: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }
              },
              '\u274C Reject'
            )
          )
        )
      )
    )
  );
};

export default DeanCurriculum;