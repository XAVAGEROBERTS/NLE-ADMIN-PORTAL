// dean/DeanHODs.jsx
import React from 'react';

const DeanHODs = ({ hods, departments, openChatWithUser }) => {
  return (
    <div className="dean-section">
      <h2 className="dean-section-title">👨‍💼 Department Heads (HODs)</h2>

      <div className="dean-card">
        <table className="dean-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Department</th>
              <th>HOD Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {hods.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                  No HODs found in this faculty
                </td>
              </tr>
            ) : (
              hods.map((hod) => (
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
                  <td>{hod.email}</td>
                  <td>{hod.contact_phone || '—'}</td>
                  <td>
                    <span className={`dean-status ${hod.is_active !== false ? 'active' : 'inactive'}`}>
                      {hod.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="dean-chat-btn" onClick={() => openChatWithUser(hod, 'hod')}>
                      💬 Message
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeanHODs;