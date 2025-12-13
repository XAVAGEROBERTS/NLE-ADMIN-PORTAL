import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { supabase } from '../services/supabase'


const AdminDashboard = () => {
  const navigate = useNavigate()
  const { profile, signOut, isAdmin, isLecturer, loading: authLoading } = useAdminAuth()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loading, setLoading] = useState({
    dashboard: true,
    students: false,
    lecturers: false,
    courses: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalLecturers: 0,
    totalAdmins: 0,
    totalCourses: 0,
    totalAssignments: 0,
    totalExams: 0,
    totalFinancialRecords: 0,
    pendingExams: 0,
    pendingAssignments: 0,
    pendingPayments: 0,
    attendanceRate: 0,
    systemHealth: 100
  })

  // State for various data
  const [students, setStudents] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [exams, setExams] = useState([])
  const [financialRecords, setFinancialRecords] = useState([])
  const [lectures, setLectures] = useState([])
  const [attendance, setAttendance] = useState([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState(null)

  // Pagination states
  const [currentPage, setCurrentPage] = useState({
    students: 1,
    lecturers: 1,
    courses: 1,
    assignments: 1,
    exams: 1
  })
  const [itemsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState({
    students: 0,
    lecturers: 0,
    courses: 0,
    assignments: 0,
    exams: 0
  })

  // Charts data
  const [studentEnrollmentData, setStudentEnrollmentData] = useState([])
  const [courseDistributionData, setCourseDistributionData] = useState([])
  const [performanceData, setPerformanceData] = useState([])
  const [financialData, setFinancialData] = useState([])

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [showLectureModal, setShowLectureModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)

  // Form states
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'student',
    program: '',
    year_of_study: 1,
    department: '',
    specialization: ''
  })

  const [newCourse, setNewCourse] = useState({
    course_code: '',
    course_name: '',
    description: '',
    credits: 3,
    year: 1,
    semester: 1,
    program: 'Computer Engineering',
    faculty: 'Computing',
    department: 'Computer Science',
    is_core: true
  })

  const [newAssignment, setNewAssignment] = useState({
    course_id: '',
    title: '',
    description: '',
    instructions: '',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    total_marks: 100,
    submission_type: 'file',
    max_file_size: 10,
    allowed_formats: ['pdf', 'doc', 'docx']
  })

  const [newLecture, setNewLecture] = useState({
    course_id: '',
    title: '',
    description: '',
    google_meet_link: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '11:00',
    materials_url: []
  })

  // Initialize dashboard
  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login')
      return
    }
    
    if (profile) {
      initializeDashboard()
      setupRealtimeSubscription()
      
      return () => {
        // Cleanup subscriptions if any
      }
    }
  }, [profile, authLoading, navigate])

  const initializeDashboard = async () => {
    try {
      setLoading(prev => ({ ...prev, dashboard: true }))
      setError(null)
      
      console.log('Initializing dashboard for:', {
        profile,
        isAdmin,
        isLecturer
      })

      // Fetch all initial data
      await Promise.all([
        fetchDashboardStats(),
        fetchStudents(),
        fetchLecturers(),
        fetchCourses(),
        fetchAssignments(),
        fetchExams(),
        fetchFinancialRecords(),
        fetchLectures(),
        fetchAttendanceData(),
        fetchChartData()
      ])
      
    } catch (error) {
      console.error('Initialization error:', error)
      setError('Failed to initialize dashboard. Please refresh the page.')
    } finally {
      setLoading(prev => ({ ...prev, dashboard: false }))
    }
  }

  const setupRealtimeSubscription = () => {
    try {
      const subscription = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'students' }, 
          () => {
            console.log('🔄 Students table changed')
            fetchDashboardStats()
            fetchStudents()
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'lecturers' },
          () => {
            console.log('🔄 Lecturers table changed')
            fetchDashboardStats()
            fetchLecturers()
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'courses' },
          () => {
            console.log('🔄 Courses table changed')
            fetchDashboardStats()
            fetchCourses()
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'assignments' },
          () => {
            console.log('🔄 Assignments table changed')
            fetchDashboardStats()
            fetchAssignments()
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'examinations' },
          () => {
            console.log('🔄 Examinations table changed')
            fetchDashboardStats()
            fetchExams()
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime status:', status)
          setRealtimeConnected(status === 'SUBSCRIBED')
        })
      
      return subscription
    } catch (error) {
      console.error('Realtime subscription error:', error)
      return null
    }
  }

  // Fetch functions
  const fetchDashboardStats = async () => {
    try {
      const [
        studentsRes,
        lecturersRes,
        coursesRes,
        assignmentsRes,
        examsRes,
        financialRes,
        attendanceRes
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('lecturers').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('assignments').select('*', { count: 'exact', head: true }),
        supabase.from('examinations').select('*', { count: 'exact', head: true }),
        supabase.from('financial_records').select('*', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('status')
      ])

      const activeStudents = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const pendingExams = await supabase
        .from('examinations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')

      const pendingAssignments = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gt('due_date', new Date().toISOString())

      const pendingPayments = await supabase
        .from('financial_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const presentAttendance = attendanceRes.data?.filter(a => a.status === 'present').length || 0
      const totalAttendance = attendanceRes.data?.length || 1
      const attendanceRate = Math.round((presentAttendance / totalAttendance) * 100)

      setStats({
        totalStudents: studentsRes.count || 0,
        activeStudents: activeStudents.count || 0,
        totalLecturers: lecturersRes.count || 0,
        totalAdmins: 1, // Hardcoded for now
        totalCourses: coursesRes.count || 0,
        totalAssignments: assignmentsRes.count || 0,
        totalExams: examsRes.count || 0,
        totalFinancialRecords: financialRes.count || 0,
        pendingExams: pendingExams.count || 0,
        pendingAssignments: pendingAssignments.count || 0,
        pendingPayments: pendingPayments.count || 0,
        attendanceRate,
        systemHealth: 100
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchStudents = async (page = 1) => {
    try {
      setLoading(prev => ({ ...prev, students: true }))
      
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      const { data, count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setStudents(data || [])
      setTotalItems(prev => ({ ...prev, students: count || 0 }))
      
    } catch (error) {
      console.error('Error fetching students:', error)
      setError('Failed to load students')
    } finally {
      setLoading(prev => ({ ...prev, students: false }))
    }
  }

  const fetchLecturers = async (page = 1) => {
    try {
      setLoading(prev => ({ ...prev, lecturers: true }))
      
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      const { data, count, error } = await supabase
        .from('lecturers')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setLecturers(data || [])
      setTotalItems(prev => ({ ...prev, lecturers: count || 0 }))
      
    } catch (error) {
      console.error('Error fetching lecturers:', error)
      setError('Failed to load lecturers')
    } finally {
      setLoading(prev => ({ ...prev, lecturers: false }))
    }
  }

  const fetchCourses = async (page = 1) => {
    try {
      setLoading(prev => ({ ...prev, courses: true }))
      
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      const { data, count, error } = await supabase
        .from('courses')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('year')
        .order('semester')
      
      if (error) throw error
      
      setCourses(data || [])
      setTotalItems(prev => ({ ...prev, courses: count || 0 }))
      
    } catch (error) {
      console.error('Error fetching courses:', error)
      setError('Failed to load courses')
    } finally {
      setLoading(prev => ({ ...prev, courses: false }))
    }
  }

  const fetchAssignments = async (page = 1) => {
    try {
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      let query = supabase
        .from('assignments')
        .select(`
          *,
          courses (course_code, course_name),
          lecturers (full_name)
        `, { count: 'exact' })
        .range(from, to)
        .order('due_date', { ascending: true })
      
      if (isLecturer && !isAdmin) {
        query = query.eq('lecturer_id', profile.id)
      }
      
      const { data, count, error } = await query
      
      if (error) throw error
      
      setAssignments(data || [])
      setTotalItems(prev => ({ ...prev, assignments: count || 0 }))
      
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const fetchExams = async (page = 1) => {
    try {
      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      
      const { data, count, error } = await supabase
        .from('examinations')
        .select(`
          *,
          courses (course_code, course_name)
        `, { count: 'exact' })
        .range(from, to)
        .order('start_time', { ascending: true })
      
      if (error) throw error
      
      setExams(data || [])
      setTotalItems(prev => ({ ...prev, exams: count || 0 }))
      
    } catch (error) {
      console.error('Error fetching exams:', error)
    }
  }

  const fetchFinancialRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_records')
        .select(`
          *,
          students (full_name, student_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      
      setFinancialRecords(data || [])
    } catch (error) {
      console.error('Error fetching financial records:', error)
    }
  }

  const fetchLectures = async () => {
    try {
      let query = supabase
        .from('lectures')
        .select(`
          *,
          courses (course_code, course_name),
          lecturers (full_name)
        `)
        .order('scheduled_date', { ascending: true })
        .limit(20)
      
      if (isLecturer && !isAdmin) {
        query = query.eq('lecturer_id', profile.id)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      setLectures(data || [])
    } catch (error) {
      console.error('Error fetching lectures:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students (full_name, student_id),
          courses (course_code)
        `)
        .order('date', { ascending: false })
        .limit(100)
      
      if (error) throw error
      
      setAttendance(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }

  const fetchChartData = async () => {
    try {
      // Student enrollment by program
      const { data: enrollmentData } = await supabase
        .from('students')
        .select('program, year_of_study')
      
      const enrollmentByProgram = enrollmentData?.reduce((acc, student) => {
        acc[student.program] = (acc[student.program] || 0) + 1
        return acc
      }, {})
      
      setStudentEnrollmentData(
        Object.entries(enrollmentByProgram || {}).map(([name, value]) => ({ name, value }))
      )

      // Course distribution by year
      const { data: courseData } = await supabase
        .from('courses')
        .select('year')
      
      const coursesByYear = courseData?.reduce((acc, course) => {
        acc[`Year ${course.year}`] = (acc[`Year ${course.year}`] || 0) + 1
        return acc
      }, {})
      
      setCourseDistributionData(
        Object.entries(coursesByYear || {}).map(([name, value]) => ({ name, value }))
      )

      // Performance data (placeholder - would need actual grade data)
      setPerformanceData([
        { name: 'Jan', gpa: 3.2 },
        { name: 'Feb', gpa: 3.4 },
        { name: 'Mar', gpa: 3.5 },
        { name: 'Apr', gpa: 3.6 },
        { name: 'May', gpa: 3.8 },
        { name: 'Jun', gpa: 3.7 }
      ])

      // Financial data
      setFinancialData([
        { month: 'Jan', revenue: 50000, expenses: 35000 },
        { month: 'Feb', revenue: 52000, expenses: 36000 },
        { month: 'Mar', revenue: 55000, expenses: 38000 },
        { month: 'Apr', revenue: 58000, expenses: 40000 },
        { month: 'May', revenue: 60000, expenses: 42000 },
        { month: 'Jun', revenue: 62000, expenses: 45000 }
      ])
      
    } catch (error) {
      console.error('Error fetching chart data:', error)
    }
  }

  // Handler functions
  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/login')
    }
  }

  const handleAddUser = async () => {
    try {
      let tableName, data
      const password = generatePassword()
      
      if (newUser.role === 'student') {
        const studentId = `NLE-${newUser.program.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}-DAY`
        data = {
          student_id: studentId,
          full_name: newUser.full_name,
          email: newUser.email,
          password_hash: password, // In production, hash this properly
          phone: newUser.phone,
          program: newUser.program,
          year_of_study: newUser.year_of_study,
          semester: 1,
          intake: 'August',
          academic_year: '2024/2025',
          status: 'active'
        }
        tableName = 'students'
      } else if (newUser.role === 'lecturer') {
        const lecturerId = `LEC${String(lecturers.length + 1).padStart(3, '0')}`
        data = {
          lecturer_id: lecturerId,
          full_name: newUser.full_name,
          email: newUser.email,
          password_hash: password,
          phone: newUser.phone,
          department: newUser.department,
          specialization: newUser.specialization
        }
        tableName = 'lecturers'
      } else {
        const adminId = `ADMIN${String(stats.totalAdmins + 1).padStart(3, '0')}`
        data = {
          admin_id: adminId,
          full_name: newUser.full_name,
          email: newUser.email,
          password_hash: password,
          phone: newUser.phone
        }
        tableName = 'system_admins'
      }
      
      const { error } = await supabase
        .from(tableName)
        .insert([data])
      
      if (error) throw error
      
      // Add user role
      await supabase
        .from('user_roles')
        .insert([{
          email: newUser.email,
          role: newUser.role,
          table_id: data.id || ''
        }])
      
      setSuccess(`${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} added successfully!`)
      setShowUserModal(false)
      setNewUser({
        full_name: '',
        email: '',
        phone: '',
        role: 'student',
        program: '',
        year_of_study: 1,
        department: '',
        specialization: ''
      })
      
      // Refresh data
      fetchDashboardStats()
      if (newUser.role === 'student') fetchStudents()
      if (newUser.role === 'lecturer') fetchLecturers()
      
    } catch (error) {
      console.error('Error adding user:', error)
      setError('Failed to add user: ' + error.message)
    }
  }

  const handleAddCourse = async () => {
    try {
      const { error } = await supabase
        .from('courses')
        .insert([newCourse])
      
      if (error) throw error
      
      setSuccess('Course added successfully!')
      setShowCourseModal(false)
      setNewCourse({
        course_code: '',
        course_name: '',
        description: '',
        credits: 3,
        year: 1,
        semester: 1,
        program: 'Computer Engineering',
        faculty: 'Computing',
        department: 'Computer Science',
        is_core: true
      })
      
      fetchCourses()
      fetchDashboardStats()
      
    } catch (error) {
      console.error('Error adding course:', error)
      setError('Failed to add course: ' + error.message)
    }
  }

  const handleAddAssignment = async () => {
    try {
      if (!newAssignment.course_id) {
        setError('Please select a course')
        return
      }
      
      const assignmentData = {
        ...newAssignment,
        lecturer_id: profile.id,
        status: 'published',
        due_date: new Date(newAssignment.due_date).toISOString()
      }
      
      const { error } = await supabase
        .from('assignments')
        .insert([assignmentData])
      
      if (error) throw error
      
      setSuccess('Assignment added successfully!')
      setShowAssignmentModal(false)
      setNewAssignment({
        course_id: '',
        title: '',
        description: '',
        instructions: '',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        total_marks: 100,
        submission_type: 'file',
        max_file_size: 10,
        allowed_formats: ['pdf', 'doc', 'docx']
      })
      
      fetchAssignments()
      
    } catch (error) {
      console.error('Error adding assignment:', error)
      setError('Failed to add assignment: ' + error.message)
    }
  }

  const handleAddLecture = async () => {
    try {
      if (!newLecture.course_id) {
        setError('Please select a course')
        return
      }
      
      const lectureData = {
        ...newLecture,
        lecturer_id: profile.id,
        status: 'scheduled',
        duration_minutes: calculateDuration(newLecture.start_time, newLecture.end_time)
      }
      
      const { error } = await supabase
        .from('lectures')
        .insert([lectureData])
      
      if (error) throw error
      
      setSuccess('Lecture scheduled successfully!')
      setShowLectureModal(false)
      setNewLecture({
        course_id: '',
        title: '',
        description: '',
        google_meet_link: '',
        scheduled_date: new Date().toISOString().slice(0, 10),
        start_time: '09:00',
        end_time: '11:00',
        materials_url: []
      })
      
      fetchLectures()
      
    } catch (error) {
      console.error('Error adding lecture:', error)
      setError('Failed to schedule lecture: ' + error.message)
    }
  }

  const handleUploadMaterial = async (file, courseId, title, description) => {
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `course-materials/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath)
      
      // Save to database
      const { error: dbError } = await supabase
        .from('course_materials')
        .insert([{
          lecturer_id: profile.id,
          course_id: courseId,
          title: title,
          description: description,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          upload_date: new Date().toISOString().slice(0, 10)
        }])
      
      if (dbError) throw dbError
      
      setSuccess(`Material "${title}" uploaded successfully!`)
      
    } catch (error) {
      console.error('Upload error:', error)
      setError('Failed to upload material: ' + error.message)
    }
  }

  // Helper functions
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const calculateDuration = (start, end) => {
    const [startHour, startMinute] = start.split(':').map(Number)
    const [endHour, endMinute] = end.split(':').map(Number)
    return (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
  }

  const handlePageChange = (type, page) => {
    setCurrentPage(prev => ({ ...prev, [type]: page }))
    
    switch (type) {
      case 'students':
        fetchStudents(page)
        break
      case 'lecturers':
        fetchLecturers(page)
        break
      case 'courses':
        fetchCourses(page)
        break
      case 'assignments':
        fetchAssignments(page)
        break
      case 'exams':
        fetchExams(page)
        break
    }
  }

  const handleSearch = async (type, term) => {
    if (!term) {
      // Reset to first page
      handlePageChange(type, 1)
      return
    }
    
    try {
      let query
      
      switch (type) {
        case 'students':
          query = supabase
            .from('students')
            .select('*', { count: 'exact' })
            .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,student_id.ilike.%${term}%`)
            .limit(itemsPerPage)
          break
        case 'lecturers':
          query = supabase
            .from('lecturers')
            .select('*', { count: 'exact' })
            .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,lecturer_id.ilike.%${term}%`)
            .limit(itemsPerPage)
          break
        case 'courses':
          query = supabase
            .from('courses')
            .select('*', { count: 'exact' })
            .or(`course_code.ilike.%${term}%,course_name.ilike.%${term}%,description.ilike.%${term}%`)
            .limit(itemsPerPage)
          break
      }
      
      const { data, count, error } = await query
      
      if (error) throw error
      
      switch (type) {
        case 'students':
          setStudents(data || [])
          setTotalItems(prev => ({ ...prev, students: count || 0 }))
          break
        case 'lecturers':
          setLecturers(data || [])
          setTotalItems(prev => ({ ...prev, lecturers: count || 0 }))
          break
        case 'courses':
          setCourses(data || [])
          setTotalItems(prev => ({ ...prev, courses: count || 0 }))
          break
      }
      
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  // Render loading states
  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Redirecting to login...</p>
      </div>
    )
  }

  // Color palette
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="logo">
              {isAdmin ? 'SYSTEM ADMIN PORTAL' : 'LECTURER PORTAL'}
            </h1>
            <p className="tagline">
              {isAdmin ? 'University Management System' : 'Teaching & Course Management'}
            </p>
            <div className="realtime-indicator">
              <span className={`realtime-dot ${realtimeConnected ? 'connected' : 'disconnected'}`}></span>
              <span>Realtime: {realtimeConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          <div className="header-right">
            <div className="user-section">
              <div className="user-info">
                <div className={`avatar ${isAdmin ? 'admin' : 'lecturer'}`}>
                  {profile.full_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || (isAdmin ? 'A' : 'L')}
                </div>
                <div>
                  <p className="user-name">{profile.full_name || profile.email}</p>
                  <p className="user-role">
                    <span className={`role-badge ${isAdmin ? 'admin' : 'lecturer'}`}>
                      {isAdmin ? 'SYSTEM ADMIN' : 'LECTURER'}
                    </span>
                  </p>
                </div>
              </div>
              <button 
                className="logout-button"
                onClick={() => setShowLogoutModal(true)}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dashboard-nav">
        <button 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>

        {isLecturer && (
          <>
            <button 
              className={`nav-item ${activeTab === 'lectures' ? 'active' : ''}`}
              onClick={() => setActiveTab('lectures')}
            >
              🎓 My Lectures
            </button>
            <button 
              className={`nav-item ${activeTab === 'materials' ? 'active' : ''}`}
              onClick={() => setActiveTab('materials')}
            >
              📚 Course Materials
            </button>
          </>
        )}

        <button 
          className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👥 Students
        </button>

        <button 
          className={`nav-item ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📖 Courses
        </button>

        <button 
          className={`nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📝 Assignments
        </button>

        <button 
          className={`nav-item ${activeTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          🎯 Exams
        </button>

        {isAdmin && (
          <>
            <button 
              className={`nav-item ${activeTab === 'lecturers' ? 'active' : ''}`}
              onClick={() => setActiveTab('lecturers')}
            >
              👨‍🏫 Lecturers
            </button>
            <button 
              className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              💰 Finance
            </button>
            <button 
              className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              📈 Reports
            </button>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙ Settings
            </button>
          </>
        )}

        {isLecturer && (
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 My Profile
          </button>
        )}
      </nav>

      {/* Alerts */}
      {error && (
        <div className="alert error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="alert-close">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="alert success">
          <span className="alert-icon">✅</span>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="alert-close">
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        {loading.dashboard && activeTab === 'dashboard' ? (
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="dashboard-content">
                {/* Welcome Section */}
                <div className="welcome-section">
                  <div>
                    <h2>
                      {isAdmin 
                        ? `Welcome, System Administrator! 👑` 
                        : `Welcome, ${profile.full_name?.split(' ')[0] || 'Lecturer'}! 👨‍🏫`
                      }
                    </h2>
                    <p>
                      {isAdmin 
                        ? `Last updated: ${new Date().toLocaleTimeString()} | Real-time data active`
                        : 'Manage your lectures, course materials, and student interactions'
                      }
                    </p>
                  </div>
                  <button 
                    onClick={initializeDashboard}
                    className="refresh-button"
                    disabled={loading.dashboard}
                  >
                    🔄 Refresh Data
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: '#3498db' }}>👥</div>
                    <h3>{stats.totalStudents.toLocaleString()}</h3>
                    <p>Total Students</p>
                    <div className="stat-subtext">
                      <span className="active-badge">
                        {stats.activeStudents} active
                      </span>
                      {realtimeConnected && <span className="live-badge">LIVE</span>}
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <>
                      <div className="stat-card">
                        <div className="stat-icon" style={{ color: '#9b59b6' }}>👨‍🏫</div>
                        <h3>{stats.totalLecturers}</h3>
                        <p>Lecturers</p>
                        <div className="stat-subtext">
                          Teaching staff
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon" style={{ color: '#e74c3c' }}>👑</div>
                        <h3>{stats.totalAdmins}</h3>
                        <p>System Admins</p>
                        <div className="stat-subtext">
                          Management team
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: '#2ecc71' }}>📚</div>
                    <h3>{stats.totalCourses}</h3>
                    <p>Active Courses</p>
                    <div className="stat-subtext">
                      All departments
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: '#f39c12' }}>📝</div>
                    <h3>{stats.pendingAssignments}</h3>
                    <p>Pending Assignments</p>
                    <div className="stat-subtext">
                      To be graded
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: '#1abc9c' }}>🎯</div>
                    <h3>{stats.pendingExams}</h3>
                    <p>Upcoming Exams</p>
                    <div className="stat-subtext">
                      To be conducted
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-icon" style={{ color: '#e67e22' }}>💰</div>
                    <h3>{stats.pendingPayments}</h3>
                    <p>Pending Payments</p>
                    <div className="stat-subtext">
                      Awaiting clearance
                    </div>
                  </div>
                </div>

        

                {/* Quick Actions */}
                <div className="actions-section">
                  <h3>Quick Actions</h3>
                  <div className="actions-grid">
                    {isLecturer && (
                      <>
                        <button 
                          className="action-button"
                          onClick={() => setShowLectureModal(true)}
                        >
                          <span className="action-icon">➕</span>
                          <span>Schedule New Lecture</span>
                          <small>With Google Meet</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setShowAssignmentModal(true)}
                        >
                          <span className="action-icon">📝</span>
                          <span>Create Assignment</span>
                          <small>For your courses</small>
                        </button>
                      </>
                    )}
                    
                    {isAdmin && (
                      <>
                        <button 
                          className="action-button"
                          onClick={() => setShowUserModal(true)}
                        >
                          <span className="action-icon">👤</span>
                          <span>Add New User</span>
                          <small>Student, Lecturer or Admin</small>
                        </button>
                        
                        <button 
                          className="action-button"
                          onClick={() => setShowCourseModal(true)}
                        >
                          <span className="action-icon">📚</span>
                          <span>Add New Course</span>
                          <small>Academic program</small>
                        </button>
                      </>
                    )}
                    
                    <button 
                      className="action-button"
                      onClick={() => navigate('/reports')}
                    >
                      <span className="action-icon">📊</span>
                      <span>Generate Reports</span>
                      <small>Analytics & insights</small>
                    </button>
                    
                    {isAdmin && (
                      <button 
                        className="action-button"
                        onClick={() => navigate('/settings')}
                      >
                        <span className="action-icon">⚙️</span>
                        <span>System Settings</span>
                        <small>Configuration</small>
                      </button>
                    )}
                  </div>
                </div>

                {/* Upcoming Lectures - For Lecturers */}
                {isLecturer && lectures.length > 0 && (
                  <div className="lectures-section">
                    <div className="section-header">
                      <h3>📅 Your Upcoming Lectures</h3>
                      <button 
                        className="view-all-button"
                        onClick={() => setActiveTab('lectures')}
                      >
                        View All →
                      </button>
                    </div>
                    <div className="lectures-list">
                      {lectures.slice(0, 3).map(lecture => (
                        <div key={lecture.id} className="lecture-card">
                          <div className="lecture-header">
                            <h4>{lecture.courses?.course_code || 'CS-101'}: {lecture.title}</h4>
                            <span className={`lecture-status ${lecture.status}`}>
                              {lecture.status}
                            </span>
                          </div>
                          <p>{lecture.description}</p>
                          <div className="lecture-details">
                            <span>📅 {new Date(lecture.scheduled_date).toLocaleDateString()}</span>
                            <span>⏰ {lecture.start_time} - {lecture.end_time}</span>
                            {lecture.google_meet_link && (
                              <a href={lecture.google_meet_link} target="_blank" rel="noreferrer" className="meet-link">
                                Join Google Meet
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity - For Admins */}
                {isAdmin && (
                  <div className="activity-section">
                    <h3>🔄 Recent System Activity</h3>
                    <div className="activity-list">
                      <div className="activity-item">
                        <span className="activity-icon">👤</span>
                        <div className="activity-content">
                          <p>New student registered: Robert Mayhem</p>
                          <small>Just now</small>
                        </div>
                      </div>
                      <div className="activity-item">
                        <span className="activity-icon">📝</span>
                        <div className="activity-content">
                          <p>Assignment submitted: CS-401 Assignment 2</p>
                          <small>5 minutes ago</small>
                        </div>
                      </div>
                      <div className="activity-item">
                        <span className="activity-icon">💰</span>
                        <div className="activity-content">
                          <p>Payment received: John Doe - $5,000</p>
                          <small>1 hour ago</small>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>👥 Student Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="search-input"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        handleSearch('students', e.target.value)
                      }}
                    />
                    {isAdmin && (
                      <button 
                        className="add-button"
                        onClick={() => setShowUserModal(true)}
                      >
                        + Add Student
                      </button>
                    )}
                  </div>
                </div>
                
                {loading.students ? (
                  <div className="loading-content">
                    <div className="spinner"></div>
                    <p>Loading students...</p>
                  </div>
                ) : (
                  <>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
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
                          {students.map(student => (
                            <tr key={student.id}>
                              <td>{student.student_id}</td>
                              <td>{student.full_name}</td>
                              <td>{student.email}</td>
                              <td>{student.program}</td>
                              <td>Year {student.year_of_study}</td>
                              <td>
                                <span className={`status-badge ${student.status}`}>
                                  {student.status}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="action-btn view"
                                    onClick={() => setSelectedUser(student)}
                                  >
                                    👁 View
                                  </button>
                                  {isAdmin && (
                                    <button className="action-btn edit">
                                      ✏ Edit
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    <div className="pagination">
                      <button 
                        disabled={currentPage.students === 1}
                        onClick={() => handlePageChange('students', currentPage.students - 1)}
                      >
                        ← Previous
                      </button>
                      <span>
                        Page {currentPage.students} of {Math.ceil(totalItems.students / itemsPerPage)}
                      </span>
                      <button 
                        disabled={currentPage.students === Math.ceil(totalItems.students / itemsPerPage)}
                        onClick={() => handlePageChange('students', currentPage.students + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Courses Tab */}
            {activeTab === 'courses' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📖 Course Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search courses..."
                      className="search-input"
                      onChange={(e) => handleSearch('courses', e.target.value)}
                    />
                    {(isAdmin || isLecturer) && (
                      <button 
                        className="add-button"
                        onClick={() => setShowCourseModal(true)}
                      >
                        + Add Course
                      </button>
                    )}
                  </div>
                </div>
                
                {loading.courses ? (
                  <div className="loading-content">
                    <div className="spinner"></div>
                    <p>Loading courses...</p>
                  </div>
                ) : (
                  <div className="courses-grid">
                    {courses.map(course => (
                      <div key={course.id} className="course-card">
                        <div className="course-header">
                          <h3>{course.course_code}</h3>
                          <span className={`course-status ${course.is_active ? 'active' : 'inactive'}`}>
                            {course.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <h4>{course.course_name}</h4>
                        <p className="course-description">{course.description}</p>
                        <div className="course-details">
                          <span>Year {course.year} - Semester {course.semester}</span>
                          <span>{course.credits} Credits</span>
                          <span>{course.program}</span>
                        </div>
                        <div className="course-actions">
                          <button 
                            className="course-btn"
                            onClick={() => setSelectedCourse(course)}
                          >
                            View Details
                          </button>
                          {isLecturer && (
                            <button className="course-btn secondary">
                              Assign Lecturer
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>📝 Assignment Management</h2>
                  {isLecturer && (
                    <button 
                      className="add-button"
                      onClick={() => setShowAssignmentModal(true)}
                    >
                      + Create Assignment
                    </button>
                  )}
                </div>
                
                <div className="assignments-list">
                  {assignments.map(assignment => (
                    <div key={assignment.id} className="assignment-card">
                      <div className="assignment-header">
                        <div>
                          <h3>{assignment.title}</h3>
                          <p className="course-info">
                            {assignment.courses?.course_code} - {assignment.courses?.course_name}
                          </p>
                        </div>
                        <span className={`assignment-status ${assignment.status}`}>
                          {assignment.status}
                        </span>
                      </div>
                      <p>{assignment.description}</p>
                      <div className="assignment-details">
                        <span>📅 Due: {new Date(assignment.due_date).toLocaleString()}</span>
                        <span>📊 Total Marks: {assignment.total_marks}</span>
                        <span>👨‍🏫 Lecturer: {assignment.lecturers?.full_name}</span>
                      </div>
                      <div className="assignment-actions">
                        <button className="action-btn view">
                          View Submissions
                        </button>
                        {isLecturer && (
                          <>
                            <button className="action-btn edit">
                              Edit
                            </button>
                            <button className="action-btn grade">
                              Grade
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lecturers Tab (Admin only) */}
            {activeTab === 'lecturers' && isAdmin && (
              <div className="tab-content">
                <div className="tab-header">
                  <h2>👨‍🏫 Lecturer Management</h2>
                  <div className="tab-actions">
                    <input
                      type="text"
                      placeholder="Search lecturers..."
                      className="search-input"
                      onChange={(e) => handleSearch('lecturers', e.target.value)}
                    />
                    <button 
                      className="add-button"
                      onClick={() => {
                        setNewUser({ ...newUser, role: 'lecturer' })
                        setShowUserModal(true)
                      }}
                    >
                      + Add Lecturer
                    </button>
                  </div>
                </div>
                
                {loading.lecturers ? (
                  <div className="loading-content">
                    <div className="spinner"></div>
                    <p>Loading lecturers...</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Lecturer ID</th>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Specialization</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lecturers.map(lecturer => (
                          <tr key={lecturer.id}>
                            <td>{lecturer.lecturer_id}</td>
                            <td>{lecturer.full_name}</td>
                            <td>{lecturer.email}</td>
                            <td>{lecturer.department}</td>
                            <td>{lecturer.specialization}</td>
                            <td>
                              <span className={`status-badge ${lecturer.status}`}>
                                {lecturer.status}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button className="action-btn view">
                                  View
                                </button>
                                <button className="action-btn edit">
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Finance Tab (Admin only) */}
            {activeTab === 'finance' && isAdmin && (
              <div className="tab-content">
                <h2>💰 Financial Management</h2>
                <div className="financial-overview">
                  <div className="financial-card">
                    <h3>Total Revenue</h3>
                    <p className="amount">$250,000</p>
                    <small>This academic year</small>
                  </div>
                  <div className="financial-card">
                    <h3>Pending Payments</h3>
                    <p className="amount">$45,000</p>
                    <small>Awaiting clearance</small>
                  </div>
                  <div className="financial-card">
                    <h3>Cleared Payments</h3>
                    <p className="amount">$205,000</p>
                    <small>Successfully processed</small>
                  </div>
                </div>
                
                <div className="table-container">
                  <h3>Recent Transactions</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Student</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialRecords.slice(0, 10).map(record => (
                        <tr key={record.id}>
                          <td>{record.receipt_number || 'N/A'}</td>
                          <td>{record.students?.full_name}</td>
                          <td>{record.description}</td>
                          <td>${record.amount}</td>
                          <td>{new Date(record.payment_date || record.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${record.status}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="tab-content profile-content">
                <h2>👤 My Profile</h2>
                <div className="profile-container">
                  <div className="profile-sidebar">
                    <div className="profile-avatar large">
                      {profile.full_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase()}
                    </div>
                    <h3>{profile.full_name}</h3>
                    <p className="profile-role">
                      <span className={`role-badge ${isAdmin ? 'admin' : 'lecturer'}`}>
                        {isAdmin ? 'System Administrator' : 'Lecturer'}
                      </span>
                    </p>
                    <p className="profile-email">{profile.email}</p>
                  </div>
                  
                  <div className="profile-details">
                    <div className="profile-section">
                      <h4>Personal Information</h4>
                      <div className="info-grid">
                        <div className="info-item">
                          <label>Full Name</label>
                          <p>{profile.full_name || 'Not set'}</p>
                        </div>
                        <div className="info-item">
                          <label>Email</label>
                          <p>{profile.email}</p>
                        </div>
                        <div className="info-item">
                          <label>Phone</label>
                          <p>{profile.phone || 'Not set'}</p>
                        </div>
                        {isLecturer && (
                          <>
                            <div className="info-item">
                              <label>Department</label>
                              <p>{profile.department || 'Not set'}</p>
                            </div>
                            <div className="info-item">
                              <label>Specialization</label>
                              <p>{profile.specialization || 'Not set'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="profile-section">
                      <h4>Account Settings</h4>
                      <div className="settings-grid">
                        <div className="setting-item">
                          <label>Email Notifications</label>
                          <input type="checkbox" defaultChecked />
                        </div>
                        <div className="setting-item">
                          <label>Theme</label>
                          <select defaultValue="light">
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <button className="update-profile-btn">
                      Update Profile
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {/* Add User Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New User</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>Role</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
              </div>
              
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              
              <div className="form-group">
                <label>Phone</label>
                <input 
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              
              {newUser.role === 'student' && (
                <>
                  <div className="form-group">
                    <label>Program</label>
                    <input 
                      type="text"
                      value={newUser.program}
                      onChange={(e) => setNewUser({ ...newUser, program: e.target.value })}
                      placeholder="e.g., Computer Engineering"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Year of Study</label>
                    <select 
                      value={newUser.year_of_study}
                      onChange={(e) => setNewUser({ ...newUser, year_of_study: parseInt(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map(year => (
                        <option key={year} value={year}>Year {year}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              {newUser.role === 'lecturer' && (
                <>
                  <div className="form-group">
                    <label>Department</label>
                    <input 
                      type="text"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Specialization</label>
                    <input 
                      type="text"
                      value={newUser.specialization}
                      onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })}
                      placeholder="e.g., Web Development"
                    />
                  </div>
                </>
              )}
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddUser}
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showCourseModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Course</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>Course Code</label>
                <input 
                  type="text"
                  value={newCourse.course_code}
                  onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })}
                  placeholder="e.g., CS-401"
                />
              </div>
              
              <div className="form-group">
                <label>Course Name</label>
                <input 
                  type="text"
                  value={newCourse.course_name}
                  onChange={(e) => setNewCourse({ ...newCourse, course_name: e.target.value })}
                  placeholder="e.g., Machine Learning"
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Course description"
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <select 
                    value={newCourse.year}
                    onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Semester</label>
                  <select 
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: parseInt(e.target.value) })}
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Credits</label>
                  <input 
                    type="number"
                    value={newCourse.credits}
                    onChange={(e) => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) })}
                    min="1"
                    max="6"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Program</label>
                <input 
                  type="text"
                  value={newCourse.program}
                  onChange={(e) => setNewCourse({ ...newCourse, program: e.target.value })}
                  placeholder="e.g., Computer Engineering"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Faculty</label>
                  <input 
                    type="text"
                    value={newCourse.faculty}
                    onChange={(e) => setNewCourse({ ...newCourse, faculty: e.target.value })}
                    placeholder="e.g., Computing"
                  />
                </div>
                
                <div className="form-group">
                  <label>Department</label>
                  <input 
                    type="text"
                    value={newCourse.department}
                    onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                    placeholder="e.g., Computer Science"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox"
                    checked={newCourse.is_core}
                    onChange={(e) => setNewCourse({ ...newCourse, is_core: e.target.checked })}
                  />
                  <span>Core Course</span>
                </label>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowCourseModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddCourse}
                >
                  Add Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAssignmentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Assignment</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>Course</label>
                <select 
                  value={newAssignment.course_id}
                  onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  placeholder="Assignment title"
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  placeholder="Assignment description"
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label>Instructions</label>
                <textarea 
                  value={newAssignment.instructions}
                  onChange={(e) => setNewAssignment({ ...newAssignment, instructions: e.target.value })}
                  placeholder="Instructions for students"
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Due Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={newAssignment.due_date}
                    onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Total Marks</label>
                  <input 
                    type="number"
                    value={newAssignment.total_marks}
                    onChange={(e) => setNewAssignment({ ...newAssignment, total_marks: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Submission Type</label>
                  <select 
                    value={newAssignment.submission_type}
                    onChange={(e) => setNewAssignment({ ...newAssignment, submission_type: e.target.value })}
                  >
                    <option value="file">File Upload</option>
                    <option value="text">Text Submission</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Max File Size (MB)</label>
                  <input 
                    type="number"
                    value={newAssignment.max_file_size}
                    onChange={(e) => setNewAssignment({ ...newAssignment, max_file_size: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowAssignmentModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-button"
                  onClick={handleAddAssignment}
                >
                  Create Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button logout"
                onClick={handleLogout}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        <p>© {new Date().getFullYear()} NLE University • {isAdmin ? 'Admin Portal' : 'Lecturer Portal'}</p>
        <p className="footer-info">
          {isAdmin 
            ? `Total Students: ${stats.totalStudents} | Lecturers: ${stats.totalLecturers} | Last Updated: ${new Date().toLocaleTimeString()}`
            : `Your Students: ${stats.activeStudents} active | Upcoming Lectures: ${lectures.length}`
          }
        </p>
      </footer>
    </div>
  )
}

// CSS Styles
const styles = `
/* Base Styles */
.admin-dashboard {
  min-height: 100vh;
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

/* Loading States */
.loading-container,
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Header */
.dashboard-header {
  background-color: #2c3e50;
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.header-left {
  flex: 1;
}

.logo {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #ecf0f1;
}

.tagline {
  margin: 5px 0 0 0;
  font-size: 14px;
  color: #bdc3c7;
}

.realtime-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #95a5a6;
}

.realtime-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.realtime-dot.connected {
  background-color: #2ecc71;
  animation: pulse 2s infinite;
}

.realtime-dot.disconnected {
  background-color: #e74c3c;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
}

.avatar.admin {
  background-color: #e74c3c;
}

.avatar.lecturer {
  background-color: #3498db;
}

.user-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.user-role {
  margin: 5px 0 0 0;
  font-size: 12px;
}

.role-badge {
  color: white;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.role-badge.admin {
  background-color: #e74c3c;
}

.role-badge.lecturer {
  background-color: #3498db;
}

.logout-button {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.3s;
}

.logout-button:hover {
  background-color: #c0392b;
}

/* Navigation */
.dashboard-nav {
  background-color: white;
  padding: 15px 20px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  border-bottom: 1px solid #e0e0e0;
}

.nav-item {
  padding: 10px 20px;
  background-color: transparent;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.3s;
}

.nav-item:hover {
  background-color: #f8f9fa;
  border-color: #3498db;
}

.nav-item.active {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

/* Alerts */
.alert {
  padding: 12px 20px;
  margin: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert.error {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
}

.alert.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.alert-icon {
  font-size: 18px;
}

.alert-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: inherit;
}

/* Main Content */
.dashboard-main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

/* Dashboard Content */
.welcome-section {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.refresh-button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.3s;
}

.refresh-button:hover {
  background-color: #2980b9;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-icon {
  font-size: 40px;
  margin-bottom: 15px;
}

.stat-subtext {
  margin-top: 8px;
  font-size: 12px;
  color: #7f8c8d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.active-badge {
  background-color: #2ecc71;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.live-badge {
  background-color: #e74c3c;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Charts Section */
.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.chart-container {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

/* Actions Section */
.actions-section {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.action-button {
  padding: 20px;
  background-color: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.action-button:hover {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.action-button:hover small {
  color: rgba(255,255,255,0.9);
}

.action-icon {
  font-size: 24px;
}

/* Lectures Section */
.lectures-section {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.view-all-button {
  background-color: transparent;
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.lectures-list {
  display: grid;
  gap: 15px;
}

.lecture-card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.lecture-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.lecture-status {
  background-color: #3498db;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.lecture-details {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  font-size: 14px;
  color: #666;
  flex-wrap: wrap;
  align-items: center;
}

.meet-link {
  color: #3498db;
  text-decoration: none;
  font-weight: 600;
  padding: 4px 8px;
  border: 1px solid #3498db;
  border-radius: 4px;
  font-size: 12px;
}

.meet-link:hover {
  background-color: #3498db;
  color: white;
}

/* Activity Section */
.activity-section {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.activity-list {
  display: grid;
  gap: 15px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.activity-icon {
  font-size: 20px;
}

.activity-content p {
  margin: 0;
}

.activity-content small {
  color: #7f8c8d;
  font-size: 12px;
}

/* Tab Content */
.tab-content {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.tab-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.search-input {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.add-button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

/* Tables */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.data-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.data-table tr:hover {
  background-color: #f8f9fa;
}

/* Status Badges */
.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background-color: #2ecc71;
  color: white;
}

.status-badge.pending {
  background-color: #f39c12;
  color: white;
}

.status-badge.inactive {
  background-color: #7f8c8d;
  color: white;
}

.status-badge.suspended {
  background-color: #e74c3c;
  color: white;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.action-btn.view {
  background-color: #3498db;
  color: white;
}

.action-btn.edit {
  background-color: #f39c12;
  color: white;
}

.action-btn.grade {
  background-color: #2ecc71;
  color: white;
}

/* Courses Grid */
.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.course-card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.course-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.course-status.active {
  background-color: #2ecc71;
  color: white;
}

.course-status.inactive {
  background-color: #7f8c8d;
  color: white;
}

.course-description {
  color: #666;
  margin: 10px 0;
  font-size: 14px;
}

.course-details {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 15px 0;
  font-size: 13px;
  color: #7f8c8d;
}

.course-actions {
  display: flex;
  gap: 10px;
}

.course-btn {
  flex: 1;
  padding: 8px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.course-btn.secondary {
  background-color: #f8f9fa;
  color: #333;
  border: 1px solid #ddd;
}

/* Assignments List */
.assignments-list {
  display: grid;
  gap: 20px;
}

.assignment-card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #f39c12;
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.course-info {
  color: #7f8c8d;
  font-size: 13px;
  margin: 5px 0 0 0;
}

.assignment-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.assignment-status.published {
  background-color: #3498db;
  color: white;
}

.assignment-status.draft {
  background-color: #7f8c8d;
  color: white;
}

.assignment-details {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 15px 0;
  font-size: 14px;
  color: #666;
}

.assignment-actions {
  display: flex;
  gap: 10px;
}

/* Financial Overview */
.financial-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.financial-card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.financial-card .amount {
  font-size: 24px;
  font-weight: 700;
  margin: 10px 0;
}

.financial-card small {
  color: #7f8c8d;
}

/* Reports */
.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.report-card {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.report-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.report-btn {
  padding: 12px 20px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Profile */
.profile-content {
  max-width: 1000px;
  margin: 0 auto;
}

.profile-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 40px;
}

.profile-sidebar {
  text-align: center;
}

.profile-avatar.large {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background-color: #3498db;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: bold;
  margin: 0 auto 20px;
}

.profile-role {
  margin: 10px 0;
}

.profile-email {
  color: #7f8c8d;
  font-size: 14px;
}

.profile-section {
  margin-bottom: 30px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.info-item label {
  display: block;
  color: #7f8c8d;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 5px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.setting-item:last-child {
  border-bottom: none;
}

.update-profile-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: white;
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

.modal-form {
  margin-top: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  resize: vertical;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
}

.cancel-button {
  padding: 10px 20px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.confirm-button {
  padding: 10px 20px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.confirm-button.logout {
  background-color: #e74c3c;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
}

.pagination button {
  padding: 8px 16px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.pagination button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.pagination span {
  color: #7f8c8d;
  font-size: 14px;
}

/* Footer */
.dashboard-footer {
  background-color: #2c3e50;
  color: #ecf0f1;
  padding: 20px;
  text-align: center;
  margin-top: 40px;
}

.footer-info {
  font-size: 12px;
  color: #bdc3c7;
  margin-top: 5px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
  
  .user-section {
    flex-direction: column;
  }
  
  .dashboard-nav {
    overflow-x: auto;
    padding: 10px;
  }
  
  .nav-item {
    padding: 8px 15px;
    font-size: 13px;
  }
  
  .stats-grid,
  .charts-section,
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .profile-container {
    grid-template-columns: 1fr;
  }
  
  .modal {
    padding: 20px;
    width: 95%;
  }
}
`

// Inject styles
const styleSheet = document.createElement('style')
styleSheet.textContent = styles
document.head.appendChild(styleSheet)

export default AdminDashboard