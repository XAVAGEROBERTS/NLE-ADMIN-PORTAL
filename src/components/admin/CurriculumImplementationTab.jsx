// admin/CurriculumImplementationTab.jsx - Updated Actions with rejection details
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const CurriculumImplementationTab = ({ showToast }) => {
  const [curriculumChanges, setCurriculumChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState(null);
  const [implementationNotes, setImplementationNotes] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [implementing, setImplementing] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);

  const fetchCurriculumChanges = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('curriculum_changes')
        .select('*')
        .in('status', ['approved', 'implemented', 'rejected', 'needs_revision'])
        .order('dean_approved_at', { ascending: false });

      if (error) throw error;
      setCurriculumChanges(data || []);
    } catch (err) {
      console.error('Error fetching curriculum changes:', err);
      showToast?.('Error loading curriculum changes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCurriculumChanges();
  }, [fetchCurriculumChanges]);

  const getStatusBadge = (status) => {
    const statusMap = {
      'approved': { label: '✅ Ready for Implementation', color: '#2e7d32', bg: '#e8f5e9' },
      'implemented': { label: '🔧 Implemented', color: '#1565c0', bg: '#e3f2fd' },
      'rejected': { label: '❌ Rejected by Dean', color: '#c62828', bg: '#ffebee' },
      'needs_revision': { label: '🔄 Revision Needed', color: '#e65100', bg: '#fff3e0' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999', bg: '#f5f5f5' };
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

  const handleImplement = (change) => {
    setSelectedChange(change);
    setImplementationNotes('');
    setViewingDetails(false);
    setShowModal(true);
  };

  const handleViewDetails = (change) => {
    setSelectedChange(change);
    setViewingDetails(true);
    setShowModal(true);
  };

  const confirmImplementation = async () => {
    if (!selectedChange) return;

    setImplementing(true);
    try {
      const { error: updateError } = await supabase
        .from('curriculum_changes')
        .update({
          status: 'implemented',
          implemented_at: new Date().toISOString(),
          implemented_by: 'system_admin',
          implementation_notes: implementationNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChange.id);

      if (updateError) throw updateError;

      const { data: hodUsers } = await supabase
        .from('user_roles')
        .select('email')
        .eq('role', 'hod');

      const { data: deanUsers } = await supabase
        .from('user_roles')
        .select('email')
        .eq('role', 'dean');

      const recipients = [
        ...(hodUsers || []).map(h => h.email),
        ...(deanUsers || []).map(d => d.email)
      ];

      if (recipients.length > 0) {
        const notifications = recipients.map(email => ({
          user_email: email,
          student_id: 'system',
          title: '🔧 Curriculum Change Implemented',
          message: `The curriculum change "${selectedChange.title}" has been successfully implemented by the System Administrator.${implementationNotes ? `\n\nNotes: ${implementationNotes}` : ''}`,
          type: 'curriculum_implemented',
          is_read: false,
          metadata: {
            curriculum_change_id: selectedChange.id,
            department_code: selectedChange.department_code,
            implemented_at: new Date().toISOString()
          },
          sender_email: 'system@nleuniversity.ac.ug',
          sender_name: '🔧 System Admin',
          sender_role: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        await supabase.from('notifications').insert(notifications);
      }

      showToast?.('✅ Curriculum change implemented successfully!', 'success');
      setShowModal(false);
      setSelectedChange(null);
      await fetchCurriculumChanges();

    } catch (err) {
      console.error('Error implementing:', err);
      showToast?.('Error implementing: ' + err.message, 'error');
    } finally {
      setImplementing(false);
    }
  };

  const filteredChanges = curriculumChanges.filter((c) => {
    const matchFilter = filter === 'all' || c.status === filter;
    const matchSearch =
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.department_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = curriculumChanges.filter(c => c.status === 'approved').length;

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
      background: '#1976d2',
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
    implementBtn: {
      background: '#1976d2',
      color: 'white',
      border: 'none',
      padding: '6px 16px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px'
    },
    viewBtn: {
      background: '#e8eaf6',
      color: '#1a237e',
      border: 'none',
      padding: '6px 16px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px'
    },
    doneText: { color: '#2e7d32', fontWeight: '600' },
    rejectedText: { color: '#c62828', fontWeight: '600' },
    revisionText: { color: '#e65100', fontWeight: '600' },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      background: 'white',
      borderRadius: '12px'
    },
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
    warning: {
      background: '#fff3e0',
      padding: '12px 16px',
      borderRadius: '6px',
      border: '1px solid #ffcc80',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px'
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
    actionButtons: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    // New style for rejection info
    rejectionInfo: {
      fontSize: '11px',
      color: '#c62828',
      marginTop: '2px',
      display: 'block'
    }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '🔧 Curriculum Implementation'),
      React.createElement('span', { style: styles.badge }, pendingCount, ' Ready for Implementation')
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
        React.createElement('option', { value: 'approved' }, 'Ready for Implementation (', pendingCount, ')'),
        React.createElement('option', { value: 'implemented' }, 'Implemented'),
        React.createElement('option', { value: 'rejected' }, 'Rejected'),
        React.createElement('option', { value: 'needs_revision' }, 'Needs Revision')
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
          filter === 'approved'
            ? 'No approved changes waiting for implementation.'
            : 'No changes found for the selected filter.'
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
            React.createElement('th', { style: styles.th }, 'Approved'),
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
                    background: statusInfo.bg,
                    color: statusInfo.color,
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
                c.dean_approved_at ? new Date(c.dean_approved_at).toLocaleDateString() : 'N/A',
                c.implemented_at && React.createElement(
                  React.Fragment,
                  null,
                  React.createElement('br', null),
                  React.createElement(
                    'small',
                    { style: { color: '#999' } },
                    'Implemented: ',
                    new Date(c.implemented_at).toLocaleDateString()
                  )
                ),
                c.rejected_at && React.createElement(
                  React.Fragment,
                  null,
                  React.createElement('br', null),
                  React.createElement(
                    'small',
                    { style: { color: '#c62828' } },
                    'Rejected: ',
                    new Date(c.rejected_at).toLocaleDateString()
                  )
                )
              ),
              React.createElement(
                'td',
                { style: styles.td },
                React.createElement(
                  'div',
                  { style: styles.actionButtons },
                  // Show "View" button for implemented, rejected, and needs_revision
                  (c.status === 'implemented' || c.status === 'rejected' || c.status === 'needs_revision') && React.createElement(
                    'button',
                    { style: styles.viewBtn, onClick: () => handleViewDetails(c) },
                    '\uD83D\uDCCB View'
                  ),
                  // Show "Implement" button only for approved status
                  c.status === 'approved' && React.createElement(
                    'button',
                    { style: styles.implementBtn, onClick: () => handleImplement(c) },
                    '\uD83D\uDD27 Implement'
                  ),
                  // Show status indicators with who rejected
                  c.status === 'implemented' && React.createElement(
                    'span',
                    { style: styles.doneText },
                    '\u2705 Done'
                  ),
                  c.status === 'rejected' && React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'span',
                      { style: styles.rejectedText },
                      '\u274C Rejected'
                    ),
                
                  ),
                  c.status === 'needs_revision' && React.createElement(
                    'span',
                    { style: styles.revisionText },
                    '\uD83D\uDD04 Revision Needed'
                  )
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
            viewingDetails ? '\uD83D\uDCCB Curriculum Change Details' : '\uD83D\uDD27 Implement Curriculum Change'
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
                      background: getStatusBadge(selectedChange.status).bg,
                      color: getStatusBadge(selectedChange.status).color,
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }
                  }, getStatusBadge(selectedChange.status).label)
                )
              ),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Approved:'),
                React.createElement('p', { style: { margin: '4px 0' } },
                  selectedChange.dean_approved_at ? new Date(selectedChange.dean_approved_at).toLocaleString() : 'N/A'
                )
              ),
              selectedChange.implemented_at && React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Implemented:'),
                React.createElement('p', { style: { margin: '4px 0' } },
                  new Date(selectedChange.implemented_at).toLocaleString()
                )
              ),
              selectedChange.rejected_at && React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#c62828', textTransform: 'uppercase' } }, 'Rejected by Dean:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#c62828' } },
                  new Date(selectedChange.rejected_at).toLocaleString()
                )
              ),
              selectedChange.implemented_by && React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Implemented By:'),
                React.createElement('p', { style: { margin: '4px 0' } }, selectedChange.implemented_by)
              ),
              selectedChange.rejection_reason && React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { fontSize: '12px', color: '#c62828', textTransform: 'uppercase' } }, 'Rejection Reason:'),
                React.createElement('p', { style: { margin: '4px 0', color: '#c62828', background: '#ffebee', padding: '8px 12px', borderRadius: '4px' } },
                  selectedChange.rejection_reason
                )
              )
            ),
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
            selectedChange.dean_notes && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#e3f2fd', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #1976d2' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0', display: 'block' } }, '\uD83D\uDC68\u200D\uD83C\uDFEB Dean\'s Notes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333', fontSize: '13px' } }, selectedChange.dean_notes)
            ),
            selectedChange.implementation_notes && React.createElement(
              'div',
              { style: { marginTop: '8px', background: '#e8f5e9', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #2e7d32' } },
              React.createElement('strong', { style: { fontSize: '12px', color: '#2e7d32', display: 'block' } }, '\uD83D\uDD27 Implementation Notes:'),
              React.createElement('p', { style: { margin: '4px 0', color: '#333', fontSize: '13px' } }, selectedChange.implementation_notes)
            )
          ),
          !viewingDetails && selectedChange.status === 'approved' && React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'div',
              { style: { marginBottom: '16px' } },
              React.createElement('label', { style: { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a237e' } },
                'Implementation Notes (Optional)'
              ),
              React.createElement('textarea', {
                value: implementationNotes,
                onChange: (e) => setImplementationNotes(e.target.value),
                style: styles.textarea,
                placeholder: 'Add notes about how this change was implemented...',
                rows: 3
              })
            ),
            React.createElement(
              'div',
              { style: styles.warning },
              React.createElement('span', { style: { fontSize: '20px', flexShrink: 0 } }, '\u26A0\uFE0F'),
              React.createElement(
                'div',
                null,
                React.createElement('strong', { style: { display: 'block', color: '#e65100' } }, 'Confirm Implementation:'),
                React.createElement('p', { style: { margin: 0, fontSize: '13px', color: '#555' } },
                  'This action will mark the curriculum change as implemented. HOD and Dean will be notified.'
                )
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
            'Close'
          ),
          !viewingDetails && selectedChange.status === 'approved' && React.createElement(
            'button',
            {
              onClick: confirmImplementation,
              disabled: implementing,
              style: {
                padding: '8px 24px',
                background: implementing ? '#999' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: implementing ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }
            },
            implementing ? 'Implementing...' : '\uD83D\uDD27 Confirm Implementation'
          )
        )
      )
    )
  );
};

export default CurriculumImplementationTab;