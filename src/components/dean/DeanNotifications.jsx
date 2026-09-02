// dean/DeanNotifications.jsx - FIXED
import React from 'react';

const DeanNotifications = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNotificationClick,
  onClose,
}) => {
  if (!notifications || notifications.length === 0) {
    return (
      <div className="dean-notification-dropdown">
        <div className="dean-notification-header">
          <h4>Notifications (0 unread)</h4>
          <button className="dean-mark-all-read" onClick={onClose}>Close</button>
        </div>
        <div className="dean-notification-empty">
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
          <p>No notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dean-notification-dropdown" style={{
      position: 'absolute',
      top: '45px',
      right: '0',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      width: '380px',
      maxHeight: '450px',
      overflow: 'hidden',
      zIndex: '1000',
      color: '#333',
    }}>
      <div className="dean-notification-header" style={{
        padding: '14px 18px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
      }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#1a237e' }}>
          Notifications ({unreadCount} unread)
        </h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button 
              className="dean-mark-all-read" 
              onClick={onMarkAllRead}
              style={{
                background: 'none',
                border: 'none',
                color: '#1976d2',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Mark all read
            </button>
          )}
          <button 
            className="dean-mark-all-read" 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer',
              fontWeight: '500',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="dean-notification-list" style={{
        maxHeight: '350px',
        overflowY: 'auto',
      }}>
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`dean-notification-item ${!notif.is_read ? 'unread' : ''}`}
            onClick={() => {
              // Mark as read first
              if (!notif.is_read) {
                onMarkRead(notif.id);
              }
              // Then open chat
              if (onNotificationClick) {
                onNotificationClick(notif);
              }
            }}
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'background 0.2s',
              background: !notif.is_read ? '#e3f2fd' : 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = !notif.is_read ? '#bbdefb' : '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !notif.is_read ? '#e3f2fd' : 'white';
            }}
          >
            <div className="dean-notification-content">
              <strong style={{
                display: 'block',
                fontSize: '13px',
                color: '#1a237e',
                marginBottom: '2px',
              }}>
                💬 {notif.sender_name || notif.sender_email}
              </strong>
              <p style={{
                margin: '4px 0',
                fontSize: '13px',
                color: '#555',
                wordWrap: 'break-word',
                lineHeight: '1.4',
              }}>
                {notif.message}
              </p>
              <small style={{
                fontSize: '11px',
                color: '#999',
                display: 'block',
                marginTop: '4px',
              }}>
                {new Date(notif.created_at).toLocaleString()}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeanNotifications;