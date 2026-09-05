// HOD/HODDisciplinaryCases.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const HODDisciplinaryCases = ({ 
  departmentCode, 
  departmentName, 
  hodEmail, 
  hodName,
  profile,
  showToast 
}) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [error, setError] = useState(null);

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    case_type: 'conduct',
    respondent_type: 'student',
    respondent_id: null,
    respondent_name: '',
    respondent_email: '',
    respondent_details: {},
    reported_by: hodName || hodEmail || 'HOD',
    status: 'pending',
  });

  // Generate case number
  const generateCaseNumber = useCallback(() => {
    const prefix = departmentCode || 'DEPT';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = cases.length + 1;
    return `${prefix}-${year}${month}-${String(count).padStart(4, '0')}`;
  }, [departmentCode, cases.length]);

  const fetchCases = useCallback(async () => {
    if (!departmentCode) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('disciplinary_cases')
        .select('*')
        .eq('department_code', departmentCode)
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error('Error fetching disciplinary cases:', err);
      setError('Failed to load cases');
      showToast?.('Failed to load cases', 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentCode, showToast]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Search for students, lecturers, or staff
  const searchRespondents = useCallback(async (query, type) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      let results = [];
      
      if (type === 'student') {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name, email, student_id, program, department_code')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,student_id.ilike.%${query}%`)
          .eq('department_code', departmentCode)
          .limit(10);
        
        if (error) throw error;
        results = (data || []).map(s => ({
          id: s.id,
          name: s.full_name,
          email: s.email,
          identifier: s.student_id,
          details: { student_id: s.student_id, program: s.program }
        }));
      } else if (type === 'lecturer') {
        const { data, error } = await supabase
          .from('lecturers')
          .select('id, full_name, email, lecturer_id, specialization, department')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,lecturer_id.ilike.%${query}%`)
          .limit(10);
        
        if (error) throw error;
        results = (data || []).map(l => ({
          id: l.id,
          name: l.full_name,
          email: l.email,
          identifier: l.lecturer_id,
          details: { lecturer_id: l.lecturer_id, specialization: l.specialization }
        }));
      } else if (type === 'staff') {
        const { data, error } = await supabase
          .from('user_roles')
          .select('id, email, role, full_name, user_id')
          .eq('role', 'staff')
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);
        
        if (error) throw error;
        results = (data || []).map(s => ({
          id: s.id,
          name: s.full_name || s.email,
          email: s.email,
          identifier: s.user_id || s.id,
          details: { role: s.role }
        }));
      }

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Error searching respondents:', err);
    } finally {
      setSearching(false);
    }
  }, [departmentCode]);

  const selectRespondent = (respondent) => {
    setFormData(prev => ({
      ...prev,
      respondent_id: respondent.id,
      respondent_name: respondent.name,
      respondent_email: respondent.email,
      respondent_details: respondent.details || {}
    }));
    setSearchTerm(respondent.name);
    setShowSearchResults(false);
  };

  const resetForm = () => {
    setFormData({
      case_number: generateCaseNumber(),
      title: '',
      description: '',
      case_type: 'conduct',
      respondent_type: 'student',
      respondent_id: null,
      respondent_name: '',
      respondent_email: '',
      respondent_details: {},
      reported_by: hodName || hodEmail || 'HOD',
      status: 'pending',
    });
    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);
    setEditItem(null);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If respondent_type changes, clear search
    if (name === 'respondent_type') {
      setSearchTerm('');
      setSearchResults([]);
      setShowSearchResults(false);
      setFormData(prev => ({
        ...prev,
        respondent_id: null,
        respondent_name: '',
        respondent_email: '',
        respondent_details: {}
      }));
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.length >= 2) {
      searchRespondents(value, formData.respondent_type);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({
      case_number: item.case_number || '',
      title: item.title || '',
      description: item.description || '',
      case_type: item.case_type || 'conduct',
      respondent_type: item.respondent_type || 'student',
      respondent_id: item.respondent_id || null,
      respondent_name: item.respondent_name || '',
      respondent_email: item.respondent_email || '',
      respondent_details: item.respondent_details || {},
      reported_by: item.reported_by || hodName || hodEmail || 'HOD',
      status: item.status || 'pending',
    });
    setSearchTerm(item.respondent_name || '');
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

    if (!formData.description.trim()) {
      setError('Please provide a description');
      return;
    }

    if (!formData.respondent_name.trim()) {
      setError('Please select or enter a respondent name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      
      const caseData = {
        department_code: departmentCode,
        case_number: formData.case_number || generateCaseNumber(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        case_type: formData.case_type,
        respondent_type: formData.respondent_type,
        respondent_id: formData.respondent_id || null,
        respondent_name: formData.respondent_name.trim(),
        respondent_email: formData.respondent_email?.trim() || null,
        respondent_details: formData.respondent_details || {},
        reported_by: formData.reported_by || hodName || hodEmail || 'HOD',
        reported_by_id: profile?.id || null,
        status: 'pending',
        reported_at: now,
        created_at: now,
        updated_at: now,
      };

      if (editItem) {
        const { error } = await supabase
          .from('disciplinary_cases')
          .update(caseData)
          .eq('id', editItem.id);
        
        if (error) throw error;
        showToast?.('Case updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('disciplinary_cases')
          .insert([caseData]);
        
        if (error) throw error;
        showToast?.('Case reported successfully!', 'success');
      }

      resetForm();
      setShowModal(false);
      await fetchCases();
    } catch (err) {
      console.error('Error submitting case:', err);
      setError('Failed to submit: ' + err.message);
      showToast?.('Error submitting: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
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

  const filteredCases = cases.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const activeCount = cases.filter(c => 
    c.status === 'pending' || c.status === 'investigating' || 
    c.status === 'hearing_scheduled' || c.status === 'pending_decision'
  ).length;

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
      background: '#c62828',
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
      background: '#c62828',
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
      maxWidth: '750px',
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
    searchContainer: {
      position: 'relative'
    },
    searchResults: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '6px',
      maxHeight: '200px',
      overflowY: 'auto',
      zIndex: 100,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    searchResultItem: {
      padding: '8px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #f5f5f5',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
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
    }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '⚖️ Disciplinary Cases'),
      React.createElement('span', { style: styles.badge }, activeCount, ' Active')
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
        React.createElement('option', { value: 'all' }, 'All (', cases.length, ')'),
        React.createElement('option', { value: 'pending' }, '⏳ Pending'),
        React.createElement('option', { value: 'investigating' }, '🔍 Investigating'),
        React.createElement('option', { value: 'hearing_scheduled' }, '⚖️ Hearing Scheduled'),
        React.createElement('option', { value: 'pending_decision' }, '📋 Pending Decision'),
        React.createElement('option', { value: 'resolved' }, '✅ Resolved'),
        React.createElement('option', { value: 'dismissed' }, '❌ Dismissed')
      ),
      React.createElement(
        'button',
        { 
          style: styles.primaryBtn, 
          onClick: () => { 
            resetForm(); 
            setFormData(prev => ({ ...prev, case_number: generateCaseNumber() }));
            setShowModal(true); 
          } 
        },
        '➕ New Case'
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchCases },
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
        'Loading cases...'
      ) : filteredCases.length === 0 ? React.createElement(
        'div',
        { style: styles.empty },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '⚖️'),
        React.createElement('h3', null, 'No Disciplinary Cases'),
        React.createElement('p', { style: { color: '#666' } }, 'Report a new disciplinary case for your department.')
      ) : filteredCases.map((item) => {
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
              React.createElement('p', { style: styles.cardSub },
                getTypeLabel(item.case_type), ' • ',
                item.case_number
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
          React.createElement('p', { style: { fontSize: '14px', color: '#444', margin: '8px 0' } }, item.description),
          React.createElement(
            'div',
            { style: { fontSize: '13px', color: '#666', marginBottom: '8px' } },
            '👤 ',
            item.respondent_name || 'Unknown',
            item.respondent_type && React.createElement(
              'span',
              { style: { marginLeft: '8px', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' } },
              item.respondent_type
            )
          ),
          React.createElement(
            'div',
            { style: styles.footer },
            React.createElement('small', { style: { color: '#999' } },
              'Reported: ', new Date(item.reported_at).toLocaleDateString()
            ),
            React.createElement(
              'div',
              { style: styles.actionButtons },
              React.createElement(
                'button',
                { style: styles.viewBtn, onClick: () => handleView(item) },
                '\uD83D\uDCCB View'
              ),
              (item.status === 'pending' || item.status === 'investigating') && React.createElement(
                'button',
                { style: styles.editBtn, onClick: () => handleEdit(item) },
                '✏️ Edit'
              )
            )
          )
        );
      })
    ),
    // New/Edit Modal with Search
    showModal && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowModal(false) },
      React.createElement(
        'div',
        { style: styles.modal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } },
            editItem ? '✏️ Edit Case' : '📋 Report New Case'
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
            React.createElement('label', { style: styles.label }, 'Case Number'),
            React.createElement('input', {
              type: 'text',
              name: 'case_number',
              value: formData.case_number || generateCaseNumber(),
              onChange: handleInputChange,
              style: { ...styles.input, background: '#f5f5f5' },
              disabled: true
            })
          ),
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
              placeholder: 'e.g., Academic Misconduct - Student Name'
            })
          ),
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Case Type *'),
              React.createElement('select', {
                name: 'case_type',
                value: formData.case_type,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 'academic' }, '📚 Academic'),
                React.createElement('option', { value: 'conduct' }, '👤 Conduct'),
                React.createElement('option', { value: 'plagiarism' }, '📝 Plagiarism'),
                React.createElement('option', { value: 'cheating' }, '📖 Cheating'),
                React.createElement('option', { value: 'misconduct' }, '⚠️ Misconduct'),
                React.createElement('option', { value: 'other' }, '📋 Other')
              )
            ),
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Respondent Type *'),
              React.createElement('select', {
                name: 'respondent_type',
                value: formData.respondent_type,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 'student' }, '👨‍🎓 Student'),
                React.createElement('option', { value: 'lecturer' }, '👨‍🏫 Lecturer'),
                React.createElement('option', { value: 'staff' }, '👤 Staff')
              )
            )
          ),
          // Respondent Search with Lookup
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Search Respondent *'),
            React.createElement(
              'div',
              { style: styles.searchContainer },
              React.createElement('input', {
                type: 'text',
                value: searchTerm,
                onChange: handleSearchChange,
                style: styles.input,
                placeholder: 'Type name, email or ID to search...'
              }),
              searching && React.createElement(
                'span',
                { style: { position: 'absolute', right: '10px', top: '10px', color: '#666' } },
                'Searching...'
              ),
              showSearchResults && searchResults.length > 0 && React.createElement(
                'div',
                { style: styles.searchResults },
                searchResults.map((result, index) => React.createElement(
                  'div',
                  {
                    key: index,
                    style: styles.searchResultItem,
                    onClick: () => selectRespondent(result),
                    onMouseEnter: (e) => e.currentTarget.style.background = '#f5f5f5',
                    onMouseLeave: (e) => e.currentTarget.style.background = 'white'
                  },
                  React.createElement(
                    'div',
                    null,
                    React.createElement('strong', null, result.name),
                    React.createElement('br', null),
                    React.createElement('small', { style: { color: '#999' } }, result.email),
                    result.identifier && React.createElement(
                      'small',
                      { style: { color: '#666', marginLeft: '8px' } },
                      ' (', result.identifier, ')'
                    )
                  ),
                  result.details?.program && React.createElement(
                    'small',
                    { style: { color: '#666' } },
                    result.details.program
                  )
                ))
              ),
              showSearchResults && searchResults.length === 0 && !searching && searchTerm.length >= 2 && React.createElement(
                'div',
                { style: { ...styles.searchResults, padding: '12px', color: '#999', textAlign: 'center' } },
                'No respondents found. Please enter manually.'
              )
            ),
            React.createElement('small', { style: { color: '#999' } },
              'Search for existing ',
              formData.respondent_type, 's. If not found, enter manually below.'
            )
          ),
          // Manual entry fields (auto-filled when respondent selected)
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Respondent Name *'),
              React.createElement('input', {
                type: 'text',
                name: 'respondent_name',
                value: formData.respondent_name,
                onChange: handleInputChange,
                style: styles.input,
                placeholder: 'Full name'
              })
            ),
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Respondent Email'),
              React.createElement('input', {
                type: 'email',
                name: 'respondent_email',
                value: formData.respondent_email,
                onChange: handleInputChange,
                style: styles.input,
                placeholder: 'email@example.com'
              })
            )
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Description *'),
            React.createElement('textarea', {
              name: 'description',
              value: formData.description,
              onChange: handleInputChange,
              style: styles.textarea,
              placeholder: 'Detailed description of the incident...',
              rows: 4
            })
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
              style: { padding: '10px 24px', background: submitting ? '#999' : '#c62828', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }
            }, submitting ? 'Submitting...' : (editItem ? 'Update' : 'Report Case'))
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
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '\uD83D\uDCCB Case Details'),
          React.createElement('button', {
            onClick: () => setShowViewModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        React.createElement(
          'div',
          { style: { background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' } },
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Case Number'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.case_number)
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
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Title'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.title)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Type'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, getTypeLabel(viewItem.case_type))
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Respondent'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } },
                viewItem.respondent_name || 'Unknown',
                ' (', viewItem.respondent_type, ')'
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Respondent Email'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.respondent_email || 'N/A')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Reported By'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.reported_by || 'Unknown')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Reported On'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, new Date(viewItem.reported_at).toLocaleString())
            ),
            viewItem.resolved_at && React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#2e7d32', textTransform: 'uppercase' } }, 'Resolved On'),
              React.createElement('p', { style: { margin: '4px 0', color: '#2e7d32', fontWeight: '500' } }, new Date(viewItem.resolved_at).toLocaleString())
            ),
            viewItem.resolved_by && React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#2e7d32', textTransform: 'uppercase' } }, 'Resolved By'),
              React.createElement('p', { style: { margin: '4px 0', color: '#2e7d32', fontWeight: '500' } }, viewItem.resolved_by)
            )
          )
        ),
        // Respondent Details (if available)
        viewItem.respondent_details && Object.keys(viewItem.respondent_details).length > 0 && React.createElement(
          'div',
          { style: { background: '#e3f2fd', padding: '12px', borderRadius: '8px', marginBottom: '12px' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0' } }, '📋 Respondent Details'),
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' } },
            viewItem.respondent_details.student_id && React.createElement(
              'div',
              null,
              React.createElement('small', { style: { color: '#666' } }, 'Student ID:'),
              React.createElement('p', { style: { margin: '2px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.respondent_details.student_id)
            ),
            viewItem.respondent_details.program && React.createElement(
              'div',
              null,
              React.createElement('small', { style: { color: '#666' } }, 'Program:'),
              React.createElement('p', { style: { margin: '2px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.respondent_details.program)
            ),
            viewItem.respondent_details.lecturer_id && React.createElement(
              'div',
              null,
              React.createElement('small', { style: { color: '#666' } }, 'Lecturer ID:'),
              React.createElement('p', { style: { margin: '2px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.respondent_details.lecturer_id)
            ),
            viewItem.respondent_details.specialization && React.createElement(
              'div',
              null,
              React.createElement('small', { style: { color: '#666' } }, 'Specialization:'),
              React.createElement('p', { style: { margin: '2px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.respondent_details.specialization)
            )
          )
        ),
        React.createElement(
          'div',
          null,
          React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Description'),
          React.createElement('p', { style: { margin: '4px 0 16px 0', color: '#333' } }, viewItem.description)
        ),
        viewItem.hearing_date && React.createElement(
          'div',
          { style: { background: '#f3e5f5', padding: '12px', borderRadius: '8px', marginBottom: '12px' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#7b1fa2' } }, '⚖️ Hearing Date:'),
          React.createElement('p', { style: { margin: '4px 0 0 0', color: '#4a148c' } }, new Date(viewItem.hearing_date).toLocaleString())
        ),
        viewItem.hearing_notes && React.createElement(
          'div',
          { style: { marginBottom: '12px' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase', display: 'block' } }, 'Hearing Notes'),
          React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, viewItem.hearing_notes)
        ),
        viewItem.decision && React.createElement(
          'div',
          { style: { background: '#e8f5e9', padding: '12px', borderRadius: '8px', marginBottom: '12px' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#2e7d32' } }, 'Decision:'),
          React.createElement('p', { style: { margin: '4px 0 0 0', color: '#1b5e20' } }, viewItem.decision)
        ),
        viewItem.sanctions && React.createElement(
          'div',
          { style: { background: '#fff3e0', padding: '12px', borderRadius: '8px', marginBottom: '12px' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#e65100' } }, 'Sanctions:'),
          React.createElement('p', { style: { margin: '4px 0 0 0', color: '#bf360c' } }, viewItem.sanctions)
        ),
        viewItem.dean_notes && React.createElement(
          'div',
          { style: { background: '#e3f2fd', padding: '12px', borderRadius: '8px', marginBottom: '12px', borderLeft: '3px solid #1976d2' } },
          React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0' } }, '👨‍🏫 Dean\'s Notes:'),
          React.createElement('p', { style: { margin: '4px 0 0 0', color: '#0d47a1' } }, viewItem.dean_notes)
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

export default HODDisciplinaryCases;