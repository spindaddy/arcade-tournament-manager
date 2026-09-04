import React, { useState, useEffect } from 'react';

function Dashboard({ stats, apiUrl }) {
  const [recentScans, setRecentScans] = useState([]);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    fetchActiveSessions();
    fetchConnection();
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

  const fetchConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/connection`);
      const data = await response.json();
      setConnection(data);
    } catch (error) {
      console.error('Failed to fetch connection info:', error);
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
          <h2 className="card-title">Connection Info</h2>
          <button className="btn btn-secondary" onClick={fetchConnection}>
            Refresh IP
          </button>
        </div>
        {connection ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <ConnectionRow label="API Base URL" value={connection.apiBase} target={`${connection.apiBase}/api`} />
            <ConnectionRow label="Web Scoreboard" value={connection.scoreboardUrl} target={connection.scoreboardUrl} />
            <ConnectionRow label="ESP32 Scan Endpoint" value={connection.scanEndpoint} target={connection.scanEndpoint} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              This Mac's current LAN address is <code>{connection.lanIp}</code>.
              Use these URLs on your ESP32 devices and any phone/tablet on the same Wi-Fi network.
            </p>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">🌐</div>
            <p>Unable to determine connection info.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({ label, value, target }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: '170px', fontSize: '13px' }}>{label}</span>
      <a href={target} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '14px' }}>
        {value}
      </a>
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
