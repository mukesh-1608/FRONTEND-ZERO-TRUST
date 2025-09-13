import React, { useState } from "react";
import api from "./api";
import { FaUserShield } from "react-icons/fa";

const ROLES = [
  { value: "soldier", label: "Soldier" },
  { value: "officer", label: "Officer" },
  { value: "commander", label: "Commander" }
];

export default function SecureAuth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("soldier");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (isLogin) {
        const res = await api.post('/login', { username, password });
        onLogin(username, res.data.token);
      } else {
        const sodium = await import('libsodium-wrappers');
        await sodium.ready;
        const keyPair = sodium.crypto_box_keypair();
        const publicKey = sodium.to_base64(keyPair.publicKey, sodium.base64_variants.URLSAFE);
        localStorage.setItem(`privateKey_${username}`, sodium.to_base64(keyPair.privateKey, sodium.base64_variants.URLSAFE));
        await api.post('/register', { username, password, role, publicKey });
        alert('Registration successful. You may log in.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Authentication Failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-outer">
      <form className="auth-card" autoComplete="off" onSubmit={handleSubmit}>
        <div className="icon-secure">
          <FaUserShield size={34} />
        </div>
        <h1 className="auth-title">
          {isLogin ? "Sign in to Secure Channel" : "Operator Registration"}
        </h1>
        <div className="auth-field">
          <label className={username ? "focused" : ""}>Username</label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            disabled={isLoading}
            onChange={e => setUsername(e.target.value.trim())}
            required
            maxLength={32}
          />
        </div>
        <div className="auth-field">
          <label className={password ? "focused" : ""}>Password</label>
          <input
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            disabled={isLoading}
            onChange={e => setPassword(e.target.value)}
            required
            maxLength={32}
          />
        </div>
        {!isLogin && (
          <div className="auth-field">
            <label className="focused">Role</label>
            <select
              value={role}
              disabled={isLoading}
              onChange={e => setRole(e.target.value)}
              required
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <button
          className="primary-btn"
          type="submit"
          disabled={isLoading || !username || !password}
        >
          {isLoading ? "Authenticating..." : isLogin ? "Login" : "Register"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
        >
          {isLogin ? "Register new operator" : "Back to Login"}
        </button>
      </form>
    </div>
  );
}
