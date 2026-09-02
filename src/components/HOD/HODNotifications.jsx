// HODNotifications.jsx
import React from 'react';

const HODNotifications = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNotificationClick,
  onClose,
}) => {
  return (
    <div className="hod-notification-dropdown">
      <div className="hod-notification-header">
        <h4>Notifications ({unreadCount} unread)</h4>
        {unreadCount > 0 && (
          <button className="hod-mark-all-read" onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>
      <div className="hod-notification-list">
        {notifications.length === 0 ? (
          <div className="hod-notification-empty">No notifications</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`hod-notification-item ${!notif.is_read ? 'unread' : ''}`}
              onClick={() => onNotificationClick(notif)}
            >
              <div className="hod-notification-content">
                <strong>{notif.sender_name || notif.sender_email}</strong>
                <p>{notif.message}</p>
                <small>{new Date(notif.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HODNotifications;