// hooks/useNotifications.js - COMPLETE WITH ALL MODULES
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

export const useNotifications = ({ 
  userEmail, 
  userId, 
  departments, 
  facultyId,
  isMounted 
}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState([]);
  
  // Track read budget notifications in localStorage for persistence
  const [readBudgetIds, setReadBudgetIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_budget_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read disciplinary notification IDs
  const [readDisciplinaryIds, setReadDisciplinaryIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_disciplinary_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read admission notification IDs
  const [readAdmissionIds, setReadAdmissionIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_admission_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read QA notification IDs
  const [readQAIds, setReadQAIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_qa_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Curriculum notification IDs
  const [readCurriculumIds, setReadCurriculumIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_curriculum_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Appraisals notification IDs
  const [readAppraisalIds, setReadAppraisalIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_appraisal_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Exam Results notification IDs
  const [readExamResultIds, setReadExamResultIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_exam_result_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Appeals notification IDs
  const [readAppealIds, setReadAppealIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_appeal_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Course Allocation notification IDs
  const [readAllocationIds, setReadAllocationIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_allocation_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track read Leave Approval notification IDs
  const [readLeaveApprovalIds, setReadLeaveApprovalIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_leave_approval_notifications_${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const intervalRef = useRef(null);

  // ===== SAVE ALL READ IDS TO LOCALSTORAGE =====
  useEffect(() => {
    try {
      localStorage.setItem(`read_budget_notifications_${userId}`, JSON.stringify([...readBudgetIds]));
    } catch (e) {}
  }, [readBudgetIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_disciplinary_notifications_${userId}`, JSON.stringify([...readDisciplinaryIds]));
    } catch (e) {}
  }, [readDisciplinaryIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_admission_notifications_${userId}`, JSON.stringify([...readAdmissionIds]));
    } catch (e) {}
  }, [readAdmissionIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_qa_notifications_${userId}`, JSON.stringify([...readQAIds]));
    } catch (e) {}
  }, [readQAIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_curriculum_notifications_${userId}`, JSON.stringify([...readCurriculumIds]));
    } catch (e) {}
  }, [readCurriculumIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_appraisal_notifications_${userId}`, JSON.stringify([...readAppraisalIds]));
    } catch (e) {}
  }, [readAppraisalIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_exam_result_notifications_${userId}`, JSON.stringify([...readExamResultIds]));
    } catch (e) {}
  }, [readExamResultIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_appeal_notifications_${userId}`, JSON.stringify([...readAppealIds]));
    } catch (e) {}
  }, [readAppealIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_allocation_notifications_${userId}`, JSON.stringify([...readAllocationIds]));
    } catch (e) {}
  }, [readAllocationIds, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(`read_leave_approval_notifications_${userId}`, JSON.stringify([...readLeaveApprovalIds]));
    } catch (e) {}
  }, [readLeaveApprovalIds, userId]);

  // ===== FETCH PENDING LEAVE REQUESTS =====
  const fetchPendingLeaveRequests = useCallback(async () => {
    if (!facultyId || !isMounted) return;

    try {
      const { data: depts, error: deptsError } = await supabase
        .from('departments')
        .select('department_code')
        .eq('faculty_id', facultyId);

      if (deptsError) {
        console.error('Error fetching departments for leave:', deptsError);
        return;
      }

      const deptCodes = (depts || []).map((d) => d.department_code).filter(Boolean);
      if (deptCodes.length === 0) return;

      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          id,
          lecturer_id,
          lecturer_name,
          lecturer_email,
          department_code,
          leave_type,
          start_date,
          end_date,
          days,
          reason,
          status,
          created_at,
          lecturer:lecturer_id (full_name, email)
        `)
        .in('department_code', deptCodes)
        .eq('status', 'approved_by_hod')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Leave fetch error:', error);
        return;
      }

      if (!isMounted) return;
      setPendingLeaveRequests(data || []);

      const leaveNotifications = (data || []).map(request => ({
        id: `leave-${request.id}`,
        type: 'leave_pending',
        title: `📋 Leave Request Awaiting Approval`,
        message: `${request.lecturer_name || request.lecturer?.full_name || 'A lecturer'} requested ${request.days} day(s) of ${request.leave_type} leave`,
        is_read: false,
        created_at: request.created_at,
        sender_email: request.lecturer_email,
        sender_name: request.lecturer_name || request.lecturer?.full_name,
        sender_role: 'lecturer',
        metadata: {
          leave_id: request.id,
          department_code: request.department_code,
          days: request.days,
          leave_type: request.leave_type,
          status: request.status
        }
      }));

      if (isMounted) {
        setNotifications(prev => {
          const chatNotifs = prev.filter(n => n.id?.startsWith('chat-'));
          const budgetNotifs = prev.filter(n => n.id?.startsWith('budget-'));
          const disciplinaryNotifs = prev.filter(n => n.id?.startsWith('disciplinary-'));
          const admissionNotifs = prev.filter(n => n.id?.startsWith('admission-'));
          const qaNotifs = prev.filter(n => n.id?.startsWith('qa-'));
          const curriculumNotifs = prev.filter(n => n.id?.startsWith('curriculum-'));
          const appraisalNotifs = prev.filter(n => n.id?.startsWith('appraisal-'));
          const examResultNotifs = prev.filter(n => n.id?.startsWith('examresult-'));
          const appealNotifs = prev.filter(n => n.id?.startsWith('appeal-'));
          const allocationNotifs = prev.filter(n => n.id?.startsWith('allocation-'));
          const leaveApprovalNotifs = prev.filter(n => n.id?.startsWith('leaveapproval-'));
          const existingLeaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
          const existingLeaveMap = {};
          existingLeaveNotifs.forEach(n => {
            existingLeaveMap[n.id] = n.is_read;
          });
          
          const mergedLeaveNotifs = leaveNotifications.map(n => ({
            ...n,
            is_read: existingLeaveMap[n.id] !== undefined ? existingLeaveMap[n.id] : false
          }));
          
          const all = [...chatNotifs, ...budgetNotifs, ...disciplinaryNotifs, ...admissionNotifs, ...qaNotifs, ...curriculumNotifs, ...appraisalNotifs, ...examResultNotifs, ...appealNotifs, ...allocationNotifs, ...leaveApprovalNotifs, ...mergedLeaveNotifs];
          return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
      }

    } catch (err) {
      console.error('Error fetching pending leave requests:', err);
    }
  }, [facultyId, isMounted]);

  // ===== FETCH CHAT NOTIFICATIONS =====
  const fetchChatNotifications = useCallback(async () => {
    if (!userEmail || !isMounted) return [];
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('receiver_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching chat notifications:', error);
        return [];
      }

      return (data || []).map(msg => ({
        id: `chat-${msg.id}`,
        type: 'message',
        title: `💬 Message from ${msg.sender_name || msg.sender_role || 'Someone'}`,
        message: msg.message,
        is_read: msg.is_read || false,
        created_at: msg.created_at,
        sender_email: msg.sender_email,
        sender_name: msg.sender_name,
        sender_role: msg.sender_role,
        metadata: {
          chat_id: msg.id,
          ...(msg.metadata || {})
        }
      }));

    } catch (err) {
      console.error('Error fetching chat notifications:', err);
      return [];
    }
  }, [userEmail, isMounted]);

  // ===== FETCH BUDGET NOTIFICATIONS =====
  const fetchBudgetNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('budget_requests')
        .select('*')
        .in('department_code', deptCodes)
        .eq('faculty_status', 'pending_dean')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching budget requests:', error);
        return [];
      }

      return (data || [])
        .filter(request => {
          const notifId = `budget-${request.id}`;
          return !readBudgetIds.has(notifId);
        })
        .map(request => ({
          id: `budget-${request.id}`,
          type: 'budget_request',
          title: `💰 Budget Request: ${request.title}`,
          message: `${request.department_code} - $${request.amount.toLocaleString()} (${request.category})`,
          is_read: false,
          created_at: request.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            request_id: request.id,
            department_code: request.department_code,
            amount: request.amount,
            title: request.title,
            category: request.category,
            priority: request.priority,
            type: 'budget_request'
          }
        }));

    } catch (err) {
      console.error('Error fetching budget notifications:', err);
      return [];
    }
  }, [departments, readBudgetIds, isMounted]);

  // ===== FETCH DISCIPLINARY NOTIFICATIONS =====
  const fetchDisciplinaryNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('disciplinary_cases')
        .select('*')
        .in('department_code', deptCodes)
        .in('status', ['pending', 'investigating', 'hearing_scheduled', 'pending_decision'])
        .order('reported_at', { ascending: false });

      if (error) {
        console.error('Error fetching disciplinary cases:', error);
        return [];
      }

      return (data || [])
        .filter(caseItem => {
          const notifId = `disciplinary-${caseItem.id}`;
          return !readDisciplinaryIds.has(notifId);
        })
        .map(caseItem => ({
          id: `disciplinary-${caseItem.id}`,
          type: 'disciplinary_case',
          title: `⚖️ ${caseItem.status === 'hearing_scheduled' ? 'Hearing Scheduled' : 'New Disciplinary Case'}`,
          message: `${caseItem.case_number}: ${caseItem.title} - ${caseItem.respondent_name} (${caseItem.department_code})`,
          is_read: false,
          created_at: caseItem.reported_at || caseItem.created_at,
          sender_email: 'system',
          sender_name: 'System',
          sender_role: 'system',
          metadata: {
            case_id: caseItem.id,
            case_number: caseItem.case_number,
            department_code: caseItem.department_code,
            status: caseItem.status,
            title: caseItem.title,
            respondent_name: caseItem.respondent_name,
            type: 'disciplinary_case'
          }
        }));

    } catch (err) {
      console.error('Error fetching disciplinary notifications:', err);
      return [];
    }
  }, [departments, readDisciplinaryIds, isMounted]);

  // ===== FETCH ADMISSIONS NOTIFICATIONS =====
  const fetchAdmissionsNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('department_code', deptCodes)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admissions:', error);
        return [];
      }

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      return (data || [])
        .filter(student => {
          const notifId = `admission-${student.id}`;
          if (readAdmissionIds.has(notifId)) return false;
          return new Date(student.created_at) > oneWeekAgo;
        })
        .map(student => ({
          id: `admission-${student.id}`,
          type: 'admission',
          title: `🎓 New Student Admitted`,
          message: `${student.full_name} (${student.student_id}) - ${student.program || 'N/A'}`,
          is_read: false,
          created_at: student.created_at,
          sender_email: 'system',
          sender_name: 'Admissions Office',
          sender_role: 'system',
          metadata: {
            student_id: student.id,
            student_name: student.full_name,
            student_number: student.student_id,
            department: student.department_code,
            program: student.program,
            type: 'admission'
          }
        }));

    } catch (err) {
      console.error('Error fetching admissions notifications:', err);
      return [];
    }
  }, [departments, readAdmissionIds, isMounted]);

  // ===== FETCH QA NOTIFICATIONS =====
  const fetchQANotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('qa_checklists')
        .select('*')
        .in('department_code', deptCodes)
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching QA checklists:', error);
        return [];
      }

      return (data || [])
        .filter(checklist => {
          const notifId = `qa-${checklist.id}`;
          return !readQAIds.has(notifId);
        })
        .map(checklist => ({
          id: `qa-${checklist.id}`,
          type: 'qa',
          title: `📋 QA Checklist: ${checklist.title}`,
          message: `${checklist.department_code} - ${checklist.checklist_type} (${checklist.academic_year})`,
          is_read: false,
          created_at: checklist.submitted_at || checklist.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            checklist_id: checklist.id,
            department_code: checklist.department_code,
            title: checklist.title,
            type: checklist.checklist_type,
            status: checklist.status,
            academic_year: checklist.academic_year,
            semester: checklist.semester,
            type: 'qa'
          }
        }));

    } catch (err) {
      console.error('Error fetching QA notifications:', err);
      return [];
    }
  }, [departments, readQAIds, isMounted]);

  // ===== FETCH CURRICULUM NOTIFICATIONS =====
  const fetchCurriculumNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('curriculum_changes')
        .select('*')
        .in('department_code', deptCodes)
        .in('status', ['pending', 'pending_dean', 'pending_hod'])
        .order('proposed_at', { ascending: false });

      if (error) {
        console.error('Error fetching curriculum changes:', error);
        return [];
      }

      return (data || [])
        .filter(change => {
          const notifId = `curriculum-${change.id}`;
          return !readCurriculumIds.has(notifId);
        })
        .map(change => ({
          id: `curriculum-${change.id}`,
          type: 'curriculum',
          title: `📋 Curriculum Change: ${change.title}`,
          message: `${change.department_code} - ${change.change_type} (${change.status})`,
          is_read: false,
          created_at: change.proposed_at || change.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            change_id: change.id,
            department_code: change.department_code,
            title: change.title,
            type: change.change_type,
            status: change.status,
            proposed_by: change.proposed_by,
            type: 'curriculum'
          }
        }));

    } catch (err) {
      console.error('Error fetching curriculum notifications:', err);
      return [];
    }
  }, [departments, readCurriculumIds, isMounted]);

  // ===== FETCH APPRAISALS NOTIFICATIONS =====
  const fetchAppraisalsNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('staff_appraisals')
        .select('*')
        .in('department_code', deptCodes)
        .in('status', ['completed', 'pending_dean'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching appraisals:', error);
        return [];
      }

      return (data || [])
        .filter(appraisal => {
          const notifId = `appraisal-${appraisal.id}`;
          return !readAppraisalIds.has(notifId);
        })
        .map(appraisal => ({
          id: `appraisal-${appraisal.id}`,
          type: 'appraisal',
          title: `⭐ Staff Appraisal: ${appraisal.lecturer_name || 'Staff Member'}`,
          message: `${appraisal.department_code} - Rating: ${appraisal.rating}/5 (${appraisal.appraisal_period})`,
          is_read: false,
          created_at: appraisal.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            appraisal_id: appraisal.id,
            department_code: appraisal.department_code,
            lecturer_name: appraisal.lecturer_name,
            rating: appraisal.rating,
            period: appraisal.appraisal_period,
            status: appraisal.status,
            type: 'appraisal'
          }
        }));

    } catch (err) {
      console.error('Error fetching appraisal notifications:', err);
      return [];
    }
  }, [departments, readAppraisalIds, isMounted]);

  // ===== FETCH EXAM RESULTS NOTIFICATIONS =====
  const fetchExamResultsNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const [examResults, assignmentResults] = await Promise.all([
        supabase
          .from('exam_results_approvals')
          .select('*')
          .in('department_code', deptCodes)
          .eq('status', 'approved_by_hod')
          .order('created_at', { ascending: false }),
        supabase
          .from('assignment_results_approvals')
          .select('*')
          .in('department_code', deptCodes)
          .eq('status', 'approved_by_hod')
          .order('created_at', { ascending: false })
      ]);

      const combined = [...(examResults.data || []), ...(assignmentResults.data || [])];

      return combined
        .filter(result => {
          const notifId = `examresult-${result.id}`;
          return !readExamResultIds.has(notifId);
        })
        .map(result => {
          const isExam = !!result.exam_id;
          const typeLabel = isExam ? '📋 Exam' : '📝 Assignment';
          const title = isExam ? result.exam_title : result.assignment_title;
          
          return {
            id: `examresult-${result.id}`,
            type: 'exam_result',
            title: `${typeLabel} Results Ready for Approval`,
            message: `${title || 'Results'} - ${result.course_code || 'N/A'} (${result.department_code})`,
            is_read: false,
            created_at: result.created_at,
            sender_email: 'system',
            sender_name: 'HOD',
            sender_role: 'hod',
            metadata: {
              result_id: result.id,
              department_code: result.department_code,
              course_code: result.course_code,
              type: isExam ? 'exam' : 'assignment',
              status: result.status,
              total_students: result.total_students || 0,
              graded_students: result.graded_students || 0,
              average_score: result.average_score || 0,
              type: 'exam_result'
            }
          };
        });

    } catch (err) {
      console.error('Error fetching exam results notifications:', err);
      return [];
    }
  }, [departments, readExamResultIds, isMounted]);

  // ===== FETCH APPEALS NOTIFICATIONS =====
  const fetchAppealsNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('student_complaints')
        .select(`
          *,
          students:student_id (
            id,
            full_name,
            student_id,
            email,
            program_code,
            year_of_study
          )
        `)
        .in('department_code', deptCodes)
        .eq('status', 'escalated')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching appeals:', error);
        return [];
      }

      return (data || [])
        .filter(appeal => {
          const notifId = `appeal-${appeal.id}`;
          return !readAppealIds.has(notifId);
        })
        .map(appeal => ({
          id: `appeal-${appeal.id}`,
          type: 'appeal',
          title: `💬 Appeal from ${appeal.students?.full_name || 'Student'}`,
          message: `${appeal.title} - ${appeal.department_code} (${appeal.category})`,
          is_read: false,
          created_at: appeal.created_at,
          sender_email: appeal.students?.email || 'system',
          sender_name: appeal.students?.full_name || 'Student',
          sender_role: 'student',
          metadata: {
            appeal_id: appeal.id,
            department_code: appeal.department_code,
            title: appeal.title,
            category: appeal.category,
            status: appeal.status,
            student_name: appeal.students?.full_name,
            student_id: appeal.students?.student_id,
            type: 'appeal'
          }
        }));

    } catch (err) {
      console.error('Error fetching appeals notifications:', err);
      return [];
    }
  }, [departments, readAppealIds, isMounted]);

  // ===== FETCH COURSE ALLOCATIONS NOTIFICATIONS =====
  const fetchAllocationNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('course_allocations')
        .select(`
          *,
          courses:course_id (course_code, course_name),
          lecturers:lecturer_id (full_name, email)
        `)
        .in('department_code', deptCodes)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching course allocations:', error);
        return [];
      }

      return (data || [])
        .filter(allocation => {
          const notifId = `allocation-${allocation.id}`;
          return !readAllocationIds.has(notifId);
        })
        .map(allocation => ({
          id: `allocation-${allocation.id}`,
          type: 'course_allocation',
          title: `📚 Course Allocation: ${allocation.courses?.course_code || 'N/A'}`,
          message: `${allocation.courses?.course_name || 'Course'} → ${allocation.lecturers?.full_name || 'Unknown Lecturer'}`,
          is_read: false,
          created_at: allocation.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            allocation_id: allocation.id,
            course_code: allocation.courses?.course_code,
            course_name: allocation.courses?.course_name,
            lecturer_name: allocation.lecturers?.full_name,
            department_code: allocation.department_code,
            type: 'course_allocation'
          }
        }));

    } catch (err) {
      console.error('Error fetching allocation notifications:', err);
      return [];
    }
  }, [departments, readAllocationIds, isMounted]);

  // ===== FETCH LEAVE APPROVALS NOTIFICATIONS =====
  const fetchLeaveApprovalNotifications = useCallback(async () => {
    if (!departments || departments.length === 0 || !isMounted) return [];

    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    if (deptCodes.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select(`
          *,
          lecturer:lecturer_id (full_name, email)
        `)
        .in('department_code', deptCodes)
        .eq('status', 'approved_by_hod')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave approvals:', error);
        return [];
      }

      return (data || [])
        .filter(request => {
          const notifId = `leaveapproval-${request.id}`;
          return !readLeaveApprovalIds.has(notifId);
        })
        .map(request => ({
          id: `leaveapproval-${request.id}`,
          type: 'leave_approval',
          title: `📝 Leave Request: ${request.lecturer?.full_name || 'Staff'}`,
          message: `${request.leave_type} - ${request.days} days (${request.department_code})`,
          is_read: false,
          created_at: request.created_at,
          sender_email: 'system',
          sender_name: 'HOD',
          sender_role: 'hod',
          metadata: {
            leave_id: request.id,
            lecturer_name: request.lecturer?.full_name,
            leave_type: request.leave_type,
            days: request.days,
            department_code: request.department_code,
            start_date: request.start_date,
            end_date: request.end_date,
            type: 'leave_approval'
          }
        }));

    } catch (err) {
      console.error('Error fetching leave approval notifications:', err);
      return [];
    }
  }, [departments, readLeaveApprovalIds, isMounted]);

  // ===== FETCH ALL NOTIFICATIONS =====
  const fetchAllNotifications = useCallback(async () => {
    if (!isMounted) return;
    
    console.log('🔔 Fetching all notifications...');
    
    const [chatNotifications, budgetNotifications, disciplinaryNotifications, admissionNotifications, qaNotifications, curriculumNotifications, appraisalNotifications, examResultNotifications, appealNotifications, allocationNotifications, leaveApprovalNotifications] = await Promise.all([
      fetchChatNotifications(),
      fetchBudgetNotifications(),
      fetchDisciplinaryNotifications(),
      fetchAdmissionsNotifications(),
      fetchQANotifications(),
      fetchCurriculumNotifications(),
      fetchAppraisalsNotifications(),
      fetchExamResultsNotifications(),
      fetchAppealsNotifications(),
      fetchAllocationNotifications(),
      fetchLeaveApprovalNotifications()
    ]);

    console.log('💬 Chat notifications:', chatNotifications.length);
    console.log('💰 Budget notifications:', budgetNotifications.length);
    console.log('⚖️ Disciplinary notifications:', disciplinaryNotifications.length);
    console.log('🎓 Admission notifications:', admissionNotifications.length);
    console.log('📋 QA notifications:', qaNotifications.length);
    console.log('📋 Curriculum notifications:', curriculumNotifications.length);
    console.log('⭐ Appraisal notifications:', appraisalNotifications.length);
    console.log('📝 Exam Result notifications:', examResultNotifications.length);
    console.log('💬 Appeal notifications:', appealNotifications.length);
    console.log('📚 Allocation notifications:', allocationNotifications.length);
    console.log('📝 Leave Approval notifications:', leaveApprovalNotifications.length);

    if (isMounted) {
      setNotifications(prev => {
        const leaveNotifs = prev.filter(n => n.id?.startsWith('leave-'));
        const all = [...leaveNotifs, ...chatNotifications, ...budgetNotifications, ...disciplinaryNotifications, ...admissionNotifications, ...qaNotifications, ...curriculumNotifications, ...appraisalNotifications, ...examResultNotifications, ...appealNotifications, ...allocationNotifications, ...leaveApprovalNotifications];
        
        const unique = {};
        all.forEach(n => {
          if (!unique[n.id]) {
            unique[n.id] = n;
          } else {
            if (unique[n.id].is_read === false && n.is_read === true) {
              unique[n.id] = n;
            }
          }
        });
        
        const result = Object.values(unique).sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        
        console.log('📊 Total notifications:', result.length);
        console.log('📊 Unread count:', result.filter(n => !n.is_read).length);
        
        return result;
      });
    }
  }, [fetchChatNotifications, fetchBudgetNotifications, fetchDisciplinaryNotifications, fetchAdmissionsNotifications, fetchQANotifications, fetchCurriculumNotifications, fetchAppraisalsNotifications, fetchExamResultsNotifications, fetchAppealsNotifications, fetchAllocationNotifications, fetchLeaveApprovalNotifications, isMounted]);

  // ===== MARK NOTIFICATION AS READ =====
  const markNotificationRead = useCallback(async (id) => {
    console.log('📌 Marking notification as read:', id);
    
    try {
      if (id?.startsWith('chat-')) {
        const chatId = id.replace('chat-', '');
        await supabase.from('chat_messages').update({ is_read: true }).eq('id', chatId);
        console.log('✅ Chat message marked as read:', chatId);
      }
      
      if (id?.startsWith('budget-')) {
        setReadBudgetIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Budget notification marked as read:', id);
      }
      
      if (id?.startsWith('disciplinary-')) {
        setReadDisciplinaryIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Disciplinary notification marked as read:', id);
      }
      
      if (id?.startsWith('admission-')) {
        setReadAdmissionIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Admission notification marked as read:', id);
      }
      
      if (id?.startsWith('qa-')) {
        setReadQAIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ QA notification marked as read:', id);
      }
      
      if (id?.startsWith('curriculum-')) {
        setReadCurriculumIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Curriculum notification marked as read:', id);
      }
      
      if (id?.startsWith('appraisal-')) {
        setReadAppraisalIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Appraisal notification marked as read:', id);
      }
      
      if (id?.startsWith('examresult-')) {
        setReadExamResultIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Exam Result notification marked as read:', id);
      }
      
      if (id?.startsWith('appeal-')) {
        setReadAppealIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Appeal notification marked as read:', id);
      }
      
      if (id?.startsWith('allocation-')) {
        setReadAllocationIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Allocation notification marked as read:', id);
      }
      
      if (id?.startsWith('leaveapproval-')) {
        setReadLeaveApprovalIds(prev => { const newSet = new Set(prev); newSet.add(id); return newSet; });
        console.log('✅ Leave Approval notification marked as read:', id);
      }
      
      if (isMounted) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
      }
      
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [isMounted]);

  // ===== MARK ALL AS READ =====
  const markAllNotificationsRead = useCallback(async () => {
    console.log('📌 Marking all notifications as read...');
    
    try {
      if (userEmail) {
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .eq('receiver_email', userEmail)
          .eq('is_read', false);
        console.log('✅ All chat messages marked as read');
      }
      
      setNotifications(prev => {
        const budgetIds = prev.filter(n => n.id?.startsWith('budget-') && !n.is_read).map(n => n.id);
        budgetIds.forEach(id => setReadBudgetIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const disciplinaryIds = prev.filter(n => n.id?.startsWith('disciplinary-') && !n.is_read).map(n => n.id);
        disciplinaryIds.forEach(id => setReadDisciplinaryIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const admissionIds = prev.filter(n => n.id?.startsWith('admission-') && !n.is_read).map(n => n.id);
        admissionIds.forEach(id => setReadAdmissionIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const qaIds = prev.filter(n => n.id?.startsWith('qa-') && !n.is_read).map(n => n.id);
        qaIds.forEach(id => setReadQAIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const curriculumIds = prev.filter(n => n.id?.startsWith('curriculum-') && !n.is_read).map(n => n.id);
        curriculumIds.forEach(id => setReadCurriculumIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const appraisalIds = prev.filter(n => n.id?.startsWith('appraisal-') && !n.is_read).map(n => n.id);
        appraisalIds.forEach(id => setReadAppraisalIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const examResultIds = prev.filter(n => n.id?.startsWith('examresult-') && !n.is_read).map(n => n.id);
        examResultIds.forEach(id => setReadExamResultIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const appealIds = prev.filter(n => n.id?.startsWith('appeal-') && !n.is_read).map(n => n.id);
        appealIds.forEach(id => setReadAppealIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const allocationIds = prev.filter(n => n.id?.startsWith('allocation-') && !n.is_read).map(n => n.id);
        allocationIds.forEach(id => setReadAllocationIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        const leaveApprovalIds = prev.filter(n => n.id?.startsWith('leaveapproval-') && !n.is_read).map(n => n.id);
        leaveApprovalIds.forEach(id => setReadLeaveApprovalIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; }));
        
        console.log('✅ All notifications marked as read');
        return prev.map(n => ({ ...n, is_read: true }));
      });
      
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [userEmail]);

  // ===== CLEAR ALL =====
  const clearAllNotifications = useCallback(async () => {
    console.log('📌 Clearing all notifications...');
    
    try {
      if (userEmail) {
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .eq('receiver_email', userEmail)
          .eq('is_read', false);
      }
      
      setNotifications(prev => {
        const allIds = prev.filter(n => !n.id?.startsWith('leave-')).map(n => n.id);
        allIds.forEach(id => {
          if (id?.startsWith('budget-')) setReadBudgetIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('disciplinary-')) setReadDisciplinaryIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('admission-')) setReadAdmissionIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('qa-')) setReadQAIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('curriculum-')) setReadCurriculumIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('appraisal-')) setReadAppraisalIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('examresult-')) setReadExamResultIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('appeal-')) setReadAppealIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('allocation-')) setReadAllocationIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
          else if (id?.startsWith('leaveapproval-')) setReadLeaveApprovalIds(prevSet => { const newSet = new Set(prevSet); newSet.add(id); return newSet; });
        });
        
        return prev.filter(n => n.id?.startsWith('leave-') && !n.is_read);
      });
      
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }, [userEmail]);

  // ===== CALCULATE UNREAD COUNT =====
  useEffect(() => {
    if (isMounted) {
      const unread = notifications.filter(n => n.is_read === false).length;
      setUnreadCount(unread);
      console.log('📊 Unread count updated:', unread);
    }
  }, [notifications, isMounted]);

  // ===== START BACKGROUND POLLING =====
  useEffect(() => {
    if (!isMounted) return;

    fetchAllNotifications();

    intervalRef.current = setInterval(() => {
      if (isMounted) {
        fetchAllNotifications();
      }
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMounted, fetchAllNotifications]);

  return {
    notifications,
    unreadCount,
    pendingLeaveRequests,
    fetchAllNotifications,
    fetchPendingLeaveRequests,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    setNotifications,
    readBudgetIds,
    readDisciplinaryIds,
    readAdmissionIds,
    readQAIds,
    readCurriculumIds,
    readAppraisalIds,
    readExamResultIds,
    readAppealIds,
    readAllocationIds,
    readLeaveApprovalIds
  };
};

export default useNotifications;