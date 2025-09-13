import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { notifyTyping, uploadFile } from './api'; // Import uploadFile
import sodium from 'libsodium-wrappers';
import { toast } from 'react-toastify';

const Chat = ({ username, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [publicKeys, setPublicKeys] = useState({});
  const [ttl, setTtl] = useState(60);
  const [selectedFile, setSelectedFile] = useState(null);
  const messageAreaRef = useRef(null);
  const [messageStatus, setMessageStatus] = useState({});
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("File size cannot exceed 5MB.");
      return;
    }
    if (file) {
      setSelectedFile(file);
      setMessage(file.name);
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (selectedFile) setSelectedFile(null);

    if (!typingTimeoutRef.current) {
      notifyTyping(true, selectedUser);
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      notifyTyping(false, selectedUser);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  // --- Start of new/modified code for file handling ---

  const decryptMessage = useCallback(async (msg) => {
    // If it's a file message, the plaintext is just the metadata
    if (msg.is_file) {
      try {
        const fileInfo = JSON.parse(msg.plaintext);
        const privateKeyB64 = localStorage.getItem(`privateKey_${username}`);
        const senderPublicKeyB64 = publicKeys[msg.from];
        if (!privateKeyB64 || !senderPublicKeyB64) throw new Error("Keys not found for decryption.");

        const privateKey = sodium.from_base_64(privateKeyB64, sodium.base64_variants.URLSAFE);
        const senderPublicKey = sodium.from_base_64(senderPublicKeyB64, sodium.base64_variants.URLSAFE);
        
        // This is where you would fetch the file blob and decrypt it
        // For now, we just return the metadata to render the link
        return { ...fileInfo, is_file: true, fileUrl: msg.fileUrl };

      } catch (e) {
        console.error("Failed to parse file message", e);
        return "[Encrypted File]";
      }
    }

    // Standard message decryption
    setMessageStatus(prev => ({ ...prev, [msg.id]: 'Decrypting...' }));
    try {
      await sodium.ready;
      const privateKeyB64 = localStorage.getItem(`privateKey_${username}`);
      if (!privateKeyB64) throw new Error("Private key not found.");
      const privateKey = sodium.from_base_64(privateKeyB64, sodium.base64_variants.URLSAFE);
      const ciphertext = sodium.from_base_64(msg.ciphertext, sodium.base64_variants.URLSAFE);
      const senderPublicKeyB64 = publicKeys[msg.from];
      if (!senderPublicKeyB64) throw new Error(`Public key for ${msg.from} not found.`);
      const senderPublicKey = sodium.from_base_64(senderPublicKeyB64, sodium.base64_variants.URLSAFE);
      const decrypted = sodium.crypto_box_seal_open(ciphertext, senderPublicKey, privateKey);
      setMessageStatus(prev => { const ns = { ...prev }; delete ns[msg.id]; return ns; });
      return sodium.to_string(decrypted);
    } catch (e) {
      console.error('Decryption failed for message:', msg, e);
      setMessageStatus(prev => ({ ...prev, [msg.id]: 'Decryption Failed' }));
      return "[DECRYPTION FAILED]";
    }
  }, [username, publicKeys]);


  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || !selectedUser) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    notifyTyping(false, selectedUser);

    // Handle file sending
    if (selectedFile) {
      const tempId = `temp_${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId, from: username, to: selectedUser, is_file: true,
        plaintext: { fileName: selectedFile.name, is_file: true },
        status: 'Encrypting & Uploading...'
      }]);
      setSelectedFile(null);
      setMessage('');
      scrollToBottom();

      try {
        await sodium.ready;
        const recipientPublicKeyB64 = publicKeys[selectedUser];
        if (!recipientPublicKeyB64) throw new Error("Recipient's public key not found.");
        const recipientPublicKey = sodium.from_base_64(recipientPublicKeyB64, sodium.base64_variants.URLSAFE);

        // Read file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = async (event) => {
          const fileContent = new Uint8Array(event.target.result);
          // Encrypt file content
          const encryptedFile = sodium.crypto_box_seal(fileContent, recipientPublicKey);
          
          // Encrypt file metadata as the message
          const fileMetadata = { fileName: selectedFile.name, is_file: true };
          const encryptedMetadata = sodium.crypto_box_seal(JSON.stringify(fileMetadata), recipientPublicKey);

          // Prepare form data for upload
          const formData = new FormData();
          formData.append('to', selectedUser);
          formData.append('ttl', parseInt(ttl, 10));
          formData.append('metadata', sodium.to_base64(encryptedMetadata, sodium.base64_variants.URLSAFE));
          formData.append('file', new Blob([encryptedFile]), selectedFile.name);

          await uploadFile(formData);
          setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove temp message
          toast.success("Secure file sent successfully.");
        };
        reader.onerror = () => {
            throw new Error("Failed to read file.");
        };
        reader.readAsArrayBuffer(selectedFile);

      } catch (error) {
        console.error("Failed to send file:", error);
        toast.error("File sending failed.");
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'Sending Failed' } : m));
      }
      return;
    }

    // Handle text message sending
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
        id: tempId, from: username, to: selectedUser, plaintext: message, status: 'Encrypting...'
    }]);
    setMessage('');
    scrollToBottom();
    try {
      await sodium.ready;
      const recipientPublicKeyB64 = publicKeys[selectedUser];
      if (!recipientPublicKeyB64) throw new Error("Recipient's public key not available.");
      const recipientPublicKey = sodium.from_base_64(recipientPublicKeyB64, sodium.base64_variants.URLSAFE);
      const ciphertext = sodium.crypto_box_seal(message, recipientPublicKey);
      const ciphertextB64 = sodium.to_base_64(ciphertext, sodium.base64_variants.URLSAFE);
      await api.post('/messages', {
          to: selectedUser, ciphertext: ciphertextB64, ttl: parseInt(ttl, 10)
      });
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'Sending Failed' } : m));
    }
  };

  // --- End of new/modified code for file handling ---


  useEffect(() => {
    const fetchUsersAndStatus = async () => {
      try {
        const usersResponse = await api.get('/users');
        const otherUsers = usersResponse.data.filter(u => u.username !== username);
        setUsers(otherUsers);
        if (otherUsers.length > 0 && !selectedUser) {
            setSelectedUser(otherUsers[0].username);
        }
        const onlineResponse = await api.get('/online-users');
        setOnlineUsers(onlineResponse.data);
      } catch (error) {
        console.error("Failed to fetch users or online status", error);
      }
    };
    fetchUsersAndStatus();
    const intervalId = setInterval(fetchUsersAndStatus, 5000);
    return () => clearInterval(intervalId);
  }, [username, selectedUser]);

  useEffect(() => {
    const fetchPublicKeys = async () => {
        const keys = {};
        const allUsernames = [...new Set([...users.map(u => u.username), username])];
        for (const uname of allUsernames) {
            if (!publicKeys[uname]) {
                try {
                    const response = await api.get(`/publicKey/${uname}`);
                    keys[uname] = response.data.publicKey;
                } catch (error) {
                    console.error(`Failed to fetch public key for ${uname}`, error);
                }
            }
        }
        if (Object.keys(keys).length > 0) {
            setPublicKeys(prev => ({ ...prev, ...keys }));
        }
    };
    if (users.length > 0) {
        fetchPublicKeys();
    }
  }, [users, username, publicKeys]);

  useEffect(() => {
    const fetchTypingStatus = async () => {
        if (!selectedUser) return;
        try {
            const response = await api.get(`/typing-status/${selectedUser}`);
            if (response.data && response.data.typingUsers) {
                setIsRecipientTyping(response.data.typingUsers.includes(selectedUser));
            } else {
                setIsRecipientTyping(false);
            }
        } catch (error) {
            setIsRecipientTyping(false);
        }
    };
    const intervalId = setInterval(fetchTypingStatus, 1500);
    return () => clearInterval(intervalId);
  }, [selectedUser]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await api.get('/messages');
        const receivedMessages = response.data;
        const existingMessageIds = new Set(messages.map(m => m.id));
        const newMessages = receivedMessages.filter(m => !existingMessageIds.has(m.id));
        
        if (newMessages.length > 0) {
            const decryptedMessages = await Promise.all(newMessages.map(async msg => {
                const content = await decryptMessage(msg);
                if (typeof content === 'string' && content !== "[DECRYPTION FAILED]" && msg.from !== username) {
                  toast.success(`New secure message from ${msg.from}`);
                } else if (content.is_file && msg.from !== username) {
                  toast.success(`New secure file from ${msg.from}`);
                }
                return { ...msg, plaintext: content };
            }));
            setMessages(prev => [...prev, ...decryptedMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        }
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };
    if (publicKeys && Object.keys(publicKeys).length > 0) {
        const intervalId = setInterval(fetchMessages, 2000);
        return () => clearInterval(intervalId);
    }
  }, [publicKeys, decryptMessage, messages, username]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const currentChatMessages = messages.filter(
    (msg) => (msg.from === selectedUser && msg.to === username) || (msg.from === username && msg.to === selectedUser)
  );

  return (
    <div className="chat-container">
      <div className="sidebar">
        <h3>OPERATIVES</h3>
        <ul>
          {users.map((user) => (
            <li key={user.id} className={`user-list-item ${selectedUser === user.username ? 'active' : ''}`} onClick={() => setSelectedUser(user.username)}>
              <span>{user.username}</span>
              <span className={`status-indicator ${onlineUsers[user.username] ? 'status-online' : 'status-offline'}`}></span>
            </li>
          ))}
        </ul>
        <button onClick={onLogout} className="logout-btn">LOGOUT</button>
      </div>
      <div className="chat-main">
        <div className="message-area" ref={messageAreaRef}>
          {currentChatMessages.map((msg) => (
            <div key={msg.id} className={`message ${msg.from === username ? 'sent' : 'received'} message-animated`}>
              {msg.is_file && typeof msg.plaintext === 'object' ? (
                <div className="file-message">
                  <span className="file-message-icon">📄</span>
                  <div className="file-message-info">
                    <a href="#" onClick={(e) => { e.preventDefault(); alert("File download/decryption not yet implemented."); }}>
                      {msg.plaintext.fileName}
                    </a>
                  </div>
                </div>
              ) : (
                <p>{msg.plaintext}</p>
              )}
              {(msg.status || messageStatus[msg.id]) && (
                <small style={{ color: msg.from === username ? '#0d1a0a' : '#e0e0e-0', opacity: 0.7 }}>
                  <em>{msg.status || messageStatus[msg.id]}</em>
                </small>
              )}
            </div>
          ))}
        </div>
        <div className="typing-indicator">
          {isRecipientTyping && ( <><span></span><span></span><span></span></> )}
        </div>
        <form className="message-input-area" onSubmit={handleSendMessage}>
          <textarea placeholder="Type message or select file..." value={message} onChange={handleTyping} rows="3" readOnly={!!selectedFile} />
          <select value={ttl} onChange={(e) => setTtl(e.target.value)}>
            <option value="30">30s TTL</option>
            <option value="60">1m TTL</option>
            <option value="300">5m TTL</option>
          </select>
          <label htmlFor="file-input" className="file-input-label">📎</label>
          <input id="file-input" type="file" onChange={handleFileChange} style={{display: 'none'}} />
          <button type="submit" disabled={!selectedUser || (!message.trim() && !selectedFile)}>SEND</button>
        </form>
      </div>
    </div>
  );
};

export default Chat;