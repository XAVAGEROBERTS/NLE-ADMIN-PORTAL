// src/components/admin/EditUserModal.jsx
import React from 'react';

const EditUserModal = ({
  editUser,
  setEditUser,
  showEditModal,
  setShowEditModal,
  handleEditUser,
  faculties,
  departments
}) => {
  return (
    <>
      <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
        <div className="modal large-modal edit-user-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit {editUser.role?.charAt(0).toUpperCase() + editUser.role?.slice(1)}</h3>
            <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={editUser.full_name}
                onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editUser.email}
                disabled
                className="form-input"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <small style={{ color: '#999' }}>Email cannot be changed</small>
            </div>

            {(editUser.role === "student" || editUser.role === "lecturer") && (
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  value={editUser.phone || ''}
                  onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                value={editUser.status}
                onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
                className="form-select"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {editUser.role === "student" && (
              <>
                <div className="form-group">
                  <label className="form-label">Program</label>
                  <input
                    type="text"
                    value={editUser.program || ''}
                    onChange={(e) => setEditUser({ ...editUser, program: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department Code</label>
                  <input
                    type="text"
                    value={editUser.department_code || ''}
                    onChange={(e) => setEditUser({ ...editUser, department_code: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Year of Study</label>
                    <select
                      value={editUser.year_of_study}
                      onChange={(e) => setEditUser({ ...editUser, year_of_study: parseInt(e.target.value) })}
                      className="form-select"
                    >
                      {[1, 2, 3, 4].map(y => (
                        <option key={y} value={y}>Year {y}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Semester</label>
                    <select
                      value={editUser.semester}
                      onChange={(e) => setEditUser({ ...editUser, semester: parseInt(e.target.value) })}
                      className="form-select"
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input
                    type="text"
                    value={editUser.academic_year || ''}
                    onChange={(e) => setEditUser({ ...editUser, academic_year: e.target.value })}
                    className="form-input"
                  />
                </div>
              </>
            )}

            {editUser.role === "lecturer" && (
              <>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    value={editUser.department || ''}
                    onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input
                    type="text"
                    value={editUser.specialization || ''}
                    onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Google Meet Link</label>
                  <input
                    type="url"
                    value={editUser.google_meet_link || ''}
                    onChange={(e) => setEditUser({ ...editUser, google_meet_link: e.target.value })}
                    className="form-input"
                  />
                </div>
              </>
            )}

            {editUser.role === "dean" && (
              <>
                <div className="info-box">
                  <strong>📚 Faculty Information</strong>
                  <p>This information is stored in the faculties table</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Faculty</label>
                  <input
                    type="text"
                    value={editUser.faculty_id ? faculties.find(f => f.id === editUser.faculty_id)?.faculty_name || 'N/A' : 'N/A'}
                    disabled
                    className="form-input"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#999' }}>Faculty cannot be changed</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    value={editUser.contact_email || ''}
                    onChange={(e) => setEditUser({ ...editUser, contact_email: e.target.value })}
                    className="form-input"
                    placeholder="Enter faculty contact email"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    value={editUser.contact_phone || ''}
                    onChange={(e) => setEditUser({ ...editUser, contact_phone: e.target.value })}
                    className="form-input"
                    placeholder="Enter faculty contact phone"
                  />
                </div>
              </>
            )}

            {editUser.role === "hod" && (
              <>
                <div className="info-box">
                  <strong>🏢 Department Information</strong>
                  <p>This information is stored in the departments table</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    value={editUser.department_id ? departments.find(d => d.id === editUser.department_id)?.department_name || 'N/A' : 'N/A'}
                    disabled
                    className="form-input"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#999' }}>Department cannot be changed</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    value={editUser.contact_email || ''}
                    onChange={(e) => setEditUser({ ...editUser, contact_email: e.target.value })}
                    className="form-input"
                    placeholder="Enter department contact email"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    value={editUser.contact_phone || ''}
                    onChange={(e) => setEditUser({ ...editUser, contact_phone: e.target.value })}
                    className="form-input"
                    placeholder="Enter department contact phone"
                  />
                </div>
              </>
            )}

            {editUser.role === "finance" && (
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  value="Finance Department"
                  disabled
                  className="form-input"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <small style={{ color: '#999' }}>Department cannot be changed</small>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button className="confirm-button" onClick={handleEditUser}>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          backdrop-filter: blur(5px);
        }

        .modal {
          background: white;
          border-radius: 20px;
          padding: 35px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
          animation: modalSlideUp 0.4s ease-out;
        }

        .modal.large-modal {
          max-width: 700px;
          width: 95%;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e8ecf1;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          color: #1a1a2e;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
          padding: 5px;
        }

        .close-btn:hover {
          color: #dc3545;
          transform: scale(1.1);
        }

        .modal-body {
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 5px;
        }

        .modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: #667eea;
          border-radius: 3px;
        }

        .info-box {
          background: #f0f7ff;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #667eea;
        }

        .info-box strong {
          display: block;
          color: #1a1a2e;
        }

        .info-box p {
          margin: 4px 0 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .form-label {
          font-weight: 600;
          color: #1a1a2e;
          font-size: 14px;
        }

        .form-input,
        .form-select {
          padding: 12px 16px;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s;
          background: #fafbfc;
          font-family: inherit;
          width: 100%;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 15px;
          justify-content: flex-end;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e8ecf1;
        }

        .cancel-button {
          padding: 12px 25px;
          background: transparent;
          border: 2px solid #e8ecf1;
          border-radius: 10px;
          color: #6b7280;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .cancel-button:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }

        .confirm-button {
          padding: 12px 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .confirm-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }

        @media (max-width: 768px) {
          .modal {
            padding: 25px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column;
          }

          .modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};

export default EditUserModal;