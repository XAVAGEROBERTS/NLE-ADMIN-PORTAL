// HODNotifications.jsx
import React from 'react';

const HODNotifications = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNotificationClick,
  onClose,
}) => {
  // Only show unread notifications
  const visibleNotifications = notifications.filter((n) => n.is_read === false);

  if (visibleNotifications.length === 0) {
    return (
      <div className="hod-notification-dropdown" style={{
        position: 'absolute',
        top: '45px',
        right: '0',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        width: '380px',
        maxHeight: '450px',
        overflow: 'hidden',
        zIndex: 1000,
        color: '#333',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa',
        }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#1a237e' }}>
            Notifications (0)
          </h4>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📭</span>
          <p style={{ margin: 0, fontSize: '14px' }}>No new notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hod-notification-dropdown" style={{
      position: 'absolute',
      top: '45px',
      right: '0',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      width: '380px',
      maxHeight: '450px',
      overflow: 'hidden',
      zIndex: 1000,
      color: '#333',
    }}>
      {/* Header */}
      <div style={{
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {unreadCount > 0 && (
            <>
              <button
                onClick={onMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
              <button
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d32f2f',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* List - only unread */}
      <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
        {visibleNotifications.map((notif) => {
          const isLeave = notif.id?.startsWith('leave-') || notif.type === 'leave_pending';

          return (
            <div
              key={notif.id}
              onClick={() => {
                onMarkRead(notif.id);
                if (onNotificationClick) onNotificationClick(notif);
              }}
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                background: isLeave ? '#fff3e0' : '#e3f2fd',
                borderLeft: isLeave ? '4px solid #ff9800' : '4px solid #1976d2',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px' }}>
                  {isLeave ? '📋' : '💬'}
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{
                    display: 'block',
                    fontSize: '13px',
                    color: isLeave ? '#e65100' : '#1a237e',
                    marginBottom: '2px',
                  }}>
                    {isLeave
                      ? notif.title || '📋 Leave Request'
                      : `💬 ${notif.sender_name || notif.sender_email || 'Message'}`
                    }
                  </strong>

                  <p style={{
                    margin: '4px 0',
                    fontSize: '13px',
                    color: '#555',
                    lineHeight: 1.4,
                  }}>
                    {notif.message}
                  </p>

                  {isLeave && notif.metadata && (
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '4px',
                    }}>
                      <span style={{
                        background: '#e3f2fd',
                        color: '#1565c0',
                        padding: '1px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                      }}>
                        {notif.metadata.days || 0} days
                      </span>
                      <span style={{
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        padding: '1px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                      }}>
                        {notif.metadata.leave_type || 'N/A'}
                      </span>
                    </div>
                  )}

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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HODNotifications;