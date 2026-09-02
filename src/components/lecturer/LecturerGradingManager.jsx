// LecturerGradingManager.jsx - Unified Grading Manager with Exam & Assignment Logic
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import './LecturerGradingManager.css';

const LecturerGradingManager = ({ profile, courses, showToast }) => {
  // ==================== STATE ====================
  const [loading, setLoading] = useState(false);
  const [gradingType, setGradingType] = useState('assignments'); // 'assignments' | 'exams'
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [items, setItems] = useState([]);
  
  // Submissions state
  const [submissions, setSubmissions] = useState([]);
  const [gradeForm, setGradeForm] = useState({});
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [bulkGrading, setBulkGrading] = useState(false);
  
  // File download state
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // Text Answers Modal
  const [selectedTextAnswer, setSelectedTextAnswer] = useState(null);
  const [showTextAnswersModal, setShowTextAnswersModal] = useState(false);
  const [exportingTextAnswers, setExportingTextAnswers] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    graded: 0,
    ungraded: 0,
    average: 'N/A',
    highest: 'N/A',
    lowest: 'N/A',
    passRate: 'N/A',
  });

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (selectedCourse) {
      fetchItems();
    }
  }, [selectedCourse, gradingType]);

  useEffect(() => {
    if (selectedItem) {
      fetchSubmissions();
    }
  }, [selectedItem]);

  // ==================== FETCH ITEMS ====================
  const fetchItems = async () => {
    setLoading(true);
    try {
      let query;
      if (gradingType === 'assignments') {
        query = supabase
          .from('assignments')
          .select('id, title, course_id, total_marks, due_date, status, file_urls, created_at')
          .eq('course_id', selectedCourse)
          .eq('lecturer_id', profile.id)
          .neq('status', 'draft')
          .order('created_at', { ascending: false });
      } else {
        // Fetch ALL exams - same logic as LecturerExamsManager
        query = supabase
          .from('examinations')
          .select('id, title, course_id, total_marks, start_time, end_time, status, exam_type, duration_minutes, exam_files, created_at')
          .eq('course_id', selectedCourse)
          .order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setItems(data || []);
      setSelectedItem('');
      setSubmissions([]);
      
      // Auto-select first item if available
      if (data && data.length > 0) {
        setSelectedItem(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      showToast(`Error loading ${gradingType}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FETCH SUBMISSIONS ====================
  const fetchSubmissions = async () => {
    if (!selectedItem) {
      setSubmissions([]);
      return;
    }

    setLoading(true);
    try {
      let data;
      let error;
      let itemDetails;

      if (gradingType === 'assignments') {
        // Get assignment details
        const { data: assignment, error: itemError } = await supabase
          .from('assignments')
          .select('id, title, total_marks, file_urls')
          .eq('id', selectedItem)
          .single();
          
        if (itemError) throw itemError;
        itemDetails = assignment;

        // Fetch assignment submissions - same as LecturerAssignmentsManager
        const result = await supabase
          .from('assignment_submissions')
          .select(`
            id,
            assignment_id,
            student_id,
            submission_date,
            submitted_text,
            file_urls,
            status,
            marks_obtained,
            feedback,
            graded_by,
            graded_at
          `)
          .eq('assignment_id', selectedItem)
          .order('submission_date', { ascending: false });

        data = result.data;
        error = result.error;
        if (error) throw error;

        const processed = await processAssignmentSubmissions(data, itemDetails);
        setSubmissions(processed);
        calculateStats(processed);
        initializeGradeForm(processed);

      } else {
        // Get exam details
        const { data: exam, error: itemError } = await supabase
          .from('examinations')
          .select('id, title, total_marks, exam_files')
          .eq('id', selectedItem)
          .single();
          
        if (itemError) throw itemError;
        itemDetails = exam;

        // Fetch exam submissions - same as LecturerExamsManager
        const result = await supabase
          .from('exam_submissions')
          .select(`
            id,
            exam_id,
            student_id,
            started_at,
            submitted_at,
            time_spent_minutes,
            status,
            total_marks_obtained,
            grade,
            grade_points,
            percentage,
            feedback,
            graded_by,
            graded_at,
            answer_text,
            answer_files
          `)
          .eq('exam_id', selectedItem)
          .order('submitted_at', { ascending: false });

        data = result.data;
        error = result.error;
        if (error) throw error;

        const processed = await processExamSubmissions(data, itemDetails);
        setSubmissions(processed);
        calculateStats(processed);
        initializeGradeForm(processed);
      }

    } catch (error) {
      console.error('Error fetching submissions:', error);
      showToast(`Error loading submissions: ${error.message}`, 'error');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== PROCESS SUBMISSIONS ====================
  const processAssignmentSubmissions = async (submissionsData, assignment) => {
    if (!submissionsData || submissionsData.length === 0) return [];

    // Get student details
    const studentUuids = [...new Set(submissionsData.map(s => s.student_id))];
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, email, student_id, profile_picture_url, department_code')
      .in('id', studentUuids);

    const studentMap = {};
    students?.forEach(stu => {
      studentMap[stu.id] = stu;
    });

    const projectRef = supabase.supabaseUrl.split("//")[1].split(".")[0];

    return submissionsData.map(sub => {
      const student = studentMap[sub.student_id] || {};
      
      // Generate file download URLs
      const fileDownloadUrls = (sub.file_urls || [])
        .map(filePath => {
          if (!filePath) return null;
          if (filePath.startsWith('http')) return filePath;
          const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
          return `https://${projectRef}.supabase.co/storage/v1/object/public/assignments/${cleanPath}`;
        })
        .filter(url => url);

      return {
        submission_id: sub.id,
        student_id: sub.student_id,
        student_name: student.full_name || 'Unknown Student',
        student_email: student.email || 'No email',
        registration_number: student.student_id || 'N/A',
        student_department: student.department_code || 'N/A',
        profile_picture: student.profile_picture_url || null,
        submission_date: sub.submission_date,
        status: sub.status || 'submitted',
        file_urls: sub.file_urls || [],
        file_download_urls: fileDownloadUrls,
        marks_obtained: sub.marks_obtained,
        feedback: sub.feedback,
        graded_at: sub.graded_at,
        is_graded: sub.marks_obtained !== null && sub.marks_obtained !== undefined,
        grade_value: sub.marks_obtained || '',
        feedback_text: sub.feedback || '',
        max_marks: assignment?.total_marks || 100,
        item_title: assignment?.title || 'Assignment',
        submitted_text: sub.submitted_text || '',
        answer_text: sub.submitted_text || '',
      };
    });
  };

  const processExamSubmissions = async (submissionsData, exam) => {
    if (!submissionsData || submissionsData.length === 0) return [];

    // Get student details
    const studentUuids = [...new Set(submissionsData.map(s => s.student_id))];
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, email, student_id, profile_picture_url, department_code')
      .in('id', studentUuids);

    const studentMap = {};
    students?.forEach(stu => {
      studentMap[stu.id] = stu;
    });

    const projectRef = supabase.supabaseUrl.split("//")[1].split(".")[0];

    return submissionsData.map(sub => {
      const student = studentMap[sub.student_id] || {};
      
      // Generate file download URLs for exam answer files
      const fileDownloadUrls = (sub.answer_files || [])
        .map(filePath => {
          if (!filePath) return null;
          if (filePath.startsWith('http')) return filePath;
          const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
          return `https://${projectRef}.supabase.co/storage/v1/object/public/Student%20exam/${cleanPath}`;
        })
        .filter(url => url);

      return {
        submission_id: sub.id,
        student_id: sub.student_id,
        student_name: student.full_name || 'Unknown Student',
        student_email: student.email || 'No email',
        registration_number: student.student_id || 'N/A',
        student_department: student.department_code || 'N/A',
        profile_picture: student.profile_picture_url || null,
        submission_date: sub.submitted_at,
        status: sub.status || 'submitted',
        file_urls: sub.answer_files || [],
        file_download_urls: fileDownloadUrls,
        marks_obtained: sub.total_marks_obtained,
        feedback: sub.feedback,
        graded_at: sub.graded_at,
        is_graded: sub.total_marks_obtained !== null && sub.total_marks_obtained !== undefined,
        grade_value: sub.total_marks_obtained || '',
        feedback_text: sub.feedback || '',
        max_marks: exam?.total_marks || 100,
        item_title: exam?.title || 'Exam',
        answer_text: sub.answer_text || '',
        submitted_text: sub.answer_text || '',
        grade: sub.grade,
        percentage: sub.percentage,
        grade_points: sub.grade_points,
        started_at: sub.started_at,
        time_spent_minutes: sub.time_spent_minutes,
      };
    });
  };

  // ==================== INITIALIZE GRADE FORM ====================
  const initializeGradeForm = (subs) => {
    const initialForm = {};
    subs.forEach(sub => {
      initialForm[sub.submission_id] = {
        marks: sub.marks_obtained?.toString() || '',
        feedback: sub.feedback || '',
      };
    });
    setGradeForm(initialForm);
  };

  // ==================== CALCULATE STATS ====================
  const calculateStats = (subs) => {
    const graded = subs.filter(s => s.is_graded);
    const grades = graded.map(s => parseFloat(s.grade_value)).filter(g => !isNaN(g) && g !== '');
    const total = subs.length;
    const gradedCount = graded.length;
    const ungradedCount = total - gradedCount;

    const avg = grades.length > 0 
      ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1)
      : 'N/A';

    const highest = grades.length > 0 ? Math.max(...grades) : 'N/A';
    const lowest = grades.length > 0 ? Math.min(...grades) : 'N/A';

    const passMark = 50;
    const passCount = grades.filter(g => g >= passMark).length;
    const passRate = grades.length > 0 
      ? ((passCount / grades.length) * 100).toFixed(1)
      : 'N/A';

    setStats({ total, gradedCount, ungradedCount, average: avg, highest, lowest, passRate, passCount });
  };

  // ==================== GRADING FUNCTIONS ====================
  const handleGradeChange = (submissionId, field, value) => {
    setGradeForm(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: value
      }
    }));
  };

  const handleGradeSubmission = async (submissionId, marks, feedback) => {
    try {
      setGradingInProgress(true);

      let updateData;
      let table;

      if (gradingType === 'assignments') {
        table = 'assignment_submissions';
        updateData = {
          marks_obtained: marks,
          feedback: feedback,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: profile.id,
        };
      } else {
        table = 'exam_submissions';
        const submission = submissions.find(s => s.submission_id === submissionId);
        const maxMarks = submission?.max_marks || 100;
        const percentage = (marks / maxMarks) * 100;
        const gradeLetter = getGradeFromMarks(marks);
        const gradePoints = getGradePoints(gradeLetter);

        updateData = {
          total_marks_obtained: marks,
          feedback: feedback,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: profile.id,
          percentage: percentage,
          grade: gradeLetter,
          grade_points: gradePoints,
        };
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', submissionId);

      if (error) throw error;

      showToast('✅ Graded successfully!', 'success');
      fetchSubmissions();
      fetchItems(); // Refresh stats

    } catch (error) {
      console.error('Error grading submission:', error);
      showToast('Failed to grade: ' + error.message, 'error');
    } finally {
      setGradingInProgress(false);
    }
  };

  const handleBulkGrade = async () => {
    if (selectedSubmissions.length === 0) {
      showToast('Please select submissions to grade', 'error');
      return;
    }

    const updates = selectedSubmissions
      .map((submissionId) => {
        const gradeData = gradeForm[submissionId];
        if (gradeData && gradeData.marks !== '') {
          return {
            id: submissionId,
            marks: parseFloat(gradeData.marks),
            feedback: gradeData.feedback || '',
          };
        }
        return null;
      })
      .filter(update => update !== null);

    if (updates.length === 0) {
      showToast('Please enter marks for selected submissions', 'error');
      return;
    }

    if (!window.confirm(`Grade ${updates.length} selected submissions?`)) return;

    setGradingInProgress(true);
    try {
      for (const update of updates) {
        await handleGradeSubmission(update.id, update.marks, update.feedback);
      }

      showToast(`${updates.length} submissions graded successfully!`, 'success');
      setSelectedSubmissions([]);
      setBulkGrading(false);
      fetchSubmissions();
      fetchItems();
    } catch (error) {
      console.error('Error bulk grading:', error);
      showToast('Error grading submissions: ' + error.message, 'error');
    } finally {
      setGradingInProgress(false);
    }
  };

  // ==================== GET GRADE HELPERS ====================
  const getGradeFromMarks = (marks) => {
    if (!marks && marks !== 0) return 'N/A';
    const numericMarks = parseFloat(marks);
    if (isNaN(numericMarks)) return 'N/A';

    if (numericMarks >= 90) return 'A+';
    if (numericMarks >= 80) return 'A';
    if (numericMarks >= 75) return 'B+';
    if (numericMarks >= 70) return 'B';
    if (numericMarks >= 65) return 'C+';
    if (numericMarks >= 60) return 'C';
    if (numericMarks >= 55) return 'D+';
    if (numericMarks >= 50) return 'D';
    return 'F';
  };

  const getGradePoints = (grade) => {
    if (!grade) return 0.0;
    const gradeMap = {
      'A+': 5.0, 'A': 5.0,
      'B+': 4.5, 'B': 4.0,
      'C+': 3.5, 'C': 3.0,
      'D+': 2.5, 'D': 2.0,
      'F': 0.0,
    };
    return gradeMap[grade.toUpperCase()] || 0.0;
  };

  const getGradeColor = (grade) => {
    if (grade === null || grade === undefined || grade === '') return '#999';
    const num = parseFloat(grade);
    if (num >= 80) return '#2e7d32';
    if (num >= 60) return '#ed6c02';
    return '#d32f2f';
  };

  // ==================== FILE DOWNLOAD ====================
  const downloadFile = async (fileUrl, fileName, submissionId = null) => {
    try {
      const downloadKey = submissionId ? `${submissionId}_${fileName}` : fileName;
      setDownloadingFile(downloadKey);

      if (fileUrl.startsWith('http')) {
        window.open(fileUrl, '_blank');
        setDownloadingFile(null);
        return;
      }

      let bucketName = gradingType === 'assignments' ? 'assignments' : 'Student exam';
      let filePath = fileUrl;

      // Parse bucket and path from URL if needed
      if (fileUrl.includes('/storage/v1/object/public/')) {
        const match = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) {
          bucketName = match[1];
          filePath = match[2];
        }
      }

      filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

      if (!filePath || filePath.length < 3) {
        showToast('Invalid file path', 'error');
        setDownloadingFile(null);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      try {
        const response = await fetch(publicUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName || filePath.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          setDownloadingFile(null);
          return;
        }
      } catch (fetchError) {
        try {
          const { data, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(filePath);

          if (downloadError) {
            window.open(publicUrl, '_blank');
          } else {
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || filePath.split('/').pop() || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        } catch (storageError) {
          window.open(publicUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast('Error downloading file', 'error');
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadAllFilesForSubmission = async (submission) => {
    if (!submission.file_download_urls || submission.file_download_urls.length === 0) {
      showToast('No files to download', 'info');
      return;
    }

    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: submission.file_download_urls.length });

    try {
      for (let i = 0; i < submission.file_download_urls.length; i++) {
        const url = submission.file_download_urls[i];
        const fileName = `${submission.student_name}_file_${i + 1}`;
        setBatchProgress({ current: i + 1, total: submission.file_download_urls.length });
        await downloadFile(url, fileName, submission.submission_id);
        if (i < submission.file_download_urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      showToast('All files downloaded!', 'success');
    } catch (error) {
      console.error('Batch download error:', error);
    } finally {
      setBatchDownloading(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // ==================== TEXT ANSWERS EXPORT ====================
  const exportTextAnswersToWord = async () => {
    const textSubmissions = submissions.filter(
      sub => sub.answer_text && sub.answer_text.length > 0
    );

    if (textSubmissions.length === 0) {
      showToast('No text answers found to export.', 'info');
      return;
    }

    setExportingTextAnswers(true);

    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${gradingType === 'assignments' ? 'Assignment' : 'Exam'} Text Answers - ${items.find(i => i.id === selectedItem)?.title || 'Item'}`,
                  size: 28,
                  bold: true,
                  font: 'Arial',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Total ${textSubmissions.length} text submissions`,
                  size: 22,
                  font: 'Arial',
                }),
              ],
              spacing: { after: 400 },
            }),
            ...textSubmissions.flatMap((sub, index) => {
              const children = [];

              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${index + 1}. ${sub.student_name || 'Unknown Student'}`,
                      size: 24,
                      bold: true,
                      font: 'Arial',
                    }),
                  ],
                  spacing: { before: 400, after: 100 },
                })
              );

              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `   Registration: ${sub.registration_number || 'N/A'} | Email: ${sub.student_email || 'N/A'}`,
                      size: 18,
                      font: 'Arial',
                      color: '666666',
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );

              const answerLines = (sub.answer_text || '').split('\n');
              answerLines.forEach(line => {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `   ${line}`,
                        size: 20,
                        font: 'Arial',
                      }),
                    ],
                    spacing: { after: 50 },
                  })
                );
              });

              if (index < textSubmissions.length - 1) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '-'.repeat(60),
                        size: 16,
                        font: 'Arial',
                        color: 'cccccc',
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  })
                );
              }

              return children;
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Text_Answers_${items.find(i => i.id === selectedItem)?.title || 'item'}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showToast(`✅ ${textSubmissions.length} text answers exported!`, 'success');
    } catch (error) {
      console.error('Error exporting:', error);
      showToast('Failed to export. Please try again.', 'error');
    } finally {
      setExportingTextAnswers(false);
    }
  };

  // ==================== SELECTION HANDLERS ====================
  const handleToggleSubmissionSelection = (submissionId) => {
    setSelectedSubmissions(prev => {
      if (prev.includes(submissionId)) {
        return prev.filter(id => id !== submissionId);
      } else {
        return [...prev, submissionId];
      }
    });
  };

  const handleSelectAllSubmissions = () => {
    const allIds = submissions
      .filter(sub => !sub.is_graded)
      .map(sub => sub.submission_id);

    if (selectedSubmissions.length === allIds.length && allIds.length > 0) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(allIds);
    }
  };

  // ==================== RENDER ====================
  const textSubmissions = submissions.filter(
    sub => sub.answer_text && sub.answer_text.length > 0
  );

  return (
    <div className="lecturer-grading-container">
      <div className="lecturer-grading-header">
        <h2>📊 Grading Management</h2>
        <p>Grade student assignments and exam submissions with feedback</p>
      </div>

      {/* Type Selector */}
      <div className="lecturer-grading-type-selector">
        <button 
          className={`grading-type-btn ${gradingType === 'assignments' ? 'active' : ''}`}
          onClick={() => {
            setGradingType('assignments');
            setSelectedItem('');
            setSubmissions([]);
            setItems([]);
          }}
        >
          📝 Assignments
        </button>
        <button 
          className={`grading-type-btn ${gradingType === 'exams' ? 'active' : ''}`}
          onClick={() => {
            setGradingType('exams');
            setSelectedItem('');
            setSubmissions([]);
            setItems([]);
          }}
        >
          📋 Exams
        </button>
      </div>

      {/* Filters */}
      <div className="lecturer-grading-filters">
        <div className="lecturer-grading-filter-group">
          <label>Select Course</label>
          <select 
            value={selectedCourse} 
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedItem('');
              setSubmissions([]);
              setItems([]);
            }}
            className="lecturer-grading-select"
          >
            <option value="">-- Select Course --</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.course_code} - {course.course_name}
              </option>
            ))}
          </select>
        </div>

        <div className="lecturer-grading-filter-group">
          <label>{gradingType === 'assignments' ? 'Assignment' : 'Exam'}</label>
          <select 
            value={selectedItem} 
            onChange={(e) => setSelectedItem(e.target.value)}
            className="lecturer-grading-select"
            disabled={!selectedCourse || loading}
          >
            <option value="">-- Select --</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.title} ({gradingType === 'assignments' ? `Max: ${item.total_marks}` : `${item.exam_type || 'Exam'} - ${item.status}`})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      {selectedItem && submissions.length > 0 && (
        <div className="lecturer-grading-stats">
          <div className="lecturer-stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="lecturer-stat-item">
            <span className="stat-label">Graded</span>
            <span className="stat-value" style={{ color: '#2e7d32' }}>{stats.gradedCount}</span>
          </div>
          <div className="lecturer-stat-item">
            <span className="stat-label">Ungraded</span>
            <span className="stat-value" style={{ color: '#d32f2f' }}>{stats.ungradedCount}</span>
          </div>
          <div className="lecturer-stat-item">
            <span className="stat-label">Average</span>
            <span className="stat-value" style={{ color: '#1565c0' }}>{stats.average}</span>
          </div>
          <div className="lecturer-stat-item">
            <span className="stat-label">Pass Rate</span>
            <span className="stat-value" style={{ color: '#ed6c02' }}>{stats.passRate}%</span>
          </div>
          <div className="lecturer-stat-item">
            <span className="stat-label">Highest/Lowest</span>
            <span className="stat-value" style={{ color: '#7b1fa2' }}>{stats.highest}/{stats.lowest}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedItem && submissions.length > 0 && (
        <div className="lecturer-grading-actions">
          {selectedSubmissions.length > 0 && (
            <button
              className="lecturer-confirm-btn"
              onClick={handleBulkGrade}
              disabled={gradingInProgress}
              style={{ background: '#28a745' }}
            >
              {gradingInProgress ? 'Grading...' : `✅ Bulk Grade (${selectedSubmissions.length})`}
            </button>
          )}
          <button
            className="lecturer-course-btn"
            onClick={() => {
              setShowTextAnswersModal(true);
            }}
            disabled={textSubmissions.length === 0}
            style={{ 
              background: textSubmissions.length > 0 ? '#6f42c1' : '#ccc',
              color: 'white'
            }}
          >
            📝 View Text Answers ({textSubmissions.length})
          </button>
          {textSubmissions.length > 0 && (
            <button
              className="lecturer-course-btn"
              onClick={exportTextAnswersToWord}
              disabled={exportingTextAnswers}
              style={{ background: '#2b579a', color: 'white' }}
            >
              📄 {exportingTextAnswers ? 'Exporting...' : 'Export to Word'}
            </button>
          )}
          <button
            className="lecturer-secondary-btn"
            onClick={fetchSubmissions}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Submissions Table */}
      {selectedItem && submissions.length > 0 ? (
        <div className="lecturer-grading-table-container">
          <div className="lecturer-grading-info">
            <h4>{submissions[0]?.item_title || 'Submissions'}</h4>
            <span className="submission-count">{submissions.length} submissions</span>
          </div>
          <table className="lecturer-grading-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedSubmissions.length === submissions.filter(s => !s.is_graded).length &&
                      submissions.filter(s => !s.is_graded).length > 0
                    }
                    onChange={handleSelectAllSubmissions}
                    title="Select all ungraded"
                  />
                </th>
                <th>Student</th>
                <th>Registration</th>
                <th>Department</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Files / Answers</th>
                <th>Grade / {submissions[0]?.max_marks || 100}</th>
                <th>Feedback</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="lecturer-loading-cell">
                    <div className="lecturer-spinner"></div>
                    <p>Loading submissions...</p>
                  </td>
                </tr>
              ) : (
                submissions.map((submission, index) => (
                  <tr key={submission.submission_id} className={submission.is_graded ? 'graded-row' : 'ungraded-row'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.includes(submission.submission_id)}
                        onChange={() => handleToggleSubmissionSelection(submission.submission_id)}
                        disabled={submission.is_graded}
                      />
                    </td>
                    <td>
                      <div className="lecturer-student-info">
                        <div className="lecturer-student-avatar-mini">
                          {submission.profile_picture ? (
                            <img src={submission.profile_picture} alt={submission.student_name} />
                          ) : (
                            <span>{submission.student_name?.[0]?.toUpperCase() || '👤'}</span>
                          )}
                        </div>
                        <span className="student-name" title={submission.student_name}>
                          {submission.student_name}
                        </span>
                        <br />
                        <span style={{ fontSize: '11px', color: '#999' }}>{submission.student_email}</span>
                      </div>
                    </td>
                    <td className="student-id-cell">{submission.registration_number}</td>
                    <td>{submission.student_department}</td>
                    <td className="submitted-date-cell">
                      {submission.submission_date ? (
                        <>
                          {new Date(submission.submission_date).toLocaleDateString()}
                          <br />
                          <span style={{ fontSize: '11px', color: '#999' }}>
                            {new Date(submission.submission_date).toLocaleTimeString()}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>Not submitted</span>
                      )}
                    </td>
                    <td>
                      <span className={`lecturer-status-badge ${submission.is_graded ? 'graded' : 'pending'}`}>
                        {submission.is_graded ? '✅ Graded' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      {/* Files */}
                      {submission.file_download_urls && submission.file_download_urls.length > 0 && (
                        <div>
                          {submission.file_download_urls.map((url, idx) => {
                            const displayName = `File ${idx + 1}`;
                            return (
                              <button
                                key={idx}
                                className="lecturer-course-btn"
                                onClick={() => downloadFile(url, `${submission.student_name}_${displayName}`, submission.submission_id)}
                                style={{ fontSize: '11px', padding: '2px 10px', margin: '2px', background: '#1976d2', color: 'white' }}
                              >
                                📥 {displayName}
                              </button>
                            );
                          })}
                          {submission.file_download_urls.length > 1 && (
                            <button
                              className="lecturer-course-btn"
                              onClick={() => downloadAllFilesForSubmission(submission)}
                              disabled={batchDownloading}
                              style={{ fontSize: '11px', padding: '2px 10px', margin: '2px', background: '#28a745', color: 'white' }}
                            >
                              📦 All
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Text Answer */}
                      {submission.answer_text && submission.answer_text.length > 0 && (
                        <div 
                          style={{ 
                            fontSize: '12px', 
                            color: '#6f42c1',
                            cursor: 'pointer',
                            padding: '4px 10px',
                            background: '#f8f0ff',
                            borderRadius: '4px',
                            border: '1px solid #d4b8e0',
                            marginTop: '4px',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => {
                            setSelectedTextAnswer(submission);
                            setShowTextAnswersModal(true);
                          }}
                          title="Click to view full text"
                        >
                          <span>📝</span> {submission.answer_text.length > 60 ? submission.answer_text.substring(0, 60) + '...' : submission.answer_text}
                        </div>
                      )}
                      
                      {!submission.file_download_urls?.length && !submission.answer_text && (
                        <span style={{ color: '#999', fontSize: '12px' }}>No files/answers</span>
                      )}
                    </td>
                    <td>
                      <div className="grade-input-wrapper">
                        <input
                          type="number"
                          min="0"
                          max={submission.max_marks}
                          step="0.5"
                          value={gradeForm[submission.submission_id]?.marks || ''}
                          onChange={(e) => handleGradeChange(submission.submission_id, 'marks', e.target.value)}
                          placeholder="Marks"
                          className="lecturer-grade-input"
                          style={{ width: '70px' }}
                        />
                        <span className="grade-max">/{submission.max_marks}</span>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={gradeForm[submission.submission_id]?.feedback || ''}
                        onChange={(e) => handleGradeChange(submission.submission_id, 'feedback', e.target.value)}
                        placeholder="Feedback"
                        className="lecturer-feedback-input"
                        style={{ width: '120px' }}
                      />
                    </td>
                    <td>
                      <button
                        className="lecturer-confirm-btn"
                        onClick={() => {
                          const marks = parseFloat(gradeForm[submission.submission_id]?.marks);
                          if (isNaN(marks)) {
                            showToast('Please enter valid marks', 'error');
                            return;
                          }
                          handleGradeSubmission(
                            submission.submission_id,
                            marks,
                            gradeForm[submission.submission_id]?.feedback || ''
                          );
                        }}
                        disabled={gradingInProgress}
                        style={{ fontSize: '12px', padding: '6px 14px' }}
                      >
                        {submission.is_graded ? 'Update' : 'Grade'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="lecturer-grading-empty">
          <span className="empty-icon">{gradingType === 'assignments' ? '📝' : '📋'}</span>
          <h3>No {gradingType} to Grade</h3>
          <p>
            {gradingType === 'assignments' 
              ? 'Select a course and assignment to view student submissions' 
              : 'Select a course and exam to view student submissions'}
          </p>
          {selectedCourse && items.length === 0 && !loading && (
            <p className="empty-hint">
              {gradingType === 'assignments' 
                ? 'No assignments found for this course.' 
                : 'No exams found for this course.'}
            </p>
          )}
          {selectedCourse && items.length > 0 && !selectedItem && !loading && (
            <p className="empty-hint" style={{ color: '#1565c0' }}>
              Select a {gradingType === 'assignments' ? 'assignment' : 'exam'} from the dropdown above
            </p>
          )}
          {selectedItem && submissions.length === 0 && !loading && (
            <p className="empty-hint" style={{ color: '#ed6c02' }}>
              No submissions found for this {gradingType === 'assignments' ? 'assignment' : 'exam'} yet.
            </p>
          )}
        </div>
      )}

      {/* ===== TEXT ANSWERS MODAL ===== */}
      {showTextAnswersModal && (
        <div className="lecturer-modal-overlay" onClick={() => {
          if (!exportingTextAnswers) {
            setShowTextAnswersModal(false);
            setSelectedTextAnswer(null);
          }
        }}>
          <div className="lecturer-modal" style={{ 
            maxWidth: '900px', 
            maxHeight: '90vh', 
            overflow: 'hidden',
            padding: 0
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '16px 24px',
              borderBottom: '2px solid #e9ecef',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px 12px 0 0'
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  <span style={{ marginRight: '10px' }}>📝</span>
                  Text Answers
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
                  {items.find(i => i.id === selectedItem)?.title || 'Item'}
                  <span style={{ marginLeft: '15px', fontWeight: 'bold' }}>
                    ({textSubmissions.length} text submissions)
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!selectedTextAnswer && textSubmissions.length > 0 && (
                  <button 
                    className="lecturer-course-btn"
                    onClick={exportTextAnswersToWord}
                    disabled={exportingTextAnswers}
                    style={{ 
                      background: '#2b579a',
                      color: 'white',
                      fontSize: '13px',
                      padding: '8px 16px'
                    }}
                  >
                    📄 {exportingTextAnswers ? 'Exporting...' : 'Export All to Word'}
                  </button>
                )}
                <button 
                  className="lecturer-cancel-btn"
                  onClick={() => {
                    setShowTextAnswersModal(false);
                    setSelectedTextAnswer(null);
                  }}
                  style={{ padding: '8px 16px' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div style={{ 
              padding: '20px 24px', 
              overflowY: 'auto', 
              maxHeight: 'calc(90vh - 150px)',
              backgroundColor: 'white'
            }}>
              {selectedTextAnswer ? (
                // Single Answer View
                <div>
                  <button 
                    className="lecturer-cancel-btn"
                    onClick={() => setSelectedTextAnswer(null)}
                    style={{ marginBottom: '16px', fontSize: '13px', padding: '4px 12px' }}
                  >
                    ← Back to all answers
                  </button>
                  
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '16px 20px', 
                    borderRadius: '8px', 
                    marginBottom: '20px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>STUDENT NAME</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                          {selectedTextAnswer.student_name || 'Unknown Student'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>REGISTRATION</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                          {selectedTextAnswer.registration_number || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>EMAIL</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                          {selectedTextAnswer.student_email || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>SUBMITTED</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                          {selectedTextAnswer.submission_date ? new Date(selectedTextAnswer.submission_date).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Answer Text - Full View */}
                  <div style={{
                    padding: '20px 24px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '2px solid #e0e0e0',
                    minHeight: '200px'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#999',
                      marginBottom: '12px',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                      borderBottom: '1px solid #e9ecef',
                      paddingBottom: '8px'
                    }}>
                      📝 ANSWER TEXT
                    </div>
                    <div style={{
                      fontSize: '16px',
                      lineHeight: '2',
                      color: '#333',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {selectedTextAnswer.answer_text}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      className="lecturer-course-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedTextAnswer.answer_text)
                          .then(() => showToast('Answer text copied!', 'success'))
                          .catch(() => showToast('Failed to copy', 'error'));
                      }}
                      style={{ background: '#28a745', color: 'white' }}
                    >
                      📋 Copy Text
                    </button>
                  </div>
                </div>
              ) : (
                // List of all text answers
                <div>
                  {textSubmissions.length === 0 ? (
                    <div className="lecturer-empty-state" style={{ padding: '40px', textAlign: 'center' }}>
                      <p>No text answers found</p>
                    </div>
                  ) : (
                    textSubmissions.map((sub, index) => (
                      <div key={sub.submission_id} style={{ 
                        marginBottom: '16px', 
                        padding: '16px 20px', 
                        background: '#f8f9fa', 
                        borderRadius: '8px',
                        border: '1px solid #e9ecef',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setSelectedTextAnswer(sub)}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6f42c1'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e9ecef'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <strong>{index + 1}. {sub.student_name}</strong>
                            <span style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>
                              ({sub.registration_number})
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              {sub.submission_date ? new Date(sub.submission_date).toLocaleString() : 'N/A'}
                            </span>
                            <span style={{
                              padding: '2px 12px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: sub.is_graded ? '#d4edda' : '#fff3cd',
                              color: sub.is_graded ? '#155724' : '#856404'
                            }}>
                              {sub.is_graded ? 'Graded' : 'Pending'}
                            </span>
                            <span style={{ color: '#6f42c1', fontSize: '13px' }}>→</span>
                          </div>
                        </div>
                        <div style={{ 
                          padding: '10px 14px', 
                          background: 'white', 
                          borderRadius: '4px',
                          border: '1px solid #e0e0e0',
                          maxHeight: '80px',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '14px',
                          color: '#555'
                        }}>
                          {sub.answer_text.length > 200 ? sub.answer_text.substring(0, 200) + '...' : sub.answer_text}
                        </div>
                        {sub.is_graded && sub.grade_value && (
                          <div style={{ marginTop: '6px', fontSize: '13px', color: '#28a745' }}>
                            ✅ {sub.grade_value} marks
                            {sub.feedback_text && ` - ${sub.feedback_text}`}
                          </div>
                        )}
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#6f42c1' }}>
                          Click to view full answer
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerGradingManager;