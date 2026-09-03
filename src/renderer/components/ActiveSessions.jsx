import React, { useState, useEffect } from 'react';

function ActiveSessions({ apiUrl }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${apiUrl}/sessions/active`);
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Active Sessions</h1>
        <p>Players currently playing arcade games (auto-updates)</p>
      </div>

      <div className="card">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎮</div>
            <p>No one is currently playing. Scans will show up here in real-time.</p>
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
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.player_name}</td>
                  <td>{session.machine_name || session.reader_id}</td>
                  <td>{new Date(session.start_time).toLocaleString()}</td>
                  <td>{formatDuration(session.start_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDuration(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diff = Math.floor((now - start) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export default ActiveSessions;