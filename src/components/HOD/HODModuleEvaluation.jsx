// HOD/HODModuleEvaluation.jsx - FIXED EDIT MODAL
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import HODEvaluationResponses from './HODEvaluationResponses';

const HODModuleEvaluation = ({ 
  departmentCode, 
  departmentName, 
  hodEmail, 
  hodName,
  profile,
  courses,
  students,
  showToast 
}) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [courseSearch, setCourseSearch] = useState('');
  const [submissionCounts, setSubmissionCounts] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    target_semester: 1,
    target_year_of_study: null,
    target_courses: [],
    target_programs: [],
    questions: [],
    status: 'draft'
  });

  const questionTypes = [
    { value: 'rating', label: '⭐ Rating (1-5)' },
    { value: 'mcq', label: '📋 Multiple Choice' },
    { value: 'text', label: '📝 Short Text' },
    { value: 'textarea', label: '📄 Long Text' },
    { value: 'boolean', label: '✅ Yes/No' },
  ];

  const checkSubmissionCount = useCallback(async (formId) => {
    try {
      const { count, error } = await supabase
        .from('module_evaluation_responses')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', formId)
        .not('submitted_at', 'is', null);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error checking submissions:', err);
      return 0;
    }
  }, []);

  const fetchForms = useCallback(async () => {
    if (!departmentCode) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('module_evaluation_forms')
        .select('*')
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const counts = {};
      for (const form of (data || [])) {
        counts[form.id] = await checkSubmissionCount(form.id);
      }
      setSubmissionCounts(counts);

      setForms(data || []);
    } catch (err) {
      console.error('Error fetching forms:', err);
      showToast?.('Failed to load forms', 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentCode, showToast, checkSubmissionCount]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const canEdit = (form) => {
    if (form.status === 'draft') return true;
    if (form.status === 'published' || form.status === 'closed') {
      const count = submissionCounts[form.id] || 0;
      return count === 0;
    }
    return false;
  };

  const canDelete = (form) => {
    const count = submissionCounts[form.id] || 0;
    return count === 0 && (form.status === 'draft' || form.status === 'archived');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      target_semester: 1,
      target_year_of_study: null,
      target_courses: [],
      target_programs: [],
      questions: [],
      status: 'draft'
    });
    setCourseSearch('');
    setEditItem(null);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: Date.now(),
        type: 'rating',
        question: '',
        required: true,
        options: [],
        placeholder: ''
      }]
    }));
  };

  const removeQuestion = (index) => {
    if (!window.confirm('Remove this question?')) return;
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const addOption = (qIndex) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === qIndex ? { ...q, options: [...q.options, ''] } : q
      )
    }));
  };

  const updateOption = (qIndex, oIndex, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === qIndex ? { 
          ...q, 
          options: q.options.map((opt, j) => j === oIndex ? value : opt) 
        } : q
      )
    }));
  };

  const removeOption = (qIndex, oIndex) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q
      )
    }));
  };

  const toggleCourseSelection = (courseId) => {
    setFormData(prev => ({
      ...prev,
      target_courses: prev.target_courses.includes(courseId)
        ? prev.target_courses.filter(id => id !== courseId)
        : [...prev.target_courses, courseId]
    }));
  };

  const filteredCourses = courses?.filter(c => 
    c.course_code.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.course_name.toLowerCase().includes(courseSearch.toLowerCase())
  ) || [];

  const handleEdit = (item) => {
    const count = submissionCounts[item.id] || 0;
    if (count > 0 && item.status !== 'draft') {
      alert('❌ This form already has submissions and cannot be edited.');
      return;
    }

    console.log('📝 Editing form:', item);
    console.log('📝 Questions:', item.questions);

    setEditItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      academic_year: item.academic_year || '',
      target_semester: item.target_semester || 1,
      target_year_of_study: item.target_year_of_study || null,
      target_courses: item.target_courses || [],
      target_programs: item.target_programs || [],
      questions: item.questions || [],
      status: item.status || 'draft'
    });
    setShowModal(true);
  };

  const handleView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const handleViewResponses = (item) => {
    setViewItem(item);
    setShowResponsesModal(true);
  };

  const handlePublish = async (id) => {
    try {
      const { error } = await supabase
        .from('module_evaluation_forms')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      showToast?.('Form published successfully!', 'success');
      await fetchForms();
    } catch (err) {
      showToast?.('Error publishing: ' + err.message, 'error');
    }
  };

  const handleClose = async (id) => {
    try {
      const { error } = await supabase
        .from('module_evaluation_forms')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      showToast?.('Form closed successfully!', 'success');
      await fetchForms();
    } catch (err) {
      showToast?.('Error closing: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const count = submissionCounts[id] || 0;
    if (count > 0) {
      alert('❌ This form has submissions and cannot be deleted.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this form?')) return;

    try {
      const { error } = await supabase
        .from('module_evaluation_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast?.('Form deleted successfully!', 'success');
      await fetchForms();
    } catch (err) {
      showToast?.('Error deleting: ' + err.message, 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Please provide a title');
      return;
    }

    if (formData.questions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    for (let q of formData.questions) {
      if (!q.question.trim()) {
        setError('Please fill in all question texts');
        return;
      }
      if (q.type === 'mcq' && q.options.some(opt => !opt.trim())) {
        setError('Please fill in all option texts for MCQ questions');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      
      const formDataToSubmit = {
        department_code: departmentCode,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        academic_year: formData.academic_year,
        target_semester: parseInt(formData.target_semester),
        target_year_of_study: formData.target_year_of_study ? parseInt(formData.target_year_of_study) : null,
        target_courses: formData.target_courses || [],
        target_programs: formData.target_programs || [],
        questions: formData.questions,
        status: formData.status,
        created_by: hodName || hodEmail || 'HOD',
        created_by_id: profile?.id || null,
        updated_at: now,
      };

      if (formData.status === 'published') {
        formDataToSubmit.published_at = now;
      }

      if (editItem) {
        const { error } = await supabase
          .from('module_evaluation_forms')
          .update(formDataToSubmit)
          .eq('id', editItem.id);
        
        if (error) throw error;
        showToast?.('Form updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('module_evaluation_forms')
          .insert([formDataToSubmit]);
        
        if (error) throw error;
        showToast?.('Form created successfully!', 'success');
      }

      resetForm();
      setShowModal(false);
      await fetchForms();
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Failed to submit: ' + err.message);
      showToast?.('Error submitting: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'draft': { label: '📝 Draft', color: '#ffa726', bg: '#fff3e0' },
      'published': { label: '📋 Published', color: '#42a5f5', bg: '#e3f2fd' },
      'closed': { label: '🔒 Closed', color: '#ef5350', bg: '#ffebee' },
      'archived': { label: '📦 Archived', color: '#78909c', bg: '#eceff1' },
    };
    return map[status] || { label: status || 'Unknown', color: '#999', bg: '#f5f5f5' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'rating': '⭐ Rating',
      'mcq': '📋 Multiple Choice',
      'text': '📝 Short Text',
      'textarea': '📄 Long Text',
      'boolean': '✅ Yes/No',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredForms = forms.filter((f) => {
    if (filter === 'all') return true;
    return f.status === filter;
  });

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
    responsesBtn: {
      background: '#e3f2fd',
      color: '#1565c0',
      border: '1px solid #90caf9',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      marginRight: '4px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
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
    questionsList: { margin: '8px 0', paddingLeft: '16px' },
    questionItem: { fontSize: '13px', color: '#444', margin: '4px 0' },
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
    editDisabledBtn: {
      background: '#e0e0e0',
      color: '#999',
      border: '1px solid #ccc',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'not-allowed',
      fontSize: '12px'
    },
    publishBtn: {
      background: '#2e7d32',
      color: 'white',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    closeBtn: {
      background: '#c62828',
      color: 'white',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    deleteBtn: {
      background: '#ef5350',
      color: 'white',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    deleteDisabledBtn: {
      background: '#e0e0e0',
      color: '#999',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'not-allowed',
      fontSize: '12px'
    },
    actionButtons: {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
      alignItems: 'center'
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
      maxWidth: '800px',
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
      resize: 'vertical',
      minHeight: '60px'
    },
    questionBox: {
      background: '#f8f9fa',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '12px',
      border: '1px solid #e8eaf6'
    },
    optionRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginBottom: '4px'
    },
    optionInput: {
      flex: 1,
      padding: '6px 10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '13px'
    },
    removeOptionBtn: {
      background: '#ffebee',
      color: '#c62828',
      border: 'none',
      padding: '2px 8px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    sectionTitle: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#1a237e',
      marginBottom: '8px',
      marginTop: '16px'
    },
    courseGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '4px',
      maxHeight: '200px',
      overflowY: 'auto',
      padding: '8px',
      background: '#fafafa',
      borderRadius: '6px',
      border: '1px solid #e8eaf6'
    },
    courseItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
      transition: 'background 0.2s'
    },
    courseCode: {
      fontWeight: '600',
      color: '#1a237e'
    },
    courseName: {
      color: '#666',
      marginLeft: '4px',
      fontSize: '12px'
    }
  };

  // ========== RENDER ==========
  return React.createElement(
    'div',
    { style: styles.container },
    // HEADER
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '📋 Module Evaluation Forms'),
      React.createElement('span', { style: styles.badge }, forms.filter(f => f.status === 'published').length, ' Active')
    ),
    // FILTERS
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
        React.createElement('option', { value: 'all' }, 'All Forms (', forms.length, ')'),
        React.createElement('option', { value: 'draft' }, '📝 Drafts'),
        React.createElement('option', { value: 'published' }, '📋 Published'),
        React.createElement('option', { value: 'closed' }, '🔒 Closed'),
        React.createElement('option', { value: 'archived' }, '📦 Archived')
      ),
      React.createElement(
        'button',
        { style: styles.primaryBtn, onClick: () => { resetForm(); setShowModal(true); } },
        '➕ Create Form'
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchForms },
        '\uD83D\uDD04 Refresh'
      )
    ),
    error && React.createElement(
      'div',
      { style: { background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' } },
      '❌ ',
      error
    ),
    // GRID
    React.createElement(
      'div',
      { style: styles.grid },
      loading ? React.createElement(
        'div',
        { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '40px' } },
        'Loading forms...'
      ) : filteredForms.length === 0 ? React.createElement(
        'div',
        { style: styles.empty },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '📋'),
        React.createElement('h3', null, 'No Evaluation Forms'),
        React.createElement('p', { style: { color: '#666' } }, 'Create a new module evaluation form for students.')
      ) : filteredForms.map((item) => {
        const statusInfo = getStatusBadge(item.status);
        const count = submissionCounts[item.id] || 0;
        const canEditForm = canEdit(item);
        const canDeleteForm = canDelete(item);
        const hasSubmissions = count > 0;

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
                item.academic_year, ' - Sem ', item.target_semester,
                item.target_year_of_study && React.createElement(
                  'span',
                  null,
                  ' • Year ',
                  item.target_year_of_study
                )
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
            { style: styles.questionsList },
            (item.questions || []).slice(0, 3).map((q, idx) => (
              React.createElement('p', { key: idx, style: styles.questionItem },
                '• ',
                q.question,
                ' (',
                getTypeLabel(q.type),
                ')'
              )
            )),
            (item.questions || []).length > 3 && React.createElement(
              'p',
              { style: { fontSize: '12px', color: '#999' } },
              '+', (item.questions || []).length - 3, ' more questions'
            )
          ),
          React.createElement(
            'div',
            { style: { fontSize: '12px', color: count > 0 ? '#c62828' : '#2e7d32', marginTop: '4px' } },
            count > 0 
              ? React.createElement('span', null, '📊 ', count, ' submission(s) received') 
              : React.createElement('span', null, '✅ No submissions yet')
          ),
          React.createElement(
            'div',
            { style: styles.footer },
            React.createElement('small', { style: { color: '#999' } },
              'Created: ', new Date(item.created_at).toLocaleDateString()
            ),
            React.createElement(
              'div',
              { style: styles.actionButtons },
              React.createElement(
                'button',
                { style: styles.viewBtn, onClick: () => handleView(item) },
                '\uD83D\uDCCB View'
              ),
              (item.status === 'published' || item.status === 'closed') && React.createElement(
                'button',
                { style: styles.responsesBtn, onClick: () => handleViewResponses(item) },
                '📊 Responses'
              ),
              item.status === 'draft' ? (
                React.createElement(
                  'button',
                  { style: styles.editBtn, onClick: () => handleEdit(item) },
                  '✏️ Edit'
                )
              ) : canEditForm ? (
                React.createElement(
                  'button',
                  { style: styles.editBtn, onClick: () => handleEdit(item) },
                  '✏️ Edit'
                )
              ) : (
                React.createElement(
                  'button',
                  { 
                    style: styles.editDisabledBtn,
                    title: hasSubmissions ? 'Cannot edit: Form has submissions' : 'Form is locked'
                  },
                  '🔒 Edit'
                )
              ),
              item.status === 'draft' && React.createElement(
                'button',
                { style: styles.publishBtn, onClick: () => handlePublish(item.id) },
                '📋 Publish'
              ),
              item.status === 'published' && React.createElement(
                'button',
                { style: styles.closeBtn, onClick: () => handleClose(item.id) },
                '🔒 Close'
              ),
              canDeleteForm ? React.createElement(
                'button',
                { style: styles.deleteBtn, onClick: () => handleDelete(item.id) },
                '🗑️'
              ) : React.createElement(
                'button',
                { 
                  style: styles.deleteDisabledBtn,
                  title: hasSubmissions ? 'Cannot delete: Form has submissions' : 'Cannot delete'
                },
                '🗑️'
              )
            )
          ),
         
        );
      })
    ),
    // ========== FULL EDIT/CREATE MODAL ==========
    showModal && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowModal(false) },
      React.createElement(
        'div',
        { style: styles.modal, onClick: (e) => e.stopPropagation() },
        // Modal Header
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } },
            editItem ? '✏️ Edit Evaluation Form' : '📋 Create Evaluation Form'
          ),
          React.createElement('button', {
            onClick: () => setShowModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        // Form
        React.createElement(
          'form',
          { onSubmit: handleSubmit },
          // Basic Info - Row 1
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
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
                placeholder: 'e.g., Semester 1 Module Evaluation'
              })
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
            )
          ),
          // Basic Info - Row 2
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Semester *'),
              React.createElement('select', {
                name: 'target_semester',
                value: formData.target_semester,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 1 }, 'Semester 1'),
                React.createElement('option', { value: 2 }, 'Semester 2')
              )
            ),
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Target Year of Study'),
              React.createElement('select', {
                name: 'target_year_of_study',
                value: formData.target_year_of_study || '',
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: '' }, 'All Years'),
                React.createElement('option', { value: 1 }, 'Year 1'),
                React.createElement('option', { value: 2 }, 'Year 2'),
                React.createElement('option', { value: 3 }, 'Year 3'),
                React.createElement('option', { value: 4 }, 'Year 4')
              )
            )
          ),
          // Description
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Description'),
            React.createElement('textarea', {
              name: 'description',
              value: formData.description,
              onChange: handleInputChange,
              style: styles.textarea,
              placeholder: 'Describe the purpose of this evaluation...',
              rows: 2
            })
          ),
          // Status
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Status *'),
            React.createElement('select', {
              name: 'status',
              value: formData.status,
              onChange: handleInputChange,
              style: styles.input
            },
              React.createElement('option', { value: 'draft' }, '📝 Draft'),
              React.createElement('option', { value: 'published' }, '📋 Publish Immediately')
            )
          ),
          // Target Courses
          courses && courses.length > 0 && React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Target Courses (Optional)'),
            React.createElement('input', {
              type: 'text',
              placeholder: 'Search courses by code or name...',
              value: courseSearch,
              onChange: (e) => setCourseSearch(e.target.value),
              style: {
                ...styles.input,
                marginBottom: '8px',
                fontSize: '13px',
                padding: '6px 12px'
              }
            }),
            React.createElement(
              'div',
              { style: styles.courseGrid },
              filteredCourses.length === 0 ? (
                React.createElement(
                  'div',
                  { style: { gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '12px' } },
                  courseSearch ? 'No courses found matching "' + courseSearch + '"' : 'No courses available'
                )
              ) : (
                filteredCourses.map((course) => (
                  React.createElement(
                    'label',
                    { 
                      key: course.id, 
                      style: {
                        ...styles.courseItem,
                        background: formData.target_courses.includes(course.id) ? '#e3f2fd' : 'transparent'
                      }
                    },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: formData.target_courses.includes(course.id),
                      onChange: () => toggleCourseSelection(course.id)
                    }),
                    React.createElement(
                      'span',
                      null,
                      React.createElement('span', { style: styles.courseCode }, course.course_code),
                      React.createElement('span', { style: styles.courseName }, course.course_name)
                    )
                  )
                ))
              )
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', marginTop: '4px' } },
              React.createElement('small', { style: { color: '#999' } },
                formData.target_courses.length > 0 
                  ? 'Selected ' + formData.target_courses.length + ' course(s)' 
                  : 'Leave unchecked to target all courses'
              ),
              filteredCourses.length > 0 && filteredCourses.length !== courses?.length && React.createElement(
                'small',
                { style: { color: '#666' } },
                'Showing ' + filteredCourses.length + ' of ' + courses?.length + ' courses'
              )
            )
          ),
          // Questions Section
          React.createElement('hr', { style: { margin: '20px 0', border: '1px solid #e8eaf6' } }),
          React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement('h4', { style: styles.sectionTitle }, '📝 Questions'),
              React.createElement('button', {
                type: 'button',
                onClick: addQuestion,
                style: { ...styles.primaryBtn, background: '#1976d2', padding: '6px 16px', fontSize: '13px' }
              }, '➕ Add Question')
            ),
            formData.questions.length === 0 && React.createElement(
              'p',
              { style: { color: '#999', textAlign: 'center', padding: '20px' } },
              'No questions added yet. Click "Add Question" to start.'
            ),
            formData.questions.map((q, index) => {
              // Ensure each question has an id
              if (!q.id) {
                q.id = Date.now() + index;
              }
              return React.createElement(
                'div',
                { key: q.id, style: styles.questionBox },
                React.createElement(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
                  React.createElement('strong', null, 'Question ', index + 1),
                  React.createElement('button', {
                    type: 'button',
                    onClick: () => removeQuestion(index),
                    style: { background: '#ffebee', color: '#c62828', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }
                  }, '✕')
                ),
                React.createElement(
                  'div',
                  { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' } },
                  React.createElement(
                    'div',
                    { style: styles.formGroup },
                    React.createElement('label', { style: { fontSize: '12px', color: '#666' } }, 'Question Text *'),
                    React.createElement('input', {
                      type: 'text',
                      value: q.question || '',
                      onChange: (e) => updateQuestion(index, 'question', e.target.value),
                      style: styles.input,
                      placeholder: 'Enter your question...'
                    })
                  ),
                  React.createElement(
                    'div',
                    { style: styles.formGroup },
                    React.createElement('label', { style: { fontSize: '12px', color: '#666' } }, 'Question Type *'),
                    React.createElement('select', {
                      value: q.type || 'rating',
                      onChange: (e) => updateQuestion(index, 'type', e.target.value),
                      style: styles.input
                    },
                      questionTypes.map((type) => (
                        React.createElement('option', { key: type.value, value: type.value }, type.label)
                      ))
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { style: { display: 'flex', gap: '12px', marginTop: '8px' } },
                  React.createElement(
                    'label',
                    { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' } },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: q.required !== false,
                      onChange: (e) => updateQuestion(index, 'required', e.target.checked)
                    }),
                    'Required'
                  )
                ),
                // MCQ Options
                q.type === 'mcq' && React.createElement(
                  'div',
                  { style: { marginTop: '8px' } },
                  React.createElement('label', { style: { fontSize: '12px', color: '#666' } }, 'Options *'),
                  (q.options || []).map((opt, oIndex) => React.createElement(
                    'div',
                    { key: oIndex, style: styles.optionRow },
                    React.createElement('input', {
                      type: 'text',
                      value: opt || '',
                      onChange: (e) => updateOption(index, oIndex, e.target.value),
                      style: styles.optionInput,
                      placeholder: 'Option ' + (oIndex + 1)
                    }),
                    React.createElement('button', {
                      type: 'button',
                      onClick: () => removeOption(index, oIndex),
                      style: styles.removeOptionBtn
                    }, '✕')
                  )),
                  React.createElement('button', {
                    type: 'button',
                    onClick: () => addOption(index),
                    style: { background: 'transparent', color: '#1976d2', border: '1px dashed #1976d2', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginTop: '4px' }
                  }, '+ Add Option')
                ),
                // Placeholder for text/textarea
                (q.type === 'text' || q.type === 'textarea') && React.createElement(
                  'div',
                  { style: { ...styles.formGroup, marginTop: '8px' } },
                  React.createElement('label', { style: { fontSize: '12px', color: '#666' } }, 'Placeholder'),
                  React.createElement('input', {
                    type: 'text',
                    value: q.placeholder || '',
                    onChange: (e) => updateQuestion(index, 'placeholder', e.target.value),
                    style: styles.input,
                    placeholder: 'e.g., Enter your answer here...'
                  })
                )
              );
            })
          ),
          // Footer
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
            }, submitting ? 'Saving...' : (editItem ? 'Update Form' : 'Create Form'))
          )
        )
      )
    ),
    // View Modal
    showViewModal && viewItem && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowViewModal(false) },
      React.createElement(
        'div',
        { style: styles.viewModal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '\uD83D\uDCCB Form Details'),
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
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Title'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.title)
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
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Academic Year'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.academic_year)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Semester'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, 'Semester ', viewItem.target_semester)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Target Year'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.target_year_of_study ? 'Year ' + viewItem.target_year_of_study : 'All Years')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Questions'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, (viewItem.questions || []).length, ' questions')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Created By'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.created_by || 'HOD')
            )
          ),
          viewItem.description && React.createElement(
            'div',
            { style: { marginTop: '8px' } },
            React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Description'),
            React.createElement('p', { style: { margin: '4px 0', color: '#333' } }, viewItem.description)
          )
        ),
        // Questions
        React.createElement(
          'div',
          null,
          React.createElement('strong', { style: { fontSize: '13px', color: '#1a237e', display: 'block', marginBottom: '8px' } }, '📝 Questions'),
          (viewItem.questions || []).map((q, idx) => React.createElement(
            'div',
            { key: idx, style: { background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e8eaf6' } },
            React.createElement(
              'div',
              null,
              React.createElement('strong', null, idx + 1, '. ', q.question),
              React.createElement('span', { style: { marginLeft: '8px', fontSize: '12px', color: '#666' } },
                '(', getTypeLabel(q.type), ')',
                q.required && React.createElement('span', { style: { color: '#c62828', marginLeft: '4px' } }, '*')
              )
            ),
            q.type === 'mcq' && React.createElement(
              'ul',
              { style: { margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#555' } },
              q.options.map((opt, oIdx) => React.createElement('li', { key: oIdx }, opt))
            )
          ))
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
    ),
    // Responses Modal
    showResponsesModal && viewItem && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowResponsesModal(false) },
      React.createElement(
        'div',
        { style: { ...styles.viewModal, maxWidth: '900px' }, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '📊 Responses: ', viewItem.title),
          React.createElement('button', {
            onClick: () => setShowResponsesModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        React.createElement(HODEvaluationResponses, {
          formId: viewItem.id,
          formTitle: viewItem.title,
          showToast: showToast
        })
      )
    )
  );
};

export default HODModuleEvaluation;