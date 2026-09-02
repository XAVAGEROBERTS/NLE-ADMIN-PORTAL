// HODOverview.jsx
import React from 'react';
import HOStatsCards from './HOStatsCards';

const HODOverview = ({
  departmentName,
  departmentCode,
  stats,
  deanInfo,
  admins,
  courses,
  students,
  lecturers,
  recentAttendance,
  openChatWithUser,
  openAdminChat,
  profile,
  profileVersion,
  hodName,
  hodEmail,
}) => {
  return (
    <div className="hod-section">
      <h2 className="hod-section-title">Department Overview – {departmentName}</h2>

      {/* Stats Cards */}
      <HOStatsCards stats={stats} />

      {/* Dean Card */}
      {deanInfo && (
        <div className="hod-dean-card">
          <div className="hod-dean-card-header">
            <div
              className="hod-dean-avatar"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
                flexShrink: 0,
              }}
            >
              {deanInfo.profile_picture_url ? (
                <img
                  src={deanInfo.profile_picture_url}
                  alt={deanInfo.display_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 22, color: '#666' }}>
                  {deanInfo.display_name?.[0]?.toUpperCase() || '👔'}
                </span>
              )}
            </div>
            <div>
              <h3>Your Dean</h3>
              <p>{deanInfo.display_name} – {deanInfo.faculty_name}</p>
            </div>
          </div>
          <p className="hod-dean-email">📧 {deanInfo.email}</p>
          <button
            className="hod-dean-chat-btn"
            onClick={() => openChatWithUser(deanInfo, 'dean')}
          >
            💬 Message Dean
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="hod-quick-stats-grid">
        <div className="hod-quick-stat">
          <span className="hod-quick-stat-icon">📚</span>
          <div>
            <h4>{courses.length}</h4>
            <p>Courses</p>
          </div>
        </div>
        <div className="hod-quick-stat">
          <span className="hod-quick-stat-icon">👨‍🎓</span>
          <div>
            <h4>{students.length}</h4>
            <p>Students</p>
          </div>
        </div>
        <div className="hod-quick-stat">
          <span className="hod-quick-stat-icon">👨‍🏫</span>
          <div>
            <h4>{lecturers.length}</h4>
            <p>Lecturers</p>
          </div>
        </div>
        <div className="hod-quick-stat">
          <span className="hod-quick-stat-icon">📊</span>
          <div>
            <h4>{stats.attendanceRate || 0}%</h4>
            <p>Attendance Rate</p>
          </div>
        </div>
      </div>

      {/* Admins */}
      {admins.length > 0 && (
        <div className="hod-card" style={{ marginTop: 20 }}>
          <h3 className="hod-card-title">👤 System Administrators</h3>
          <table className="hod-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td><strong>{admin.display_name}</strong></td>
                  <td>{admin.email}</td>
                  <td>
                    <button className="hod-chat-btn" onClick={() => openChatWithUser(admin, 'admin')}>
                      💬 Message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Attendance */}
      {recentAttendance.length > 0 && (
        <div className="hod-card" style={{ marginTop: 20 }}>
          <h3 className="hod-card-title">📊 Recent Attendance</h3>
          <table className="hod-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Course</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAttendance.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.students?.full_name}</td>
                  <td>{r.courses?.course_code}</td>
                  <td>
                    <span className={`hod-status ${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HODOverview;