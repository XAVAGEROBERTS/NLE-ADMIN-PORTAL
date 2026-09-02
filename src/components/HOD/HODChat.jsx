// HODChat.jsx - REAL-TIME WITH AUTO-SCROLL
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';

const HODChat = ({
  selectedUser,
  selectedUserType,
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  sendingMessage,
  onClose,
  chatEndRef,
  hodEmail,
  hodName,
  profile,
}) => {
  const [localMessages, setLocalMessages] = useState(messages || []);
  const [localNewMessage, setLocalNewMessage] = useState(newMessage || '');
  const [localSending, setLocalSending] = useState(sendingMessage || false);
  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Update local state when props change
  useEffect(() => {
    setLocalMessages(messages || []);
  }, [messages]);

  useEffect(() => {
    setLocalNewMessage(newMessage || '');
  }, [newMessage]);

  useEffect(() => {
    setLocalSending(sendingMessage || false);
  }, [sendingMessage]);

  // ========== SCROLL TO BOTTOM FUNCTION ==========
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    // Try multiple methods to ensure scrolling works
    setTimeout(() => {
      // Method 1: Use the ref from parent
      if (chatEndRef?.current) {
        chatEndRef.current.scrollIntoView({ behavior, block: 'end' });
        return;
      }

      // Method 2: Use local ref
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        return;
      }

      // Method 3: Scroll the container directly
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }

      // Method 4: Find the chat body and scroll it
      const chatBody = document.querySelector('.hod-chat-body');
      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, 100); // Delay to ensure DOM has updated
  }, [chatEndRef]);

  // ========== SCROLL ON MESSAGE CHANGE ==========
  useEffect(() => {
    if (localMessages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [localMessages, scrollToBottom]);

  // ========== SCROLL ON INITIAL LOAD ==========
  useEffect(() => {
    if (localMessages.length > 0) {
      // Initial scroll with a longer delay to ensure everything is rendered
      setTimeout(() => {
        scrollToBottom('auto');
      }, 300);
    }
  }, []);

  // ========== SETUP REAL-TIME SUBSCRIPTION ==========
  useEffect(() => {
    if (!selectedUser?.email || !hodEmail) {
      console.log('⚠️ No selected user or HOD email, skipping realtime setup');
      return;
    }

    console.log('🔄 Setting up real-time chat for HOD:', hodEmail, '↔', selectedUser.email);

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new subscription
    const channel = supabase
      .channel(`hod-chat-${hodEmail}-${selectedUser.email}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;

          // Check if message belongs to this conversation
          const isThisConversation =
            (msg.sender_email === hodEmail && msg.receiver_email === selectedUser.email) ||
            (msg.sender_email === selectedUser.email && msg.receiver_email === hodEmail);

          if (!isThisConversation) return;

          console.log('📩 New real-time message:', msg);

          // Add message to chat
          setLocalMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === msg.id)) return prev;
            
            // Remove any temp message with same content
            const cleaned = prev.filter(
              (m) =>
                !(
                  typeof m.id === 'string' &&
                  m.id.startsWith('temp-') &&
                  m.message === msg.message &&
                  m.sender_email === msg.sender_email
                )
            );
            
            const newMessages = [...cleaned, msg];
            
            // Scroll to bottom after state update
            setTimeout(() => scrollToBottom('smooth'), 50);
            
            return newMessages;
          });

          // If message is from the other party, mark it as read
          if (msg.sender_email === selectedUser.email && msg.receiver_email === hodEmail) {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', msg.id)
              .then(() => {
                console.log('✅ Marked message as read');
              })
              .catch((err) => {
                console.error('❌ Error marking message as read:', err);
              });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;

          // Check if message belongs to this conversation
          const isThisConversation =
            (msg.sender_email === hodEmail && msg.receiver_email === selectedUser.email) ||
            (msg.sender_email === selectedUser.email && msg.receiver_email === hodEmail);

          if (!isThisConversation) return;

          // Update message in state (e.g., when marked as read)
          setLocalMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
          );
        }
      )
      .subscribe((status) => {
        console.log('🟢 Realtime subscription status:', status);
      });

    channelRef.current = channel;

    // ========== POLLING FALLBACK (every 5 seconds) ==========
    const pollInterval = setInterval(() => {
      if (!selectedUser?.email || !hodEmail) return;

      supabase
        .from('chat_messages')
        .select('*')
        .or(
          `and(sender_email.eq.${hodEmail},receiver_email.eq.${selectedUser.email}),` +
          `and(sender_email.eq.${selectedUser.email},receiver_email.eq.${hodEmail})`
        )
        .order('created_at', { ascending: true })
        .limit(200)
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Polling error:', error);
            return;
          }

          if (data && data.length > 0) {
            setLocalMessages((prev) => {
              // Merge new messages with existing, avoiding duplicates
              const existingIds = new Set(prev.map((m) => m.id));
              const newMessages = data.filter((m) => !existingIds.has(m.id));
              if (newMessages.length === 0) return prev;
              
              // Also remove temp messages that match new ones
              const cleaned = prev.filter(
                (m) =>
                  !(
                    typeof m.id === 'string' &&
                    m.id.startsWith('temp-') &&
                    newMessages.some((nm) => nm.message === m.message && nm.sender_email === m.sender_email)
                  )
              );
              
              const updatedMessages = [...cleaned, ...newMessages];
              
              // Scroll to bottom after state update
              setTimeout(() => scrollToBottom('smooth'), 50);
              
              return updatedMessages;
            });
          }
        });
    }, 5000);

    // ========== CLEANUP ==========
    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedUser?.email, hodEmail, scrollToBottom]);

  // ========== SEND MESSAGE ==========
  const handleSendMessage = useCallback(async () => {
    if (!localNewMessage.trim() || !selectedUser?.email || localSending) return;

    const tempId = `temp-${Date.now()}`;
    const messageText = localNewMessage.trim();

    const optimisticMessage = {
      id: tempId,
      sender_email: hodEmail,
      sender_role: 'hod',
      sender_name: hodName || 'HOD',
      receiver_email: selectedUser.email,
      receiver_role: selectedUserType || 'user',
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setLocalMessages((prev) => [...prev, optimisticMessage]);
    setLocalNewMessage('');
    setLocalSending(true);
    
    // Scroll immediately after optimistic update
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            sender_id: profile?.id || null,
            sender_email: hodEmail,
            sender_role: 'hod',
            sender_name: hodName || 'HOD',
            receiver_email: selectedUser.email,
            receiver_role: selectedUserType || 'user',
            message: messageText,
            is_read: false,
            department_id: selectedUser.department_id || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m))
      );
      
      // Scroll again after message is confirmed
      setTimeout(() => scrollToBottom('smooth'), 100);

    } catch (err) {
      console.error('❌ Send error:', err);
      // Remove optimistic message on failure
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('Failed to send message. Please try again.');
    } finally {
      setLocalSending(false);
    }
  }, [localNewMessage, selectedUser, hodEmail, hodName, selectedUserType, localSending, scrollToBottom, profile]);

  // ========== HANDLE KEY PRESS ==========
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Update parent state when local state changes
  const handleInputChange = (e) => {
    const value = e.target.value;
    setLocalNewMessage(value);
    if (setNewMessage) {
      setNewMessage(value);
    }
  };

  return (
    <div className="hod-chat-overlay" onClick={onClose}>
      <div className="hod-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hod-chat-header">
          <div>
            <h3>💬 Chat with {selectedUserType?.toUpperCase()}</h3>
            <p>
              {selectedUser.display_name || selectedUser.email}
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#4caf50' }}>
                ● Online
              </span>
            </p>
          </div>
          <button className="hod-chat-close" onClick={onClose}>✕</button>
        </div>

        <div 
          className="hod-chat-body"
          ref={chatContainerRef}
        >
          {localMessages.length === 0 ? (
            <div className="hod-chat-empty">
              <p>No messages yet. Start the conversation!</p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Messages appear in real-time
              </p>
            </div>
          ) : (
            localMessages.map((msg) => {
              const isMe = msg.sender_role === 'hod' || msg.sender_email === hodEmail;
              const isTemp = typeof msg.id === 'string' && msg.id.startsWith('temp-');

              return (
                <div
                  key={msg.id}
                  className={`hod-chat-message ${isMe ? 'sent' : 'received'}`}
                  style={{
                    opacity: isTemp ? 0.7 : 1,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <div className="hod-chat-meta">
                    <strong>{msg.sender_name || msg.sender_email}</strong>
                    <small>
                      {new Date(msg.created_at).toLocaleTimeString()}
                      {isTemp && ' • Sending...'}
                      {isMe && !isTemp && msg.is_read && ' • ✅ Read'}
                    </small>
                  </div>
                  <p>{msg.message}</p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
          <div ref={chatEndRef} />
        </div>

        <div className="hod-chat-footer">
          <input
            type="text"
            value={localNewMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="hod-chat-input"
            disabled={localSending}
          />
          <button
            className="hod-chat-send"
            onClick={handleSendMessage}
            disabled={localSending || !localNewMessage.trim()}
          >
            {localSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HODChat;