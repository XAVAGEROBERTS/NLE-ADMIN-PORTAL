// HOD/HODQualityAssurance.jsx - With View Details Modal
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const HODQualityAssurance = ({ 
  departmentCode, 
  departmentName, 
  hodEmail, 
  hodName,
  profile,
  showToast 
}) => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [error, setError] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    checklist_type: 'internal',
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    semester: 1,
  });

  const fetchChecklists = useCallback(async () => {
    if (!departmentCode) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('qa_checklists')
        .select('*')
        .eq('department_code', departmentCode)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (err) {
      console.error('Error fetching QA checklists:', err);
      setError('Failed to load checklists');
      showToast?.('Failed to load checklists', 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentCode, showToast]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      checklist_type: 'internal',
      academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      semester: 1,
    });
    setChecklistItems([]);
    setEditItem(null);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...checklistItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setChecklistItems(newItems);
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, { 
      id: Date.now(),
      criteria: '', 
      status: 'pending', 
      notes: '',
      evidence: ''
    }]);
  };

  const removeChecklistItem = (index) => {
    const newItems = checklistItems.filter((_, i) => i !== index);
    setChecklistItems(newItems);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      checklist_type: item.checklist_type || 'internal',
      academic_year: item.academic_year || '',
      semester: item.semester || 1,
    });
    setChecklistItems(item.items || []);
    setShowModal(true);
  };

  const handleView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Please provide a title');
      return;
    }

    if (checklistItems.length === 0) {
      setError('Please add at least one checklist item');
      return;
    }

    const incompleteItems = checklistItems.filter(item => !item.criteria?.trim());
    if (incompleteItems.length > 0) {
      setError('Please fill in all criteria fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      
      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id || profile?.id || null;
      
      const checklistData = {
        department_code: departmentCode,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        checklist_type: formData.checklist_type,
        academic_year: formData.academic_year,
        semester: parseInt(formData.semester),
        items: checklistItems,
        status: 'pending',
        submitted_by: hodName || hodEmail || 'HOD',
        submitted_by_id: authUserId,
        submitted_at: now,
        updated_at: now,
      };

      let result;
      if (editItem) {
        const { data, error } = await supabase
          .from('qa_checklists')
          .update(checklistData)
          .eq('id', editItem.id)
          .select();
        
        if (error) throw error;
        result = data;
        showToast?.('Checklist updated successfully!', 'success');
      } else {
        const { data, error } = await supabase
          .from('qa_checklists')
          .insert([checklistData])
          .select();
        
        if (error) throw error;
        result = data;
        showToast?.('Checklist submitted for review!', 'success');
      }

      resetForm();
      setShowModal(false);
      await fetchChecklists();
    } catch (err) {
      console.error('Error submitting checklist:', err);
      setError('Failed to submit: ' + err.message);
      showToast?.('Error submitting: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { label: '⏳ Pending', color: '#ffa726', bg: '#fff3e0' },
      'in_progress': { label: '📋 In Progress', color: '#42a5f5', bg: '#e3f2fd' },
      'completed': { label: '✅ Completed', color: '#66bb6a', bg: '#e8f5e9' },
      'approved': { label: '✅ Approved by Dean', color: '#2e7d32', bg: '#c8e6c9' },
      'needs_revision': { label: '🔄 Revision Needed', color: '#ff7043', bg: '#fbe9e7' },
      'rejected': { label: '❌ Rejected by Dean', color: '#ef5350', bg: '#ffebee' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999', bg: '#f5f5f5' };
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

  const filteredChecklists = checklists.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const pendingCount = checklists.filter(c => c.status === 'pending' || c.status === 'in_progress').length;

  // Styles
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
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
      gap: '20px'
    },
    card: {
      background: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      border: '1px solid #f0f0f5',
      transition: 'all 0.3s ease'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10px'
    },
    cardTitle: { margin: 0, color: '#1a237e', fontSize: '16px' },
    cardSub: { margin: '4px 0 0 0', fontSize: '13px', color: '#666' },
    itemsList: { margin: '8px 0', paddingLeft: '16px' },
    itemText: { fontSize: '13px', color: '#444', margin: '4px 0' },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #f0f0f0'
    },
    empty: {
      textAlign: 'center',
      padding: '60px 20px',
      background: 'white',
      borderRadius: '12px',
      gridColumn: '1 / -1'
    },
    primaryBtn: {
      padding: '10px 20px',
      background: '#1a237e',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px'
    },
    viewBtn: {
      background: '#e8eaf6',
      color: '#1a237e',
      border: '1px solid #c5cae9',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      marginRight: '4px'
    },
    editBtn: {
      background: 'transparent',
      color: '#1a237e',
      border: '1px solid #1a237e',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    actionButtons: {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap'
    },
    deanFeedback: {
      marginTop: '12px',
      padding: '12px 14px',
      background: '#f5f7ff',
      borderRadius: '8px',
      borderLeft: '4px solid #1a237e'
    },
    deanApproved: {
      marginTop: '12px',
      padding: '12px 14px',
      background: '#e8f5e9',
      borderRadius: '8px',
      borderLeft: '4px solid #2e7d32'
    },
    deanRejected: {
      marginTop: '12px',
      padding: '12px 14px',
      background: '#ffebee',
      borderRadius: '8px',
      borderLeft: '4px solid #c62828'
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
      zIndex: 1000
    },
    modal: {
      background: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflow: 'auto',
      padding: '24px'
    },
    viewModal: {
      background: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '750px',
      maxHeight: '90vh',
      overflow: 'auto',
      padding: '24px'
    },
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '600' },
    input: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      fontSize: '14px'
    },
    textarea: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      fontSize: '14px',
      resize: 'vertical'
    },
    itemRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginBottom: '8px'
    },
    itemInput: {
      flex: 1,
      padding: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '13px'
    },
    removeBtn: {
      background: '#ffebee',
      color: '#c62828',
      border: 'none',
      padding: '4px 10px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    detailRow: {
      display: 'flex',
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f5'
    },
    detailLabel: {
      width: '140px',
      fontWeight: '600',
      color: '#666',
      fontSize: '13px',
      flexShrink: 0
    },
    detailValue: {
      flex: 1,
      color: '#333',
      fontSize: '13px'
    },
    itemStatusBadge: {
      fontSize: '11px',
      padding: '2px 10px',
      borderRadius: '10px',
      fontWeight: '500'
    },
    statusCompleted: { background: '#e8f5e9', color: '#2e7d32' },
    statusInProgress: { background: '#fff3e0', color: '#e65100' },
    statusPending: { background: '#f5f5f5', color: '#666' },
    statusNA: { background: '#e3f2fd', color: '#1565c0' }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '📋 Quality Assurance'),
      React.createElement('span', { style: styles.badge }, pendingCount, ' Pending')
    ),
    React.createElement(
      'div',
      { style: styles.filters },
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
        React.createElement('option', { value: 'approved' }, 'Approved by Dean'),
        React.createElement('option', { value: 'needs_revision' }, 'Needs Revision'),
        React.createElement('option', { value: 'rejected' }, 'Rejected by Dean')
      ),
      React.createElement(
        'button',
        { style: styles.primaryBtn, onClick: () => { resetForm(); setShowModal(true); } },
        '➕ New Checklist'
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchChecklists },
        '\uD83D\uDD04 Refresh'
      )
    ),
    error && React.createElement(
      'div',
      { style: { background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' } },
      '❌ ',
      error
    ),
    React.createElement(
      'div',
      { style: styles.grid },
      loading ? React.createElement(
        'div',
        { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '40px' } },
        'Loading checklists...'
      ) : filteredChecklists.length === 0 ? React.createElement(
        'div',
        { style: styles.empty },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '📋'),
        React.createElement('h3', null, 'No QA Checklists'),
        React.createElement('p', { style: { color: '#666' } }, 'Create a new QA checklist for your department.')
      ) : filteredChecklists.map((item) => {
        const statusInfo = getStatusBadge(item.status);
        return React.createElement(
          'div',
          { key: item.id, style: styles.card },
          React.createElement(
            'div',
            { style: styles.cardHeader },
            React.createElement(
              'div',
              null,
              React.createElement('h4', { style: styles.cardTitle }, item.title),
              React.createElement('p', { style: styles.cardSub }, getTypeLabel(item.checklist_type)),
              React.createElement('p', { style: { fontSize: '12px', color: '#999' } },
                item.academic_year, ' - Sem ', item.semester
              )
            ),
            React.createElement('span', {
              style: {
                background: statusInfo.bg,
                color: statusInfo.color,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                border: '1px solid ' + statusInfo.color
              }
            }, statusInfo.label)
          ),
          item.description && React.createElement(
            'p',
            { style: { fontSize: '14px', color: '#444', margin: '8px 0' } },
            item.description
          ),
          React.createElement(
            'div',
            { style: styles.itemsList },
            (item.items || []).slice(0, 3).map((i, idx) => (
              React.createElement('p', { key: idx, style: styles.itemText },
                '• ',
                i.criteria,
                i.status === 'completed' && ' ✅',
                i.status === 'pending' && ' ⏳',
                i.status === 'in_progress' && ' 📋'
              )
            )),
            (item.items || []).length > 3 && React.createElement(
              'p',
              { style: { fontSize: '12px', color: '#999' } },
              '+', (item.items || []).length - 3, ' more items'
            )
          ),
          // Show Dean's feedback if available
          item.dean_notes && React.createElement(
            'div',
            { 
              style: item.status === 'approved' ? styles.deanApproved : 
                     item.status === 'rejected' ? styles.deanRejected : 
                     styles.deanFeedback 
            },
            React.createElement(
              'strong',
              { style: { fontSize: '12px', display: 'block', marginBottom: '4px' } },
              item.status === 'approved' ? '✅ Approved by Dean' :
              item.status === 'rejected' ? '❌ Rejected by Dean' :
              '👨‍🏫 Dean\'s Feedback'
            ),
            React.createElement(
              'p',
              { style: { margin: 0, fontSize: '13px', color: '#444' } },
              item.dean_notes
            ),
            item.dean_approved_at && React.createElement(
              'small',
              { style: { color: '#999', display: 'block', marginTop: '4px' } },
              'Reviewed on: ', new Date(item.dean_approved_at).toLocaleString()
            )
          ),
          React.createElement(
            'div',
            { style: styles.footer },
            React.createElement('small', { style: { color: '#999' } },
              'Submitted: ', new Date(item.submitted_at).toLocaleDateString()
            ),
            React.createElement(
              'div',
              { style: styles.actionButtons },
              // View button - always shown
              React.createElement(
                'button',
                { style: styles.viewBtn, onClick: () => handleView(item) },
                '\uD83D\uDCCB View'
              ),
              // Edit button - only for pending or needs_revision
              (item.status === 'pending' || item.status === 'needs_revision') && React.createElement(
                'button',
                { style: styles.editBtn, onClick: () => handleEdit(item) },
                '✏️ Edit'
              )
            )
          )
        );
      })
    ),
    // New/Edit Modal
    showModal && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowModal(false) },
      React.createElement(
        'div',
        { style: styles.modal, onClick: (e) => e.stopPropagation() },
        // ... modal content (same as before)
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } },
            editItem ? '✏️ Edit QA Checklist' : '📋 New QA Checklist'
          ),
          React.createElement('button', {
            onClick: () => setShowModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        React.createElement(
          'form',
          { onSubmit: handleSubmit },
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Title *'),
            React.createElement('input', {
              type: 'text',
              name: 'title',
              value: formData.title,
              onChange: handleInputChange,
              style: styles.input,
              placeholder: 'e.g., Department Self-Assessment 2024'
            })
          ),
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Checklist Type *'),
              React.createElement('select', {
                name: 'checklist_type',
                value: formData.checklist_type,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 'internal' }, '📋 Internal QA'),
                React.createElement('option', { value: 'external' }, '🔍 External QA'),
                React.createElement('option', { value: 'accreditation' }, '🎓 Accreditation'),
                React.createElement('option', { value: 'program_review' }, '📊 Program Review')
              )
            ),
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Semester *'),
              React.createElement('select', {
                name: 'semester',
                value: formData.semester,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 1 }, 'Semester 1'),
                React.createElement('option', { value: 2 }, 'Semester 2')
              )
            )
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Academic Year *'),
            React.createElement('input', {
              type: 'text',
              name: 'academic_year',
              value: formData.academic_year,
              onChange: handleInputChange,
              style: styles.input,
              placeholder: 'e.g., 2024/2025'
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Description'),
            React.createElement('textarea', {
              name: 'description',
              value: formData.description,
              onChange: handleInputChange,
              style: styles.textarea,
              placeholder: 'Describe the purpose of this QA checklist...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Checklist Items *'),
            React.createElement(
              'div',
              null,
              checklistItems.map((item, index) => React.createElement(
                'div',
                { key: index, style: styles.itemRow },
                React.createElement('input', {
                  type: 'text',
                  value: item.criteria || '',
                  onChange: (e) => handleItemChange(index, 'criteria', e.target.value),
                  style: { ...styles.itemInput, width: '55%' },
                  placeholder: 'Criteria/Requirement'
                }),
                React.createElement('select', {
                  value: item.status || 'pending',
                  onChange: (e) => handleItemChange(index, 'status', e.target.value),
                  style: { ...styles.input, width: '30%' }
                },
                  React.createElement('option', { value: 'pending' }, '⏳ Pending'),
                  React.createElement('option', { value: 'in_progress' }, '📋 In Progress'),
                  React.createElement('option', { value: 'completed' }, '✅ Completed'),
                  React.createElement('option', { value: 'not_applicable' }, 'N/A')
                ),
                React.createElement('button', {
                  type: 'button',
                  onClick: () => removeChecklistItem(index),
                  style: styles.removeBtn
                }, '✕')
              ))
            ),
            React.createElement('button', {
              type: 'button',
              onClick: addChecklistItem,
              style: { ...styles.primaryBtn, background: '#1976d2', padding: '6px 16px', fontSize: '13px' }
            }, '➕ Add Item')
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #f0f0f0' } },
            React.createElement('button', {
              type: 'button',
              onClick: () => setShowModal(false),
              style: { padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }
            }, 'Cancel'),
            React.createElement('button', {
              type: 'submit',
              disabled: submitting,
              style: { padding: '10px 24px', background: submitting ? '#999' : '#1a237e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }
            }, submitting ? 'Submitting...' : (editItem ? 'Update' : 'Submit'))
          )
        )
      )
    ),
    // View Details Modal
    showViewModal && viewItem && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowViewModal(false) },
      React.createElement(
        'div',
        { style: styles.viewModal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '\uD83D\uDCCB QA Checklist Details'),
          React.createElement('button', {
            onClick: () => setShowViewModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        // Basic Info
        React.createElement(
          'div',
          { style: { background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' } },
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Title'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.title)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Type'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, getTypeLabel(viewItem.checklist_type))
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Department'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.department_code)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Academic Year'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.academic_year)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Semester'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, 'Semester ', viewItem.semester)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Status'),
              React.createElement(
                'p',
                { style: { margin: '4px 0' } },
                React.createElement('span', {
                  style: {
                    background: getStatusBadge(viewItem.status).bg,
                    color: getStatusBadge(viewItem.status).color,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }
                }, getStatusBadge(viewItem.status).label)
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Submitted By'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.submitted_by || 'HOD')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Submitted On'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, new Date(viewItem.submitted_at).toLocaleString())
            )
          ),
          viewItem.description && React.createElement(
            'div',
            { style: { marginTop: '8px' } },
            React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Description'),
            React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, viewItem.description)
          )
        ),
        // Checklist Items
        React.createElement(
          'div',
          null,
          React.createElement('strong', { style: { fontSize: '13px', color: '#1a237e', display: 'block', marginBottom: '8px' } }, '\uD83D\uDCCB Checklist Items'),
          React.createElement(
            'div',
            { style: { background: '#fafafa', borderRadius: '8px', overflow: 'hidden' } },
            React.createElement(
              'div',
              { style: { display: 'flex', padding: '8px 12px', background: '#e8eaf6', fontWeight: '600', fontSize: '12px', color: '#1a237e' } },
              React.createElement('div', { style: { flex: 1 } }, 'Criteria'),
              React.createElement('div', { style: { width: '120px', textAlign: 'center' } }, 'Status')
            ),
            (viewItem.items || []).map((item, index) => {
              let statusClass = '';
              let statusLabel = item.status || 'pending';
              if (statusLabel === 'completed') statusClass = 'completed';
              else if (statusLabel === 'in_progress') statusClass = 'in-progress';
              else if (statusLabel === 'pending') statusClass = 'pending';
              else if (statusLabel === 'not_applicable') statusClass = 'not-applicable';
              
              return React.createElement(
                'div',
                { key: index, style: { display: 'flex', padding: '8px 12px', borderBottom: '1px solid #f0f0f5', alignItems: 'center' } },
                React.createElement('div', { style: { flex: 1, fontSize: '13px', color: '#333' } },
                  (index + 1), '. ', item.criteria
                ),
                React.createElement(
                  'div',
                  { style: { width: '120px', textAlign: 'center' } },
                  React.createElement('span', {
                    className: 'qa-checklist-item .item-status ' + statusClass,
                    style: {
                      fontSize: '11px',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      fontWeight: '500',
                      background: statusClass === 'completed' ? '#e8f5e9' : 
                                 statusClass === 'in-progress' ? '#fff3e0' : 
                                 statusClass === 'pending' ? '#f5f5f5' : 
                                 statusClass === 'not-applicable' ? '#e3f2fd' : '#f5f5f5',
                      color: statusClass === 'completed' ? '#2e7d32' : 
                             statusClass === 'in-progress' ? '#e65100' : 
                             statusClass === 'pending' ? '#666' : 
                             statusClass === 'not-applicable' ? '#1565c0' : '#666'
                    }
                  }, statusLabel === 'completed' ? '✅ Completed' :
                     statusLabel === 'in_progress' ? '📋 In Progress' :
                     statusLabel === 'pending' ? '⏳ Pending' :
                     statusLabel === 'not_applicable' ? 'N/A' : statusLabel)
                )
              );
            })
          )
        ),
        // Dean's Feedback
        viewItem.dean_notes && React.createElement(
          'div',
          { 
            style: { 
              marginTop: '16px', 
              padding: '12px 14px', 
              borderRadius: '8px',
              background: viewItem.status === 'approved' ? '#e8f5e9' : 
                         viewItem.status === 'rejected' ? '#ffebee' : '#f5f7ff',
              borderLeft: '4px solid ' + (viewItem.status === 'approved' ? '#2e7d32' : 
                                         viewItem.status === 'rejected' ? '#c62828' : '#1a237e')
            }
          },
          React.createElement(
            'strong',
            { style: { fontSize: '12px', display: 'block', marginBottom: '4px' } },
            viewItem.status === 'approved' ? '✅ Approved by Dean' :
            viewItem.status === 'rejected' ? '❌ Rejected by Dean' :
            '👨‍🏫 Dean\'s Feedback'
          ),
          React.createElement(
            'p',
            { style: { margin: 0, fontSize: '13px', color: '#444' } },
            viewItem.dean_notes
          ),
          viewItem.dean_approved_at && React.createElement(
            'small',
            { style: { color: '#999', display: 'block', marginTop: '4px' } },
            'Reviewed on: ', new Date(viewItem.dean_approved_at).toLocaleString()
          )
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' } },
          React.createElement('button', {
            onClick: () => setShowViewModal(false),
            style: { padding: '10px 24px', background: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }
          }, 'Close')
        )
      )
    )
  );
};

export default HODQualityAssurance;