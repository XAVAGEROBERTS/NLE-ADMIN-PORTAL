// dean/DeanOverview.jsx - HARDENED
import React, { useMemo } from 'react';
import DeanStatsCards from './DeanStatsCards';

const DeanOverview = ({
  facultyName,
  stats,
  departments,
  hods,
  admins,
  recentAttendance,
  openChatWithUser,
  openAdminChat,
  profile,
  profileVersion,
  deanName,
  loading,
}) => {
  // Memoize derived data
  const departmentStats = useMemo(() => {
    const deptCodes = departments.map(d => d.department_code).filter(Boolean);
    return { total: departments.length, codes: deptCodes };
  }, [departments]);

  const recentAttendanceLimited = useMemo(() => {
    return recentAttendance.slice(0, 10);
  }, [recentAttendance]);

  if (loading) {
    return (
      <div className="dean-section">
        <div className="dean-loading">Loading overview...</div>
      </div>
    );
  }

  return (
    <div className="dean-section">
      <h2 className="dean-section-title">🎓 Faculty Overview - {facultyName}</h2>

      <DeanStatsCards stats={stats} />

      <div className="dean-quick-stats-grid">
        <div className="dean-quick-stat">
          <span className="dean-quick-stat-icon">🏢</span>
          <div>
            <h4>{departmentStats.total}</h4>
            <p>Departments</p>
          </div>
        </div>
        <div className="dean-quick-stat">
          <span className="dean-quick-stat-icon">📚</span>
          <div>
            <h4>{stats.totalCourses}</h4>
            <p>Courses</p>
          </div>
        </div>
        <div className="dean-quick-stat">
          <span className="dean-quick-stat-icon">👨‍🎓</span>
          <div>
            <h4>{stats.totalStudents}</h4>
            <p>Students</p>
          </div>
        </div>
        <div className="dean-quick-stat">
          <span className="dean-quick-stat-icon">👨‍🏫</span>
          <div>
            <h4>{stats.totalLecturers}</h4>
            <p>Lecturers</p>
          </div>
        </div>
        <div className="dean-quick-stat">
          <span className="dean-quick-stat-icon">👨‍💼</span>
          <div>
            <h4>{stats.totalHODs}</h4>
            <p>HODs</p>
          </div>
        </div>
        <div className="dean-quick-stat" style={{ cursor: 'pointer' }} onClick={openAdminChat}>
          <span className="dean-quick-stat-icon">👤</span>
          <div>
            <h4>Chat</h4>
            <p>With Admin</p>
          </div>
        </div>
      </div>

      <div className="dean-pending-grid">
        <div className="dean-pending-card dean-pending-orange">
          <span>📚</span>
          <div>
            <h4>{stats.pendingAllocations || 0}</h4>
            <p>Pending Allocations</p>
          </div>
        </div>
        <div className="dean-pending-card dean-pending-blue">
          <span>📝</span>
          <div>
            <h4>{stats.pendingLeaveApprovals || 0}</h4>
            <p>Pending Leave Approvals</p>
          </div>
        </div>
        <div className="dean-pending-card dean-pending-red">
          <span>💬</span>
          <div>
            <h4>{stats.pendingAppeals || 0}</h4>
            <p>Pending Appeals</p>
          </div>
        </div>
        <div className="dean-pending-card dean-pending-green">
          <span>💰</span>
          <div>
            <h4>{stats.pendingBudgetRequests || 0}</h4>
            <p>Pending Budget Requests</p>
          </div>
        </div>
      </div>

      {hods.length > 0 && (
        <div className="dean-card" style={{ marginTop: 20 }}>
          <h3 className="dean-card-title">👨‍💼 Department Heads (HODs)</h3>
          <table className="dean-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Department</th>
                <th>HOD</th>
                <th>Contact</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {hods.slice(0, 10).map(hod => (
                <tr key={hod.id}>
                  <td>
                    <div className="dean-avatar-small">
                      {hod.profile_picture_url ? (
                        <img src={hod.profile_picture_url} alt={hod.head_name} />
                      ) : (
                        <span>{hod.head_name?.[0]?.toUpperCase() || 'H'}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong>{hod.department_code}</strong>
                    <br />
                    <small>{hod.department_name}</small>
                  </td>
                  <td>{hod.head_name || '—'}</td>
                  <td>{hod.contact_phone || hod.email || '—'}</td>
                  <td>
                    <button className="dean-chat-btn" onClick={() => openChatWithUser(hod, 'hod')}>
                      💬 Message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {admins.length > 0 && (
        <div className="dean-card" style={{ marginTop: 20 }}>
          <h3 className="dean-card-title">👤 System Administrators</h3>
          <table className="dean-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.slice(0, 10).map(admin => (
                <tr key={admin.id}>
                  <td>
                    <div className="dean-avatar-small">
                      {admin.profile_picture_url ? (
                        <img src={admin.profile_picture_url} alt={admin.display_name} />
                      ) : (
                        <span>{admin.display_name?.[0]?.toUpperCase() || 'A'}</span>
                      )}
                    </div>
                  </td>
                  <td><strong>{admin.display_name}</strong></td>
                  <td>{admin.email}</td>
                  <td>
                    <button className="dean-chat-btn" onClick={() => openChatWithUser(admin, 'admin')}>
                      💬 Message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recentAttendanceLimited.length > 0 && (
        <div className="dean-card" style={{ marginTop: 20 }}>
          <h3 className="dean-card-title">📊 Recent Attendance</h3>
          <table className="dean-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Course</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAttendanceLimited.map(record => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.students?.full_name || 'Unknown'}</td>
                  <td>{record.courses?.course_code}</td>
                  <td>
                    <span className={`dean-status ${record.status}`}>
                      {record.status}
                    </span>
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

export default DeanOverview;