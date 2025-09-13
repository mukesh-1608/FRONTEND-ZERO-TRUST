import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import sodium from 'libsodium-wrappers';

const Chat = ({ onLogout }) => {
  const [users, setUsers] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [ttl, setTtl] = useState(60); // Default TTL of 60 seconds
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Fetch users and messages periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user list
        const usersResponse = await api.get('/users');
        setUsers(usersResponse.data);

        // Fetch messages
        const messagesResponse = await api.get('/messages');
        const receivedMessages = messagesResponse.data;

        // Decrypt messages
        const decryptedMessages = await Promise.all(
          receivedMessages.map(async (msg) => {
            try {
              const privateKey = sodium.from_base64(localStorage.getItem('privateKey'));
              const senderKeyResponse = await api.get(`/users/${msg.from}/key`);
              const senderPublicKey = sodium.from_base64(senderKeyResponse.data.publicKey);

              const decrypted = sodium.crypto_box_seal_open(
                sodium.from_base64(msg.ciphertext),
                senderPublicKey,
                privateKey
              );
              return { ...msg, plaintext: sodium.to_string(decrypted), decrypted: true };
            } catch (e) {
              console.error('Could not decrypt message:', msg, e);
              return { ...msg, plaintext: '[DECRYPTION FAILED]', decrypted: false };
            }
          })
        );

        setMessages(decryptedMessages);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData(); // Initial fetch
    const intervalId = setInterval(fetchData, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, []);

  const handleSendMessage = async () => {
    if (!recipient || !message) {
      alert('Please select a recipient and type a message.');
      return;
    }

    try {
      await sodium.ready;
      const recipientKeyResponse = await api.get(`/users/${recipient}/key`);
      const recipientPublicKey = sodium.from_base64(recipientKeyResponse.data.publicKey);

      const ciphertext = sodium.crypto_box_seal(message, recipientPublicKey);

      await api.post('/messages', {
        recipientUsername: recipient,
        ciphertext: sodium.to_base64(ciphertext, 'base64'),
        ttl: ttl,
      });

      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Is the recipient username correct?');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('privateKey');
    localStorage.removeItem('username');
    onLogout();
  };

  const username = localStorage.getItem('username');

  return (
    <div className="chat-container">
      <div className="sidebar">
        <h3>Users</h3>
        <ul>
          {users.map((user) => (
            <li
              key={user.id}
              className={recipient === user.username ? 'active' : ''}
              onClick={() => setRecipient(user.username)}
            >
              {user.username} {user.username === username ? '(You)' : ''}
            </li>
          ))}
        </ul>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
      <div className="chat-main">
        <div className="message-area">
          {messages.length > 0 ? messages.map((msg, index) => (
            <div key={index} className={`message ${msg.from === username ? 'sent' : 'received'}`}>
              <strong>{msg.from === username ? 'You' : msg.from}:</strong> {msg.plaintext}
            </div>
          )) : <p>No messages yet. Start a conversation!</p>}
          <div ref={messagesEndRef} />
        </div>
        <div className="message-input-area">
          <textarea
            placeholder={`Message to ${recipient || '... (select a user)'}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!recipient}
          />
          <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
            <option value={30}>30 Seconds</option>
            <option value={60}>1 Minute</option>
            <option value={300}>5 Minutes</option>
          </select>
          <button onClick={handleSendMessage} disabled={!recipient || !message}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;