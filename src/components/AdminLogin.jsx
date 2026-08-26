import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'

const AdminLogin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, loading: authLoading } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDemoHint, setShowDemoHint] = useState(false)

  // Remove default credentials from production
  useEffect(() => {
    // Only pre-fill in development environment
    if (process.env.NODE_ENV === 'development') {
      setEmail('admin@university.edu')
      setPassword('Admin123!')
      setShowDemoHint(true)
    }
  }, [])

  // Clear credentials from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('email') || params.has('password')) {
      // Remove credentials from URL without reloading
      navigate(location.pathname, { replace: true })
    }
  }, [location, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Basic validation
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password')
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn(email, password)
      
      if (result.success) {
        navigate('/dashboard')
      } else {
        // Generic error message to prevent user enumeration
        setError('Invalid credentials. Please try again.')
        // Clear password on failure
        setPassword('')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Login error:', err)
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle demo login for development/testing
  const handleDemoLogin = () => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('admin@university.edu')
      setPassword('Admin123!')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logo}>🔐</div>
          </div>
          <h2 style={styles.title}>ADMIN PORTAL</h2>
          <p style={styles.subtitle}>NLE University Management System</p>
          <div style={styles.warningBox}>
            ⚡ Authorized Personnel Only
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your admin email"
              style={styles.input}
              required
              disabled={isLoading || authLoading}
              autoComplete="username"
            />
          </div>

          <div style={styles.inputGroup}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Password</label>
              <a 
                href="#" 
                style={styles.forgotLink}
                onClick={(e) => {
                  e.preventDefault()
                  // Implement password reset flow
                  navigate('/admin/forgot-password')
                }}
              >
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              required
              disabled={isLoading || authLoading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            style={{
              ...styles.button,
              ...(isLoading || authLoading ? styles.buttonDisabled : styles.buttonActive)
            }}
            disabled={isLoading || authLoading}
          >
            {isLoading ? (
              <>
                <span style={styles.spinner}></span>
                AUTHENTICATING...
              </>
            ) : (
              'ENTER ADMIN PORTAL'
            )}
          </button>
        </form>

      
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%)',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '450px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    border: '2px solid #e74c3c',
    position: 'relative',
    zIndex: 1
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  logo: {
    fontSize: '48px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '28px',
    color: '#2c3e50',
    margin: '0 0 10px 0',
    fontWeight: '700',
    letterSpacing: '1px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#7f8c8d',
    margin: '0 0 15px 0',
    fontWeight: '500'
  },
  warningBox: {
    display: 'inline-block',
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '10px 20px',
    borderRadius: '25px',
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid #ffeaa7',
    marginTop: '10px'
  },
  error: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    color: '#721c24',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '14px',
    animation: 'fadeIn 0.3s ease'
  },
  form: {
    marginBottom: '30px'
  },
  inputGroup: {
    marginBottom: '25px'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  label: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: '14px'
  },
  forgotLink: {
    color: '#3498db',
    fontSize: '12px',
    textDecoration: 'none',
    fontWeight: '500',
    cursor: 'pointer'
  },
  input: {
    width: '100%',
    padding: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'all 0.3s',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '18px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    transition: 'all 0.3s',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  buttonActive: {
    backgroundColor: '#e74c3c',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#c0392b',
      transform: 'translateY(-2px)',
      boxShadow: '0 5px 15px rgba(231, 76, 60, 0.3)'
    }
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderRadius: '50%',
    borderTopColor: 'white',
    animation: 'spin 1s linear infinite'
  },
  demoHint: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    border: '1px dashed #dee2e6',
    borderRadius: '8px',
    textAlign: 'center'
  },
  demoHintText: {
    margin: '0 0 10px 0',
    color: '#6c757d',
    fontSize: '12px'
  },
  demoButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  footer: {
    borderTop: '1px solid #eee',
    paddingTop: '20px',
    textAlign: 'center'
  },
  securityNotice: {
    fontSize: '12px',
    color: '#666',
    lineHeight: '1.6',
    margin: '0'
  },
  devNotice: {
    fontSize: '10px',
    color: '#e74c3c',
    marginTop: '10px',
    fontWeight: 'bold'
  }
}

// Add CSS animations
const styleSheet = document.styleSheets[0]
styleSheet.insertRule(`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`, styleSheet.cssRules.length)
styleSheet.insertRule(`
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length)

export default AdminLogin