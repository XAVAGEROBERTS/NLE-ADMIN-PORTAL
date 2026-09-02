// src/components/admin/CourseModal.jsx
import React from 'react';

const CourseModal = ({
  showCourseModal,
  setShowCourseModal,
  newCourse,
  setNewCourse,
  handleAddCourse
}) => {
  return (
    <>
      <div className="modal-overlay" onClick={() => setShowCourseModal(false)}>
        <div className="modal course-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>📖 Add New Course</h3>
            <button className="close-btn" onClick={() => setShowCourseModal(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input
                type="text"
                value={newCourse.course_code}
                onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })}
                placeholder="e.g., CS-401"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Course Name *</label>
              <input
                type="text"
                value={newCourse.course_name}
                onChange={(e) => setNewCourse({ ...newCourse, course_name: e.target.value })}
                placeholder="e.g., Machine Learning"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                placeholder="Course description"
                rows="3"
                className="form-textarea"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Year</label>
                <select
                  value={newCourse.year}
                  onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })}
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
                  value={newCourse.semester}
                  onChange={(e) => setNewCourse({ ...newCourse, semester: parseInt(e.target.value) })}
                  className="form-select"
                >
                  <option value={1}>Semester 1</option>
                  <option value={2}>Semester 2</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Credits</label>
                <input
                  type="number"
                  value={newCourse.credits}
                  onChange={(e) => setNewCourse({ ...newCourse, credits: parseInt(e.target.value) })}
                  min="1"
                  max="6"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Department Code</label>
              <input
                type="text"
                value={newCourse.department_code}
                onChange={(e) => setNewCourse({ ...newCourse, department_code: e.target.value })}
                placeholder="e.g., ENG, SCT"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Program</label>
              <input
                type="text"
                value={newCourse.program}
                onChange={(e) => setNewCourse({ ...newCourse, program: e.target.value })}
                placeholder="e.g., Computer Engineering"
                className="form-input"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="cancel-button" onClick={() => setShowCourseModal(false)}>
              Cancel
            </button>
            <button className="confirm-button" onClick={handleAddCourse}>
              Add Course
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
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
          animation: modalSlideUp 0.4s ease-out;
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
          grid-template-columns: 1fr 1fr 1fr;
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

export default CourseModal;