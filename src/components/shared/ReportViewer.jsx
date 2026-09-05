// components/shared/ReportViewer.jsx - COMPLETE
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const ReportViewer = ({ 
  departmentCode = null,
  showAll = false,  // true = Admin sees all, false = HOD sees only published
  showToast 
}) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('faculty_board_reports')
        .select('*');

      // If showAll is false (HOD), only show published
      if (!showAll) {
        query = query.eq('status', 'published');
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      showToast?.('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAll, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
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

  const filteredReports = reports.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.report_type === typeFilter;
    const matchSearch =
      r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.academic_year?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchType && matchSearch;
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
      background: '#1565c0',
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
    filterSelect: {
      padding: '10px 16px',
      border: '1.5px solid #d1d5db',
      borderRadius: '8px',
      background: 'white',
      fontSize: '14px',
      cursor: 'pointer',
      minWidth: '180px'
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
      fontSize: '12px'
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
    viewModal: {
      background: 'white',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '850px',
      maxHeight: '90vh',
      overflow: 'auto',
      padding: '24px'
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
      React.createElement('span', { style: styles.badge }, reports.length, ' Reports')
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
          value: typeFilter,
          onChange: (e) => setTypeFilter(e.target.value),
          style: styles.filterSelect
        },
        React.createElement('option', { value: 'all' }, 'All Types'),
        React.createElement('option', { value: 'monthly' }, '📊 Monthly'),
        React.createElement('option', { value: 'quarterly' }, '📈 Quarterly'),
        React.createElement('option', { value: 'annual' }, '📅 Annual'),
        React.createElement('option', { value: 'special' }, '⭐ Special')
      ),
      // Only show status filter if Admin (showAll)
      showAll && React.createElement(
        'select',
        {
          value: statusFilter,
          onChange: (e) => setStatusFilter(e.target.value),
          style: styles.filterSelect
        },
        React.createElement('option', { value: 'all' }, 'All Statuses'),
        React.createElement('option', { value: 'draft' }, '📝 Draft'),
        React.createElement('option', { value: 'review' }, '🔍 In Review'),
        React.createElement('option', { value: 'approved' }, '✅ Approved'),
        React.createElement('option', { value: 'published' }, '📨 Published')
      ),
      React.createElement(
        'button',
        { style: styles.refreshBtn, onClick: fetchReports },
        '\uD83D\uDD04 Refresh'
      )
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
        React.createElement('h3', null, 'No Reports Found'),
        React.createElement('p', { style: { color: '#666' } }, 
          showAll ? 'No reports have been created yet.' : 'No published reports available.'
        )
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
              item.published_at ? 'Published: ' + new Date(item.published_at).toLocaleDateString() : 
              'Created: ' + new Date(item.created_at).toLocaleDateString()
            ),
            React.createElement(
              'button',
              { style: styles.viewBtn, onClick: () => handleView(item) },
              '\uD83D\uDCCB View'
            )
          )
        );
      })
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
            ),
            viewItem.published_at && React.createElement(
              'div',
              null,
              React.createElement('strong', { style: { fontSize: '12px', color: '#1565c0', textTransform: 'uppercase' } }, 'Published'),
              React.createElement('p', { style: { margin: '4px 0', color: '#1565c0', fontWeight: '500' } }, new Date(viewItem.published_at).toLocaleString())
            )
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
          // Executive Summary
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
          // Academic Affairs
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
          // Staff & Faculty
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
          // Research & Innovation
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
          // Financial Summary
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
          // Strategic Initiatives
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
          // Recommendations
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

export default ReportViewer;