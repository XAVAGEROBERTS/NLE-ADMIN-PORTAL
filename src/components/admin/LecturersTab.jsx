// src/components/admin/LecturersTab.jsx
import React from 'react';
import './LecturersTab.css';

const LecturersTab = ({
  lecturers, searchTerm, setSearchTerm, setShowUserModal, setNewUser,
  setBulkMessageRole, setBulkMessageText, setShowBulkMessageModal,
  openEditModal, openChatWithUser, setSelectedLecturerForDept, 
  setShowDeptAssignmentModal, setSelectedLecturerForCourses, 
  setShowCourseAssignmentModal, handleProfilePictureUpdate,
  renderLecturerDepartments
}) => {
  return (
    <div className="lecturers-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>👨‍🏫 Lecturer Management</h2>
          <span className="record-count">{lecturers.length} lecturers</span>
        </div>
        <div className="tab-actions">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="🔍 Search lecturers..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="add-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "lecturer" })); setShowUserModal(true); }}>
            + Add Lecturer
          </button>
          <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('lecturer'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>
            📨 Message All
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>Photo</th>
              <th>Lecturer ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Specialization</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lecturers.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-row">
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>No lecturers found</p>
                  </div>
                </td>
              </tr>
            ) : (
              lecturers.map((lecturer) => (
                <tr key={lecturer.id}>
                  <td>
                    <div
                      className="lecturer-avatar"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            await handleProfilePictureUpdate(file, lecturer.id, 'lecturer');
                          }
                        };
                        input.click();
                      }}
                      title="Click to upload photo"
                    >
                      {lecturer.profile_picture_url ? (
                        <img
                          src={lecturer.profile_picture_url}
                          alt={lecturer.full_name}
                        />
                      ) : (
                        <span>{lecturer.full_name?.[0]?.toUpperCase() || "👤"}</span>
                      )}
                    </div>
                  </td>
                  <td><span className="lecturer-id">{lecturer.lecturer_id}</span></td>
                  <td className="lecturer-name">{lecturer.full_name}</td>
                  <td className="lecturer-email">{lecturer.email}</td>
                  <td>{renderLecturerDepartments(lecturer)}</td>
                  <td className="specialization">{lecturer.specialization || "—"}</td>
                  <td>
                    <span className={`status-badge ${lecturer.status || "active"}`}>
                      {lecturer.status || "active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => openEditModal(lecturer, 'lecturer')}>✏️</button>
                      <button className="action-btn message" onClick={() => openChatWithUser(lecturer, 'lecturer')}>💬</button>
                      <button className="action-btn dept" onClick={() => { setSelectedLecturerForDept(lecturer); setShowDeptAssignmentModal(true); }}>🏢</button>
                      <button className="action-btn courses" onClick={() => { setSelectedLecturerForCourses(lecturer); setShowCourseAssignmentModal(true); }}>📚</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LecturersTab;