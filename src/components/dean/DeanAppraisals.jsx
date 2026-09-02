// dean/DeanAppraisals.jsx - HARDENED
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';

const DeanAppraisals = ({ departments, fetchDeanData, setStats }) => {
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState(null);
  const [deanRecommendation, setDeanRecommendation] = useState('');
  const [promotionRecommendation, setPromotionRecommendation] = useState('');

  const deptCodes = useMemo(() => {
    return departments.map(d => d.department_code).filter(Boolean);
  }, [departments]);

  const fetchAppraisals = useCallback(async () => {
    if (deptCodes.length === 0) {
      setAppraisals([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_appraisals')
        .select(`
          *,
          lecturers:lecturer_id (id, full_name, email, specialization)
        `)
        .in('department_code', deptCodes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppraisals(data || []);
    } catch (err) {
      console.error('Error fetching appraisals:', err);
    } finally {
      setLoading(false);
    }
  }, [deptCodes]);

  useEffect(() => {
    fetchAppraisals();
  }, [fetchAppraisals]);

  const handleSubmitRecommendation = async (id) => {
    if (!deanRecommendation.trim()) {
      alert('Please provide a recommendation');
      return;
    }

    try {
      const { error } = await supabase
        .from('staff_appraisals')
        .update({
          status: 'approved_by_dean',
          dean_recommendation: deanRecommendation,
          promotion_recommendation: promotionRecommendation || null,
          dean_approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Recommendation submitted successfully!');
      setShowModal(false);
      setDeanRecommendation('');
      setPromotionRecommendation('');
      await fetchAppraisals();
      if (fetchDeanData) await fetchDeanData();
    } catch (err) {
      alert('Error submitting recommendation: ' + err.message);
    }
  };

  const filteredAppraisals = useMemo(() => {
    return appraisals.filter((a) => {
      const matchFilter = filter === 'all' || a.status === filter;
      const matchSearch =
        a.lecturers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.lecturers?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [appraisals, filter, searchTerm]);

  const pendingCount = useMemo(() => {
    return appraisals.filter(a => a.status === 'completed' || a.status === 'pending_dean').length;
  }, [appraisals]);

  return (
    <div className="dean-section">
      <div className="dean-section-header">
        <h2 className="dean-section-title">⭐ Staff Appraisals - Faculty Review</h2>
        <span className="dean-badge dean-badge-pending">{pendingCount} Pending Review</span>
      </div>

      <div className="dean-filters">
        <input
          type="text"
          placeholder="Search appraisals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="dean-search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dean-filter-select"
        >
          <option value="all">All ({appraisals.length})</option>
          <option value="completed">Completed</option>
          <option value="approved_by_dean">Dean Approved</option>
          <option value="pending_dean">Pending Dean</option>
        </select>
      </div>

      <div className="dean-appraisal-grid">
        {loading ? (
          <div className="dean-loading">Loading appraisals...</div>
        ) : filteredAppraisals.length === 0 ? (
          <div className="dean-empty">
            <span>📭</span>
            <h3>No appraisals found</h3>
          </div>
        ) : (
          filteredAppraisals.map((a) => (
            <div key={a.id} className="dean-appraisal-card">
              <div className="dean-appraisal-header">
                <h3>{a.lecturers?.full_name || 'Unknown Lecturer'}</h3>
                <div className="dean-appraisal-rating">
                  {'⭐'.repeat(Math.round(a.rating || 0))}
                  <span>({a.rating || 0}/5)</span>
                </div>
              </div>
              <p className="dean-appraisal-email">{a.lecturers?.email}</p>
              <p className="dean-appraisal-specialization">
                <strong>Specialization:</strong> {a.lecturers?.specialization || 'N/A'}
              </p>
              <p className="dean-appraisal-period">
                <strong>Period:</strong> {a.appraisal_period}
              </p>
              {a.comment && (
                <p className="dean-appraisal-comment"><strong>Comment:</strong> {a.comment}</p>
              )}
              {a.strengths && (
                <div className="dean-appraisal-strengths">
                  <h4>✅ Strengths</h4>
                  <p>{a.strengths}</p>
                </div>
              )}
              {a.areas_for_improvement && (
                <div className="dean-appraisal-improvements">
                  <h4>🔄 Areas for Improvement</h4>
                  <p>{a.areas_for_improvement}</p>
                </div>
              )}
              {a.goals && (
                <div className="dean-appraisal-goals">
                  <h4>🎯 Goals</h4>
                  <p>{a.goals}</p>
                </div>
              )}
              <div className="dean-appraisal-footer">
                <span className={`dean-status ${
                  a.status === 'approved_by_dean' ? 'dean-status-approved' :
                  'dean-status-pending'
                }`}>
                  {a.status === 'approved_by_dean' ? 'Dean Approved' : 'Pending Review'}
                </span>
                <button
                  className="dean-review-btn"
                  onClick={() => {
                    setSelectedAppraisal(a);
                    setShowModal(true);
                  }}
                >
                  {a.status === 'approved_by_dean' ? '📋 View' : '📝 Review'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && selectedAppraisal && (
        <div className="dean-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dean-modal dean-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="dean-modal-header">
              <h3>⭐ Review Appraisal</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="dean-modal-body">
              <div className="dean-appraisal-details">
                <p><strong>Lecturer:</strong> {selectedAppraisal.lecturers?.full_name}</p>
                <p><strong>Email:</strong> {selectedAppraisal.lecturers?.email}</p>
                <p><strong>Specialization:</strong> {selectedAppraisal.lecturers?.specialization || 'N/A'}</p>
                <p><strong>Period:</strong> {selectedAppraisal.appraisal_period}</p>
                <p><strong>Rating:</strong> {'⭐'.repeat(Math.round(selectedAppraisal.rating || 0))} ({selectedAppraisal.rating || 0}/5)</p>
                <p><strong>Comment:</strong> {selectedAppraisal.comment}</p>
                {selectedAppraisal.strengths && (
                  <p><strong>Strengths:</strong> {selectedAppraisal.strengths}</p>
                )}
                {selectedAppraisal.areas_for_improvement && (
                  <p><strong>Areas for Improvement:</strong> {selectedAppraisal.areas_for_improvement}</p>
                )}
                {selectedAppraisal.goals && (
                  <p><strong>Goals:</strong> {selectedAppraisal.goals}</p>
                )}
              </div>
              <div className="dean-form-group">
                <label>Dean's Recommendation</label>
                <textarea
                  value={deanRecommendation}
                  onChange={(e) => setDeanRecommendation(e.target.value)}
                  className="dean-textarea"
                  placeholder="Provide your recommendation for this lecturer..."
                  rows={3}
                />
              </div>
              <div className="dean-form-group">
                <label>Promotion Recommendation</label>
                <select
                  value={promotionRecommendation}
                  onChange={(e) => setPromotionRecommendation(e.target.value)}
                  className="dean-select"
                >
                  <option value="">Select recommendation...</option>
                  <option value="recommend">✅ Recommend for Promotion</option>
                  <option value="not_recommend">❌ Not Recommended</option>
                  <option value="defer">⏳ Defer Decision</option>
                </select>
              </div>
            </div>
            <div className="dean-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="dean-save-btn"
                onClick={() => handleSubmitRecommendation(selectedAppraisal.id)}
              >
                Submit Recommendation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanAppraisals;