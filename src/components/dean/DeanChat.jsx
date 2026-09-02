// dean/DeanChat.jsx - HARDENED
import React, { useRef, useEffect } from 'react';

const DeanChat = ({
  selectedUser,
  selectedUserType,
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  sendingMessage,
  onClose,
  chatEndRef,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedUser]);

  return (
    <div className="dean-chat-overlay" onClick={onClose}>
      <div className="dean-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dean-chat-header">
          <div>
            <h3>💬 Chat with {selectedUserType?.toUpperCase()}</h3>
            <p>{selectedUser.display_name || selectedUser.email}</p>
          </div>
          <button className="dean-chat-close" onClick={onClose}>✕</button>
        </div>

        <div className="dean-chat-body">
          {messages.length === 0 ? (
            <div className="dean-chat-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`dean-chat-message ${msg.sender_role === 'dean' ? 'sent' : 'received'}`}
              >
                <div className="dean-chat-meta">
                  <strong>{msg.sender_name || msg.sender_email}</strong>
                  <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                </div>
                <p>{msg.message}</p>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="dean-chat-footer">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !sendingMessage) sendMessage();
            }}
            placeholder="Type your message..."
            className="dean-chat-input"
          />
          <button
            className="dean-chat-send"
            onClick={sendMessage}
            disabled={sendingMessage || !newMessage.trim()}
          >
            {sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeanChat;