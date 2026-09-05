// src/components/admin/modals/UserModal.jsx
import React, { useState, useEffect } from 'react';

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
  // Auto-generate email when name changes
  useEffect(() => {
    if (newUser.role === 'student' && newUser.full_name && newUser.full_name.trim()) {
      generateEmail();
    }
  }, [newUser.full_name]);

  // Auto-fill program details when program is selected
  useEffect(() => {
    if (newUser.role === 'student' && newUser.program_id) {
      const selectedProgram = programs.find(p => p.id === newUser.program_id);
      if (selectedProgram) {
        const currentYear = new Date().getFullYear();
        const programYears = selectedProgram.years || 3;
        const endYear = currentYear + programYears;
        const academicYear = `${currentYear}/${endYear}`;
        
        const currentMonth = new Date().getMonth();
        const semester = (currentMonth >= 1 && currentMonth <= 6) ? 2 : 1;
        const intake = semester === 1 ? 'August' : 'January';

        console.log('📚 Selected Program:', {
          name: selectedProgram.name,
          code: selectedProgram.code,
          years: selectedProgram.years,
          department: selectedProgram.department_name,
          department_code: selectedProgram.department_code
        });

        setNewUser(prev => ({
          ...prev,
          program_code: selectedProgram.code,
          program_name: selectedProgram.name,
          program: selectedProgram.name,
          department: selectedProgram.department_name || '',
          department_code: selectedProgram.department_code || '',
          program_duration_years: programYears,
          total_semesters: programYears * 2,
          academic_year: academicYear,
          year_of_study: 1,
          semester: semester,
          intake: intake
        }));
      }
    }
  }, [newUser.program_id, programs]);

  const generateEmail = () => {
    const fullName = newUser.full_name?.trim();
    if (!fullName) return;

    const nameParts = fullName.toLowerCase().split(' ');
    let emailName = '';
    
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      emailName = lastName + firstName;
    } else {
      emailName = nameParts[0];
    }
    
    emailName = emailName.replace(/[^a-zA-Z]/g, '');
    const email = `${emailName}@nle.university.com`;
    
    console.log('📧 Generated email:', email);
    
    setNewUser(prev => ({
      ...prev,
      email: email
    }));
  };

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
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={newUser.full_name || ''}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="Enter full name (e.g., Kenyi Robert)"
                className="form-input"
              />
              <small className="form-hint">💡 Email will be auto-generated: lastnamefirstname@nle.university.com</small>
            </div>

            {/* Email - Auto-filled */}
            <div className="form-group">
              <label className="form-label">Email *</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="email"
                  value={newUser.email || ''}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Email auto-generated from name"
                  className="form-input"
                  style={{ flex: 1 }}
                />
             
              </div>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={newUser.phone || ''}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Enter phone number"
                className="form-input"
              />
            </div>

            {newUser.role === "student" && (
              <>
                {/* Date of Birth */}
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    value={newUser.date_of_birth || ''}
                    onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Program Selection - CORRECTED to show actual years from database */}
                <div className="form-group">
                  <label className="form-label">Program *</label>
                  {programsLoading ? (
                    <p>Loading programs...</p>
                  ) : (
                    <select
                      value={newUser.program_id || ""}
                      onChange={(e) => {
                        const selectedProgram = programs.find(p => p.id === e.target.value);
                        if (selectedProgram) {
                          const currentYear = new Date().getFullYear();
                          const programYears = selectedProgram.years || 3;
                          const endYear = currentYear + programYears;
                          const academicYear = `${currentYear}/${endYear}`;
                          
                          const currentMonth = new Date().getMonth();
                          const semester = (currentMonth >= 1 && currentMonth <= 6) ? 2 : 1;

                          console.log('📚 Selected Program:', {
                            id: selectedProgram.id,
                            code: selectedProgram.code,
                            name: selectedProgram.name,
                            years: selectedProgram.years,
                            department: selectedProgram.department_name,
                            department_code: selectedProgram.department_code
                          });

                          setNewUser({
                            ...newUser,
                            program_id: e.target.value,
                            program_code: selectedProgram.code,
                            program_name: selectedProgram.name,
                            program: selectedProgram.name,
                            department: selectedProgram.department_name || '',
                            department_code: selectedProgram.department_code || '',
                            program_duration_years: programYears,
                            total_semesters: programYears * 2,
                            academic_year: academicYear,
                            year_of_study: 1,
                            semester: semester,
                            intake: semester === 1 ? 'August' : 'January'
                          });
                        } else {
                          setNewUser({
                            ...newUser,
                            program_id: e.target.value
                          });
                        }
                      }}
                      className="form-select"
                    >
                      <option value="">Select Program</option>
                      {programs.map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name} ({prog.code}) - {prog.years || 3} Years
                        </option>
                      ))}
                    </select>
                  )}
                  {!programsLoading && programs.length === 0 && (
                    <small style={{ color: '#dc3545' }}>
                      ⚠️ No programs found. Please add programs in the Programs tab.
                    </small>
                  )}
                </div>

                {/* Auto-filled Fields Display */}
                {newUser.program_id && newUser.program_duration_years && (
                  <div className="auto-filled-fields" style={{ 
                    background: '#f8f9fa', 
                    padding: '16px', 
                    borderRadius: '10px',
                    marginTop: '10px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#495057' }}>
                      ✅ Auto-filled Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Department</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px' }}>
                          {newUser.department || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Department Code</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px' }}>
                          {newUser.department_code || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Program Duration</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px', color: '#667eea' }}>
                          {newUser.program_duration_years || 3} Years ({newUser.total_semesters || 6} Semesters)
                        </p>
                      </div>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Academic Year</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px' }}>
                          {newUser.academic_year || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Year of Study</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px' }}>
                          {newUser.year_of_study || 1}
                        </p>
                      </div>
                      <div>
                        <small style={{ color: '#6c757d', fontSize: '11px' }}>Semester</small>
                        <p style={{ margin: '2px 0', fontWeight: '500', fontSize: '13px' }}>
                          {newUser.semester || 1} ({newUser.intake || 'N/A'})
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Lecturer Fields */}
            {newUser.role === "lecturer" && (
              <>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    value={newUser.department || ''}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="e.g., Computer Science"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input
                    type="text"
                    value={newUser.specialization || ''}
                    onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })}
                    placeholder="e.g., Web Development"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Google Meet Link</label>
                  <input
                    type="url"
                    value={newUser.google_meet_link || ''}
                    onChange={(e) => setNewUser({ ...newUser, google_meet_link: e.target.value })}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    className="form-input"
                  />
                </div>
              </>
            )}

            {/* Dean Fields */}
            {newUser.role === "dean" && (
              <div className="form-group">
                <label className="form-label">Faculty *</label>
                <select
                  value={newUser.faculty_id || ''}
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

            {/* HOD Fields */}
            {newUser.role === "hod" && (
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  value={newUser.department_id || ''}
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

            {/* Finance Fields */}
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
        .form-hint {
          color: #6c757d;
          font-size: 12px;
          margin-top: 4px;
        }
        .auto-filled-fields {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 10px;
          margin-top: 10px;
          border: 1px solid #e9ecef;
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