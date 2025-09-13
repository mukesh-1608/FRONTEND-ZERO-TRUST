import React, { useState } from 'react';
import api from './api';
import sodium from 'libsodium-wrappers';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('soldier');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/login', { username, password });
        onLogin(username, response.data.token);
      } else {
        await sodium.ready;
        const keyPair = sodium.crypto_box_keypair();
        const publicKey = sodium.to_base64(keyPair.publicKey, sodium.base64_variants.URLSAFE);

        // In a real app, you'd derive a key from the password to encrypt the private key
        // For simplicity, we are not storing the private key in this version
        localStorage.setItem(`privateKey_${username}`, sodium.to_base64(keyPair.privateKey, sodium.base64_variants.URLSAFE));

        await api.post('/register', { username, password, role, publicKey });
        alert('Registration successful! Please log in.');
        setIsLogin(true); // Switch to login form after registration
      }
    } catch (err) {
      setError(err.response?.data?.error || `An error occurred during ${isLogin ? 'login' : 'registration'}.`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'SECURE LOGIN' : 'REGISTER OPERATIVE'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Callsign (Username)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {!isLogin && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="soldier">Soldier</option>
            <option value="officer">Officer</option>
            <option value="commander">Commander</option>
          </select>
        )}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'PROCESSING...' : isLogin ? 'AUTHENTICATE' : 'REGISTER'}
        </button>
      </form>
      {error && <p style={{ color: 'var(--accent-red)' }}>{error}</p>}
      <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth">
        {isLogin ? 'Need to register an operative?' : 'Already have an account?'}
      </button>
    </div>
  );
};

export default Auth;