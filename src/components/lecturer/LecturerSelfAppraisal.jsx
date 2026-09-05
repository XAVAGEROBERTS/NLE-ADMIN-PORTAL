// lecturer/LecturerSelfAppraisal.jsx - READ-ONLY VIEW
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import './LecturerAppraisal.css';

const LecturerSelfAppraisal = ({ profile, courses, departmentCodes, showToast }) => {
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  // Fetch lecturer's appraisals (read-only)
  const fetchAppraisals = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_appraisals')
        .select(`
          *,
          lecturers:lecturer_id (id, full_name, email)
        `)
        .eq('lecturer_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppraisals(data || []);
    } catch (err) {
      console.error('Error fetching appraisals:', err);
      showToast('Error loading appraisals', 'error');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, showToast]);

  useEffect(() => {
    fetchAppraisals();
  }, [fetchAppraisals]);

  // Get status badge
  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { label: '📝 Draft', color: '#ffa726' },
      'completed': { label: '📋 Completed - Pending Dean Review', color: '#42a5f5' },
      'approved_by_dean': { label: '✅ Approved by Dean', color: '#66bb6a' },
      'pending_dean': { label: '⏳ With Dean', color: '#ffa726' },
      'rejected': { label: '❌ Rejected', color: '#ef5350' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#999' };
  };

  // Get promotion recommendation label
  const getPromotionLabel = (value) => {
    const map = {
      'recommend': '✅ Recommended for Promotion',
      'not_recommend': '❌ Not Recommended',
      'defer': '⏳ Deferred Decision',
    };
    return map[value] || value || 'Not specified';
  };

  const filteredAppraisals = appraisals.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="lecturer-tab-content">
      <div className="lecturer-tab-header">
        <h2>⭐ My Appraisals</h2>
        <div className="lecturer-tab-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="lecturer-filter-select"
          >
            <option value="all">All ({appraisals.length})</option>
            <option value="completed">Pending Dean Review</option>
            <option value="approved_by_dean">Dean Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button 
            className="lecturer-refresh-btn" 
            onClick={fetchAppraisals}
            style={{ marginLeft: '10px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        background: '#e3f2fd',
        padding: '12px 16px',
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
            Appraisals are conducted by your Head of Department (HOD)
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#1565c0' }}>
            You can view your appraisal results and dean's feedback here once completed.
          </p>
        </div>
      </div>

      {/* Appraisals List */}
      <div className="lecturer-appraisals-list">
        {loading ? (
          <div className="lecturer-loading-content">
            <div className="lecturer-spinner"></div>
            <p>Loading appraisals...</p>
          </div>
        ) : filteredAppraisals.length === 0 ? (
          <div className="lecturer-empty-state">
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>📋</span>
            <h3>No Appraisals Found</h3>
            <p style={{ color: '#666' }}>
              Your HOD hasn't submitted any appraisals for you yet.
            </p>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
              Appraisals are typically conducted at the end of each semester.
            </p>
          </div>
        ) : (
          <div className="lecturer-appraisal-grid">
            {filteredAppraisals.map((appraisal) => {
              const statusInfo = getStatusBadge(appraisal.status);
              return (
                <div key={appraisal.id} className="lecturer-appraisal-card">
                  <div className="lecturer-appraisal-header">
                    <div>
                      <h4 style={{ margin: 0, color: '#1a237e' }}>
                        📅 {appraisal.appraisal_period || 'Period not set'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                        Appraised by: HOD
                      </p>
                    </div>
                    <span 
                      className="lecturer-status-badge" 
                      style={{ 
                        background: statusInfo.color, 
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="lecturer-appraisal-rating-display">
                    <strong>Rating:</strong> 
                    <span style={{ marginLeft: '8px' }}>
                      {'⭐'.repeat(Math.round(appraisal.rating || 0))}
                    </span>
                    <span style={{ marginLeft: '4px', color: '#666' }}>
                      ({appraisal.rating || 0}/5)
                    </span>
                  </div>

                  {appraisal.comment && (
                    <div className="lecturer-appraisal-section">
                      <strong>📝 Overall Comment:</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#444' }}>{appraisal.comment}</p>
                    </div>
                  )}

                  {appraisal.strengths && (
                    <div className="lecturer-appraisal-section">
                      <strong>✅ Strengths:</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#444' }}>{appraisal.strengths}</p>
                    </div>
                  )}

                  {appraisal.areas_for_improvement && (
                    <div className="lecturer-appraisal-section">
                      <strong>🔄 Areas for Improvement:</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#444' }}>{appraisal.areas_for_improvement}</p>
                    </div>
                  )}

                  {appraisal.goals && (
                    <div className="lecturer-appraisal-section">
                      <strong>🎯 Goals:</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#444' }}>{appraisal.goals}</p>
                    </div>
                  )}

                  {/* Dean's Feedback (if approved) */}
                  {appraisal.status === 'approved_by_dean' && appraisal.dean_recommendation && (
                    <div className="lecturer-appraisal-dean-feedback">
                      <hr style={{ margin: '12px 0' }} />
                      <h5 style={{ 
                        color: '#1a237e', 
                        margin: '0 0 8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        👨‍🏫 Dean's Feedback
                      </h5>
                      <div style={{ 
                        background: '#f5f7ff', 
                        padding: '12px', 
                        borderRadius: '6px'
                      }}>
                        <p style={{ margin: '0 0 8px 0' }}>
                          <strong>Recommendation:</strong> {appraisal.dean_recommendation}
                        </p>
                        {appraisal.promotion_recommendation && (
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>Promotion:</strong> {getPromotionLabel(appraisal.promotion_recommendation)}
                          </p>
                        )}
                        {appraisal.dean_approved_at && (
                          <small style={{ color: '#666' }}>
                            Reviewed on: {new Date(appraisal.dean_approved_at).toLocaleString()}
                          </small>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection reason (if rejected) */}
                  {appraisal.status === 'rejected' && appraisal.dean_recommendation && (
                    <div className="lecturer-appraisal-dean-feedback" style={{ borderLeftColor: '#ef5350' }}>
                      <hr style={{ margin: '12px 0' }} />
                      <h5 style={{ 
                        color: '#c62828', 
                        margin: '0 0 8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        ❌ Dean's Decision
                      </h5>
                      <div style={{ 
                        background: '#ffebee', 
                        padding: '12px', 
                        borderRadius: '6px'
                      }}>
                        <p style={{ margin: '0' }}>{appraisal.dean_recommendation}</p>
                        {appraisal.dean_approved_at && (
                          <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                            Reviewed on: {new Date(appraisal.dean_approved_at).toLocaleString()}
                          </small>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="lecturer-appraisal-footer">
                    <small style={{ color: '#999' }}>
                      Created: {new Date(appraisal.created_at).toLocaleDateString()}
                    </small>
                    <small style={{ color: '#999' }}>
                      {appraisal.updated_at && new Date(appraisal.updated_at) > new Date(appraisal.created_at) && (
                        `Updated: ${new Date(appraisal.updated_at).toLocaleDateString()}`
                      )}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturerSelfAppraisal;