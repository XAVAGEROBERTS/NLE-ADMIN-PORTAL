// src/components/admin/ExamsTab.jsx
import React from 'react';
import './ExamsTab.css';

const ExamsTab = ({
  exams, setShowExamsModal, handleDeleteExam,
  getAdminExamStatus, getTimeUntilStart
}) => {
  return (
    <div className="exams-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>🎯 Exam Management</h2>
          <span className="record-count">{exams.length} exams</span>
        </div>
        <button className="add-button" onClick={() => setShowExamsModal(true)}>+ Schedule Exam</button>
      </div>

      <div className="exams-list">
        {exams.length > 0 ? (
          exams.map((exam) => {
            const status = getAdminExamStatus(exam);
            return (
              <div key={exam.id} className="exam-card">
                <div className="exam-header">
                  <div>
                    <h3>{exam.title}</h3>
                    <p className="course-info">{exam.courses?.course_code} - {exam.courses?.course_name}</p>
                  </div>
                  <span className={`exam-status ${status}`}>{status.toUpperCase()}</span>
                </div>
                <p className="exam-description">{exam.description}</p>
                <div className={`exam-status-bar ${status}`}>
                  <strong>
                    {status === "active" ? "🔴 EXAM IS ONGOING NOW" : 
                     status === "upcoming" ? `⏳ Starts in ${getTimeUntilStart(exam.start_time)}` : 
                     "✅ Exam Ended"}
                  </strong>
                </div>
                <div className="exam-details">
                  <div><strong>Start:</strong> {new Date(exam.start_time).toLocaleString()}</div>
                  <div><strong>End:</strong> {new Date(exam.end_time).toLocaleString()}</div>
                  <div><strong>Duration:</strong> {exam.duration_minutes} minutes</div>
                  <div><strong>Total Marks:</strong> {exam.total_marks}</div>
                  <div><strong>Location:</strong> {exam.venue || exam.location || "Online"}</div>
                </div>
                <div className="exam-actions">
                  <button className="action-btn delete" onClick={() => handleDeleteExam(exam.id)}>🗑️ Delete</button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No exams scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamsTab;