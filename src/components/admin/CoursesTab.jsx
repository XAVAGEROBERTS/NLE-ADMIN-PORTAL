// src/components/admin/CoursesTab.jsx
import React from 'react';
import './CoursesTab.css';

const CoursesTab = ({
  courses, searchTerm, setSearchTerm, setShowCourseModal,
  renderCoursesGrid, handleToggleCourseActive
}) => {
  return (
    <div className="courses-tab">
      <div className="tab-header">
        <div className="tab-title">
          <h2>📖 Course Management</h2>
          <span className="record-count">{courses.length} courses</span>
        </div>
        <div className="tab-actions">
          <div className="search-wrapper">
            <input 
              type="text" 
              placeholder="🔍 Search courses..." 
              className="search-input" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button className="add-button" onClick={() => setShowCourseModal(true)}>+ Add Course</button>
        </div>
      </div>
      {renderCoursesGrid()}
    </div>
  );
};

export default CoursesTab;