import React, { useState } from 'react';
import axios from 'axios';
import sodium from 'libsodium-wrappers';

const Auth = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(true);

  const handleRegister = async () => {
    if (!username || !password) {
      alert('Username and password are required.');
      return;
    }
    try {
      await sodium.ready;
      const { publicKey, privateKey } = sodium.crypto_box_keypair();

      await axios.post('http://localhost:3001/api/register', {
        username,
        password,
        publicKey: sodium.to_base64(publicKey, 'base64'),
      });

      localStorage.setItem('privateKey', sodium.to_base64(privateKey, 'base64'));
      alert('Registration successful! Please log in.');
      setIsRegistering(false); // Switch to login view
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. The username might already be taken.');
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      alert('Username and password are required.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:3001/api/login', {
        username,
        password,
      });

      localStorage.setItem('jwt', response.data.token);
      localStorage.setItem('username', username); // Store username for later use
      onLogin();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Check your credentials.');
    }
  };

  return (
    <div className="auth-container">
      <h2>{isRegistering ? 'Register' : 'Login'}</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {isRegistering ? (
        <button onClick={handleRegister}>Register</button>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
      <button className="toggle-auth" onClick={() => setIsRegistering(!isRegistering)}>
        {isRegistering ? 'Switch to Login' : 'Switch to Register'}
      </button>
    </div>
  );
};

export default Auth;