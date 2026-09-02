// src/components/admin/StudentsTab.jsx
import React from 'react';
import './StudentsTab.css';

const StudentsTab = ({ 
  students, searchTerm, setSearchTerm, setShowUserModal, setNewUser, 
  setBulkMessageRole, setBulkMessageText, setShowBulkMessageModal,
  openEditModal, handleUpdateStudentStatus, setSelectedStudentForPicture, 
  setShowProfilePictureModal, openChatWithUser 
}) => {
  return (
    <div className="students-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>👥 Student Management</h2>
          <span className="record-count">{students.length} students</span>
        </div>
        <div className="tab-actions">
          <div className="search-wrapper">
            <input 
              type="text" 
              placeholder="🔍 Search students..." 
              className="search-input" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button className="add-button" onClick={() => { setNewUser(prev => ({ ...prev, role: "student" })); setShowUserModal(true); }}>
            + Add Student
          </button>
          <button className="add-button bulk-message" onClick={() => { setBulkMessageRole('student'); setBulkMessageText(''); setShowBulkMessageModal(true); }}>
            📨 Message All
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "60px" }}>Photo</th>
              <th>Student ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Program</th>
              <th>Department</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-row">
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>No students found</p>
                  </div>
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div
                      className="student-avatar"
                      onClick={() => {
                        setSelectedStudentForPicture(student);
                        setShowProfilePictureModal(true);
                      }}
                      title="Click to change photo"
                    >
                      {student.profile_picture_url ? (
                        <img
                          src={student.profile_picture_url}
                          alt={student.full_name}
                        />
                      ) : (
                        <span>{student.full_name?.[0]?.toUpperCase() || "👤"}</span>
                      )}
                    </div>
                  </td>
                  <td><strong className="student-id">{student.student_id}</strong></td>
                  <td className="student-name">{student.full_name}</td>
                  <td className="student-email">{student.email}</td>
                  <td>{student.program || "N/A"}</td>
                  <td>
                    <span className="dept-badge">{student.department_code || "N/A"}</span>
                  </td>
                  <td className="year-semester">Year {student.year_of_study || 1} - Sem {student.semester || 1}</td>
                  <td>
                    <span className={`status-badge ${student.status || "active"}`}>
                      {student.status?.charAt(0).toUpperCase() + student.status?.slice(1) || "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" onClick={() => openEditModal(student, 'student')}>✏️ Edit</button>
                      <button className="action-btn message" onClick={() => openChatWithUser(student, 'student')}>💬</button>
                      <button className="action-btn toggle" onClick={() => handleUpdateStudentStatus(student.id, student.status === "active" ? "inactive" : "active")}>
                        {student.status === "active" ? "⏸" : "▶"}
                      </button>
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

export default StudentsTab;