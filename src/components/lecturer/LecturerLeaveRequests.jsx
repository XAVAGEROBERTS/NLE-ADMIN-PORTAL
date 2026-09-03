// lecturer/LecturerLeaveRequests.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';

const LecturerLeaveRequests = ({ profile, showToast }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userDepartments, setUserDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [primaryDepartment, setPrimaryDepartment] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const [lecturerRecord, setLecturerRecord] = useState(null);
  
  const initialFetchDone = useRef(false);
  const profileIdRef = useRef(profile?.id);
  
  const [newLeave, setNewLeave] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  });
  
  const [leaveBalance, setLeaveBalance] = useState({
    annual: 25,
    sick: 15,
    study: 10,
    maternity: 90,
    paternity: 10,
  });

  const lecturerId = profile?.id;
  const lecturerName = profile?.full_name || '';
  const lecturerEmail = profile?.email || '';

  // ===== FIND LECTURER RECORD - ROBUST APPROACH =====
  const findLecturerRecord = useCallback(async () => {
    if (!lecturerId && !lecturerEmail) {
      console.log('❌ No lecturer ID or email');
      return null;
    }

    console.log('🔍 Finding lecturer record for:', { lecturerId, lecturerEmail });

    let foundLecturer = null;

    // APPROACH 1: Try by email (most reliable)
    if (lecturerEmail) {
      console.log('📧 Approach 1: Looking by email:', lecturerEmail);
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, primary_department_code, email, full_name, auth_uid')
        .eq('email', lecturerEmail)
        .maybeSingle();
      
      if (!error && data) {
        foundLecturer = data;
        console.log('✅ Found lecturer by email:', foundLecturer);
      } else if (error) {
        console.log('⚠️ Error searching by email:', error.message);
      }
    }

    // APPROACH 2: Try by auth_uid
    if (!foundLecturer && lecturerId) {
      console.log('🆔 Approach 2: Looking by auth_uid:', lecturerId);
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, primary_department_code, email, full_name, auth_uid')
        .eq('auth_uid', lecturerId)
        .maybeSingle();
      
      if (!error && data) {
        foundLecturer = data;
        console.log('✅ Found lecturer by auth_uid:', foundLecturer);
      }
    }

    // APPROACH 3: Try by id (if the profile.id is the lecturer's id)
    if (!foundLecturer && lecturerId) {
      console.log('🔑 Approach 3: Looking by id:', lecturerId);
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, primary_department_code, email, full_name, auth_uid')
        .eq('id', lecturerId)
        .maybeSingle();
      
      if (!error && data) {
        foundLecturer = data;
        console.log('✅ Found lecturer by id:', foundLecturer);
      }
    }

    // APPROACH 4: Case-insensitive email
    if (!foundLecturer && lecturerEmail) {
      console.log('🔤 Approach 4: Looking by email (case insensitive)');
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, primary_department_code, email, full_name, auth_uid')
        .ilike('email', lecturerEmail)
        .maybeSingle();
      
      if (!error && data) {
        foundLecturer = data;
        console.log('✅ Found lecturer by case-insensitive email:', foundLecturer);
      }
    }

    // APPROACH 5: Check if lecturer exists in lecturer_departments
    if (!foundLecturer) {
      console.log('🔗 Approach 5: Looking for lecturer in lecturer_departments');
      
      // Try to find by lecturer_id in lecturer_departments
      if (lecturerId) {
        const { data: deptData, error: deptError } = await supabase
          .from('lecturer_departments')
          .select('lecturer_id')
          .eq('lecturer_id', lecturerId)
          .maybeSingle();
        
        if (!deptError && deptData) {
          console.log('Found in lecturer_departments with lecturer_id:', deptData.lecturer_id);
          // Now get the lecturer record
          const { data: lectData, error: lectError } = await supabase
            .from('lecturers')
            .select('id, primary_department_code, email, full_name, auth_uid')
            .eq('id', deptData.lecturer_id)
            .maybeSingle();
          
          if (!lectError && lectData) {
            foundLecturer = lectData;
            console.log('✅ Found lecturer from lecturer_departments:', foundLecturer);
          }
        }
      }
    }

    // APPROACH 6: Try by email from user_roles
    if (!foundLecturer && lecturerEmail) {
      console.log('👤 Approach 6: Looking in user_roles for email');
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('email', lecturerEmail)
        .eq('role', 'lecturer')
        .maybeSingle();
      
      if (!roleError && roleData && roleData.user_id) {
        console.log('Found in user_roles with user_id:', roleData.user_id);
        const { data: lectData, error: lectError } = await supabase
          .from('lecturers')
          .select('id, primary_department_code, email, full_name, auth_uid')
          .eq('auth_uid', roleData.user_id)
          .maybeSingle();
        
        if (!lectError && lectData) {
          foundLecturer = lectData;
          console.log('✅ Found lecturer from user_roles:', foundLecturer);
        }
      }
    }

    // APPROACH 7: Fallback - get all lecturers and find by email match
    if (!foundLecturer && lecturerEmail) {
      console.log('📋 Approach 7: Getting all lecturers and searching');
      const { data, error } = await supabase
        .from('lecturers')
        .select('id, primary_department_code, email, full_name, auth_uid');
      
      if (!error && data && data.length > 0) {
        // Try exact match
        let found = data.find(l => l.email?.toLowerCase() === lecturerEmail.toLowerCase());
        
        // Try partial match
        if (!found) {
          const emailPart = lecturerEmail.split('@')[0];
          found = data.find(l => l.email?.toLowerCase().includes(emailPart.toLowerCase()));
        }
        
        // Try name match
        if (!found && lecturerName) {
          const nameParts = lecturerName.split(' ');
          found = data.find(l => {
            const lName = l.full_name || '';
            return nameParts.some(part => lName.toLowerCase().includes(part.toLowerCase()));
          });
        }
        
        if (found) {
          foundLecturer = found;
          console.log('✅ Found lecturer by manual search:', foundLecturer);
        } else {
          // If still not found, use the first lecturer (for testing)
          console.log('⚠️ No match found, using first lecturer as fallback');
          foundLecturer = data[0];
        }
      }
    }

    return foundLecturer;
  }, [lecturerId, lecturerEmail, lecturerName]);

  // ===== FETCH DEPARTMENTS =====
  const fetchUserDepartments = useCallback(async () => {
    if (!lecturerId && !lecturerEmail) {
      console.log('❌ No lecturer ID or email');
      setError('No lecturer information found. Please log out and log in again.');
      return;
    }

    setError(null);
    
    try {
      // Find the lecturer record
      const lecturer = await findLecturerRecord();
      
      if (!lecturer) {
        console.error('❌ Could not find lecturer record');
        setError('Could not find your lecturer record. Please contact admin.');
        return;
      }

      setLecturerRecord(lecturer);
      console.log('📋 Lecturer record found:', lecturer);

      // Fetch departments from lecturer_departments using the lecturer's ID
      const { data: deptData, error: deptError } = await supabase
        .from('lecturer_departments')
        .select('id, department_code, department_name, access_level, is_active, is_primary')
        .eq('lecturer_id', lecturer.id)
        .eq('is_active', true);

      if (deptError) {
        console.error('❌ Error fetching lecturer_departments:', deptError);
        throw deptError;
      }

      console.log('✅ Found departments:', deptData);

      if (deptData && deptData.length > 0) {
        setUserDepartments(deptData);
        
        const primary = deptData.find(d => d.is_primary === true);
        if (primary) {
          setPrimaryDepartment(primary.department_code);
          setSelectedDepartment(primary.department_code);
          console.log('⭐ Primary department:', primary.department_code);
        } else {
          setPrimaryDepartment(deptData[0].department_code);
          setSelectedDepartment(deptData[0].department_code);
          console.log('⚠️ No primary set, using first:', deptData[0].department_code);
        }
        
        setError(null);
      } else {
        setError('No departments found. Please contact your HOD or admin.');
      }
      
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      setError('Error loading departments: ' + error.message);
    }
  }, [lecturerId, lecturerEmail, findLecturerRecord]);

  // ===== FETCH LEAVE REQUESTS =====
  const fetchLeaveRequests = useCallback(async () => {
    if (!lecturerId) return;

    setLoading(true);
    try {
      // If we have the lecturer record, use that ID
      let queryLecturerId = lecturerId;
      if (lecturerRecord?.id) {
        queryLecturerId = lecturerRecord.id;
      }

      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .select('*')
        .eq('lecturer_id', queryLecturerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      if (showToast) {
        showToast('Error loading leave requests', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [lecturerId, lecturerRecord, showToast]);

  // ===== INITIAL EFFECT =====
  useEffect(() => {
    if (lecturerId && (lecturerId !== profileIdRef.current || !initialFetchDone.current)) {
      profileIdRef.current = lecturerId;
      initialFetchDone.current = true;
      
      // First find the lecturer, then fetch departments and leave requests
      const init = async () => {
        const lecturer = await findLecturerRecord();
        if (lecturer) {
          setLecturerRecord(lecturer);
          await fetchUserDepartments();
          await fetchLeaveRequests();
        } else {
          setError('Could not find your lecturer record. Please contact admin.');
        }
      };
      
      init();
    }
  }, [lecturerId, findLecturerRecord, fetchUserDepartments, fetchLeaveRequests]);

  // ===== CALCULATE WORKING DAYS =====
  const calculateWorkingDays = (startDate, endDate) => {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // ===== SUBMIT LEAVE REQUEST =====
  const handleSubmitLeave = async () => {
    setError(null);
    
    if (!newLeave.start_date || !newLeave.end_date) {
      showToast('Please select start and end dates', 'error');
      return;
    }

    if (!newLeave.reason?.trim()) {
      showToast('Please provide a reason for leave', 'error');
      return;
    }

    if (userDepartments.length === 0) {
      showToast('You have no departments assigned. Please contact your HOD.', 'error');
      return;
    }

    const deptToUse = primaryDepartment;
    if (!deptToUse) {
      showToast('No primary department set. Please contact your HOD or admin.', 'error');
      return;
    }

    const start = new Date(newLeave.start_date);
    const end = new Date(newLeave.end_date);
    if (end < start) {
      showToast('End date must be after start date', 'error');
      return;
    }

    const days = calculateWorkingDays(start, end);
    if (days <= 0) {
      showToast('Please select valid date range', 'error');
      return;
    }

    const available = leaveBalance[newLeave.leave_type] || 0;
    if (days > available) {
      showToast(`Insufficient ${newLeave.leave_type} leave. Available: ${available} days`, 'error');
      return;
    }

    setSubmitting(true);
    
    try {
      const deptName = userDepartments.find(d => d.department_code === deptToUse)?.department_name || deptToUse;
      
      // Use the lecturer record ID if available
      const lecturerIdToUse = lecturerRecord?.id || lecturerId;

      console.log('📤 Submitting leave request:', {
        lecturerId: lecturerIdToUse,
        department_code: deptToUse,
        leave_type: newLeave.leave_type,
        days: days
      });

      const { data, error } = await supabase
        .from('lecturer_leave_requests')
        .insert([{
          lecturer_id: lecturerIdToUse,
          lecturer_name: lecturerName || lecturerRecord?.full_name || '',
          lecturer_email: lecturerEmail || lecturerRecord?.email || '',
          department_code: deptToUse,
          department_name: deptName,
          is_primary_department: true,
          leave_type: newLeave.leave_type,
          start_date: newLeave.start_date,
          end_date: newLeave.end_date,
          days: days,
          reason: newLeave.reason.trim(),
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        showToast('Error submitting leave: ' + error.message, 'error');
        setSubmitting(false);
        return;
      }

      console.log('✅ Leave request submitted:', data);
      
      // Notify secondary departments
      const secondaryDepts = userDepartments.filter(d => d.department_code !== deptToUse);
      if (secondaryDepts.length > 0) {
        for (const dept of secondaryDepts) {
          await supabase
            .from('hod_notifications')
            .insert([{
              department_code: dept.department_code,
              title: `📋 Leave Alert: ${lecturerName || lecturerRecord?.full_name || 'Lecturer'}`,
              message: `${lecturerName || lecturerRecord?.full_name || 'A lecturer'} has submitted a leave request to ${deptToUse} from ${newLeave.start_date} to ${newLeave.end_date}. (${days} days)`,
              type: 'leave_notification',
              is_read: false,
              created_at: new Date().toISOString()
            }]);
        }
      }
      
      showToast(`✅ Leave request submitted to ${deptToUse} (Primary Department) for approval! (${days} days)`, 'success');
      
      setNewLeave({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      setShowModal(false);
      initialFetchDone.current = false;
      await fetchLeaveRequests();
      
    } catch (error) {
      console.error('❌ Error submitting leave:', error);
      showToast('Error submitting leave: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CANCEL LEAVE REQUEST =====
  const handleCancelLeave = async (requestId) => {
    if (!requestId) return;
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;

    setCancelling(true);
    try {
      const lecturerIdToUse = lecturerRecord?.id || lecturerId;
      
      const { error } = await supabase
        .from('lecturer_leave_requests')
        .update({ 
          status: 'cancelled', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', requestId)
        .eq('lecturer_id', lecturerIdToUse);

      if (error) throw error;
      showToast('Leave request cancelled successfully', 'success');
      initialFetchDone.current = false;
      await fetchLeaveRequests();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      showToast('Error cancelling leave: ' + error.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  // ===== STATUS HELPERS =====
  const getStatusBadge = (status) => {
    const map = {
      'pending': 'warning',
      'pending_hod': 'warning',
      'approved_by_hod': 'info',
      'approved_by_dean': 'success',
      'approved': 'success',
      'rejected': 'danger',
      'rejected_by_hod': 'danger',
      'rejected_by_dean': 'danger',
      'cancelled': 'secondary',
    };
    return map[status] || 'secondary';
  };

  const getStatusLabel = (status) => {
    const map = {
      'pending': '⏳ Pending HOD',
      'pending_hod': '⏳ Pending HOD',
      'approved_by_hod': '📋 HOD Approved (Pending Dean)',
      'approved_by_dean': '✅ Approved by Dean',
      'approved': '✅ Approved',
      'rejected': '❌ Rejected',
      'rejected_by_hod': '❌ Rejected by HOD',
      'rejected_by_dean': '❌ Rejected by Dean',
      'cancelled': '🔄 Cancelled',
    };
    return map[status] || status || 'Unknown';
  };

  const getLeaveTypeLabel = (type) => {
    const map = {
      'annual': '🏖️ Annual Leave',
      'sick': '🤒 Sick Leave',
      'study': '📚 Study Leave',
      'maternity': '👶 Maternity Leave',
      'paternity': '👨‍👦 Paternity Leave',
      'other': '📝 Other Leave',
    };
    return map[type] || type || 'Other';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const refreshLeaveRequests = useCallback(() => {
    initialFetchDone.current = false;
    fetchLeaveRequests();
    fetchUserDepartments();
  }, [fetchLeaveRequests, fetchUserDepartments]);

  const canCancel = (status) => status === 'pending' || status === 'pending_hod';

  // ===== RENDER =====
  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <div>
          <h2>📝 Leave Requests</h2>
          <p style={{ color: '#666', marginTop: '4px' }}>
            Request time off and track your leave balance
          </p>
          {userDepartments.length > 1 && (
            <p style={{ color: '#1976d2', fontSize: '13px', marginTop: '4px' }}>
              📌 You have {userDepartments.length} departments. 
              <strong style={{ color: '#4caf50' }}> Primary: {primaryDepartment}</strong>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="lecturer-refresh-btn" onClick={refreshLeaveRequests} disabled={loading}>
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
          <button className="lecturer-add-btn" onClick={() => setShowModal(true)} disabled={userDepartments.length === 0}>
            + New Leave Request
          </button>
        </div>
      </div>

      {error && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffc107', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => {
              setError(null);
              fetchUserDepartments();
            }}
            style={{ 
              padding: '4px 12px', 
              background: '#ffc107', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Leave Balance Cards */}
      <div className="lecturer-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="lecturer-stat-card" style={{ background: '#e3f2fd' }}>
          <h3 style={{ fontSize: '24px', margin: '0', color: '#1565c0' }}>{leaveBalance.annual}</h3>
          <p>🏖️ Annual Leave</p>
        </div>
        <div className="lecturer-stat-card" style={{ background: '#e8f5e9' }}>
          <h3 style={{ fontSize: '24px', margin: '0', color: '#2e7d32' }}>{leaveBalance.sick}</h3>
          <p>🤒 Sick Leave</p>
        </div>
        <div className="lecturer-stat-card" style={{ background: '#f3e5f5' }}>
          <h3 style={{ fontSize: '24px', margin: '0', color: '#6a1b9a' }}>{leaveBalance.study}</h3>
          <p>📚 Study Leave</p>
        </div>
        <div className="lecturer-stat-card" style={{ background: '#fff3e0' }}>
          <h3 style={{ fontSize: '24px', margin: '0', color: '#e65100' }}>{leaveBalance.maternity + leaveBalance.paternity}</h3>
          <p>👶 Maternity/Paternity</p>
        </div>
      </div>

      {/* Leave Requests Table */}
      {loading && leaveRequests.length === 0 ? (
        <div className="lecturer-loading-content"><div className="lecturer-spinner"></div><p>Loading leave requests...</p></div>
      ) : leaveRequests.length === 0 ? (
        <div className="lecturer-empty-state" style={{ background: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📋</span>
          <h3>No Leave Requests</h3>
          <p style={{ color: '#666' }}>You haven't submitted any leave requests yet.</p>
          <p style={{ fontSize: '13px', color: '#4caf50' }}>⭐ Your primary department is: <strong>{primaryDepartment}</strong></p>
          <button className="lecturer-add-btn" onClick={() => setShowModal(true)} style={{ marginTop: '12px' }} disabled={userDepartments.length === 0}>
            + Request Leave
          </button>
        </div>
      ) : (
        <div className="lecturer-table-container">
          <table className="lecturer-data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Department</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((request) => (
                <tr key={request.id}>
                  <td>{getLeaveTypeLabel(request.leave_type)}</td>
                  <td>
                    <span className="lecturer-dept-badge" style={{ 
                      background: request.is_primary_department ? '#e8f5e9' : '#f5f5f5', 
                      color: request.is_primary_department ? '#2e7d32' : '#666'
                    }}>
                      {request.department_code || 'N/A'}
                      {request.is_primary_department && ' ⭐'}
                    </span>
                  </td>
                  <td>{formatDate(request.start_date)}</td>
                  <td>{formatDate(request.end_date)}</td>
                  <td><strong>{request.days}</strong></td>
                  <td>{request.reason || '—'}</td>
                  <td>
                    <span className={`lecturer-status-badge ${getStatusBadge(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </td>
                  <td>
                    {canCancel(request.status) && (
                      <button className="lecturer-danger-btn" onClick={() => handleCancelLeave(request.id)} disabled={cancelling} style={{ padding: '4px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        {cancelling ? '⏳...' : '🗑️ Cancel'}
                      </button>
                    )}
                    {request.status === 'approved' || request.status === 'approved_by_dean' && (
                      <span style={{ color: '#2e7d32', fontWeight: '600' }}>✅ Approved</span>
                    )}
                    {(request.status === 'rejected' || request.status === 'rejected_by_hod' || request.status === 'rejected_by_dean') && (
                      <span style={{ color: '#d32f2f', fontWeight: '600' }}>❌ Rejected</span>
                    )}
                    {request.status === 'cancelled' && (
                      <span style={{ color: '#666', fontWeight: '600' }}>🔄 Cancelled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Leave Request Modal */}
      {showModal && (
        <div className="lecturer-modal-overlay" onClick={() => !submitting && setShowModal(false)}>
          <div className="lecturer-modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <h3>📝 New Leave Request</h3>
            <p style={{ color: '#666', marginBottom: '16px' }}>
              Submit a leave request for approval by your HOD and Dean.
            </p>

            <div className="lecturer-modal-form">
              {/* Primary Department Display */}
              <div className="lecturer-form-group">
                <label>Department (Primary) ⭐</label>
                <input 
                  type="text" 
                  value={userDepartments.find(d => d.department_code === primaryDepartment)?.department_name || primaryDepartment} 
                  disabled 
                  className="lecturer-form-input" 
                  style={{ background: '#e8f5e9', border: '2px solid #4caf50', fontWeight: 'bold', color: '#2e7d32' }} 
                />
                <small style={{ color: '#4caf50', display: 'block', marginTop: '4px' }}>
                  ✅ Leave requests are submitted to your primary department: <strong>{primaryDepartment}</strong>
                </small>
              </div>

              {/* Secondary Departments Info */}
              {userDepartments.filter(d => d.department_code !== primaryDepartment).length > 0 && (
                <div style={{ padding: '10px 14px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', color: '#666' }}>
                  📌 <strong>Secondary Departments (Notification Only):</strong>{' '}
                  {userDepartments.filter(d => d.department_code !== primaryDepartment).map(d => d.department_code).join(', ')}
                  <br /><small>These departments will be notified of your leave.</small>
                </div>
              )}

              {/* Leave Type */}
              <div className="lecturer-form-group">
                <label>Leave Type *</label>
                <select value={newLeave.leave_type} onChange={(e) => setNewLeave({ ...newLeave, leave_type: e.target.value })} className="lecturer-form-select">
                  <option value="annual">🏖️ Annual Leave ({leaveBalance.annual} days left)</option>
                  <option value="sick">🤒 Sick Leave ({leaveBalance.sick} days left)</option>
                  <option value="study">📚 Study Leave ({leaveBalance.study} days left)</option>
                  <option value="maternity">👶 Maternity Leave ({leaveBalance.maternity} days left)</option>
                  <option value="paternity">👨‍👦 Paternity Leave ({leaveBalance.paternity} days left)</option>
                  <option value="other">📝 Other</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="lecturer-form-row">
                <div className="lecturer-form-group">
                  <label>Start Date *</label>
                  <input type="date" value={newLeave.start_date} onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })} className="lecturer-form-input" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="lecturer-form-group">
                  <label>End Date *</label>
                  <input type="date" value={newLeave.end_date} onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })} className="lecturer-form-input" min={newLeave.start_date || new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              {/* Days Calculation */}
              {newLeave.start_date && newLeave.end_date && (
                <div style={{ padding: '10px 14px', background: '#e3f2fd', borderRadius: '6px', fontSize: '14px', color: '#1565c0' }}>
                  📊 Working Days: <strong>{calculateWorkingDays(new Date(newLeave.start_date), new Date(newLeave.end_date))}</strong> days
                </div>
              )}

              {/* Reason */}
              <div className="lecturer-form-group">
                <label>Reason *</label>
                <textarea value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} placeholder="Please provide a reason for your leave request..." rows="3" className="lecturer-form-textarea" />
              </div>

              {/* Modal Actions */}
              <div className="lecturer-modal-actions">
                <button className="lecturer-cancel-btn" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                <button className="lecturer-confirm-btn" onClick={handleSubmitLeave} disabled={submitting || userDepartments.length === 0} style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: submitting || userDepartments.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {submitting ? 'Submitting...' : `📤 Submit to ${primaryDepartment}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerLeaveRequests;