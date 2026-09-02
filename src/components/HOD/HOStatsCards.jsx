// HOStatsCards.jsx
import React from 'react';

const HOStatsCards = ({ stats }) => {
  const cards = [
    { id: 'courses', label: '📚 Courses', value: stats.totalCourses, color: 'green' },
    { id: 'students', label: '👨‍🎓 Students', value: stats.totalStudents, color: 'orange' },
    { id: 'lecturers', label: '👨‍🏫 Lecturers', value: stats.totalLecturers, color: 'purple' },
    { id: 'attendance', label: '📊 Attendance Rate', value: `${stats.attendanceRate || 0}%`, color: 'blue' },
    { id: 'leave', label: '📝 Pending Leave', value: stats.pendingLeaveRequests || 0, color: 'red' },
    { id: 'complaints', label: '💬 Pending Complaints', value: stats.pendingComplaints || 0, color: 'yellow' },
    { id: 'allocations', label: '📚 Pending Allocations', value: stats.pendingAllocations || 0, color: 'teal' },
  ];

  const colorMap = {
    green: 'hod-stat-green',
    orange: 'hod-stat-orange',
    purple: 'hod-stat-purple',
    blue: 'hod-stat-blue',
    red: 'hod-stat-red',
    yellow: 'hod-stat-yellow',
    teal: 'hod-stat-teal',
  };

  return (
    <div className="hod-stats-grid">
      {cards.map((card) => (
        <div key={card.id} className={`hod-stat-card ${colorMap[card.color] || ''}`}>
          <h3>{card.value}</h3>
          <p>{card.label}</p>
        </div>
      ))}
    </div>
  );
};

export default HOStatsCards;