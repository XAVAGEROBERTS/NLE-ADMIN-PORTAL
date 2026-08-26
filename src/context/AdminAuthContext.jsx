import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AdminAuthContext = createContext({})

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null) // 'admin' or 'lecturer' or 'finance'

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

        // Get user role from user_roles table (using email as per your SQL)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role, table_id')
          .eq('email', session.user.email)
          .single()

        if (roleError) {
          console.log('⚠️ No role found in user_roles table:', roleError)
          setLoading(false)
          return
        }

        console.log('📋 User role from database:', roleData.role)

        // Allow admin, lecturer, or finance
        if (roleData.role === 'admin' || roleData.role === 'lecturer' || roleData.role === 'finance') {
          setRole(roleData.role)
          setAdmin(session.user)
          
          // Fetch profile from appropriate table
          let profileData = null
          
          if (roleData.role === 'admin') {
            const { data: adminProfile } = await supabase
              .from('system_admins')
              .select('*')
              .eq('id', roleData.table_id)
              .single()
            profileData = adminProfile
          } else if (roleData.role === 'lecturer') {
            console.log('🔍 Loading lecturer with ID:', roleData.table_id)
            const { data: lecturerProfile, error: lecturerError } = await supabase
              .from('lecturers')
              .select('*')
              .eq('id', roleData.table_id)
              .single()
            
            if (lecturerError) {
              console.error('❌ Lecturer load error:', lecturerError)
              profileData = null
            } else {
              profileData = lecturerProfile
              console.log('✅ Lecturer profile loaded from session:', lecturerProfile)
            }
          } else if (roleData.role === 'finance') {
            const { data: financeProfile } = await supabase
              .from('finance_officers')
              .select('*')
              .eq('id', roleData.table_id)
              .single()
            profileData = financeProfile
          }
          
          if (profileData) {
            const fullProfile = {
              ...profileData,
              role: roleData.role,
              full_name: profileData.full_name || session.user.email,
              table_id: roleData.table_id
            }
            setProfile(fullProfile)
            localStorage.setItem('admin_user', JSON.stringify(fullProfile))
            console.log('✅ Profile set from session:', fullProfile)
          }
        } else {
          console.log('⚠️ User is not admin/lecturer/finance, signing out...')
          await supabase.auth.signOut()
          localStorage.removeItem('admin_user')
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

      // Check if user is admin, lecturer, or finance
      if (!['admin', 'lecturer', 'finance'].includes(user.role)) {
        setLoading(false)
        return { success: false, error: 'Access denied. Only Admin, Lecturer, or Finance Officer accounts allowed.' }
      }

      // Update last login - FIXED: Use try/catch instead of .catch()
      try {
        await supabase.rpc('update_last_login', {
          user_email: email,
          user_role: user.role
        })
      } catch (updateError) {
        console.warn('⚠️ Last login update failed (non-critical):', updateError.message)
        // Continue anyway - this is not critical
      }

      // Get additional profile data - FIXED: Use table_id from RPC, not email
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
          .eq('id', user.table_id) // Use table_id, NOT email
          .single()
        
        if (lecturerError) {
          console.error('❌ Lecturer fetch error:', lecturerError)
          console.error('Error details:', lecturerError.message)
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
          .eq('id', user.table_id) // Use table_id, NOT email
          .single()
        
        if (financeError) {
          console.error('Finance fetch error:', financeError)
        } else {
          profileData = financeData || {}
        }
      }

      // Check if we got profile data
      if (!profileData || Object.keys(profileData).length === 0) {
        console.error('❌ No profile data found for user ID:', user.table_id)
        setLoading(false)
        return { 
          success: false, 
          error: `Profile not found for ${user.role}. Please contact administrator.` 
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
        table_name: tableName
      }

      console.log('✅ Final user profile:', userProfile)

      // Set user data
      setRole(user.role)
      setAdmin({ email: email })
      setProfile(userProfile)
      localStorage.setItem('admin_user', JSON.stringify(userProfile))
      
      // Add a small delay to ensure state updates are processed
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