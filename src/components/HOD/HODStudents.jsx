// HODStudents.jsx - UPDATED with Export only in footer
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import './HODStudents.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HODStudents = ({
  departmentId,
  departmentCode,
  hodEmail,
  hodName,
  students,
  lecturers,
  courses,
  openChatWithUser,
  profile,
  profileVersion,
  loading,
  searchTerm,
  setSearchTerm,
  fetchHODData,
}) => {
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [studentAssignments, setStudentAssignments] = useState([]);
  const [studentExams, setStudentExams] = useState([]);
  const [studentFinancials, setStudentFinancials] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 7, label: 'Loading student data...' });
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentCGPA, setStudentCGPA] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter students based on search term
  useEffect(() => {
    let filtered = [...students];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(term) ||
          s.student_id?.toLowerCase().includes(term) ||
          s.email?.toLowerCase().includes(term) ||
          s.program?.toLowerCase().includes(term)
      );
    }
    
    setFilteredStudents(filtered);
  }, [students, searchTerm]);

  // ==================== GRADE HELPERS (SAME AS RESULTS COMPONENT) ====================
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
      'A+': 5.0,
      'A': 5.0,
      'B+': 4.5,
      'B': 4.0,
      'C+': 3.5,
      'C': 3.0,
      'D+': 2.5,
      'D': 2.0,
      'F': 0.0
    };
    const points = gradeMap[grade.toUpperCase()];
    return points !== undefined ? points : 0.0;
  };

  // ==================== CALCULATE CGPA (EXACTLY LIKE RESULTS COMPONENT) ====================
  const calculateStudentCGPA = useCallback(async (studentId) => {
    if (!studentId) return 0.0;

    let totalPoints = 0;
    let totalCredits = 0;

    try {
      // 1. Fetch student courses that are completed with grades
      const { data: studentCoursesData, error: scError } = await supabase
        .from('student_courses')
        .select(`
          id,
          course_id,
          status,
          grade,
          grade_points,
          marks,
          courses:course_id (
            id,
            course_code,
            course_name,
            credits,
            year,
            semester
          )
        `)
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .not('grade', 'is', null);

      if (scError) {
        console.error('Error fetching student courses:', scError);
      }

      // 2. Fetch exam submissions that are graded
      const { data: examSubmissions, error: subError } = await supabase
        .from('exam_submissions')
        .select(`
          id,
          exam_id,
          total_marks_obtained,
          grade,
          grade_points,
          percentage,
          status
        `)
        .eq('student_id', studentId)
        .eq('status', 'graded')
        .not('total_marks_obtained', 'is', null);

      if (subError) {
        console.error('Error fetching exam submissions:', subError);
      }

      // ===== PROCESS STUDENT COURSES (like Results component) =====
      if (studentCoursesData && studentCoursesData.length > 0) {
        studentCoursesData.forEach(sc => {
          const grade = sc.grade || getGradeFromMarks(sc.marks);
          if (!grade) return;
          
          let gradePoints = 0;
          if (sc.grade_points !== null && sc.grade_points !== undefined) {
            gradePoints = parseFloat(sc.grade_points);
          } else if (sc.grade) {
            gradePoints = getGradePoints(sc.grade);
          } else {
            const calculatedGrade = getGradeFromMarks(sc.marks);
            gradePoints = getGradePoints(calculatedGrade);
          }

          const credits = sc.courses?.credits || 3;
          
          if (gradePoints && credits) {
            totalPoints += gradePoints * credits;
            totalCredits += credits;
          }
        });
      }

      // ===== PROCESS EXAM SUBMISSIONS (like Results component) =====
      if (examSubmissions && examSubmissions.length > 0) {
        const examIds = examSubmissions.map(sub => sub.exam_id);
        const { data: exams, error: examsError } = await supabase
          .from('examinations')
          .select(`
            id,
            course_id,
            total_marks,
            courses:course_id (
              id,
              course_code,
              course_name,
              credits,
              year,
              semester
            )
          `)
          .in('id', examIds);

        if (examsError) {
          console.error('Error fetching exams:', examsError);
        }

        const examMap = {};
        exams?.forEach(exam => {
          examMap[exam.id] = exam;
        });

        examSubmissions.forEach(sub => {
          const exam = examMap[sub.exam_id];
          if (!exam || !exam.courses) return;

          let gradePoints = 0;
          if (sub.grade_points !== null && sub.grade_points !== undefined) {
            gradePoints = parseFloat(sub.grade_points);
          } else if (sub.grade) {
            gradePoints = getGradePoints(sub.grade);
          } else {
            const calculatedGrade = getGradeFromMarks(sub.total_marks_obtained);
            gradePoints = getGradePoints(calculatedGrade);
          }

          const credits = exam.courses.credits || 3;
          
          if (credits) {
            totalPoints += (gradePoints || 0) * credits;
            totalCredits += credits;
          }
        });
      }

      const cgpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0.0;
      console.log(`✅ CGPA calculated: ${cgpa} (${totalPoints} points / ${totalCredits} credits)`);
      return cgpa;

    } catch (error) {
      console.error('Error calculating CGPA:', error);
      return 0.0;
    }
  }, []);

  // ==================== EXPORT STUDENT DETAILS TO PDF ====================
  const exportStudentToPDF = async () => {
    if (!selectedStudent || !studentDetails) return;

    setExporting(true);
    try {
      const doc = new jsPDF();
      
      doc.setProperties({
        title: `Student Report - ${studentDetails.full_name}`,
        subject: 'Student Academic Report',
        author: 'NLE University - HOD Dashboard',
        keywords: 'student, report, academic',
        creator: 'NLE University'
      });

      // Header
      doc.setFontSize(20);
      doc.setTextColor(41, 128, 185);
      doc.text('NLE UNIVERSITY', 105, 20, null, null, 'center');
      
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text('STUDENT ACADEMIC REPORT', 105, 30, null, null, 'center');
      
      doc.setFontSize(10);
      doc.setTextColor(127, 140, 141);
      doc.text('Generated by HOD Dashboard', 105, 36, null, null, 'center');

      // Student Information
      const stats = calculateStudentStats();
      let yPos = 50;

      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('STUDENT INFORMATION', 20, yPos);
      yPos += 8;

      const studentInfo = [
        ['Full Name:', studentDetails.full_name],
        ['Student ID:', studentDetails.student_id],
        ['Email:', studentDetails.email],
        ['Program:', studentDetails.program || 'N/A'],
        ['Department:', studentDetails.department_code || 'N/A'],
        ['Year:', studentDetails.year_of_study || 'N/A'],
        ['Semester:', studentDetails.semester || 'N/A'],
        ['Status:', studentDetails.status || 'Active'],
      ];

      autoTable(doc, {
        startY: yPos,
        body: studentInfo,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 80 }
        },
        margin: { left: 20 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Academic Summary
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('ACADEMIC SUMMARY', 20, yPos);
      yPos += 8;

      const summaryData = [
        ['Total Courses:', stats.totalCourses.toString()],
        ['Completed:', stats.completed.toString()],
        ['In Progress:', stats.inProgress.toString()],
        ['Average Marks:', stats.avgMarks],
        ['CGPA:', stats.cgpa],
        ['Attendance Rate:', stats.attendanceRate + '%'],
      ];

      autoTable(doc, {
        startY: yPos,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 40 }
        },
        margin: { left: 20 }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Courses
      if (studentCourses.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('COURSES', 20, yPos);
        yPos += 8;

        const courseData = studentCourses.map(c => [
          c.courses?.course_code || 'N/A',
          c.courses?.course_name || 'N/A',
          c.status || 'Enrolled',
          c.marks || '-',
          c.grade || '-',
          c.grade_points || '-',
          (c.attendance_percentage || 0) + '%'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Code', 'Course Name', 'Status', 'Marks', 'Grade', 'GP', 'Attendance']],
          body: courseData,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
          styles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Attendance Records
      if (studentAttendance.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('ATTENDANCE RECORDS', 20, yPos);
        yPos += 8;

        const attendanceData = studentAttendance.slice(0, 30).map(a => [
          new Date(a.date).toLocaleDateString(),
          a.courses?.course_code || 'N/A',
          a.status || 'Absent',
          a.check_in_time || '-',
          a.notes || '-'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Course', 'Status', 'Check In', 'Notes']],
          body: attendanceData,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
          styles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Assignments
      if (studentAssignments.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('ASSIGNMENTS', 20, yPos);
        yPos += 8;

        const assignmentData = studentAssignments.slice(0, 20).map(a => [
          a.assignments?.title || 'N/A',
          a.assignments?.courses?.course_code || 'N/A',
          a.submission_date ? new Date(a.submission_date).toLocaleDateString() : '-',
          a.marks_obtained !== null ? `${a.marks_obtained}/${a.assignments?.total_marks || '?'}` : '-',
          a.status || 'Submitted',
          a.feedback || '-'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Assignment', 'Course', 'Submitted', 'Marks', 'Status', 'Feedback']],
          body: assignmentData,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
          styles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Exams
      if (studentExams.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('EXAMS', 20, yPos);
        yPos += 8;

        const examData = studentExams.slice(0, 20).map(e => [
          e.examinations?.title || 'N/A',
          e.examinations?.courses?.course_code || 'N/A',
          e.examinations?.exam_type || 'N/A',
          e.total_marks_obtained !== null ? `${e.total_marks_obtained}/${e.examinations?.total_marks || '?'}` : '-',
          e.grade || '-',
          e.status || 'Submitted'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Exam', 'Course', 'Type', 'Marks', 'Grade', 'Status']],
          body: examData,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
          styles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Financial Records
      if (studentFinancials.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('FINANCIAL RECORDS', 20, yPos);
        yPos += 8;

        const financialData = studentFinancials.map(f => [
          f.payment_date ? new Date(f.payment_date).toLocaleDateString() : new Date(f.created_at).toLocaleDateString(),
          f.description,
          '$' + (f.amount?.toFixed(2) || '0.00'),
          f.status || 'Pending',
          f.receipt_number || '-'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Description', 'Amount', 'Status', 'Receipt']],
          body: financialData,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
          styles: { fontSize: 9 },
          margin: { left: 20, right: 20 }
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          'This is an electronically generated document from NLE University HOD Dashboard.',
          105,
          doc.internal.pageSize.height - 10,
          null,
          null,
          'center'
        );
        doc.text(
          `Generated on: ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
          105,
          doc.internal.pageSize.height - 5,
          null,
          null,
          'center'
        );
      }

      doc.save(`Student_Report_${studentDetails.student_id}_${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export student report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Fetch student details - SHOW LOADER FIRST THEN LOAD DATA
  const fetchStudentDetails = useCallback(async (student) => {
    if (!student) return;
    
    setSelectedStudent(student);
    setStudentCGPA(0);
    setDataLoaded(false);
    setLoadingDetails(true);
    setLoadingProgress({ current: 0, total: 7, label: 'Loading student details...' });
    setShowStudentModal(true);
    
    try {
      setStudentDetails(null);
      setStudentCourses([]);
      setStudentAttendance([]);
      setStudentAssignments([]);
      setStudentExams([]);
      setStudentFinancials([]);

      setLoadingProgress({ current: 1, total: 7, label: 'Fetching student data...' });

      const results = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('id', student.id)
          .single(),
        
        supabase
          .from('student_courses')
          .select('id, course_id, status, grade, grade_points, marks, attendance_percentage, enrollment_date')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('attendance_records')
          .select('id, date, status, check_in_time, notes, course_id')
          .eq('student_id', student.id)
          .order('date', { ascending: false })
          .limit(50),
        
        supabase
          .from('assignment_submissions')
          .select('id, assignment_id, submission_date, marks_obtained, feedback, status')
          .eq('student_id', student.id)
          .order('submission_date', { ascending: false })
          .limit(30),
        
        supabase
          .from('exam_submissions')
          .select('id, exam_id, submitted_at, total_marks_obtained, grade, grade_points, percentage, feedback, status')
          .eq('student_id', student.id)
          .order('submitted_at', { ascending: false })
          .limit(30),
        
        supabase
          .from('financial_records')
          .select('*')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setLoadingProgress({ current: 2, total: 7, label: 'Processing student data...' });

      const [studentResult, coursesResult, attendanceResult, assignmentsResult, examsResult, financialResult] = results;

      if (studentResult.error) throw studentResult.error;
      setStudentDetails(studentResult.data);
      setLoadingProgress({ current: 3, total: 7, label: 'Loading courses...' });

      let enrichedCourses = [];
      if (!coursesResult.error && coursesResult.data) {
        const courseIds = coursesResult.data.map(c => c.course_id).filter(id => id);
        let courseMap = {};
        if (courseIds.length > 0) {
          const { data: courseDetails } = await supabase
            .from('courses')
            .select('id, course_code, course_name, credits, year, semester, department_code')
            .in('id', courseIds);
          
          if (courseDetails) {
            courseMap = courseDetails.reduce((acc, c) => {
              acc[c.id] = c;
              return acc;
            }, {});
          }
        }
        
        enrichedCourses = coursesResult.data.map(c => ({
          ...c,
          courses: courseMap[c.course_id] || null
        }));
        setStudentCourses(enrichedCourses);
      }
      setLoadingProgress({ current: 4, total: 7, label: 'Loading attendance...' });

      if (!attendanceResult.error && attendanceResult.data) {
        const attCourseIds = attendanceResult.data.map(a => a.course_id).filter(id => id);
        let attCourseMap = {};
        if (attCourseIds.length > 0) {
          const { data: attCourseDetails } = await supabase
            .from('courses')
            .select('id, course_code, course_name')
            .in('id', attCourseIds);
            
          if (attCourseDetails) {
            attCourseMap = attCourseDetails.reduce((acc, c) => {
              acc[c.id] = c;
              return acc;
            }, {});
          }
        }
        
        const enrichedAttendance = attendanceResult.data.map(a => ({
          ...a,
          courses: attCourseMap[a.course_id] || null
        }));
        setStudentAttendance(enrichedAttendance);
      }
      setLoadingProgress({ current: 5, total: 7, label: 'Loading assignments...' });

      if (!assignmentsResult.error && assignmentsResult.data) {
        const assignmentIds = assignmentsResult.data.map(a => a.assignment_id).filter(id => id);
        let assignmentMap = {};
        if (assignmentIds.length > 0) {
          const { data: assignmentDetails } = await supabase
            .from('assignments')
            .select('id, title, description, due_date, total_marks, course_id')
            .in('id', assignmentIds);
            
          if (assignmentDetails) {
            const assignCourseIds = assignmentDetails.map(a => a.course_id).filter(id => id);
            let assignCourseMap = {};
            if (assignCourseIds.length > 0) {
              const { data: assignCourseDetails } = await supabase
                .from('courses')
                .select('id, course_code, course_name')
                .in('id', assignCourseIds);
                
              if (assignCourseDetails) {
                assignCourseMap = assignCourseDetails.reduce((acc, c) => {
                  acc[c.id] = c;
                  return acc;
                }, {});
              }
            }
            
            assignmentMap = assignmentDetails.reduce((acc, a) => {
              acc[a.id] = {
                ...a,
                courses: assignCourseMap[a.course_id] || null
              };
              return acc;
            }, {});
          }
        }
        
        const enrichedAssignments = assignmentsResult.data.map(a => ({
          ...a,
          assignments: assignmentMap[a.assignment_id] || null
        }));
        setStudentAssignments(enrichedAssignments);
      }
      setLoadingProgress({ current: 6, total: 7, label: 'Loading exams...' });

      if (!examsResult.error && examsResult.data) {
        const examIds = examsResult.data.map(e => e.exam_id).filter(id => id);
        let examMap = {};
        if (examIds.length > 0) {
          const { data: examDetails } = await supabase
            .from('examinations')
            .select('id, title, total_marks, exam_type, start_time, end_time, course_id')
            .in('id', examIds);
            
          if (examDetails) {
            const examCourseIds = examDetails.map(e => e.course_id).filter(id => id);
            let examCourseMap = {};
            if (examCourseIds.length > 0) {
              const { data: examCourseDetails } = await supabase
                .from('courses')
                .select('id, course_code, course_name')
                .in('id', examCourseIds);
                
              if (examCourseDetails) {
                examCourseMap = examCourseDetails.reduce((acc, c) => {
                  acc[c.id] = c;
                  return acc;
                }, {});
              }
            }
            
            examMap = examDetails.reduce((acc, e) => {
              acc[e.id] = {
                ...e,
                courses: examCourseMap[e.course_id] || null
              };
              return acc;
            }, {});
          }
        }
        
        const enrichedExams = examsResult.data.map(e => ({
          ...e,
          examinations: examMap[e.exam_id] || null
        }));
        setStudentExams(enrichedExams);
      }
      setLoadingProgress({ current: 7, total: 7, label: 'Loading financial records...' });

      if (!financialResult.error && financialResult.data) {
        setStudentFinancials(financialResult.data);
      }

      setLoadingProgress({ current: 7, total: 7, label: 'Calculating CGPA...' });
      const cgpa = await calculateStudentCGPA(student.id);
      setStudentCGPA(cgpa);

      setLoadingProgress({ current: 7, total: 7, label: '✅ Done!' });
      
      setDataLoaded(true);
      setLoadingDetails(false);
      
    } catch (error) {
      console.error('Error fetching student details:', error);
      alert('Failed to load student details: ' + error.message);
      setLoadingDetails(false);
      setShowStudentModal(false);
    }
  }, [calculateStudentCGPA]);

  // Calculate student statistics
  const calculateStudentStats = () => {
    const courses = studentCourses || [];
    const totalCourses = courses.length;
    const completed = courses.filter(c => c.status === 'completed' || c.status === 'passed').length;
    const inProgress = courses.filter(c => c.status === 'in_progress').length;
    const failed = courses.filter(c => c.status === 'failed').length;
    const dropped = courses.filter(c => c.status === 'dropped').length;
    
    const totalMarks = courses.reduce((sum, c) => sum + (c.marks || 0), 0);
    const avgMarks = totalCourses > 0 ? (totalMarks / totalCourses).toFixed(1) : '0.0';
    
    const attendanceRecords = studentAttendance || [];
    const present = attendanceRecords.filter(a => a.status === 'present').length;
    const total = attendanceRecords.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    
    return {
      totalCourses,
      completed,
      inProgress,
      failed,
      dropped,
      avgMarks,
      cgpa: studentCGPA.toFixed(2),
      attendanceRate,
      totalAttendance: total,
    };
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    const colors = {
      'active': 'active',
      'inactive': 'inactive',
      'suspended': 'suspended',
      'graduated': 'graduated',
      'pending': 'pending',
      'enrolled': 'enrolled',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'dropped': 'dropped',
      'failed': 'failed',
      'submitted': 'submitted',
      'graded': 'graded',
      'returned': 'returned',
      'present': 'present',
      'absent': 'absent',
      'late': 'late',
      'excused': 'excused',
      'medical': 'medical',
      'paid': 'paid',
      'overdue': 'overdue',
    };
    return colors[status] || 'active';
  };

  // Get grade color
  const getGradeColor = (grade) => {
    if (!grade) return '#999';
    const grades = {
      'A': '#2e7d32',
      'A+': '#2e7d32',
      'B+': '#2e7d32',
      'B': '#ed6c02',
      'C+': '#ed6c02',
      'C': '#ed6c02',
      'D+': '#d32f2f',
      'D': '#d32f2f',
      'F': '#d32f2f',
    };
    return grades[grade] || '#999';
  };

  // Render student details modal
  const renderStudentModal = () => {
    if (!showStudentModal || !selectedStudent) return null;
    
    const stats = calculateStudentStats();
    const isLoading = loadingDetails;
    
    return (
      <div className="hod-modal-overlay" onClick={() => !isLoading && setShowStudentModal(false)}>
        <div className="hod-modal large-modal" onClick={(e) => e.stopPropagation()}>
          <div className="hod-modal-header">
            <div>
              <h3>Student Details</h3>
              <p>{selectedStudent.full_name} ({selectedStudent.student_id})</p>
            </div>
            <button className="hod-modal-close" onClick={() => !isLoading && setShowStudentModal(false)}>✕</button>
          </div>
          
          <div className="hod-modal-body">
            {isLoading ? (
              <div className="hod-loading-content">
                <div className="hod-spinner"></div>
                <div className="hod-loading-progress">
                  <div className="hod-progress-bar">
                    <div 
                      className="hod-progress-fill" 
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="hod-loading-label">{loadingProgress.label}</p>
                  <p className="hod-loading-percent">
                    {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Student Info */}
                <div className="hod-student-profile">
                  <div className="hod-student-avatar-large">
                    {selectedStudent.profile_picture_url ? (
                      <img src={selectedStudent.profile_picture_url} alt={selectedStudent.full_name} />
                    ) : (
                      <span>{selectedStudent.full_name?.[0]?.toUpperCase() || '👤'}</span>
                    )}
                  </div>
                  <div className="hod-student-info">
                    <h4>{selectedStudent.full_name}</h4>
                    <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                    <p><strong>Email:</strong> {selectedStudent.email}</p>
                    <p><strong>Program:</strong> {selectedStudent.program || 'N/A'}</p>
                    <p><strong>Department:</strong> {selectedStudent.department_code || 'N/A'}</p>
                    <p><strong>Year:</strong> {selectedStudent.year_of_study || 'N/A'} | <strong>Semester:</strong> {selectedStudent.semester || 'N/A'}</p>
                    <p>
                      <strong>Status:</strong> 
                      <span className={`hod-status-badge ${getStatusBadge(selectedStudent.status)}`}>
                        {selectedStudent.status || 'Active'}
                      </span>
                    </p>
                  </div>
               
                </div>

                {/* Statistics Cards */}
                <div className="hod-student-stats">
                  <div className="stat-item">
                    <div className="stat-value">{stats.totalCourses}</div>
                    <div className="stat-label">Total Courses</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{stats.completed}</div>
                    <div className="stat-label">Completed</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{stats.avgMarks}</div>
                    <div className="stat-label">Avg Marks</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{stats.cgpa}</div>
                    <div className="stat-label">CGPA</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{stats.attendanceRate}%</div>
                    <div className="stat-label">Attendance Rate</div>
                  </div>
                </div>

                {/* Courses */}
                <div className="hod-student-section">
                  <h4>📚 Courses ({studentCourses.length})</h4>
                  <div className="hod-sub-table-container">
                    <table className="hod-sub-table">
                      <thead>
                        <tr>
                          <th>Course Code</th>
                          <th>Course Name</th>
                          <th>Status</th>
                          <th>Marks</th>
                          <th>Grade</th>
                          <th>GP</th>
                          <th>Attendance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentCourses.length === 0 ? (
                          <tr><td colSpan="7" className="hod-empty-cell">No courses enrolled</td></tr>
                        ) : (
                          studentCourses.map((c) => (
                            <tr key={c.id}>
                              <td><strong>{c.courses?.course_code || 'N/A'}</strong></td>
                              <td>{c.courses?.course_name || 'N/A'}</td>
                              <td>
                                <span className={`hod-status-badge ${getStatusBadge(c.status)}`}>
                                  {c.status || 'Enrolled'}
                                </span>
                              </td>
                              <td>{c.marks || '-'}</td>
                              <td style={{ color: getGradeColor(c.grade), fontWeight: 'bold' }}>
                                {c.grade || '-'}
                              </td>
                              <td>{c.grade_points || '-'}</td>
                              <td>{c.attendance_percentage || 0}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Attendance */}
                <div className="hod-student-section">
                  <h4>📅 Attendance Records ({studentAttendance.length})</h4>
                  <div className="hod-sub-table-container">
                    <table className="hod-sub-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Course</th>
                          <th>Status</th>
                          <th>Check In</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentAttendance.length === 0 ? (
                          <tr><td colSpan="5" className="hod-empty-cell">No attendance records</td></tr>
                        ) : (
                          studentAttendance.slice(0, 20).map((a) => (
                            <tr key={a.id}>
                              <td>{new Date(a.date).toLocaleDateString()}</td>
                              <td>{a.courses?.course_code || 'N/A'}</td>
                              <td>
                                <span className={`hod-status-badge ${getStatusBadge(a.status)}`}>
                                  {a.status || 'Absent'}
                                </span>
                              </td>
                              <td>{a.check_in_time || '-'}</td>
                              <td>{a.notes || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Assignments */}
                <div className="hod-student-section">
                  <h4>📝 Assignments ({studentAssignments.length})</h4>
                  <div className="hod-sub-table-container">
                    <table className="hod-sub-table">
                      <thead>
                        <tr>
                          <th>Assignment</th>
                          <th>Course</th>
                          <th>Submitted</th>
                          <th>Marks</th>
                          <th>Status</th>
                          <th>Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentAssignments.length === 0 ? (
                          <tr><td colSpan="6" className="hod-empty-cell">No assignments submitted</td></tr>
                        ) : (
                          studentAssignments.slice(0, 20).map((a) => (
                            <tr key={a.id}>
                              <td>{a.assignments?.title || 'N/A'}</td>
                              <td>{a.assignments?.courses?.course_code || 'N/A'}</td>
                              <td>{a.submission_date ? new Date(a.submission_date).toLocaleDateString() : '-'}</td>
                              <td>{a.marks_obtained !== null ? `${a.marks_obtained}/${a.assignments?.total_marks || '?'}` : '-'}</td>
                              <td>
                                <span className={`hod-status-badge ${getStatusBadge(a.status)}`}>
                                  {a.status || 'Submitted'}
                                </span>
                              </td>
                              <td>{a.feedback || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Exams */}
                <div className="hod-student-section">
                  <h4>🎯 Exams ({studentExams.length})</h4>
                  <div className="hod-sub-table-container">
                    <table className="hod-sub-table">
                      <thead>
                        <tr>
                          <th>Exam</th>
                          <th>Course</th>
                          <th>Type</th>
                          <th>Marks</th>
                          <th>Grade</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentExams.length === 0 ? (
                          <tr><td colSpan="6" className="hod-empty-cell">No exams taken</td></tr>
                        ) : (
                          studentExams.slice(0, 20).map((e) => (
                            <tr key={e.id}>
                              <td>{e.examinations?.title || 'N/A'}</td>
                              <td>{e.examinations?.courses?.course_code || 'N/A'}</td>
                              <td>{e.examinations?.exam_type || 'N/A'}</td>
                              <td>{e.total_marks_obtained !== null ? `${e.total_marks_obtained}/${e.examinations?.total_marks || '?'}` : '-'}</td>
                              <td style={{ color: getGradeColor(e.grade), fontWeight: 'bold' }}>
                                {e.grade || '-'}
                              </td>
                              <td>
                                <span className={`hod-status-badge ${getStatusBadge(e.status)}`}>
                                  {e.status || 'Submitted'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Records */}
                <div className="hod-student-section">
                  <h4>💰 Financial Records ({studentFinancials.length})</h4>
                  <div className="hod-sub-table-container">
                    <table className="hod-sub-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentFinancials.length === 0 ? (
                          <tr><td colSpan="5" className="hod-empty-cell">No financial records</td></tr>
                        ) : (
                          studentFinancials.map((f) => (
                            <tr key={f.id}>
                              <td>{f.payment_date ? new Date(f.payment_date).toLocaleDateString() : new Date(f.created_at).toLocaleDateString()}</td>
                              <td>{f.description}</td>
                              <td>${f.amount?.toFixed(2) || '0.00'}</td>
                              <td>
                                <span className={`hod-status-badge ${getStatusBadge(f.status)}`}>
                                  {f.status || 'Pending'}
                                </span>
                              </td>
                              <td>{f.receipt_number || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="hod-modal-footer">
            <button className="hod-cancel-btn" onClick={() => !isLoading && setShowStudentModal(false)}>
              Close
            </button>
            {selectedStudent && !isLoading && (
              <>
                <button 
                  className="hod-chat-btn"
                  onClick={() => {
                    setShowStudentModal(false);
                    openChatWithUser({
                      email: selectedStudent.email,
                      full_name: selectedStudent.full_name,
                      display_name: selectedStudent.full_name,
                      id: selectedStudent.id,
                    }, 'student');
                  }}
                >
                  💬 Message Student
                </button>
                <button 
                  className="hod-export-btn"
                  onClick={exportStudentToPDF}
                  disabled={exporting}
                >
                  {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="hod-students-container">
      <div className="hod-students-header">
        <div>
          <h2>👥 Student Management</h2>
          <p>View and manage all students in your department</p>
        </div>
        <div className="hod-students-actions">
          <input
            type="text"
            placeholder="Search students by name, ID, email..."
            className="hod-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="hod-refresh-btn" onClick={fetchHODData} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="hod-students-stats">
        <div className="hod-stat-card">
          <span className="hod-stat-icon">👥</span>
          <div className="hod-stat-value">{students.length}</div>
          <div className="hod-stat-label">Total Students</div>
        </div>
        <div className="hod-stat-card">
          <span className="hod-stat-icon">✅</span>
          <div className="hod-stat-value">{students.filter(s => s.status === 'active').length}</div>
          <div className="hod-stat-label">Active Students</div>
        </div>
        <div className="hod-stat-card">
          <span className="hod-stat-icon">📚</span>
          <div className="hod-stat-value">{new Set(students.map(s => s.program)).size}</div>
          <div className="hod-stat-label">Programs</div>
        </div>
        <div className="hod-stat-card">
          <span className="hod-stat-icon">🎓</span>
          <div className="hod-stat-value">{students.filter(s => s.year_of_study >= 4).length}</div>
          <div className="hod-stat-label">Final Year Students</div>
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="hod-loading-content">
          <div className="hod-spinner"></div>
          <p>Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="hod-empty-state">
          <span className="hod-empty-icon">👥</span>
          <h3>No Students Found</h3>
          <p>{searchTerm ? 'No students match your search criteria.' : 'No students in this department yet.'}</p>
        </div>
      ) : (
        <div className="hod-students-table-container">
          <table className="hod-students-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Program</th>
                <th>Year</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="hod-student-avatar">
                      {student.profile_picture_url ? (
                        <img src={student.profile_picture_url} alt={student.full_name} />
                      ) : (
                        <span>{student.full_name?.[0]?.toUpperCase() || '👤'}</span>
                      )}
                    </div>
                  </td>
                  <td><strong>{student.student_id}</strong></td>
                  <td>{student.full_name}</td>
                  <td>{student.email}</td>
                  <td>{student.program || 'N/A'}</td>
                  <td>Y{student.year_of_study || '?'} S{student.semester || '?'}</td>
                  <td>
                    <span className={`hod-status-badge ${getStatusBadge(student.status)}`}>
                      {student.status || 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="hod-action-buttons">
                      <button 
                        className="hod-action-btn view"
                        onClick={() => fetchStudentDetails(student)}
                      >
                        👁️ View
                      </button>
                      <button 
                        className="hod-action-btn message"
                        onClick={() => openChatWithUser({
                          email: student.email,
                          full_name: student.full_name,
                          display_name: student.full_name,
                          id: student.id,
                        }, 'student')}
                      >
                        💬 Message
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Details Modal */}
      {renderStudentModal()}
    </div>
  );
};

export default HODStudents;