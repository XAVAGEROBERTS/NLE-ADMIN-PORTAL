// HOD/HODEvaluationResponses.jsx - FIXED
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const HODEvaluationResponses = ({ formId, formTitle, showToast }) => {
  const [responses, setResponses] = useState([]);
  const [draftResponses, setDraftResponses] = useState([]);
  const [students, setStudents] = useState([]);
  const [formQuestions, setFormQuestions] = useState([]);
  const [formData, setFormData] = useState(null);
  const [targetStudents, setTargetStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedIsDraft, setSelectedIsDraft] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    drafts: 0,
    targetCount: 0,
    completionRate: 0,
    averageRating: 0,
  });

  const fetchResponses = useCallback(async () => {
    if (!formId) return;

    setLoading(true);
    try {
      console.log('📊 Fetching responses for form:', formId);
      
      // First, get the form data with questions
      const { data: form, error: formError } = await supabase
        .from('module_evaluation_forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) {
        console.error('Error fetching form:', formError);
        throw formError;
      }

      console.log('📋 Form loaded:', form?.title);
      console.log('📝 Questions:', form?.questions?.length || 0);

      setFormData(form);
      const questions = form?.questions || [];
      setFormQuestions(questions);

      // Calculate target students based on form criteria
      let query = supabase
        .from('students')
        .select('id, full_name, email, student_id, program, year_of_study, department_code')
        .eq('department_code', form.department_code);

      if (form.target_year_of_study) {
        query = query.eq('year_of_study', form.target_year_of_study);
      }

      if (form.target_semester) {
        query = query.eq('semester', form.target_semester);
      }

      if (form.target_courses && form.target_courses.length > 0) {
        const { data: enrolledStudents, error: enrolledError } = await supabase
          .from('student_courses')
          .select('student_id')
          .in('course_id', form.target_courses);

        if (!enrolledError && enrolledStudents) {
          const studentIds = enrolledStudents.map(s => s.student_id);
          if (studentIds.length > 0) {
            query = query.in('id', studentIds);
          } else {
            setTargetStudents([]);
            setStats(prev => ({ ...prev, targetCount: 0, completionRate: 0 }));
          }
        }
      }

      const { data: targetStudentsData, error: targetError } = await query;

      if (targetError) {
        console.error('Error fetching target students:', targetError);
        throw targetError;
      }

      setTargetStudents(targetStudentsData || []);

      // Get FULLY SUBMITTED responses (with submitted_at not null)
      const { data: submittedResponses, error: submittedError } = await supabase
        .from('module_evaluation_responses')
        .select('*')
        .eq('form_id', formId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });

      if (submittedError) {
        console.error('Error fetching submitted responses:', submittedError);
        throw submittedError;
      }

      // Get DRAFT responses (with submitted_at null)
      const { data: draftResponsesData, error: draftError } = await supabase
        .from('module_evaluation_responses')
        .select('*')
        .eq('form_id', formId)
        .is('submitted_at', null)
        .order('updated_at', { ascending: false });

      if (draftError) {
        console.error('Error fetching draft responses:', draftError);
        throw draftError;
      }

      console.log('📊 Submitted responses:', submittedResponses?.length || 0);
      console.log('📊 Draft responses:', draftResponsesData?.length || 0);

      // Get student details for responses
      const allStudentIds = [
        ...(submittedResponses?.map(r => r.student_id).filter(Boolean) || []),
        ...(draftResponsesData?.map(r => r.student_id).filter(Boolean) || [])
      ];
      
      let studentsData = [];
      if (allStudentIds.length > 0) {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name, email, student_id, program')
          .in('id', allStudentIds);
        if (!error) studentsData = data || [];
      }

      setResponses(submittedResponses || []);
      setDraftResponses(draftResponsesData || []);
      setStudents(studentsData);

      // Calculate stats
      const totalSubmitted = submittedResponses?.length || 0;
      const totalDrafts = draftResponsesData?.length || 0;
      const targetCount = targetStudentsData?.length || 0;
      const completed = submittedResponses?.filter(r => r.submitted_at).length || 0;
      const completionRate = targetCount > 0 ? Math.round((completed / targetCount) * 100) : 0;

      // Calculate average rating from submitted responses only
      let totalRating = 0;
      let ratingCount = 0;
      submittedResponses?.forEach(response => {
        if (response.answers) {
          Object.values(response.answers).forEach(value => {
            if (typeof value === 'number' && value >= 1 && value <= 5) {
              totalRating += value;
              ratingCount++;
            }
          });
        }
      });

      setStats({
        total: totalSubmitted + totalDrafts,
        completed: totalSubmitted,
        drafts: totalDrafts,
        targetCount,
        completionRate,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
      });
    } catch (err) {
      console.error('Error fetching responses:', err);
      showToast?.('Failed to load responses', 'error');
    } finally {
      setLoading(false);
    }
  }, [formId, showToast]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const getQuestionText = (questionId) => {
    const question = formQuestions.find(q => String(q.id) === String(questionId));
    return question?.question || questionId;
  };

  const getQuestionType = (questionId) => {
    const question = formQuestions.find(q => String(q.id) === String(questionId));
    return question?.type || 'text';
  };

  const getStudentName = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student?.full_name || studentId || 'Unknown Student';
  };

  const getStudentEmail = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student?.email || 'N/A';
  };

  const getStudentProgram = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student?.program || 'N/A';
  };

  const renderAnswer = (questionId, answer) => {
    const type = getQuestionType(questionId);
    
    if (answer === null || answer === undefined || answer === '') {
      return <span style={{ color: '#999' }}>Not answered</span>;
    }

    if (type === 'rating') {
      return <span>{'⭐'.repeat(Math.round(answer))} ({answer}/5)</span>;
    }

    if (type === 'boolean') {
      return <span>{answer === 'yes' ? '✅ Yes' : '❌ No'}</span>;
    }

    if (type === 'mcq') {
      return <span>{answer}</span>;
    }

    if (typeof answer === 'string' && answer.length > 100) {
      return <span>{answer.substring(0, 100)}...</span>;
    }

    return <span>{String(answer)}</span>;
  };

  const styles = {
    container: { padding: '20px' },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '20px',
      paddingBottom: '12px',
      borderBottom: '2px solid #e8eaf6'
    },
    title: { margin: 0, fontSize: '20px', color: '#1a237e' },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '16px',
      marginBottom: '20px'
    },
    statCard: {
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e8eaf6',
      textAlign: 'center'
    },
    statValue: { fontSize: '24px', fontWeight: '700', color: '#1a237e', margin: 0 },
    statLabel: { fontSize: '12px', color: '#666', margin: '4px 0 0 0' },
    statSub: { fontSize: '11px', color: '#999', margin: '2px 0 0 0' },
    tableContainer: {
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #e8eaf6',
      overflow: 'hidden',
      overflowX: 'auto'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px'
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      background: '#f8f9fa',
      borderBottom: '2px solid #e8eaf6',
      fontWeight: '600',
      color: '#1a237e'
    },
    td: {
      padding: '10px 16px',
      borderBottom: '1px solid #f0f0f5',
      verticalAlign: 'middle'
    },
    viewBtn: {
      background: '#e8eaf6',
      color: '#1a237e',
      border: 'none',
      padding: '4px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    draftBadge: {
      background: '#fff8e1',
      color: '#ff8f00',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: '600',
      border: '1px solid #ffcc02'
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
      borderRadius: '12px',
      width: '90%',
      maxWidth: '650px',
      maxHeight: '80vh',
      overflow: 'auto',
      padding: '24px'
    },
    responseItem: {
      padding: '12px',
      marginBottom: '12px',
      background: '#f8f9fa',
      borderRadius: '6px',
      borderLeft: '3px solid #1a237e'
    },
    questionText: { fontWeight: '600', color: '#1a237e', margin: '0 0 4px 0', fontSize: '14px' },
    answerText: { margin: '4px 0 0 0', color: '#333', fontSize: '14px', paddingLeft: '8px' },
    draftResponseItem: {
      padding: '12px',
      marginBottom: '12px',
      background: '#fff8e1',
      borderRadius: '6px',
      borderLeft: '3px solid #ff8f00'
    },
    closeBtn: {
      padding: '8px 20px',
      background: '#f5f5f5',
      border: '1px solid #ddd',
      borderRadius: '6px',
      cursor: 'pointer'
    },
    draftBanner: {
      background: '#fff8e1',
      padding: '8px 12px',
      borderRadius: '6px',
      marginBottom: '12px',
      border: '1px solid #ffcc02',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading responses...</div>;
  }

  const allResponses = [...responses, ...draftResponses];

  return React.createElement(
    'div',
    { style: styles.container },
    React.createElement(
      'div',
      { style: styles.header },
      React.createElement('h3', { style: styles.title }, '📊 Responses: ', formTitle || 'Evaluation'),
      React.createElement('span', { style: { color: '#666' } }, responses.length, ' submitted, ', draftResponses.length, ' in progress')
    ),
    React.createElement(
      'div',
      { style: styles.statsGrid },
      React.createElement(
        'div',
        { style: styles.statCard },
        React.createElement('p', { style: styles.statValue }, stats.completed),
        React.createElement('p', { style: styles.statLabel }, 'Submitted'),
        React.createElement('p', { style: styles.statSub }, 'Fully completed')
      ),
      React.createElement(
        'div',
        { style: styles.statCard },
        React.createElement('p', { style: { fontSize: '24px', fontWeight: '700', color: '#ff8f00', margin: 0 } }, stats.drafts),
        React.createElement('p', { style: styles.statLabel }, 'In Progress'),
        React.createElement('p', { style: styles.statSub }, 'Started but not submitted')
      ),
      React.createElement(
        'div',
        { style: styles.statCard },
        React.createElement('p', { style: styles.statValue }, stats.targetCount),
        React.createElement('p', { style: styles.statLabel }, 'Target Students'),
        React.createElement('p', { style: styles.statSub }, 'Based on cohort/courses')
      ),
      React.createElement(
        'div',
        { style: styles.statCard },
        React.createElement('p', { style: { fontSize: '24px', fontWeight: '700', color: stats.completionRate >= 70 ? '#2e7d32' : stats.completionRate >= 40 ? '#ffa726' : '#c62828', margin: 0 } },
          stats.completionRate + '%'
        ),
        React.createElement('p', { style: styles.statLabel }, 'Completion Rate'),
        React.createElement('p', { style: styles.statSub }, stats.completed + ' of ' + stats.targetCount + ' students')
      ),
      React.createElement(
        'div',
        { style: styles.statCard },
        React.createElement('p', { style: styles.statValue }, stats.averageRating > 0 ? stats.averageRating : 'N/A'),
        React.createElement('p', { style: styles.statLabel }, 'Avg Rating'),
        React.createElement('p', { style: styles.statSub }, 'From submitted responses')
      )
    ),
    React.createElement(
      'div',
      { style: styles.tableContainer },
      allResponses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {stats.targetCount > 0 ? (
            <div>
              <p>No responses yet.</p>
              <p style={{ fontSize: '13px', color: '#999' }}>
                Target: {stats.targetCount} students • 
                {stats.completionRate === 0 && ' Waiting for submissions'}
              </p>
            </div>
          ) : (
            <div>
              <p>No target students found for this evaluation.</p>
              <p style={{ fontSize: '13px', color: '#999' }}>
                Please check the form's target criteria (courses, year, semester).
              </p>
            </div>
          )}
        </div>
      ) : (
        React.createElement(
          'table',
          { style: styles.table },
          React.createElement(
            'thead',
            null,
            React.createElement(
              'tr',
              null,
              React.createElement('th', { style: styles.th }, 'Student'),
              React.createElement('th', { style: styles.th }, 'Email'),
              React.createElement('th', { style: styles.th }, 'Program'),
              React.createElement('th', { style: styles.th }, 'Status'),
              React.createElement('th', { style: styles.th }, 'Date'),
              React.createElement('th', { style: styles.th }, 'Actions')
            )
          ),
          React.createElement(
            'tbody',
            null,
            // Submitted responses
            responses.map((response) => (
              React.createElement(
                'tr',
                { key: response.id },
                React.createElement('td', { style: styles.td }, getStudentName(response.student_id)),
                React.createElement('td', { style: styles.td }, getStudentEmail(response.student_id)),
                React.createElement('td', { style: styles.td }, getStudentProgram(response.student_id)),
                React.createElement(
                  'td',
                  { style: styles.td },
                  React.createElement('span', { style: { color: '#2e7d32', fontWeight: '600' } }, '✅ Submitted')
                ),
                React.createElement('td', { style: styles.td }, new Date(response.submitted_at).toLocaleString()),
                React.createElement(
                  'td',
                  { style: styles.td },
                  React.createElement(
                    'button',
                    { style: styles.viewBtn, onClick: () => { setSelectedResponse(response); setSelectedIsDraft(false); setShowResponseModal(true); } },
                    '📋 View'
                  )
                )
              )
            )),
            // Draft responses
            draftResponses.map((response) => (
              React.createElement(
                'tr',
                { key: response.id, style: { background: '#fffde7' } },
                React.createElement('td', { style: styles.td }, getStudentName(response.student_id)),
                React.createElement('td', { style: styles.td }, getStudentEmail(response.student_id)),
                React.createElement('td', { style: styles.td }, getStudentProgram(response.student_id)),
                React.createElement(
                  'td',
                  { style: styles.td },
                  React.createElement('span', { style: { color: '#ff8f00', fontWeight: '600' } }, '🔄 In Progress'),
                  React.createElement('br', null),
                  React.createElement('span', { style: { fontSize: '10px', color: '#999' } }, 
                    Object.keys(response.answers || {}).filter(k => response.answers[k] && response.answers[k] !== '').length,
                    '/', (formQuestions.length || 0), ' answered'
                  )
                ),
                React.createElement('td', { style: styles.td }, new Date(response.updated_at).toLocaleString()),
                React.createElement(
                  'td',
                  { style: styles.td },
                  React.createElement(
                    'button',
                    { style: { ...styles.viewBtn, background: '#fff8e1', border: '1px solid #ffcc02' }, onClick: () => { setSelectedResponse(response); setSelectedIsDraft(true); setShowResponseModal(true); } },
                    '📋 View'
                  )
                )
              )
            ))
          )
        )
      )
    ),
    // View Response Modal
    showResponseModal && selectedResponse && React.createElement(
      'div',
      { style: styles.modalOverlay, onClick: () => setShowResponseModal(false) },
      React.createElement(
        'div',
        { style: styles.modal, onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
          React.createElement('h3', { style: { margin: 0, color: '#1a237e' } }, '📋 Student Response'),
          React.createElement('button', {
            onClick: () => setShowResponseModal(false),
            style: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }
          }, '✕')
        ),
        // Student info
        React.createElement(
          'div',
          { style: { background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginBottom: '16px' } },
          React.createElement('p', { style: { margin: '4px 0' } }, '👤 ', getStudentName(selectedResponse.student_id)),
          React.createElement('p', { style: { margin: '4px 0' } }, '📧 ', getStudentEmail(selectedResponse.student_id)),
          React.createElement('p', { style: { margin: '4px 0', color: '#999' } }, 
            selectedIsDraft ? '🔄 Status: In Progress (Draft)' : '✅ Status: Submitted',
            ' • ',
            selectedIsDraft ? new Date(selectedResponse.updated_at).toLocaleString() : new Date(selectedResponse.submitted_at).toLocaleString()
          )
        ),
        // Draft banner if viewing draft
        selectedIsDraft && React.createElement(
          'div',
          { style: styles.draftBanner },
          React.createElement('span', { style: { fontSize: '20px' } }, '🔄'),
          React.createElement(
            'div',
            null,
            React.createElement('strong', null, 'This is a draft response'),
            React.createElement('p', { style: { margin: '0', fontSize: '13px', color: '#555' } },
              'Student has started but not yet submitted this evaluation.'
            )
          )
        ),
        // Questions and answers
        Object.entries(selectedResponse.answers || {}).map(([questionId, answer]) => {
          const questionText = getQuestionText(questionId);
          const answered = answer !== '' && answer !== null && answer !== undefined;
          return React.createElement(
            'div',
            { key: questionId, style: answered ? styles.responseItem : { ...styles.responseItem, opacity: 0.6 } },
            React.createElement('p', { style: styles.questionText }, 'Q: ', questionText),
            React.createElement('p', { style: styles.answerText }, 
              answered ? renderAnswer(questionId, answer) : 
              React.createElement('span', { style: { color: '#999', fontStyle: 'italic' } }, 'Not answered')
            )
          );
        }),
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '16px' } },
          React.createElement('button', { style: styles.closeBtn, onClick: () => setShowResponseModal(false) }, 'Close')
        )
      )
    )
  );
};

export default HODEvaluationResponses;