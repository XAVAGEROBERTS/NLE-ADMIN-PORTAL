import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Clear any student data
localStorage.removeItem('student_user')
localStorage.removeItem('student_auth')
localStorage.removeItem('student_profile')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)