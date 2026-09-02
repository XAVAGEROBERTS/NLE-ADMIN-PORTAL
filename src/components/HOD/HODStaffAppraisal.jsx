// HODStaffAppraisal.jsx - Fixed with proper appraisal_period
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const HODStaffAppraisal = ({ departmentCode, lecturers, fetchHODData }) => {
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [appraisalData, setAppraisalData] = useState({
    rating: 3,
    comment: '',
    strengths: '',
    areas_for_improvement: '',
    goals: '',
    appraisal_period: '', // Add this field
  });
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Set default appraisal period when modal opens
  useEffect(() => {
    if (showModal) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setAppraisalData(prev => ({
        ...prev,
        appraisal_period: `${year}-${month}` // e.g., "2024-01"
      }));
    }
  }, [showModal]);

  useEffect(() => {
    fetchAppraisals();
  }, [departmentCode]);

  const fetchAppraisals = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching appraisals for department:', departmentCode);
      
      const { data, error } = await supabase
        .from('staff_appraisals')
        .select(`
          *,
          lecturers:lecturer_id (id, full_name, email)
        `)
        .eq('department_code', departmentCode)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log(`Found ${data?.length || 0} appraisals`);
      setAppraisals(data || []);
    } catch (err) {
      console.error('Error fetching appraisals:', err);
      setError('Failed to load appraisals: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppraisal = async () => {
    if (!selectedLecturer) {
      alert('Please select a lecturer');
      return;
    }

    if (!appraisalData.comment.trim()) {
      alert('Please provide a comment');
      return;
    }

    if (!appraisalData.appraisal_period) {
      alert('Please set the appraisal period');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Submitting appraisal for lecturer:', selectedLecturer);
      console.log('Appraisal data:', appraisalData);

      const appraisalRecord = {
        lecturer_id: selectedLecturer,
        department_code: departmentCode,
        appraisal_period: appraisalData.appraisal_period, // Now properly set
        rating: appraisalData.rating,
        comment: appraisalData.comment.trim(),
        strengths: appraisalData.strengths?.trim() || null,
        areas_for_improvement: appraisalData.areas_for_improvement?.trim() || null,
        goals: appraisalData.goals?.trim() || null,
        status: 'completed',
        appraised_by: 'hod',
        appraised_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Sending to Supabase:', appraisalRecord);

      const { data, error } = await supabase
        .from('staff_appraisals')
        .insert([appraisalRecord])
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Appraisal saved successfully:', data);
      
      setSuccessMessage('✅ Appraisal submitted successfully!');
      
      // Reset form
      setShowModal(false);
      setSelectedLecturer('');
      setAppraisalData({
        rating: 3,
        comment: '',
        strengths: '',
        areas_for_improvement: '',
        goals: '',
        appraisal_period: '',
      });
      
      // Refresh data
      await fetchAppraisals();
      if (fetchHODData) await fetchHODData();
      
      // Show success alert
      alert('✅ Appraisal submitted successfully!');
      
    } catch (err) {
      console.error('Error submitting appraisal:', err);
      setError('Failed to submit appraisal: ' + err.message);
      alert('❌ Error submitting appraisal: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAppraisals = appraisals.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="hod-section">
      {error && (
        <div className="hod-error-banner" style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #ef9a9a'
        }}>
          ❌ {error}
        </div>
      )}
      
      {successMessage && (
        <div className="hod-success-banner" style={{
          background: '#e8f5e9',
          color: '#2e7d32',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #a5d6a7'
        }}>
          ✅ {successMessage}
        </div>
      )}

      <div className="hod-section-header">
        <h2 className="hod-section-title">⭐ Staff Appraisal</h2>
        <button 
          className="hod-primary-btn" 
          onClick={() => setShowModal(true)}
          disabled={lecturers.length === 0}
        >
          ➕ New Appraisal
        </button>
      </div>

      {lecturers.length === 0 && (
        <div className="hod-warning" style={{
          background: '#fff3e0',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #ffcc80'
        }}>
          ⚠️ No lecturers found in this department. Please add lecturers first.
        </div>
      )}

      <div className="hod-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="hod-filter-select"
        >
          <option value="all">All Appraisals ({appraisals.length})</option>
          <option value="completed">Completed</option>
          <option value="draft">Drafts</option>
        </select>
        <button className="hod-refresh-btn" onClick={fetchAppraisals}>
          🔄 Refresh
        </button>
      </div>

      <div className="hod-appraisal-grid">
        {loading ? (
          <div className="hod-loading">Loading appraisals...</div>
        ) : filteredAppraisals.length === 0 ? (
          <div className="hod-empty">
            <span>📭</span>
            <h3>No appraisals found</h3>
            <p>Click "New Appraisal" to evaluate a lecturer</p>
          </div>
        ) : (
          filteredAppraisals.map((a) => (
            <div key={a.id} className="hod-appraisal-card">
              <div className="hod-appraisal-header">
                <h3>{a.lecturers?.full_name || 'Unknown Lecturer'}</h3>
                <div className="hod-appraisal-rating">
                  {'⭐'.repeat(Math.round(a.rating || 0))}
                  <span>({a.rating || 0}/5)</span>
                </div>
              </div>
              <p className="hod-appraisal-email">{a.lecturers?.email || 'No email'}</p>
              <p className="hod-appraisal-period" style={{ fontSize: '12px', color: '#999' }}>
                📅 {a.appraisal_period || 'Period not set'}
              </p>
              {a.comment && (
                <p className="hod-appraisal-comment">{a.comment}</p>
              )}
              {a.strengths && (
                <div className="hod-appraisal-strengths">
                  <h4>✅ Strengths</h4>
                  <p>{a.strengths}</p>
                </div>
              )}
              {a.areas_for_improvement && (
                <div className="hod-appraisal-improvements">
                  <h4>🔄 Areas for Improvement</h4>
                  <p>{a.areas_for_improvement}</p>
                </div>
              )}
              {a.goals && (
                <div className="hod-appraisal-goals">
                  <h4>🎯 Goals</h4>
                  <p>{a.goals}</p>
                </div>
              )}
              <div className="hod-appraisal-footer">
                <span className="hod-appraisal-date">
                  {a.appraised_at ? new Date(a.appraised_at).toLocaleDateString() : new Date(a.created_at).toLocaleDateString()}
                </span>
                <span className={`hod-status ${a.status === 'completed' ? 'hod-status-approved' : 'hod-status-pending'}`}>
                  {a.status || 'completed'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Appraisal Modal */}
      {showModal && (
        <div className="hod-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="hod-modal hod-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="hod-modal-header">
              <h3>⭐ New Staff Appraisal</h3>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="hod-modal-body">
              <div className="hod-form-group">
                <label>Lecturer *</label>
                <select
                  value={selectedLecturer}
                  onChange={(e) => setSelectedLecturer(e.target.value)}
                  className="hod-select"
                  required
                >
                  <option value="">Select Lecturer</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} - {l.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hod-form-group">
                <label>Appraisal Period *</label>
                <input
                  type="month"
                  value={appraisalData.appraisal_period}
                  onChange={(e) => setAppraisalData({ ...appraisalData, appraisal_period: e.target.value })}
                  className="hod-input"
                  required
                />
                <small style={{ color: '#999' }}>Select the month/year for this appraisal</small>
              </div>

              <div className="hod-form-group">
                <label>Rating (1-5) *</label>
                <div className="hod-rating-input">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      className={`hod-star-btn ${appraisalData.rating >= r ? 'active' : ''}`}
                      onClick={() => setAppraisalData({ ...appraisalData, rating: r })}
                      type="button"
                    >
                      ⭐
                    </button>
                  ))}
                  <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
                    {appraisalData.rating}/5
                  </span>
                </div>
              </div>

              <div className="hod-form-group">
                <label>Overall Comment *</label>
                <textarea
                  value={appraisalData.comment}
                  onChange={(e) => setAppraisalData({ ...appraisalData, comment: e.target.value })}
                  className="hod-textarea"
                  placeholder="Overall comments about the lecturer's performance..."
                  rows={3}
                  required
                />
              </div>

              <div className="hod-form-group">
                <label>Strengths</label>
                <textarea
                  value={appraisalData.strengths}
                  onChange={(e) => setAppraisalData({ ...appraisalData, strengths: e.target.value })}
                  className="hod-textarea"
                  placeholder="What are the lecturer's strengths?"
                  rows={3}
                />
              </div>

              <div className="hod-form-group">
                <label>Areas for Improvement</label>
                <textarea
                  value={appraisalData.areas_for_improvement}
                  onChange={(e) => setAppraisalData({ ...appraisalData, areas_for_improvement: e.target.value })}
                  className="hod-textarea"
                  placeholder="What areas need improvement?"
                  rows={3}
                />
              </div>

              <div className="hod-form-group">
                <label>Goals for Next Period</label>
                <textarea
                  value={appraisalData.goals}
                  onChange={(e) => setAppraisalData({ ...appraisalData, goals: e.target.value })}
                  className="hod-textarea"
                  placeholder="What goals should be set for the next period?"
                  rows={3}
                />
              </div>
            </div>
            <div className="hod-modal-footer">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button 
                className="hod-save-btn" 
                onClick={handleSubmitAppraisal}
                disabled={submitting || !selectedLecturer || !appraisalData.comment.trim() || !appraisalData.appraisal_period}
              >
                {submitting ? 'Submitting...' : 'Submit Appraisal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODStaffAppraisal;