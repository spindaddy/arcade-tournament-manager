import React, { useState, useEffect } from 'react';

function Dashboard({ stats, apiUrl }) {
  const [recentScans, setRecentScans] = useState([]);

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch(`${apiUrl}/sessions/active`);
      const data = await response.json();
      setRecentScans(data);
    } catch (error) {
      console.error('Failed to fetch active sessions:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Real-time overview of your arcade tournament</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{stats?.activeSessions || 0}</div>
          <div className="label">Currently Playing</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.playerCount || 0}</div>
          <div className="label">Registered Players</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.todayScans || 0}</div>
          <div className="label">Scans Today</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats?.activeTournaments || 0}</div>
          <div className="label">Active Tournaments</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Active Players</h2>
          <button className="btn btn-secondary" onClick={fetchActiveSessions}>
            Refresh
          </button>
        </div>
        {recentScans.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🕹️</div>
            <p>No active sessions. Players will appear here when they scan their badges.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Machine</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((session) => (
                <tr key={session.id}>
                  <td>{session.player_name}</td>
                  <td>{session.machine_name || session.reader_id}</td>
                  <td>{new Date(session.start_time).toLocaleTimeString()}</td>
                  <td>{getDuration(session.start_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">ESP32 Connection</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your ESP32 devices should POST to: <code>{apiUrl}/scan</code>
        </p>
        <pre style={{
          background: 'var(--bg-card)',
          padding: '12px',
          borderRadius: '8px',
          marginTop: '12px',
          fontSize: '13px'
        }}>
{`{
  "badge_uid": "AA:BB:CC:DD",
  "reader_id": "reader-01"
}`}
        </pre>
      </div>
    </div>
  );
}

function getDuration(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diff = Math.floor((now - start) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}m ${seconds}s`;
}

export default Dashboard;
