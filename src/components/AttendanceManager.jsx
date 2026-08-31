// AttendanceManager.jsx - FIXED VERSION
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';

const AttendanceManager = ({
  profile,
  isLecturer,
  isAdmin,
  departmentCodes,
  allowedDepartments,
  students,
  lectures,
  stats,
  fetchDashboardStats,
  showToast,
}) => {
  // ---------- State ----------
  const [attendanceStudent, setAttendanceStudent] = useState(null);
  const [attendanceCourses, setAttendanceCourses] = useState([]);
  const [loadingAttendanceCourses, setLoadingAttendanceCourses] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceError, setAttendanceError] = useState(null);
  const [timetableDepartments, setTimetableDepartments] = useState([]);
  const [attendanceDepartmentFilter, setAttendanceDepartmentFilter] = useState('');
  const [attendanceStudentSearch, setAttendanceStudentSearch] = useState('');
  const [todayLectures, setTodayLectures] = useState([]);
  const [selectedLectureForAttendance, setSelectedLectureForAttendance] = useState(null);
  const [loadingTodayLectures, setLoadingTodayLectures] = useState(false);
  const [enrolledStudentsForLecture, setEnrolledStudentsForLecture] = useState([]);
  const [attendanceBatchMode, setAttendanceBatchMode] = useState(false);
  const [attendanceBatchStatus, setAttendanceBatchStatus] = useState({});
  const [attendanceNotes, setAttendanceNotes] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // History search state
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyCourseFilter, setHistoryCourseFilter] = useState('');

  const [showAttendanceRecordModal, setShowAttendanceRecordModal] = useState(false);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({
    student_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    notes: '',
    course_id: '',
    lecture_id: '',
  });

  // ---------- Helpers ----------
  const getFilteredStudents = useCallback(
    (searchTerm = '') => {
      let filtered = students || [];

      if (attendanceDepartmentFilter) {
        filtered = filtered.filter((s) => s.department_code === attendanceDepartmentFilter);
      }
      if (isLecturer && departmentCodes.length > 0) {
        filtered = filtered.filter((s) => departmentCodes.includes(s.department_code));
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(
          (s) =>
            (s.full_name && s.full_name.toLowerCase().includes(term)) ||
            (s.student_id && s.student_id.toLowerCase().includes(term))
        );
      }

      return filtered.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
    [students, attendanceDepartmentFilter, isLecturer, departmentCodes]
  );

  // Filter attendance history records
  const filteredAttendanceRecords = useMemo(() => {
    let filtered = attendanceRecords || [];

    if (historySearch.trim()) {
      const term = historySearch.trim().toLowerCase();
      filtered = filtered.filter(
        (record) =>
          (record.students?.full_name && record.students.full_name.toLowerCase().includes(term)) ||
          (record.students?.student_id && record.students.student_id.toLowerCase().includes(term)) ||
          (record.courses?.course_code && record.courses.course_code.toLowerCase().includes(term)) ||
          (record.courses?.course_name && record.courses.course_name.toLowerCase().includes(term))
      );
    }

    if (historyStatusFilter) {
      filtered = filtered.filter((record) => record.status === historyStatusFilter);
    }

    if (historyDateFilter) {
      filtered = filtered.filter((record) => record.date === historyDateFilter);
    }

    if (historyCourseFilter) {
      filtered = filtered.filter(
        (record) => record.courses?.course_code === historyCourseFilter
      );
    }

    return filtered;
  }, [attendanceRecords, historySearch, historyStatusFilter, historyDateFilter, historyCourseFilter]);

  // Get unique courses from records for filter dropdown
  const historyCourses = useMemo(() => {
    const courses = new Map();
    attendanceRecords?.forEach((record) => {
      if (record.courses?.course_code) {
        courses.set(record.courses.course_code, {
          course_code: record.courses.course_code,
          course_name: record.courses.course_name || '',
        });
      }
    });
    return Array.from(courses.values()).sort((a, b) => 
      a.course_code.localeCompare(b.course_code)
    );
  }, [attendanceRecords]);

  // ---------- Utility to get current user ID for recorded_by ----------
  const getCurrentUserId = useCallback(async () => {
    if (isLecturer && profile?.id) {
      const { data: lecturer } = await supabase
        .from('lecturers')
        .select('id')
        .eq('id', profile.id)
        .maybeSingle();
      
      if (lecturer) return lecturer.id;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: lecturerByAuth } = await supabase
          .from('lecturers')
          .select('id')
          .eq('auth_uid', user.id)
          .maybeSingle();
        
        if (lecturerByAuth) return lecturerByAuth.id;
      }
    }
    
    return null;
  }, [isLecturer, profile]);

  // ---------- Utility to get course ID from slot ----------
  const getCourseIdFromSlot = useCallback(async (slot) => {
    if (!slot) return null;
    
    if (slot.course_id) return slot.course_id;
    
    try {
      let query = supabase
        .from('courses')
        .select('id')
        .eq('course_code', slot.course_code);
      
      if (slot.program_code) {
        query = query.eq('program_code', slot.program_code);
      }
      
      const { data: courseData, error: courseError } = await query.maybeSingle();

      if (courseError) throw courseError;
      if (!courseData) {
        const { data: courseData2 } = await supabase
          .from('courses')
          .select('id')
          .eq('course_code', slot.course_code)
          .maybeSingle();
        
        if (courseData2) return courseData2.id;
        throw new Error(`Course ${slot.course_code} not found`);
      }
      
      return courseData.id;
    } catch (err) {
      console.error('Error in getCourseIdFromSlot:', err);
      throw err;
    }
  }, []);

  // ---------- Data fetching ----------
  const fetchAttendanceData = useCallback(async () => {
    try {
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          date,
          status,
          notes,
          check_in_time,
          created_at,
          student_id,
          course_id,
          lecture_id
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (!records || records.length === 0) {
        setAttendanceRecords([]);
        return;
      }

      const studentIds = [...new Set(records.map((r) => r.student_id).filter(Boolean))];
      const courseIds = [...new Set(records.map((r) => r.course_id).filter(Boolean))];

      const [studentsRes, coursesRes] = await Promise.all([
        supabase.from('students').select('id, full_name, student_id, department_code, program_code').in('id', studentIds),
        supabase.from('courses').select('id, course_code, course_name, department_code').in('id', courseIds),
      ]);

      const studentMap = {};
      studentsRes.data?.forEach((s) => (studentMap[s.id] = s));
      const courseMap = {};
      coursesRes.data?.forEach((c) => (courseMap[c.id] = c));

      let combined = records.map((r) => ({
        ...r,
        students: studentMap[r.student_id] || null,
        courses: courseMap[r.course_id] || null,
      }));

      if (attendanceDepartmentFilter) {
        combined = combined.filter((r) => 
          r.students?.department_code === attendanceDepartmentFilter ||
          r.courses?.department_code === attendanceDepartmentFilter
        );
      }
      if (isLecturer && departmentCodes.length > 0) {
        combined = combined.filter((r) => 
          (r.students && departmentCodes.includes(r.students.department_code)) ||
          (r.courses && departmentCodes.includes(r.courses.department_code))
        );
      }

      setAttendanceRecords(combined);
      setAttendanceError(null);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setAttendanceError('Failed to load attendance records');
      setAttendanceRecords([]);
    }
  }, [attendanceDepartmentFilter, isLecturer, departmentCodes]);

  const loadTimetableDepartments = useCallback(async () => {
    try {
      const { data: timetables, error } = await supabase
        .from('program_timetables')
        .select('department_code')
        .eq('is_active', true)
        .not('department_code', 'is', null);

      if (error) throw error;

      const codes = [...new Set((timetables || []).map(t => t.department_code).filter(Boolean))];
      console.log('📂 Available departments:', codes);
      setTimetableDepartments(codes);
    } catch (err) {
      console.error('Error loading timetable departments:', err);
      setTimetableDepartments([]);
    }
  }, []);

  const fetchTodayLectures = useCallback(async () => {
    const dayOfWeek = new Date().getDay();
    setLoadingTodayLectures(true);
    try {
      console.log(`📅 Fetching lectures for day ${dayOfWeek}`);

      let timetableQuery = supabase
        .from('program_timetables')
        .select('id, department_code, program_code, program_id, year_of_study, semester')
        .eq('is_active', true);

      if (attendanceDepartmentFilter) {
        timetableQuery = timetableQuery.eq('department_code', attendanceDepartmentFilter);
      }
      if (isLecturer && departmentCodes.length > 0) {
        timetableQuery = timetableQuery.in('department_code', departmentCodes);
      }

      const { data: timetables, error: timetableError } = await timetableQuery;
      
      if (timetableError) throw timetableError;
      
      if (!timetables || timetables.length === 0) {
        console.log('📭 No timetables found for filter');
        setTodayLectures([]);
        setLoadingTodayLectures(false);
        return;
      }

      const timetableIds = timetables.map(t => t.id);
      const timetableMap = {};
      timetables.forEach(t => {
        timetableMap[t.id] = t;
      });

      const { data: slots, error: slotsError } = await supabase
        .from('program_timetable_slots')
        .select(`
          id,
          course_id,
          course_code,
          course_name,
          start_time,
          end_time,
          room_number,
          building,
          slot_type,
          program_timetable_id,
          lecturer_id
        `)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .in('program_timetable_id', timetableIds);

      if (slotsError) throw slotsError;

      const lecturerIds = [...new Set((slots || []).map(s => s.lecturer_id).filter(Boolean))];
      let lecturerMap = {};
      
      if (lecturerIds.length > 0) {
        const { data: lecturersData } = await supabase
          .from('lecturers')
          .select('id, full_name')
          .in('id', lecturerIds);
        
        lecturersData?.forEach(l => {
          lecturerMap[l.id] = l;
        });
      }

      const enriched = (slots || []).map(slot => {
        const timetable = timetableMap[slot.program_timetable_id] || {};
        return {
          ...slot,
          department_code: timetable.department_code || null,
          program_code: timetable.program_code || null,
          program_id: timetable.program_id || null,
          year_of_study: timetable.year_of_study || null,
          semester: timetable.semester || null,
          lecturers: lecturerMap[slot.lecturer_id] || null,
        };
      });

      setTodayLectures(enriched);
    } catch (err) {
      console.error('Error fetching today lectures:', err);
      showToast('Failed to load lectures: ' + err.message, 'error');
      setTodayLectures([]);
    } finally {
      setLoadingTodayLectures(false);
    }
  }, [attendanceDepartmentFilter, isLecturer, departmentCodes, showToast]);

  const fetchEnrolledStudentsForLecture = useCallback(
    async (slot) => {
      if (!slot) return;
      try {
        const courseId = await getCourseIdFromSlot(slot);
        if (!courseId) {
          showToast('Course not found', 'error');
          setEnrolledStudentsForLecture([]);
          return;
        }

        const { data: studentCourses, error: scError } = await supabase
          .from('student_courses')
          .select('id, student_id, status')
          .eq('course_id', courseId)
          .eq('status', 'enrolled');

        if (scError) throw scError;

        if (!studentCourses || studentCourses.length === 0) {
          setEnrolledStudentsForLecture([]);
          showToast('No enrolled students found for this course', 'info');
          return;
        }

        const studentIds = studentCourses.map((sc) => sc.student_id);
        let studentsQuery = supabase
          .from('students')
          .select('id, full_name, student_id, email, department_code, program_code, year_of_study, semester')
          .in('id', studentIds);

        if (slot.department_code) {
          studentsQuery = studentsQuery.eq('department_code', slot.department_code);
        }

        const { data: studentsData, error: studentsError } = await studentsQuery;

        if (studentsError) throw studentsError;

        const studentMap = {};
        studentsData?.forEach((s) => (studentMap[s.id] = s));

        let enrolled = studentCourses
          .filter((sc) => studentMap[sc.student_id])
          .map((sc) => ({
            ...studentMap[sc.student_id],
            student_course_id: sc.id,
            enrollment_status: sc.status || 'enrolled',
          }));

        setEnrolledStudentsForLecture(enrolled);

        const today = new Date().toISOString().split('T')[0];
        let initialStatus = {};
        let initialNotes = {};

        if (enrolled.length > 0) {
          const { data: existingRecords, error: existingError } = await supabase
            .from('attendance_records')
            .select('student_id, status, notes')
            .eq('course_id', courseId)
            .eq('date', today)
            .in('student_id', enrolled.map((s) => s.id));

          if (!existingError && existingRecords) {
            existingRecords.forEach((rec) => {
              initialStatus[rec.student_id] = rec.status;
              initialNotes[rec.student_id] = rec.notes || '';
            });
          }
        }

        enrolled.forEach((s) => {
          if (!initialStatus[s.id]) {
            initialStatus[s.id] = 'present';
            initialNotes[s.id] = '';
          }
        });

        setAttendanceBatchStatus(initialStatus);
        setAttendanceNotes(initialNotes);
      } catch (err) {
        console.error('Error fetching enrolled students:', err);
        setEnrolledStudentsForLecture([]);
        showToast('Failed to load students: ' + err.message, 'error');
      }
    },
    [showToast, getCourseIdFromSlot]
  );

  const handleBatchAttendanceSave = useCallback(async () => {
    if (!selectedLectureForAttendance) {
      showToast('No lecture selected', 'error');
      return;
    }

    const slot = todayLectures.find((l) => l.id === selectedLectureForAttendance);
    if (!slot) {
      showToast('Lecture not found', 'error');
      return;
    }

    const studentsToRecord = enrolledStudentsForLecture.filter(
      (s) => attendanceBatchStatus[s.id] && attendanceBatchStatus[s.id] !== 'not_recorded'
    );

    if (studentsToRecord.length === 0) {
      showToast('No students to record', 'error');
      return;
    }

    setSavingAttendance(true);
    try {
      const courseId = await getCourseIdFromSlot(slot);
      if (!courseId) {
        throw new Error('Course not found');
      }

      const recordedBy = await getCurrentUserId();

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 8);
      let successCount = 0;
      let updateCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const student of studentsToRecord) {
        const status = attendanceBatchStatus[student.id] || 'present';
        const notes = attendanceNotes[student.id] || '';

        try {
          const { data: existing, error: checkError } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('student_id', student.id)
            .eq('course_id', courseId)
            .eq('date', today)
            .maybeSingle();

          if (checkError) throw checkError;

          const recordData = {
            student_id: student.id,
            course_id: courseId,
            date: today,
            status,
            notes: notes || null,
            check_in_time: now,
            updated_at: new Date().toISOString(),
          };
          
          if (recordedBy) {
            recordData.recorded_by = recordedBy;
          }

          if (existing) {
            const { error: updateError } = await supabase
              .from('attendance_records')
              .update(recordData)
              .eq('id', existing.id);
            if (updateError) throw updateError;
            updateCount++;
          } else {
            recordData.day_of_week = new Date().getDay();
            recordData.created_at = new Date().toISOString();
            
            const { error: insertError } = await supabase
              .from('attendance_records')
              .insert([recordData]);
            if (insertError) throw insertError;
            successCount++;
          }
        } catch (err) {
          console.error('Error saving for student', student.id, err);
          errorCount++;
          errors.push(`${student.full_name}: ${err.message}`);
        }
      }

      let message = `✅ ${successCount} new, ${updateCount} updated`;
      if (errorCount > 0) {
        message += `, ⚠️ ${errorCount} failed`;
        if (errors.length) message += ` (${errors.slice(0, 3).join(', ')})`;
      }
      showToast(message, errorCount > 0 && successCount === 0 ? 'error' : 'success');

      await fetchAttendanceData();
      if (fetchDashboardStats) await fetchDashboardStats();
      await fetchTodayLectures();

      setAttendanceBatchMode(false);
      setSelectedLectureForAttendance(null);
      setEnrolledStudentsForLecture([]);
      setAttendanceBatchStatus({});
      setAttendanceNotes({});
    } catch (err) {
      console.error('Batch save error:', err);
      showToast('Failed to save attendance: ' + err.message, 'error');
    } finally {
      setSavingAttendance(false);
    }
  }, [
    selectedLectureForAttendance,
    todayLectures,
    enrolledStudentsForLecture,
    attendanceBatchStatus,
    attendanceNotes,
    fetchAttendanceData,
    fetchDashboardStats,
    fetchTodayLectures,
    showToast,
    getCourseIdFromSlot,
    getCurrentUserId,
  ]);

  const loadCoursesForAttendanceStudent = useCallback(
    async (student) => {
      if (!student) {
        setAttendanceCourses([]);
        return;
      }
      setLoadingAttendanceCourses(true);
      try {
        let query = supabase
          .from('courses')
          .select('id, course_code, course_name, year, semester')
          .eq('is_active', true);
        
        if (student.department_code) {
          query = query.eq('department_code', student.department_code);
        } else if (student.program_code) {
          query = query.eq('program_code', student.program_code);
        }
        
        if (student.year_of_study) {
          query = query.eq('year', student.year_of_study);
        }
        if (student.semester) {
          query = query.eq('semester', student.semester);
        }
        
        query = query.order('course_code');
        
        const { data, error } = await query;

        if (error) throw error;
        setAttendanceCourses(data || []);
      } catch (err) {
        console.error('Error loading courses:', err);
        showToast('Failed to load courses: ' + err.message, 'error');
        setAttendanceCourses([]);
      } finally {
        setLoadingAttendanceCourses(false);
      }
    },
    [showToast]
  );

  const handleSaveAttendanceRecord = useCallback(async () => {
    if (!attendanceForm.student_id || !attendanceForm.date || !attendanceForm.course_id) {
      showToast('Please fill in Student, Date, and Course', 'error');
      return;
    }

    try {
      const recordedBy = await getCurrentUserId();
      
      const recordData = {
        student_id: attendanceForm.student_id,
        course_id: attendanceForm.course_id,
        lecture_id: attendanceForm.lecture_id || null,
        date: attendanceForm.date,
        status: attendanceForm.status,
        notes: attendanceForm.notes || null,
        day_of_week: new Date(attendanceForm.date).getDay(),
        check_in_time: new Date().toTimeString().slice(0, 8),
      };
      
      if (recordedBy) {
        recordData.recorded_by = recordedBy;
      }

      if (editingAttendanceRecord) {
        const { error } = await supabase
          .from('attendance_records')
          .update(recordData)
          .eq('id', editingAttendanceRecord.id);
        if (error) throw error;
        showToast('Attendance record updated!', 'success');
      } else {
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('student_id', recordData.student_id)
          .eq('course_id', recordData.course_id)
          .eq('date', recordData.date)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('attendance_records')
            .update(recordData)
            .eq('id', existing.id);
          if (error) throw error;
          showToast('Attendance updated (existing record found).', 'success');
        } else {
          const { error } = await supabase
            .from('attendance_records')
            .insert([recordData]);
          if (error) throw error;
          showToast('Attendance recorded successfully!', 'success');
        }
      }

      setShowAttendanceRecordModal(false);
      setEditingAttendanceRecord(null);
      setAttendanceForm({
        student_id: '',
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        notes: '',
        course_id: '',
        lecture_id: '',
      });
      fetchAttendanceData();
      if (fetchDashboardStats) fetchDashboardStats();
    } catch (err) {
      console.error('Save attendance error:', err);
      showToast('Error saving attendance: ' + err.message, 'error');
    }
  }, [attendanceForm, editingAttendanceRecord, fetchAttendanceData, fetchDashboardStats, showToast, getCurrentUserId]);

  const handleDeleteAttendanceRecord = useCallback(
    async (recordId) => {
      if (!window.confirm('Delete this attendance record?')) return;
      try {
        const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
        if (error) throw error;
        showToast('Record deleted', 'success');
        fetchAttendanceData();
        if (fetchDashboardStats) fetchDashboardStats();
      } catch (err) {
        console.error('Delete error:', err);
        showToast('Error deleting record: ' + err.message, 'error');
      }
    },
    [fetchAttendanceData, fetchDashboardStats, showToast]
  );

  // ---------- Effects ----------
  useEffect(() => {
    loadTimetableDepartments();
    fetchTodayLectures();
    fetchAttendanceData();
  }, []);

  useEffect(() => {
    fetchTodayLectures();
    fetchAttendanceData();
  }, [attendanceDepartmentFilter]);

  // ---------- Render ----------
  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h2>📅 Attendance Management</h2>
          <p style={{ color: '#666', marginTop: '5px' }}>
            Record attendance based on today's timetable or manually
          </p>
        </div>
        <div className="tab-actions">
          <div className="attendance-rate large">
            Overall Rate: <strong>{stats?.attendanceRate || 0}%</strong>
          </div>
          <button
            className="refresh-button"
            onClick={() => {
              fetchTodayLectures();
              fetchAttendanceData();
              loadTimetableDepartments();
            }}
            disabled={loadingTodayLectures}
          >
            🔄 Refresh
          </button>
          <button
            className="confirm-button"
            onClick={() => setShowAttendanceRecordModal(true)}
            style={{ marginLeft: '10px' }}
          >
            ➕ Record Single Attendance
          </button>
        </div>
      </div>

      {/* Department Filter */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid #dee2e6',
      }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              Filter by Department
            </label>
            <select
              value={attendanceDepartmentFilter || ''}
              onChange={(e) => {
                const dept = e.target.value;
                setAttendanceDepartmentFilter(dept);
                setAttendanceStudentSearch('');
                if (attendanceBatchMode) {
                  setAttendanceBatchMode(false);
                  setSelectedLectureForAttendance(null);
                  setEnrolledStudentsForLecture([]);
                }
              }}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="">All Departments</option>
              {isLecturer ? (
                allowedDepartments?.length > 0 ? (
                  allowedDepartments.map((dept) => (
                    <option key={dept.department_code} value={dept.department_code}>
                      {dept.department_code} - {dept.department_name || dept.department_code}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No departments assigned</option>
                )
              ) : timetableDepartments.length > 0 ? (
                timetableDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              ) : (
                <option value="" disabled>No departments in timetable</option>
              )}
            </select>
            {attendanceDepartmentFilter && (
              <small style={{ display: 'block', marginTop: '4px', color: '#1976d2' }}>
                📂 Filtering: <strong>{attendanceDepartmentFilter}</strong>
              </small>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              Search Students
            </label>
            <input
              type="text"
              value={attendanceStudentSearch || ''}
              onChange={(e) => setAttendanceStudentSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="form-input"
              style={{ width: '100%' }}
            />
            {attendanceStudentSearch && (
              <small style={{ display: 'block', marginTop: '4px', color: '#1976d2' }}>
                🔍 Searching: <strong>{attendanceStudentSearch}</strong>
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Today's Timetable */}
      <div style={{ marginBottom: '30px' }}>
        <h3>📋 Today's Lectures</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {attendanceDepartmentFilter && (
            <span style={{ marginLeft: '10px', color: '#1976d2', fontWeight: 'bold' }}>
              • Filtered by: {attendanceDepartmentFilter}
            </span>
          )}
        </p>

        {loadingTodayLectures ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner"></div>
            <p>Loading lectures...</p>
          </div>
        ) : todayLectures.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: '#f8f9fa',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h4>No Lectures Today</h4>
            <p style={{ color: '#666' }}>
              {attendanceDepartmentFilter
                ? `No lectures for department: ${attendanceDepartmentFilter}`
                : 'No lectures scheduled for today'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '16px',
          }}>
            {todayLectures.map((slot) => (
              <div key={slot.id} style={{
                border: selectedLectureForAttendance === slot.id ? '3px solid #28a745' : '1px solid #dee2e6',
                background: selectedLectureForAttendance === slot.id ? '#f0fff4' : 'white',
                padding: '16px',
                borderRadius: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>
                      {slot.course_code} - {slot.course_name}
                    </h4>
                    <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                      {slot.slot_type}
                      {slot.department_code && (
                        <span style={{
                          marginLeft: '8px',
                          background: '#e3f2fd',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#1976d2',
                        }}>
                          Dept: {slot.department_code}
                        </span>
                      )}
                      {slot.program_code && (
                        <span style={{
                          marginLeft: '8px',
                          background: '#f3e5f5',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#7b1fa2',
                        }}>
                          {slot.program_code}
                        </span>
                      )}
                    </p>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: '#e3f2fd',
                    color: '#1976d2',
                  }}>
                    {slot.start_time} - {slot.end_time}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>
                  <div>👨‍🏫 {slot.lecturers?.full_name || 'Not Assigned'}</div>
                  <div>📍 {slot.room_number || 'TBD'} - {slot.building || 'TBD'}</div>
                </div>
                <button
                  className="action-btn view"
                  onClick={() => {
                    setSelectedLectureForAttendance(slot.id);
                    setAttendanceBatchMode(true);
                    fetchEnrolledStudentsForLecture(slot);
                  }}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  📝 Record Attendance
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batch Attendance Mode */}
      {attendanceBatchMode && selectedLectureForAttendance && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          border: '2px solid #28a745',
          marginBottom: '30px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: 0 }}>
              📝 Record Attendance
              <span style={{
                fontSize: '14px',
                fontWeight: 'normal',
                color: '#666',
                marginLeft: '10px',
              }}>
                {todayLectures.find((l) => l.id === selectedLectureForAttendance)?.course_code}
              </span>
            </h3>
            <button
              className="cancel-button"
              onClick={() => {
                setAttendanceBatchMode(false);
                setSelectedLectureForAttendance(null);
                setEnrolledStudentsForLecture([]);
                setAttendanceBatchStatus({});
                setAttendanceNotes({});
              }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              className="action-btn success"
              onClick={() => {
                const newStatus = {};
                enrolledStudentsForLecture.forEach((s) => (newStatus[s.id] = 'present'));
                setAttendanceBatchStatus(newStatus);
                showToast('All marked Present', 'success');
              }}
            >
              ✅ All Present
            </button>
            <button
              className="action-btn warning"
              onClick={() => {
                const newStatus = {};
                enrolledStudentsForLecture.forEach((s) => (newStatus[s.id] = 'absent'));
                setAttendanceBatchStatus(newStatus);
                showToast('All marked Absent', 'info');
              }}
            >
              ❌ All Absent
            </button>
            <button
              className="action-btn"
              style={{ background: '#6c757d', color: 'white' }}
              onClick={() => {
                const slot = todayLectures.find((l) => l.id === selectedLectureForAttendance);
                if (slot) {
                  fetchEnrolledStudentsForLecture(slot);
                  showToast('Refreshed attendance data', 'info');
                }
              }}
            >
              🔄 Refresh Status
            </button>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudentsForLecture
                  .filter((s) => {
                    const search = (attendanceStudentSearch || '').trim().toLowerCase();
                    if (!search) return true;
                    return (
                      s.full_name?.toLowerCase().includes(search) ||
                      s.student_id?.toLowerCase().includes(search)
                    );
                  })
                  .map((student, index) => (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td><strong>{student.student_id}</strong></td>
                      <td>{student.full_name}</td>
                      <td>{student.department_code || 'N/A'}</td>
                      <td>
                        <select
                          value={attendanceBatchStatus[student.id] || 'present'}
                          onChange={(e) =>
                            setAttendanceBatchStatus({
                              ...attendanceBatchStatus,
                              [student.id]: e.target.value,
                            })
                          }
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                          }}
                        >
                          <option value="present">✅ Present</option>
                          <option value="absent">❌ Absent</option>
                          <option value="late">🕒 Late</option>
                          <option value="excused">📝 Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            padding: '12px 16px',
            background: '#f8f9fa',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
              <span>👥 Total: <strong>{enrolledStudentsForLecture.length}</strong></span>
              <span>✅ Present: <strong>{Object.values(attendanceBatchStatus).filter((s) => s === 'present').length}</strong></span>
              <span>❌ Absent: <strong>{Object.values(attendanceBatchStatus).filter((s) => s === 'absent').length}</strong></span>
              <span>🕒 Late: <strong>{Object.values(attendanceBatchStatus).filter((s) => s === 'late').length}</strong></span>
            </div>
            <button
              className="confirm-button"
              onClick={handleBatchAttendanceSave}
              disabled={savingAttendance}
              style={{ padding: '10px 24px' }}
            >
              {savingAttendance ? 'Saving...' : '💾 Save Attendance'}
            </button>
          </div>
        </div>
      )}

      {/* Attendance History */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h3 style={{ margin: 0 }}>📊 Attendance History</h3>
          <button
            className="refresh-button"
            onClick={() => {
              fetchAttendanceData();
              showToast('Refreshing history...', 'info');
            }}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* History Search and Filters */}
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #dee2e6',
        }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '250px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                🔍 Search
              </label>
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by student name, ID, or course..."
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Status
              </label>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: '100%' }}
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
                <option value="medical">Medical</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Date
              </label>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Course
              </label>
              <select
                value={historyCourseFilter}
                onChange={(e) => setHistoryCourseFilter(e.target.value)}
                className="form-select"
                style={{ width: '100%' }}
              >
                <option value="">All Courses</option>
                {historyCourses.map((course) => (
                  <option key={course.course_code} value={course.course_code}>
                    {course.course_code} - {course.course_name}
                  </option>
                ))}
              </select>
            </div>
            {(historySearch || historyStatusFilter || historyDateFilter || historyCourseFilter) && (
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="cancel-button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryStatusFilter('');
                    setHistoryDateFilter('');
                    setHistoryCourseFilter('');
                  }}
                  style={{ padding: '8px 16px' }}
                >
                  ✕ Clear Filters
                </button>
              </div>
            )}
          </div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Showing <strong>{filteredAttendanceRecords.length}</strong> of{' '}
            <strong>{attendanceRecords.length}</strong> records
          </div>
        </div>

        {attendanceError && (
          <div style={{ color: '#dc3545', marginBottom: '10px' }}>{attendanceError}</div>
        )}

        {filteredAttendanceRecords.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <h3>No records found</h3>
            <p style={{ color: '#666' }}>
              {attendanceRecords.length === 0
                ? 'Attendance records will appear here after you save them.'
                : 'No records match your search criteria.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendanceRecords.map((record) => {
                  const date = new Date(record.date);
                  return (
                    <tr key={record.id}>
                      <td>{date.toLocaleDateString()}</td>
                      <td>
                        <strong>{record.students?.full_name || 'Unknown'}</strong>
                        <br />
                        <small style={{ color: '#1976d2' }}>
                          {record.students?.student_id || 'N/A'}
                        </small>
                      </td>
                      <td>
                        <strong>{record.courses?.course_code || 'N/A'}</strong>
                        {record.courses?.course_name && (
                          <>
                            <br />
                            <small style={{ color: '#666' }}>
                              {record.courses.course_name}
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${record.status}`}>
                          {record.status?.charAt(0).toUpperCase() + record.status?.slice(1)}
                        </span>
                      </td>
                      <td>{record.check_in_time || '—'}</td>
                      <td>{record.notes || '—'}</td>
                      <td>
                        <button
                          className="action-btn"
                          style={{
                            background: '#6c757d',
                            color: 'white',
                            padding: '4px 8px',
                            fontSize: '12px',
                            marginRight: '5px',
                          }}
                          onClick={() => {
                            setEditingAttendanceRecord(record);
                            setAttendanceForm({
                              student_id: record.student_id,
                              date: record.date,
                              status: record.status,
                              notes: record.notes || '',
                              course_id: record.course_id,
                              lecture_id: record.lecture_id || '',
                            });
                            setAttendanceStudent(record.students);
                            loadCoursesForAttendanceStudent(record.students);
                            setShowAttendanceRecordModal(true);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="action-btn danger"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleDeleteAttendanceRecord(record.id)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Attendance Modal */}
      {showAttendanceRecordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingAttendanceRecord ? 'Edit' : 'Record'} Attendance</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Search Student</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={attendanceStudentSearch}
                    onChange={(e) => {
                      const searchTerm = e.target.value;
                      setAttendanceStudentSearch(searchTerm);
                      const matchingStudents = getFilteredStudents(searchTerm);
                      if (matchingStudents.length === 1 && !editingAttendanceRecord) {
                        const student = matchingStudents[0];
                        setAttendanceForm({
                          ...attendanceForm,
                          student_id: student.id,
                          course_id: '',
                        });
                        setAttendanceStudent(student);
                        loadCoursesForAttendanceStudent(student);
                      }
                    }}
                    placeholder="Search by name or student ID..."
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  {attendanceStudentSearch && (
                    <button
                      className="clear-search-btn"
                      onClick={() => {
                        setAttendanceStudentSearch('');
                        if (!editingAttendanceRecord) {
                          setAttendanceForm({
                            ...attendanceForm,
                            student_id: '',
                            course_id: '',
                          });
                          setAttendanceStudent(null);
                          setAttendanceCourses([]);
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
                <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                  Type name or ID to filter students
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Student *</label>
                <select
                  value={attendanceForm.student_id || ''}
                  onChange={async (e) => {
                    const selectedId = e.target.value;
                    setAttendanceForm({
                      ...attendanceForm,
                      student_id: selectedId,
                      course_id: '',
                    });

                    if (!selectedId) {
                      setAttendanceStudent(null);
                      setAttendanceCourses([]);
                      return;
                    }

                    const student = students.find((s) => s.id === selectedId);
                    setAttendanceStudent(student || null);
                    if (student) {
                      await loadCoursesForAttendanceStudent(student);
                      setAttendanceStudentSearch('');
                    }
                  }}
                  className="form-select"
                  required
                  disabled={editingAttendanceRecord}
                >
                  <option value="">Select Student</option>
                  {getFilteredStudents(attendanceStudentSearch).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.student_id ? ` (${s.student_id})` : ''} – {s.department_code || 'N/A'} – Y
                      {s.year_of_study} S{s.semester}
                    </option>
                  ))}
                </select>
                {attendanceStudentSearch && (
                  <small style={{ display: 'block', marginTop: '6px', color: '#1976d2' }}>
                    🔍 Found {getFilteredStudents(attendanceStudentSearch).length} student(s)
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Course *</label>
                {loadingAttendanceCourses ? (
                  <p>Loading courses...</p>
                ) : (
                  <select
                    value={attendanceForm.course_id || ''}
                    onChange={(e) =>
                      setAttendanceForm({ ...attendanceForm, course_id: e.target.value })
                    }
                    className="form-select"
                    required
                    disabled={!attendanceStudent || attendanceCourses.length === 0}
                  >
                    <option value="">
                      {!attendanceStudent
                        ? 'Select a student first'
                        : attendanceCourses.length === 0
                        ? 'No courses found for this semester'
                        : 'Select Course'}
                    </option>
                    {attendanceCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.course_code} – {c.course_name}
                      </option>
                    ))}
                  </select>
                )}
                {attendanceStudent && (
                  <small style={{ display: 'block', marginTop: '6px', color: '#666' }}>
                    Showing Year {attendanceStudent.year_of_study} Semester {attendanceStudent.semester}{' '}
                    courses
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={attendanceForm.date}
                  onChange={(e) =>
                    setAttendanceForm({ ...attendanceForm, date: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Status *</label>
                <select
                  value={attendanceForm.status}
                  onChange={(e) =>
                    setAttendanceForm({ ...attendanceForm, status: e.target.value })
                  }
                  className="form-select"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                  <option value="medical">Medical</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  value={attendanceForm.notes}
                  onChange={(e) =>
                    setAttendanceForm({ ...attendanceForm, notes: e.target.value })
                  }
                  rows="3"
                  className="form-textarea"
                  placeholder="e.g. Arrived 20 minutes late"
                />
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setShowAttendanceRecordModal(false);
                    setEditingAttendanceRecord(null);
                    setAttendanceStudentSearch('');
                    setAttendanceStudent(null);
                    setAttendanceCourses([]);
                    setAttendanceForm({
                      student_id: '',
                      date: new Date().toISOString().split('T')[0],
                      status: 'present',
                      notes: '',
                      course_id: '',
                      lecture_id: '',
                    });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="confirm-button"
                  onClick={handleSaveAttendanceRecord}
                  disabled={
                    !attendanceForm.student_id ||
                    !attendanceForm.date ||
                    !attendanceForm.course_id
                  }
                >
                  {editingAttendanceRecord ? 'Update' : 'Save'} Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;