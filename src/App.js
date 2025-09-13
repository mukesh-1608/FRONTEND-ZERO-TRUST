import React, { useState, useEffect } from 'react';
import SecureAuth from './SecureAuth';
import Chat from './Chat';
import './App.css';
import api from './api';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (newUsername, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', newUsername);
    setUsername(newUsername);
    setIsLoggedIn(true);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername('');
    setIsLoggedIn(false);
    delete api.defaults.headers.common['Authorization'];
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        Loading Secure Channel...
      </div>
    );
  }

  return (
    <div className="App">
      <ToastContainer position="top-right" />
      {!isLoggedIn
        ? <SecureAuth onLogin={handleLogin} />
        : <Chat username={username} onLogout={handleLogout} />}
    </div>
  );
}

export default App;
