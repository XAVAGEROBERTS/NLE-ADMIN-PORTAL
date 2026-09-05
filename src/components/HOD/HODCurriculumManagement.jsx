// HOD/HODCurriculumManagement.jsx - COMPLETE FIXED
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const HODCurriculumManagement = ({ 
  departmentCode, 
  departmentName, 
  hodEmail, 
  hodName,
  profile,
  showToast 
}) => {
  const [curriculumChanges, setCurriculumChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState(null);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    change_type: 'new_program',
    proposed_changes: '',
    justification: '',
  });

  const fetchCurriculumChanges = useCallback(async () => {
    if (!departmentCode) return;

    setLoading(true);
    setError(null);
    try {
      console.log('📋 Fetching curriculum changes for department:', departmentCode);
      
      const { data, error } = await supabase
        .from('curriculum_changes')
        .select('*')
        .eq('department_code', departmentCode)
        .order('proposed_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Found curriculum changes:', data?.length || 0);
      setCurriculumChanges(data || []);
    } catch (err) {
      console.error('❌ Error fetching curriculum changes:', err);
      setError('Failed to load curriculum changes: ' + err.message);
      showToast?.('Failed to load curriculum changes', 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentCode, showToast]);

  useEffect(() => {
    fetchCurriculumChanges();
  }, [fetchCurriculumChanges]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      change_type: 'new_program',
      proposed_changes: '',
      justification: '',
    });
    setEditItem(null);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      change_type: item.change_type || 'new_program',
      proposed_changes: item.proposed_changes || '',
      justification: item.justification || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Please provide a title');
      return;
    }

    if (!formData.description.trim()) {
      setError('Please provide a description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      
      const changeData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        change_type: formData.change_type,
        department_code: departmentCode,
        proposed_changes: formData.proposed_changes?.trim() || null,
        justification: formData.justification?.trim() || null,
        proposed_by: hodName || hodEmail || 'HOD',
        proposed_at: now,
        status: 'pending_dean', // FIXED: Directly to Dean
        updated_at: now,
      };

      console.log('📤 Submitting curriculum change:', changeData);

      let result;
      if (editItem) {
        const { data, error } = await supabase
          .from('curriculum_changes')
          .update(changeData)
          .eq('id', editItem.id)
          .select();
        
        if (error) {
          console.error('❌ Update error:', error);
          throw error;
        }
        result = data;
        console.log('✅ Update successful:', result);
      } else {
        const { data, error } = await supabase
          .from('curriculum_changes')
          .insert([changeData])
          .select();
        
        if (error) {
          console.error('❌ Insert error:', error);
          throw error;
        }
        result = data;
        console.log('✅ Insert successful:', result);
      }

      showToast?.(
        editItem ? 'Curriculum change updated successfully!' : 'Curriculum change submitted to Dean for review!',
        'success'
      );

      resetForm();
      setShowModal(false);
      await fetchCurriculumChanges();
    } catch (err) {
      console.error('❌ Error submitting curriculum change:', err);
      
      let errorMessage = 'Failed to submit: ';
      if (err.message?.includes('row-level security')) {
        errorMessage += 'Permission denied. Please contact your administrator.';
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Unknown error';
      }
      
      setError(errorMessage);
      showToast?.(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending_dean': { label: '⏳ Pending Dean', color: '#42a5f5' },
      'approved': { label: '✅ Approved', color: '#66bb6a' },
      'rejected': { label: '❌ Rejected', color: '#ef5350' },
      'needs_revision': { label: '🔄 Revision Needed', color: '#ff7043' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999' };
  };

  const getTypeLabel = (type) => {
    const map = {
      'new_program': '📘 New Program',
      'program_modification': '📝 Program Modification',
      'new_course': '📘 New Course',
      'course_modification': '📝 Course Modification',
      'program_retirement': '🗑️ Program Retirement',
    };
    return map[type] || type || 'Unknown';
  };

  const filteredChanges = curriculumChanges.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div className="hod-section">
      <div className="hod-section-header">
        <h2 className="hod-section-title">📋 Curriculum & Programme Management</h2>
        <button 
          className="hod-primary-btn" 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          ➕ New Curriculum Change
        </button>
      </div>

      <div className="hod-info-banner" style={{
        background: '#e3f2fd',
        padding: '14px 18px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #90caf9',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>ℹ️</span>
        <div>
          <p style={{ margin: 0, fontWeight: '600', color: '#0d47a1' }}>
            Submit curriculum changes for Dean approval
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#1565c0' }}>
            Changes go directly to the Dean for review and approval.
          </p>
        </div>
      </div>

      <div className="hod-filters" style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
          style={{
            padding: '8px 14px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        >
          <option value="all">All ({curriculumChanges.length})</option>
          <option value="pending_dean">Pending Dean ({curriculumChanges.filter(c => c.status === 'pending_dean').length})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_revision">Revision Needed</option>
        </select>
        <button 
          className="hod-refresh-btn" 
          onClick={fetchCurriculumChanges}
          style={{
            padding: '8px 16px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          ❌ {error}
        </div>
      )}

      <div className="hod-curriculum-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: '20px'
      }}>
        {loading ? (
          <div className="hod-loading" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            Loading curriculum changes...
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="hod-empty" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📋</span>
            <h3>No Curriculum Changes</h3>
            <p style={{ color: '#666' }}>Submit a new curriculum change for Dean approval.</p>
          </div>
        ) : (
          filteredChanges.map((item) => {
            const statusInfo = getStatusBadge(item.status);
            return (
              <div key={item.id} className="hod-curriculum-card" style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #f0f0f5',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, color: '#1a237e' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                      {getTypeLabel(item.change_type)}
                    </p>
                  </div>
                  <span style={{
                    background: statusInfo.color,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}>
                    {statusInfo.label}
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: '#444', margin: '8px 0' }}>
                  {item.description}
                </p>

                {item.proposed_changes && (
                  <div style={{
                    margin: '8px 0',
                    padding: '8px 12px',
                    background: '#e8f5e9',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                    <strong>Proposed Changes:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#444' }}>{item.proposed_changes}</p>
                  </div>
                )}

                {item.justification && (
                  <div style={{
                    margin: '8px 0',
                    padding: '8px 12px',
                    background: '#fff3e0',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                    <strong>Justification:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#444' }}>{item.justification}</p>
                  </div>
                )}

                {item.dean_notes && (
                  <div style={{
                    margin: '12px 0',
                    padding: '10px 12px',
                    background: '#f5f7ff',
                    borderRadius: '6px',
                    borderLeft: '3px solid #1a237e'
                  }}>
                    <strong style={{ fontSize: '12px', color: '#1a237e' }}>👨‍🏫 Dean's Feedback:</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#444' }}>
                      {item.dean_notes}
                    </p>
                    {item.dean_approved_at && (
                      <small style={{ color: '#999', display: 'block', marginTop: '4px' }}>
                        Reviewed: {new Date(item.dean_approved_at).toLocaleString()}
                      </small>
                    )}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <small style={{ color: '#999' }}>
                    Submitted: {new Date(item.proposed_at).toLocaleDateString()}
                  </small>
                  {item.status === 'pending_dean' ? (
                    <span style={{ fontSize: '12px', color: '#42a5f5' }}>
                      ⏳ Waiting for Dean
                    </span>
                  ) : item.status === 'needs_revision' ? (
                    <button 
                      style={{
                        background: 'transparent',
                        color: '#1a237e',
                        border: '1px solid #1a237e',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => handleEdit(item)}
                    >
                      ✏️ Edit
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {item.status === 'approved' ? '✅ Approved' : ''}
                      {item.status === 'rejected' ? '❌ Rejected' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="hod-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="hod-modal" style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, color: '#1a237e' }}>
                {editItem ? '✏️ Edit Curriculum Change' : '📋 New Curriculum Change'}
              </h3>
              <button 
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Change Type *
                </label>
                <select
                  name="change_type"
                  value={formData.change_type}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  required
                >
                  <option value="new_program">📘 New Program</option>
                  <option value="program_modification">📝 Program Modification</option>
                  <option value="new_course">📘 New Course</option>
                  <option value="course_modification">📝 Course Modification</option>
                  <option value="program_retirement">🗑️ Program Retirement</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Introduction to AI - New Course"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the proposed change..."
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Proposed Changes
                </label>
                <textarea
                  name="proposed_changes"
                  value={formData.proposed_changes}
                  onChange={handleInputChange}
                  placeholder="Detail the specific changes you're proposing..."
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                  Justification
                </label>
                <textarea
                  name="justification"
                  value={formData.justification}
                  onChange={handleInputChange}
                  placeholder="Why is this change needed? What benefits will it bring?"
                  rows="2"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '16px',
                borderTop: '1px solid #f0f0f0'
              }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    background: '#1a237e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? 'Submitting...' : (editItem ? 'Update' : 'Submit to Dean')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODCurriculumManagement;