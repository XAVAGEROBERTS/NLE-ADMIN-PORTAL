// dean/DeanFacultyBoardReports.jsx - COMPLETE
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanFacultyBoardReports = ({ profile, fetchDeanData, setStats }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [error, setError] = useState(null);

  // Complete form data with all sections
  const [formData, setFormData] = useState({
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    semester: 1,
    report_type: 'quarterly',
    title: '',
    content: '',
    status: 'draft',
    prepared_by: profile?.full_name || 'Dean',
    sections: {
      // 1. Executive Summary
      executive_summary: '',
      key_highlights: '',
      overall_performance: '',
      
      // 2. Academic Affairs
      academic_affairs: '',
      student_enrollment: '',
      program_performance: '',
      curriculum_updates: '',
      academic_achievements: '',
      student_success: '',
      
      // 3. Staff & Faculty
      staff_faculty: '',
      faculty_appointments: '',
      staff_development: '',
      performance_reviews: '',
      faculty_achievements: '',
      
      // 4. Research & Innovation
      research_innovation: '',
      research_output: '',
      grants_secured: '',
      publications: '',
      conferences_attended: '',
      collaborations: '',
      
      // 5. Financial Summary
      financial_summary: '',
      budget_utilization: '',
      resource_allocation: '',
      financial_projections: '',
      
      // 6. Strategic Initiatives
      strategic_initiatives: '',
      ongoing_projects: '',
      future_plans: '',
      challenges: '',
      solutions: '',
      
      // 7. Recommendations
      recommendations: '',
      action_items: '',
      decisions_needed: ''
    }
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('faculty_board_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
      
      if (setStats) {
        const drafts = (data || []).filter(r => r.status === 'draft').length;
        const published = (data || []).filter(r => r.status === 'published').length;
        setStats(prev => ({ 
          ...prev, 
          draftReports: drafts,
          publishedReports: published 
        }));
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [setStats]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const resetForm = () => {
    setFormData({
      academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      semester: 1,
      report_type: 'quarterly',
      title: '',
      content: '',
      status: 'draft',
      prepared_by: profile?.full_name || 'Dean',
      sections: {
        executive_summary: '',
        key_highlights: '',
        overall_performance: '',
        academic_affairs: '',
        student_enrollment: '',
        program_performance: '',
        curriculum_updates: '',
        academic_achievements: '',
        student_success: '',
        staff_faculty: '',
        faculty_appointments: '',
        staff_development: '',
        performance_reviews: '',
        faculty_achievements: '',
        research_innovation: '',
        research_output: '',
        grants_secured: '',
        publications: '',
        conferences_attended: '',
        collaborations: '',
        financial_summary: '',
        budget_utilization: '',
        resource_allocation: '',
        financial_projections: '',
        strategic_initiatives: '',
        ongoing_projects: '',
        future_plans: '',
        challenges: '',
        solutions: '',
        recommendations: '',
        action_items: '',
        decisions_needed: ''
      }
    });
    setEditItem(null);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSectionChange = (section, value) => {
    setFormData(prev => ({
      ...prev,
      sections: { ...prev.sections, [section]: value }
    }));
  };

  const handleEdit = (item) => {
    setEditItem(item);
    const sections = item.sections || {};
    setFormData({
      academic_year: item.academic_year || '',
      semester: item.semester || 1,
      report_type: item.report_type || 'quarterly',
      title: item.title || '',
      content: item.content || '',
      status: item.status || 'draft',
      prepared_by: item.prepared_by || profile?.full_name || 'Dean',
      sections: {
        executive_summary: sections.executive_summary || '',
        key_highlights: sections.key_highlights || '',
        overall_performance: sections.overall_performance || '',
        academic_affairs: sections.academic_affairs || '',
        student_enrollment: sections.student_enrollment || '',
        program_performance: sections.program_performance || '',
        curriculum_updates: sections.curriculum_updates || '',
        academic_achievements: sections.academic_achievements || '',
        student_success: sections.student_success || '',
        staff_faculty: sections.staff_faculty || '',
        faculty_appointments: sections.faculty_appointments || '',
        staff_development: sections.staff_development || '',
        performance_reviews: sections.performance_reviews || '',
        faculty_achievements: sections.faculty_achievements || '',
        research_innovation: sections.research_innovation || '',
        research_output: sections.research_output || '',
        grants_secured: sections.grants_secured || '',
        publications: sections.publications || '',
        conferences_attended: sections.conferences_attended || '',
        collaborations: sections.collaborations || '',
        financial_summary: sections.financial_summary || '',
        budget_utilization: sections.budget_utilization || '',
        resource_allocation: sections.resource_allocation || '',
        financial_projections: sections.financial_projections || '',
        strategic_initiatives: sections.strategic_initiatives || '',
        ongoing_projects: sections.ongoing_projects || '',
        future_plans: sections.future_plans || '',
        challenges: sections.challenges || '',
        solutions: sections.solutions || '',
        recommendations: sections.recommendations || '',
        action_items: sections.action_items || '',
        decisions_needed: sections.decisions_needed || ''
      }
    });
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

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      
      const reportData = {
        academic_year: formData.academic_year,
        semester: parseInt(formData.semester),
        report_type: formData.report_type,
        title: formData.title.trim(),
        content: formData.content?.trim() || '',
        sections: formData.sections,
        status: formData.status,
        prepared_by: formData.prepared_by || profile?.full_name || 'Dean',
        prepared_by_id: profile?.id || null,
        updated_at: now,
      };

      if (formData.status === 'published') {
        reportData.published_at = now;
      }

      if (editItem) {
        const { error } = await supabase
          .from('faculty_board_reports')
          .update(reportData)
          .eq('id', editItem.id);
        
        if (error) throw error;
        alert('✅ Report updated successfully!');
      } else {
        const { error } = await supabase
          .from('faculty_board_reports')
          .insert([{
            ...reportData,
            created_at: now,
          }]);
        
        if (error) throw error;
        alert('✅ Report created successfully!');
      }

      resetForm();
      setShowModal(false);
      await fetchReports();
    } catch (err) {
      console.error('Error submitting report:', err);
      setError('Failed to submit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      const { error } = await supabase
        .from('faculty_board_reports')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      alert('✅ Report published successfully!');
      await fetchReports();
    } catch (err) {
      alert('Error publishing: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;

    try {
      const { error } = await supabase
        .from('faculty_board_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('✅ Report deleted successfully!');
      await fetchReports();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { label: '📝 Draft', color: '#ffa726', bg: '#fff3e0' },
      'review': { label: '🔍 In Review', color: '#42a5f5', bg: '#e3f2fd' },
      'approved': { label: '✅ Approved', color: '#2e7d32', bg: '#e8f5e9' },
      'published': { label: '📨 Published', color: '#1565c0', bg: '#e3f2fd' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999', bg: '#f5f5f5' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'monthly': '📊 Monthly',
      'quarterly': '📈 Quarterly',
      'annual': '📅 Annual',
      'special': '⭐ Special',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchFilter = filter === 'all' || r.status === filter;
      const matchSearch =
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.academic_year?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.report_type?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [reports, filter, searchTerm]);

  const draftCount = useMemo(() => {
    return reports.filter(r => r.status === 'draft').length;
  }, [reports]);

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
    publishBtn: {
      background: '#2e7d32',
      color: 'white',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    deleteBtn: {
      background: '#c62828',
      color: 'white',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
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
      maxWidth: '800px',
      maxHeight: '90vh',
      overflow: 'auto',
      padding: '24px'
    },
    viewModal: {
      background: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '850px',
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
    sectionTitle: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#1a237e',
      marginBottom: '8px',
      marginTop: '16px'
    },
    sectionSubtitle: {
      fontSize: '13px',
      fontWeight: '500',
      color: '#1565c0',
      marginBottom: '4px',
      marginTop: '8px'
    },
    detailSection: {
      marginBottom: '16px',
      padding: '12px',
      background: '#f8f9fa',
      borderRadius: '6px'
    },
    detailLabel: {
      fontSize: '11px',
      color: '#666',
      textTransform: 'uppercase',
      fontWeight: '600',
      display: 'block',
      marginBottom: '4px'
    },
    detailValue: {
      fontSize: '14px',
      color: '#333',
      margin: 0,
      whiteSpace: 'pre-wrap',
      lineHeight: '1.6'
    }
  };

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h2', { style: styles.title }, '📄 Faculty Board Reports'),
      React.createElement('span', { style: styles.badge }, draftCount, ' Drafts')
    ),
    React.createElement(
      'div',
      { style: styles.filters },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search reports...',
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
        React.createElement('option', { value: 'all' }, 'All Reports (', reports.length, ')'),
        React.createElement('option', { value: 'draft' }, '📝 Drafts'),
        React.createElement('option', { value: 'review' }, '🔍 In Review'),
        React.createElement('option', { value: 'approved' }, '✅ Approved'),
        React.createElement('option', { value: 'published' }, '📨 Published')
      ),
      React.createElement(
        'button',
        { style: styles.primaryBtn, onClick: () => { resetForm(); setShowModal(true); } },
        '➕ Create Report'
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchReports },
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
        'Loading reports...'
      ) : filteredReports.length === 0 ? React.createElement(
        'div',
        { style: styles.empty },
        React.createElement('span', { style: { fontSize: '48px', display: 'block', marginBottom: '12px' } }, '📭'),
        React.createElement('h3', null, 'No reports found'),
        React.createElement('p', { style: { color: '#666' } }, 'Create a new report for the Faculty Board.')
      ) : filteredReports.map((item) => {
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
                getTypeLabel(item.report_type), ' • ',
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
          React.createElement('p', { style: { fontSize: '14px', color: '#444', margin: '8px 0' } },
            item.content?.substring(0, 100),
            item.content?.length > 100 ? '...' : ''
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
              (item.status === 'draft' || item.status === 'review') && React.createElement(
                'button',
                { style: styles.editBtn, onClick: () => handleEdit(item) },
                '✏️ Edit'
              ),
              item.status === 'draft' && React.createElement(
                'button',
                { style: styles.publishBtn, onClick: () => handlePublish(item.id) },
                '📨 Publish'
              ),
              (item.status === 'draft' || item.status === 'review') && React.createElement(
                'button',
                { style: styles.deleteBtn, onClick: () => handleDelete(item.id) },
                '🗑️'
              )
            )
          )
        );
      })
    ),
    // Modal for Create/Edit
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
            editItem ? '✏️ Edit Report' : '📝 Create New Report'
          ),
          React.createElement('button', {
            onClick: () => setShowModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        React.createElement(
          'form',
          { onSubmit: handleSubmit },
          // Basic Info
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' } },
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
            ),
            React.createElement(
              'div',
              { style: styles.formGroup },
              React.createElement('label', { style: styles.label }, 'Report Type *'),
              React.createElement('select', {
                name: 'report_type',
                value: formData.report_type,
                onChange: handleInputChange,
                style: styles.input
              },
                React.createElement('option', { value: 'monthly' }, '📊 Monthly'),
                React.createElement('option', { value: 'quarterly' }, '📈 Quarterly'),
                React.createElement('option', { value: 'annual' }, '📅 Annual'),
                React.createElement('option', { value: 'special' }, '⭐ Special')
              )
            )
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
              placeholder: 'e.g., Faculty Board Report - Q1 2024'
            })
          ),
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
              React.createElement('option', { value: 'review' }, '🔍 In Review'),
              React.createElement('option', { value: 'approved' }, '✅ Approved'),
              React.createElement('option', { value: 'published' }, '📨 Published')
            )
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Content'),
            React.createElement('textarea', {
              name: 'content',
              value: formData.content,
              onChange: handleInputChange,
              style: styles.textarea,
              placeholder: 'Main content of the report...',
              rows: 4
            })
          ),
          React.createElement('hr', { style: { margin: '20px 0', border: '1px solid #e8eaf6' } }),
          React.createElement('h4', { style: styles.sectionTitle }, '📋 Report Sections'),

          // 1. Executive Summary
          React.createElement('h5', { style: styles.sectionSubtitle }, '1. Executive Summary'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Key Highlights'),
            React.createElement('textarea', {
              value: formData.sections.key_highlights,
              onChange: (e) => handleSectionChange('key_highlights', e.target.value),
              style: styles.textarea,
              placeholder: 'Key highlights of the period...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Overall Performance'),
            React.createElement('textarea', {
              value: formData.sections.overall_performance,
              onChange: (e) => handleSectionChange('overall_performance', e.target.value),
              style: styles.textarea,
              placeholder: 'Overall performance summary...',
              rows: 2
            })
          ),

          // 2. Academic Affairs
          React.createElement('h5', { style: styles.sectionSubtitle }, '2. Academic Affairs'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Student Enrollment'),
            React.createElement('textarea', {
              value: formData.sections.student_enrollment,
              onChange: (e) => handleSectionChange('student_enrollment', e.target.value),
              style: styles.textarea,
              placeholder: 'Current student enrollment statistics...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Program Performance'),
            React.createElement('textarea', {
              value: formData.sections.program_performance,
              onChange: (e) => handleSectionChange('program_performance', e.target.value),
              style: styles.textarea,
              placeholder: 'Program performance metrics...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Curriculum Updates'),
            React.createElement('textarea', {
              value: formData.sections.curriculum_updates,
              onChange: (e) => handleSectionChange('curriculum_updates', e.target.value),
              style: styles.textarea,
              placeholder: 'Curriculum changes and updates...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Academic Achievements'),
            React.createElement('textarea', {
              value: formData.sections.academic_achievements,
              onChange: (e) => handleSectionChange('academic_achievements', e.target.value),
              style: styles.textarea,
              placeholder: 'Academic achievements and awards...',
              rows: 2
            })
          ),

          // 3. Staff & Faculty
          React.createElement('h5', { style: styles.sectionSubtitle }, '3. Staff & Faculty'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Faculty Appointments'),
            React.createElement('textarea', {
              value: formData.sections.faculty_appointments,
              onChange: (e) => handleSectionChange('faculty_appointments', e.target.value),
              style: styles.textarea,
              placeholder: 'New faculty appointments and changes...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Staff Development'),
            React.createElement('textarea', {
              value: formData.sections.staff_development,
              onChange: (e) => handleSectionChange('staff_development', e.target.value),
              style: styles.textarea,
              placeholder: 'Staff development activities...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Performance Reviews'),
            React.createElement('textarea', {
              value: formData.sections.performance_reviews,
              onChange: (e) => handleSectionChange('performance_reviews', e.target.value),
              style: styles.textarea,
              placeholder: 'Performance review summary...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Faculty Achievements'),
            React.createElement('textarea', {
              value: formData.sections.faculty_achievements,
              onChange: (e) => handleSectionChange('faculty_achievements', e.target.value),
              style: styles.textarea,
              placeholder: 'Faculty achievements and recognition...',
              rows: 2
            })
          ),

          // 4. Research & Innovation
          React.createElement('h5', { style: styles.sectionSubtitle }, '4. Research & Innovation'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Research Output'),
            React.createElement('textarea', {
              value: formData.sections.research_output,
              onChange: (e) => handleSectionChange('research_output', e.target.value),
              style: styles.textarea,
              placeholder: 'Research output summary...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Grants Secured'),
            React.createElement('textarea', {
              value: formData.sections.grants_secured,
              onChange: (e) => handleSectionChange('grants_secured', e.target.value),
              style: styles.textarea,
              placeholder: 'Grants and funding secured...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Publications'),
            React.createElement('textarea', {
              value: formData.sections.publications,
              onChange: (e) => handleSectionChange('publications', e.target.value),
              style: styles.textarea,
              placeholder: 'Publications list...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Conferences & Collaborations'),
            React.createElement('textarea', {
              value: formData.sections.conferences_attended,
              onChange: (e) => handleSectionChange('conferences_attended', e.target.value),
              style: styles.textarea,
              placeholder: 'Conferences attended and collaborations...',
              rows: 2
            })
          ),

          // 5. Financial Summary
          React.createElement('h5', { style: styles.sectionSubtitle }, '5. Financial Summary'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Budget Utilization'),
            React.createElement('textarea', {
              value: formData.sections.budget_utilization,
              onChange: (e) => handleSectionChange('budget_utilization', e.target.value),
              style: styles.textarea,
              placeholder: 'Budget utilization summary...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Resource Allocation'),
            React.createElement('textarea', {
              value: formData.sections.resource_allocation,
              onChange: (e) => handleSectionChange('resource_allocation', e.target.value),
              style: styles.textarea,
              placeholder: 'Resource allocation details...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Financial Projections'),
            React.createElement('textarea', {
              value: formData.sections.financial_projections,
              onChange: (e) => handleSectionChange('financial_projections', e.target.value),
              style: styles.textarea,
              placeholder: 'Financial projections for next period...',
              rows: 2
            })
          ),

          // 6. Strategic Initiatives
          React.createElement('h5', { style: styles.sectionSubtitle }, '6. Strategic Initiatives'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Ongoing Projects'),
            React.createElement('textarea', {
              value: formData.sections.ongoing_projects,
              onChange: (e) => handleSectionChange('ongoing_projects', e.target.value),
              style: styles.textarea,
              placeholder: 'Ongoing strategic projects...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Future Plans'),
            React.createElement('textarea', {
              value: formData.sections.future_plans,
              onChange: (e) => handleSectionChange('future_plans', e.target.value),
              style: styles.textarea,
              placeholder: 'Future plans and initiatives...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Challenges & Solutions'),
            React.createElement('textarea', {
              value: formData.sections.challenges,
              onChange: (e) => handleSectionChange('challenges', e.target.value),
              style: styles.textarea,
              placeholder: 'Challenges faced and solutions implemented...',
              rows: 2
            })
          ),

          // 7. Recommendations
          React.createElement('h5', { style: styles.sectionSubtitle }, '7. Recommendations'),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Action Items'),
            React.createElement('textarea', {
              value: formData.sections.action_items,
              onChange: (e) => handleSectionChange('action_items', e.target.value),
              style: styles.textarea,
              placeholder: 'Action items for the board...',
              rows: 2
            })
          ),
          React.createElement(
            'div',
            { style: styles.formGroup },
            React.createElement('label', { style: styles.label }, 'Decisions Needed'),
            React.createElement('textarea', {
              value: formData.sections.decisions_needed,
              onChange: (e) => handleSectionChange('decisions_needed', e.target.value),
              style: styles.textarea,
              placeholder: 'Decisions required from the board...',
              rows: 2
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
              style: { padding: '10px 24px', background: submitting ? '#999' : '#1a237e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }
            }, submitting ? 'Saving...' : (editItem ? 'Update Report' : 'Create Report'))
          )
        )
      )
    ),
    // View Modal - Complete with all sections
    showViewModal && viewItem && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowViewModal(false) },
      React.createElement(
        'div',
        { style: styles.viewModal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '\uD83D\uDCC4 Report Details'),
          React.createElement('button', {
            onClick: () => setShowViewModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        // Report Header
        React.createElement(
          'div',
          { style: { background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' } },
          React.createElement(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' } },
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
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, getTypeLabel(viewItem.report_type))
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
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, 'Semester ', viewItem.semester)
            ),
            React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Prepared By'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1a237e', fontWeight: '500' } }, viewItem.prepared_by || 'Dean')
            )
          ),
          viewItem.published_at && React.createElement(
            'div',
            { style: { marginTop: '8px' } },
            React.createElement('strong', { style: { fontSize: '12px', color: '#666', textTransform: 'uppercase' } }, 'Published'),
            React.createElement('p', { style: { margin: '4px 0', color: '#1565c0', fontWeight: '500' } }, new Date(viewItem.published_at).toLocaleString())
          )
        ),
        // Content
        viewItem.content && React.createElement(
          'div',
          { style: styles.detailSection },
          React.createElement('strong', { style: styles.detailLabel }, 'Content'),
          React.createElement('p', { style: styles.detailValue }, viewItem.content)
        ),
        // All Sections
        viewItem.sections && React.createElement(
          React.Fragment,
          null,
          // 1. Executive Summary
          (viewItem.sections.key_highlights || viewItem.sections.overall_performance) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '1. Executive Summary'),
            viewItem.sections.key_highlights && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Key Highlights'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.key_highlights)
            ),
            viewItem.sections.overall_performance && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Overall Performance'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.overall_performance)
            )
          ),
          // 2. Academic Affairs
          (viewItem.sections.student_enrollment || viewItem.sections.program_performance || viewItem.sections.curriculum_updates || viewItem.sections.academic_achievements) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '2. Academic Affairs'),
            viewItem.sections.student_enrollment && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Student Enrollment'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.student_enrollment)
            ),
            viewItem.sections.program_performance && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Program Performance'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.program_performance)
            ),
            viewItem.sections.curriculum_updates && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Curriculum Updates'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.curriculum_updates)
            ),
            viewItem.sections.academic_achievements && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Academic Achievements'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.academic_achievements)
            )
          ),
          // 3. Staff & Faculty
          (viewItem.sections.faculty_appointments || viewItem.sections.staff_development || viewItem.sections.performance_reviews || viewItem.sections.faculty_achievements) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '3. Staff & Faculty'),
            viewItem.sections.faculty_appointments && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Faculty Appointments'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.faculty_appointments)
            ),
            viewItem.sections.staff_development && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Staff Development'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.staff_development)
            ),
            viewItem.sections.performance_reviews && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Performance Reviews'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.performance_reviews)
            ),
            viewItem.sections.faculty_achievements && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Faculty Achievements'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.faculty_achievements)
            )
          ),
          // 4. Research & Innovation
          (viewItem.sections.research_output || viewItem.sections.grants_secured || viewItem.sections.publications || viewItem.sections.conferences_attended) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '4. Research & Innovation'),
            viewItem.sections.research_output && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Research Output'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.research_output)
            ),
            viewItem.sections.grants_secured && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Grants Secured'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.grants_secured)
            ),
            viewItem.sections.publications && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Publications'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.publications)
            ),
            viewItem.sections.conferences_attended && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Conferences & Collaborations'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.conferences_attended)
            )
          ),
          // 5. Financial Summary
          (viewItem.sections.budget_utilization || viewItem.sections.resource_allocation || viewItem.sections.financial_projections) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '5. Financial Summary'),
            viewItem.sections.budget_utilization && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Budget Utilization'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.budget_utilization)
            ),
            viewItem.sections.resource_allocation && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Resource Allocation'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.resource_allocation)
            ),
            viewItem.sections.financial_projections && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Financial Projections'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.financial_projections)
            )
          ),
          // 6. Strategic Initiatives
          (viewItem.sections.ongoing_projects || viewItem.sections.future_plans || viewItem.sections.challenges) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '6. Strategic Initiatives'),
            viewItem.sections.ongoing_projects && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Ongoing Projects'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.ongoing_projects)
            ),
            viewItem.sections.future_plans && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Future Plans'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.future_plans)
            ),
            viewItem.sections.challenges && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Challenges & Solutions'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.challenges)
            )
          ),
          // 7. Recommendations
          (viewItem.sections.action_items || viewItem.sections.decisions_needed) && React.createElement(
            'div',
            { style: styles.detailSection },
            React.createElement('h5', { style: { color: '#1a237e', margin: '0 0 8px 0', fontSize: '15px' } }, '7. Recommendations'),
            viewItem.sections.action_items && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: styles.detailLabel }, 'Action Items'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.action_items)
            ),
            viewItem.sections.decisions_needed && React.createElement(
              React.Fragment,
              null,
              React.createElement('strong', { style: { ...styles.detailLabel, marginTop: '8px' } }, 'Decisions Needed'),
              React.createElement('p', { style: styles.detailValue }, viewItem.sections.decisions_needed)
            )
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

export default DeanFacultyBoardReports;