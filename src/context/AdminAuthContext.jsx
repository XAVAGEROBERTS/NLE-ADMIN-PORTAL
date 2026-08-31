import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AdminAuthContext = createContext({})

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null) // 'admin', 'dean', 'hod', 'lecturer', or 'finance'

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        console.log('🔍 Checking admin session...')
        
        // Get user from localStorage first (for custom auth)
        const storedUser = localStorage.getItem('admin_user')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          console.log('✅ Found user in localStorage:', userData)
          setAdmin({ email: userData.email })
          setProfile(userData)
          setRole(userData.role)
          setLoading(false)
          return
        }

        // Check for Supabase auth session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.log('Session error:', sessionError)
          setLoading(false)
          return
        }

        if (!session) {
          console.log('No session found')
          setLoading(false)
          return
        }

        console.log('✅ Supabase session found for:', session.user.email)

        // Get all roles for this user (not just single)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('email', session.user.email)

        if (roleError) {
          console.log('⚠️ No roles found in user_roles table:', roleError)
          setLoading(false)
          return
        }

        console.log('📋 User roles from database:', roleData)

        // Filter for admin/lecturer/finance/dean/hod roles
        const allowedRoles = ['admin', 'dean', 'hod', 'lecturer', 'finance']
        const validRoles = roleData.filter(r => allowedRoles.includes(r.role))
        
        if (validRoles.length === 0) {
          console.log('⚠️ User has no admin/lecturer/finance/dean/hod roles')
          setLoading(false)
          return
        }

        // Choose primary role (priority: admin > dean > hod > finance > lecturer)
        const rolePriority = { admin: 5, dean: 4, hod: 3, finance: 2, lecturer: 1 }
        validRoles.sort((a, b) => rolePriority[b.role] - rolePriority[a.role])
        const primaryRoleData = validRoles[0]
        
        setRole(primaryRoleData.role)
        setAdmin(session.user)
        
        // Fetch profile based on role
        let profileData = null
        
        if (primaryRoleData.role === 'admin') {
          const { data: adminProfile } = await supabase
            .from('system_admins')
            .select('*')
            .eq('id', primaryRoleData.table_id)
            .single()
          profileData = adminProfile
        } else if (primaryRoleData.role === 'lecturer') {
          console.log('🔍 Loading lecturer with ID:', primaryRoleData.table_id)
          const { data: lecturerProfile, error: lecturerError } = await supabase
            .from('lecturers')
            .select('*')
            .eq('id', primaryRoleData.table_id)
            .single()
          
          if (lecturerError) {
            console.error('❌ Lecturer load error:', lecturerError)
            profileData = null
          } else {
            profileData = lecturerProfile
            console.log('✅ Lecturer profile loaded:', lecturerProfile)
          }
        } else if (primaryRoleData.role === 'finance') {
          const { data: financeProfile } = await supabase
            .from('finance_officers')
            .select('*')
            .eq('id', primaryRoleData.table_id)
            .single()
          profileData = financeProfile
        } else if (primaryRoleData.role === 'dean') {
          // For dean, fetch faculty info
          const { data: facultyData } = await supabase
            .from('faculties')
            .select('*')
            .eq('id', primaryRoleData.faculty_id)
            .single()
          profileData = {
            ...facultyData,
            full_name: session.user.email,
            faculty_id: primaryRoleData.faculty_id
          }
        } else if (primaryRoleData.role === 'hod') {
          // For HOD, fetch department info
          const { data: deptData } = await supabase
            .from('departments')
            .select('*')
            .eq('id', primaryRoleData.department_id)
            .single()
          profileData = {
            ...deptData,
            full_name: session.user.email,
            department_id: primaryRoleData.department_id,
            faculty_id: primaryRoleData.faculty_id
          }
        }
        
        if (profileData) {
          const fullProfile = {
            ...profileData,
            role: primaryRoleData.role,
            full_name: profileData.full_name || session.user.email,
            table_id: primaryRoleData.table_id,
            faculty_id: primaryRoleData.faculty_id,
            department_id: primaryRoleData.department_id,
            // Include all roles for permission checking
            roles: validRoles.map(r => r.role)
          }
          setProfile(fullProfile)
          localStorage.setItem('admin_user', JSON.stringify(fullProfile))
          console.log('✅ Profile set from session:', fullProfile)
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAdminSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        if (event === 'SIGNED_IN' && session) {
          await checkAdminSession()
        } else if (event === 'SIGNED_OUT') {
          setAdmin(null)
          setProfile(null)
          setRole(null)
          localStorage.removeItem('admin_user')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      console.log('🔐 Signing in with:', email)
      
      // Use the custom authenticate_user function from your SQL
      const { data, error } = await supabase.rpc('authenticate_user', {
        user_email: email.trim(),
        user_password: password.trim()
      })

      if (error) {
        console.error('❌ RPC error:', error)
        setLoading(false)
        return { success: false, error: error.message }
      }

      console.log('✅ RPC response:', data)

      if (!data || data.length === 0) {
        setLoading(false)
        return { success: false, error: 'Invalid credentials or not authorized' }
      }

      const user = data[0]
      console.log('👤 Authenticated user:', user)

      // Check if user has allowed role
      const allowedRoles = ['admin', 'dean', 'hod', 'lecturer', 'finance']
      if (!allowedRoles.includes(user.role)) {
        setLoading(false)
        return { success: false, error: 'Access denied. Your role is not authorized for this portal.' }
      }

      // Update last login
      try {
        await supabase.rpc('update_last_login', {
          user_email: email,
          user_role: user.role
        })
      } catch (updateError) {
        console.warn('⚠️ Last login update failed (non-critical):', updateError.message)
      }

      // Get additional profile data
      let profileData = {}
      let tableName = ''
      
      console.log('🔍 Fetching profile with table_id:', user.table_id)
      
      if (user.role === 'admin') {
        tableName = 'system_admins'
        const { data: adminData, error: adminError } = await supabase
          .from('system_admins')
          .select('*')
          .eq('id', user.table_id)
          .single()
        
        if (adminError) {
          console.error('Admin fetch error:', adminError)
        } else {
          profileData = adminData || {}
        }
        
      } else if (user.role === 'lecturer') {
        tableName = 'lecturers'
        console.log('🔍 Looking up lecturer with ID:', user.table_id)
        
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('lecturers')
          .select('*')
          .eq('id', user.table_id)
          .single()
        
        if (lecturerError) {
          console.error('❌ Lecturer fetch error:', lecturerError)
          setLoading(false)
          return { 
            success: false, 
            error: `Failed to fetch lecturer profile: ${lecturerError.message}` 
          }
        }
        
        profileData = lecturerData || {}
        console.log('✅ Lecturer profile fetched successfully:', profileData)
        
      } else if (user.role === 'finance') {
        tableName = 'finance_officers'
        const { data: financeData, error: financeError } = await supabase
          .from('finance_officers')
          .select('*')
          .eq('id', user.table_id)
          .single()
        
        if (financeError) {
          console.error('Finance fetch error:', financeError)
        } else {
          profileData = financeData || {}
        }
      } else if (user.role === 'dean') {
        tableName = 'faculties'
        const { data: facultyData, error: facultyError } = await supabase
          .from('faculties')
          .select('*')
          .eq('id', user.faculty_id || user.table_id)
          .single()
        
        if (facultyError) {
          console.error('Dean faculty fetch error:', facultyError)
        } else {
          profileData = facultyData || {}
        }
      } else if (user.role === 'hod') {
        tableName = 'departments'
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('*')
          .eq('id', user.department_id || user.table_id)
          .single()
        
        if (deptError) {
          console.error('HOD department fetch error:', deptError)
        } else {
          profileData = deptData || {}
        }
      }

      // Create user profile object
      const userProfile = {
        ...profileData,
        email: email,
        role: user.role,
        full_name: user.full_name || profileData.full_name || email,
        permissions: user.permissions || [],
        table_id: user.table_id,
        table_name: tableName,
        faculty_id: user.faculty_id || profileData.faculty_id || null,
        department_id: user.department_id || profileData.department_id || null,
        // Include all roles if available
        roles: user.roles || [user.role]
      }

      console.log('✅ Final user profile:', userProfile)

      // Set user data
      setRole(user.role)
      setAdmin({ email: email })
      setProfile(userProfile)
      localStorage.setItem('admin_user', JSON.stringify(userProfile))
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('✅ Sign in complete, returning success')
      return { success: true, role: user.role, profile: userProfile }
      
    } catch (error) {
      console.error('❌ Login failed:', error)
      setLoading(false)
      return { 
        success: false, 
        error: error.message || 'Invalid credentials. Please try again.' 
      }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      localStorage.removeItem('admin_user')
      setAdmin(null)
      setProfile(null)
      setRole(null)
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // Check if user can access specific features
  const canAccess = (feature) => {
    if (!role) return false
    
    const permissions = {
      admin: {
        dashboard: true,
        lectures: true,
        materials: true,
        students: true,
        assignments: true,
        grades: true,
        profile: true,
        system_settings: true,
        user_management: true,
        all_users: true,
        system_logs: true,
        database_management: true,
        faculty_management: true,
        department_management: true,
        finance_management: true,
        course_management: true
      },
      dean: {
        dashboard: true,
        lectures: true,
        materials: true,
        students: true,
        assignments: true,
        grades: true,
        profile: true,
        faculty_management: true,
        department_management: true,
        course_management: true,
        // Restricted for dean:
        system_settings: false,
        user_management: false,
        all_users: false,
        system_logs: false,
        database_management: false,
        finance_management: false
      },
      hod: {
        dashboard: true,
        lectures: true,
        materials: true,
        students: true,
        assignments: true,
        grades: true,
        profile: true,
        department_management: true,
        course_management: true,
        // Restricted for HOD:
        system_settings: false,
        user_management: false,
        all_users: false,
        system_logs: false,
        database_management: false,
        finance_management: false,
        faculty_management: false
      },
      finance: {
        dashboard: true,
        profile: true,
        finance_management: true,
        // Restricted for finance:
        lectures: false,
        materials: false,
        students: false,
        assignments: false,
        grades: false,
        system_settings: false,
        user_management: false,
        all_users: false,
        system_logs: false,
        database_management: false,
        faculty_management: false,
        department_management: false,
        course_management: false
      },
      lecturer: {
        dashboard: true,
        lectures: true,
        materials: true,
        students: true,
        assignments: true,
        grades: true,
        profile: true,
        // Restricted for lecturers:
        system_settings: false,
        user_management: false,
        all_users: false,
        system_logs: false,
        database_management: false,
        faculty_management: false,
        department_management: false,
        finance_management: false,
        course_management: false
      }
    }

    return permissions[role]?.[feature] || false
  }

  return (
    <AdminAuthContext.Provider value={{
      admin,
      profile,
      role,
      loading,
      isAuthenticated: !!profile,
      isAdmin: role === 'admin',
      isDean: role === 'dean',
      isHOD: role === 'hod',
      isLecturer: role === 'lecturer',
      isFinance: role === 'finance',
      signIn,
      signOut,
      canAccess
    }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}