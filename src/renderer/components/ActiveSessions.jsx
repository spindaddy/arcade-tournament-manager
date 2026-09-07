import React, { useState, useEffect } from 'react';
import { parseDbTime, formatElapsed } from '../lib/time';

function ActiveSessions({ apiUrl }) {
  const [sessions, setSessions] = useState([]);
  const [clearing, setClearing] = useState(false);

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

  const clearAll = async () => {
    if (!confirm('End ALL active sessions? Players will be set as not playing and their OBS names cleared.')) return;
    setClearing(true);
    try {
      await fetch(`${apiUrl}/sessions/clear`, { method: 'POST' });
      fetchSessions();
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      alert('Failed to clear sessions');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Active Sessions</h1>
        <p>Players currently playing arcade games (auto-updates)</p>
      </div>

      <div className="card">
        {sessions.length > 0 && (
          <div className="card-header">
            <h2 className="card-title">Playing Now</h2>
            <button className="btn btn-secondary btn-sm" onClick={clearAll} disabled={clearing}>
              {clearing ? 'Clearing...' : 'End All Sessions'}
            </button>
          </div>
        )}
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
                  <td>{parseDbTime(session.start_time) ? parseDbTime(session.start_time).toLocaleString() : '-'}</td>
                  <td>{formatElapsed(session.start_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ActiveSessions;