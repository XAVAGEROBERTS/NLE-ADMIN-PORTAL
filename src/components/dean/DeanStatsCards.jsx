// dean/DeanStatsCards.jsx - HARDENED
import React, { useMemo } from 'react';

const DeanStatsCards = ({ stats }) => {
  const cards = useMemo(() => [
    { id: 'departments', label: '🏢 Departments', value: stats.totalDepartments, color: 'blue' },
    { id: 'courses', label: '📚 Courses', value: stats.totalCourses, color: 'green' },
    { id: 'students', label: '👨‍🎓 Students', value: stats.totalStudents, color: 'orange' },
    { id: 'lecturers', label: '👨‍🏫 Lecturers', value: stats.totalLecturers, color: 'purple' },
    { id: 'hods', label: '👨‍💼 HODs', value: stats.totalHODs, color: 'teal' },
  ], [stats]);

  const colorMap = {
    blue: 'dean-stat-blue',
    green: 'dean-stat-green',
    orange: 'dean-stat-orange',
    purple: 'dean-stat-purple',
    teal: 'dean-stat-teal',
    red: 'dean-stat-red',
  };

  return (
    <div className="dean-stats-grid">
      {cards.map((card) => (
        <div key={card.id} className={`dean-stat-card ${colorMap[card.color] || ''}`}>
          <h3>{card.value}</h3>
          <p>{card.label}</p>
        </div>
      ))}
    </div>
  );
};

export default DeanStatsCards;