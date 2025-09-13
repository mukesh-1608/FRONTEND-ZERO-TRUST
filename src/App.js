import React, { useState, useEffect } from 'react';
import sodium from 'libsodium-wrappers';
import Auth from './Auth';
import Chat from './Chat';
import './App.css'; // We will create this file later

function App() {
  const [isSodiumReady, setIsSodiumReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initSodium = async () => {
      await sodium.ready;
      setIsSodiumReady(true);
    };
    initSodium();

    const token = localStorage.getItem('jwt');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };


  if (!isSodiumReady) {
    return <div className="loading-screen"><h1>Loading Cryptography Modules...</h1></div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Aegis Secure Chat</h1>
      </header>
      <main>
        {isAuthenticated ? (
          <Chat onLogout={handleLogout} />
        ) : (
          <Auth onLogin={handleLogin} />
        )}
      </main>
    </div>
  );
}

export default App;