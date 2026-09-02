// src/components/admin/DeansTab.jsx
import React from 'react';
import { supabase } from '../../services/supabase';
import './DeansTab.css';

const DeansTab = ({
  deans, loadingDeans, setShowUserModal, setNewUser,
  setBulkMessageRole, setBulkMessageText, setShowBulkMessageModal,
  openEditModal, openChatWithUser, handleProfilePictureUpdate,
  fetchDeans, fetchDashboardStats, showToast
}) => {
  return (
    <div className="deans-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>👨‍🎓 Dean Management</h2>
          <span className="record-count">{deans.length} deans</span>
        </div>
        <div className="tab-actions">
          <button className="add-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "dean", faculty_id: "", faculty_name: "" })); setShowUserModal(true); }}>
            + Add Dean
          </button>
          <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('dean'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>
            📨 Message All
          </button>
        </div>
      </div>

      {loadingDeans ? (
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading deans...</p>
        </div>
      ) : deans.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👨‍🎓</span>
          <p>No deans found</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Faculty</th>
                <th>Faculty Code</th>
                <th>Contact</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deans.map((dean) => (
                <tr key={dean.id}>
                  <td>
                    <div
                      className="dean-avatar"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            await handleProfilePictureUpdate(file, dean.id, 'dean');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {dean.profile_picture_url ? (
                        <img
                          src={dean.profile_picture_url}
                          alt={dean.display_name}
                        />
                      ) : (
                        <span>{dean.display_name?.[0]?.toUpperCase() || "👤"}</span>
                      )}
                    </div>
                  </td>
                  <td><strong>{dean.display_name || dean.email}</strong></td>
                  <td className="dean-email">{dean.email}</td>
                  <td>{dean.faculties?.faculty_name || 'N/A'}</td>
                  <td><span className="dept-badge">{dean.faculties?.faculty_code || 'N/A'}</span></td>
                  <td className="contact-info">
                    {dean.faculties?.contact_phone || dean.faculties?.contact_email ? (
                      <>
                        {dean.faculties?.contact_email && <div>📧 {dean.faculties?.contact_email}</div>}
                        {dean.faculties?.contact_phone && <div>📱 {dean.faculties?.contact_phone}</div>}
                      </>
                    ) : 'N/A'}
                  </td>
                  <td>{dean.created_at ? new Date(dean.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => openEditModal(dean, 'dean')}>✏️</button>
                      <button className="action-btn message" onClick={() => openChatWithUser(dean, 'dean')}>💬</button>
                      <button className="action-btn delete" onClick={() => {
                        if (window.confirm(`Remove Dean ${dean.email}?`)) {
                          supabase.from("user_roles").delete().eq("id", dean.id)
                            .then(() => {
                              showToast("Dean removed successfully!", 'success');
                              fetchDeans();
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

export default DeansTab;