import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AdminAuthContext = createContext({})

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null) // 'admin' or 'lecturer'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        console.log('Checking admin session...')
        
        // Get user from localStorage first (for custom auth)
        const storedUser = localStorage.getItem('admin_user')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          console.log('Found user in localStorage:', userData)
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

        console.log('Supabase session found for:', session.user.email)

        // Get user role from user_roles table (using email as per your SQL)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role, table_id')
          .eq('email', session.user.email)
          .single()

        if (roleError) {
          console.log('No role found in user_roles table:', roleError)
          setLoading(false)
          return
        }

        console.log('User role from database:', roleData.role)

        // Only allow admin or lecturer
        if (roleData.role === 'admin' || roleData.role === 'lecturer') {
          setRole(roleData.role)
          setAdmin(session.user)
          
          // Fetch profile from appropriate table
          if (roleData.role === 'admin') {
            const { data: adminProfile } = await supabase
              .from('system_admins')
              .select('*')
              .eq('id', roleData.table_id)
              .single()
            
            if (adminProfile) {
              const profileData = {
                ...adminProfile,
                role: 'admin',
                full_name: adminProfile.full_name || session.user.email,
                table_id: adminProfile.id
              }
              setProfile(profileData)
              localStorage.setItem('admin_user', JSON.stringify(profileData))
            }
          } else if (roleData.role === 'lecturer') {
            const { data: lecturerProfile } = await supabase
              .from('lecturers')
              .select('*')
              .eq('id', roleData.table_id)
              .single()
            
            if (lecturerProfile) {
              const profileData = {
                ...lecturerProfile,
                role: 'lecturer',
                full_name: lecturerProfile.full_name || session.user.email,
                table_id: lecturerProfile.id
              }
              setProfile(profileData)
              localStorage.setItem('admin_user', JSON.stringify(profileData))
            }
          }
        } else {
          console.log('User is not admin/lecturer, signing out...')
          await supabase.auth.signOut()
        }
      } catch (error) {
        console.error('Auth check error:', error)
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
      console.log('Signing in with:', email)
      
      // Use the custom authenticate_user function from your SQL
      const { data, error } = await supabase.rpc('authenticate_user', {
        user_email: email.trim(),
        user_password: password.trim()
      })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      console.log('RPC response:', data)

      if (!data || data.length === 0) {
        throw new Error('Invalid credentials or not authorized')
      }

      const user = data[0]
      console.log('Authenticated user:', user)

      // Check if user is admin or lecturer
      if (user.role !== 'admin' && user.role !== 'lecturer') {
        throw new Error('Access denied. Admin/Lecturer account required.')
      }

      // Update last login
      await supabase.rpc('update_last_login', {
        user_email: email,
        user_role: user.role
      })

      // Get additional profile data
      let profileData = {}
      if (user.role === 'admin') {
        const { data: adminData } = await supabase
          .from('system_admins')
          .select('*')
          .eq('email', email)
          .single()
        profileData = adminData || {}
      } else if (user.role === 'lecturer') {
        const { data: lecturerData } = await supabase
          .from('lecturers')
          .select('*')
          .eq('email', email)
          .single()
        profileData = lecturerData || {}
      }

      // Create user profile object
      const userProfile = {
        ...profileData,
        email: email,
        role: user.role,
        full_name: user.full_name || profileData.full_name || email,
        permissions: user.permissions,
        table_id: user.table_id
      }

      console.log('Final user profile:', userProfile)

      // Set user data
      setRole(user.role)
      setAdmin({ email: email })
      setProfile(userProfile)
      localStorage.setItem('admin_user', JSON.stringify(userProfile))
      
      return { success: true, role: user.role }
    } catch (error) {
      console.error('Login failed:', error)
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
      // Clear local storage
      localStorage.removeItem('admin_user')
      
      // Clear state
      setAdmin(null)
      setProfile(null)
      setRole(null)
      
      // Sign out from Supabase if using auth
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // Check if user can access specific features
  const canAccess = (feature) => {
    if (!role) return false
    
    const lecturerPermissions = {
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
      database_management: false
    }

    const adminPermissions = {
      // Admin has all permissions
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
      database_management: true
    }

    const permissions = role === 'admin' ? adminPermissions : lecturerPermissions
    return permissions[feature] || false
  }

  return (
    <AdminAuthContext.Provider value={{
      admin,
      profile,
      role,
      loading,
      isAuthenticated: !!profile,
      isAdmin: role === 'admin',
      isLecturer: role === 'lecturer',
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