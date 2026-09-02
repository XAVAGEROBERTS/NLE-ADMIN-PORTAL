// src/components/admin/UserModal.jsx
import React from 'react';

const UserModal = ({
  newUser,
  setNewUser,
  showUserModal,
  setShowUserModal,
  handleAddStudent,
  handleAddLecturer,
  handleAddDean,
  handleAddHOD,
  handleAddFinance,
  programs,
  programsLoading,
  faculties,
  departments
}) => {
  const handleSubmit = () => {
    if (newUser.role === "student") handleAddStudent();
    else if (newUser.role === "lecturer") handleAddLecturer();
    else if (newUser.role === "dean") handleAddDean();
    else if (newUser.role === "hod") handleAddHOD();
    else if (newUser.role === "finance") handleAddFinance();
  };

  const getTitle = () => {
    if (newUser.role === "student") return "Add New Student";
    if (newUser.role === "lecturer") return "Add New Lecturer";
    if (newUser.role === "dean") return "Add New Dean";
    if (newUser.role === "hod") return "Add New HOD";
    if (newUser.role === "finance") return "Add New Finance Officer";
    return "Add New User";
  };

  return (
    <>
      <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
        <div className="modal large-modal user-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{getTitle()}</h3>
            <button className="close-btn" onClick={() => setShowUserModal(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Enter full name"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Enter email address"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Enter phone number"
                className="form-input"
              />
            </div>

            {newUser.role === "student" && (
              <>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    value={newUser.date_of_birth}
                    onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Program *</label>
                  {programsLoading ? (
                    <p>Loading programs...</p>
                  ) : (
                    <select
                      value={newUser.program_id || ""}
                      onChange={(e) => {
                        const selectedProg = programs.find(p => p.id === e.target.value);
                        setNewUser({
                          ...newUser,
                          program_id: selectedProg?.id || "",
                          program: selectedProg?.name || "",
                          program_code: selectedProg?.code || ""
                        });
                      }}
                      className="form-select"
                    >
                      <option value="">Select Program</option>
                      {programs.map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name} ({prog.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Department Code *</label>
                  <input
                    type="text"
                    value={newUser.department_code}
                    onChange={(e) => setNewUser({
                      ...newUser,
                      department_code: e.target.value.trim().toUpperCase().replace(/\s+/g, "")
                    })}
                    placeholder="e.g. SCT"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Academic Year *</label>
                  <input
                    type="text"
                    value={newUser.academic_year}
                    onChange={(e) => setNewUser({ ...newUser, academic_year: e.target.value.trim() })}
                    placeholder="e.g. 2025/2029"
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Year of Study</label>
                    <select
                      value={newUser.year_of_study}
                      onChange={(e) => setNewUser({ ...newUser, year_of_study: parseInt(e.target.value) })}
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
                      value={newUser.semester}
                      onChange={(e) => setNewUser({ ...newUser, semester: parseInt(e.target.value) })}
                      className="form-select"
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {newUser.role === "lecturer" && (
              <>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="e.g., Computer Science"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input
                    type="text"
                    value={newUser.specialization}
                    onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })}
                    placeholder="e.g., Web Development"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Google Meet Link</label>
                  <input
                    type="url"
                    value={newUser.google_meet_link}
                    onChange={(e) => setNewUser({ ...newUser, google_meet_link: e.target.value })}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    className="form-input"
                  />
                </div>
              </>
            )}

            {newUser.role === "dean" && (
              <div className="form-group">
                <label className="form-label">Faculty *</label>
                <select
                  value={newUser.faculty_id}
                  onChange={(e) => {
                    const selectedFaculty = faculties.find(f => f.id === e.target.value);
                    setNewUser({
                      ...newUser,
                      faculty_id: e.target.value,
                      faculty_name: selectedFaculty?.faculty_name || ""
                    });
                  }}
                  className="form-select"
                  required
                >
                  <option value="">Select Faculty</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.faculty_name} ({faculty.faculty_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newUser.role === "hod" && (
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  value={newUser.department_id}
                  onChange={(e) => {
                    const selectedDept = departments.find(d => d.id === e.target.value);
                    setNewUser({
                      ...newUser,
                      department_id: e.target.value,
                      department_name: selectedDept?.department_name || "",
                      department_code: selectedDept?.department_code || ""
                    });
                  }}
                  className="form-select"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department_name} ({dept.department_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newUser.role === "finance" && (
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  value="Finance Department"
                  disabled
                  className="form-input"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <small style={{ color: '#999' }}>Department is fixed</small>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={() => setShowUserModal(false)}>
              Cancel
            </button>
            <button className="confirm-button" onClick={handleSubmit}>
              {newUser.role === "student" && "Add Student"}
              {newUser.role === "lecturer" && "Add Lecturer"}
              {newUser.role === "dean" && "Add Dean"}
              {newUser.role === "hod" && "Add HOD"}
              {newUser.role === "finance" && "Add Finance Officer"}
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
        .form-select,
        .form-textarea {
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
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          transition: all 0.3s;
          cursor: pointer;
        }

        .confirm-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
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

export default UserModal;