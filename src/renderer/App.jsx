import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Players from './components/Players';
import Tournaments from './components/Tournaments';
import Machines from './components/Machines';
import ActiveSessions from './components/ActiveSessions';
import InstallGuide from './components/InstallGuide';
import Scoreboard from './components/Scoreboard';
import Divisions from './components/Divisions';
import Settings from './components/Settings';

const API_URL = 'http://localhost:3001/api';
const API_BASE = 'http://localhost:3001';

function App() {
  const [stats, setStats] = useState(null);
  const [title, setTitle] = useState('Arcade Tournament');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchMeta = async () => {
    try {
      const response = await fetch(`${API_URL}/meta`);
      const data = await response.json();
      if (data.title) setTitle(data.title);
      if (data.theme) setTheme(data.theme);
    } catch (error) {
      console.error('Failed to fetch meta:', error);
    }
  };

  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <div className="logo">
            <span className="logo-icon">🎮</span>
            <span className="logo-text">{title}</span>
          </div>
          <ul className="nav-links">
            <li>
              <NavLink to="/" end>Dashboard</NavLink>
            </li>
            <li>
              <NavLink to="/players">Players</NavLink>
            </li>
            <li>
              <NavLink to="/tournaments">Tournament</NavLink>
            </li>
            <li>
              <NavLink to="/machines">Machines</NavLink>
            </li>
            <li>
              <NavLink to="/scoreboard">Scoreboard</NavLink>
            </li>
            <li>
              <NavLink to="/divisions">Divisions</NavLink>
            </li>
            <li>
              <NavLink to="/active">Active Sessions</NavLink>
            </li>
            <li>
              <NavLink to="/settings">Settings</NavLink>
            </li>
            <li>
              <NavLink to="/guide">Install Guide</NavLink>
            </li>
          </ul>
          {stats && (
            <div className="stats-mini">
              <div className="stat-item">
                <span className="stat-value">{stats.activeSessions}</span>
                <span className="stat-label">Playing Now</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.playerCount}</span>
                <span className="stat-label">Players</span>
              </div>
              <div className="stat-item">
                <a href={API_BASE} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Open Scoreboard ↗
                </a>
              </div>
            </div>
          )}
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard stats={stats} apiUrl={API_URL} title={title} />} />
            <Route path="/players" element={<Players apiUrl={API_URL} />} />
            <Route path="/tournaments" element={<Tournaments apiUrl={API_URL} />} />
            <Route path="/machines" element={<Machines apiUrl={API_URL} />} />
            <Route path="/scoreboard" element={<Scoreboard apiUrl={API_URL} title={title} />} />
            <Route path="/divisions" element={<Divisions apiUrl={API_URL} />} />
            <Route path="/active" element={<ActiveSessions apiUrl={API_URL} />} />
            <Route path="/settings" element={<Settings apiUrl={API_URL} currentTheme={theme} onThemeChange={setTheme} />} />
            <Route path="/guide" element={<InstallGuide />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
