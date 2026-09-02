// src/components/admin/HODsTab.jsx
import React from 'react';
import { supabase } from '../../services/supabase';
import './HODsTab.css';

const HODsTab = ({
  hods, loadingHODs, setShowUserModal, setNewUser,
  setBulkMessageRole, setBulkMessageText, setShowBulkMessageModal,
  openEditModal, openChatWithUser, handleProfilePictureUpdate,
  fetchHODs, fetchDashboardStats, showToast, departments
}) => {
  return (
    <div className="hods-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>🏢 HOD Management</h2>
          <span className="record-count">{hods.length} HODs</span>
        </div>
        <div className="tab-actions">
          <button className="add-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "hod", department_id: "", department_name: "", department_code: "" })); setShowUserModal(true); }}>
            + Add HOD
          </button>
          <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('hod'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>
            📨 Message All
          </button>
        </div>
      </div>

      {loadingHODs ? (
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading HODs...</p>
        </div>
      ) : hods.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏢</span>
          <p>No HODs found</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Department Code</th>
                <th>Contact</th>
                <th>Faculty</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hods.map((hod) => (
                <tr key={hod.id}>
                  <td>
                    <div
                      className="hod-avatar"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            await handleProfilePictureUpdate(file, hod.id, 'hod');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {hod.profile_picture_url ? (
                        <img
                          src={hod.profile_picture_url}
                          alt={hod.display_name}
                        />
                      ) : (
                        <span>{hod.display_name?.[0]?.toUpperCase() || "👤"}</span>
                      )}
                    </div>
                  </td>
                  <td><strong>{hod.display_name || hod.email}</strong></td>
                  <td className="hod-email">{hod.email}</td>
                  <td>{hod.departments?.department_name || 'N/A'}</td>
                  <td><span className="dept-badge">{hod.departments?.department_code || 'N/A'}</span></td>
                  <td className="contact-info">
                    {hod.departments?.contact_phone || hod.departments?.contact_email ? (
                      <>
                        {hod.departments?.contact_email && <div>📧 {hod.departments?.contact_email}</div>}
                        {hod.departments?.contact_phone && <div>📱 {hod.departments?.contact_phone}</div>}
                      </>
                    ) : 'N/A'}
                  </td>
                  <td>{hod.faculties?.faculty_name || 'N/A'}</td>
                  <td>{hod.created_at ? new Date(hod.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => openEditModal(hod, 'hod')}>✏️</button>
                      <button className="action-btn message" onClick={() => openChatWithUser(hod, 'hod')}>💬</button>
                      <button className="action-btn delete" onClick={() => {
                        if (window.confirm(`Remove HOD ${hod.email}?`)) {
                          supabase.from("user_roles").delete().eq("id", hod.id)
                            .then(() => {
                              showToast("HOD removed successfully!", 'success');
                              fetchHODs();
                              fetchDashboardStats();
                            })
                            .catch(err => showToast("Error: " + err.message, 'error'));
                        }
                      }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HODsTab;