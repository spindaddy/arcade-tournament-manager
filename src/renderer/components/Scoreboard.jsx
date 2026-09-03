import React, { useState, useEffect } from 'react';

function Scoreboard({ apiUrl, title }) {
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [scoreInput, setScoreInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchScoreboard();
    const interval = setInterval(fetchScoreboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchScoreboard = async () => {
    try {
      const response = await fetch(`${apiUrl}/scoreboard`);
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch scoreboard:', error);
    }
  };

  const openEditor = (entry) => {
    setEditing(entry);
    setScoreInput('');
    setError('');
  };

  const submitScore = async (e) => {
    e.preventDefault();
    const value = parseInt(scoreInput, 10);
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid non-negative integer score.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: editing.player_id, score: value })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save score');
      }

      setEditing(null);
      fetchScoreboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const medalFor = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Scoreboard</h1>
        <p>{title} — click "Set Score" to update a player's score</p>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>No players with scores yet. Scores will appear here once players start playing.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Standings</h2>
            <button className="btn btn-secondary" onClick={fetchScoreboard}>
              Refresh
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.player_id} className={entry.rank <= 3 ? 'rank-top' : ''}>
                  <td className="rank-cell">
                    <span className="rank-number">{entry.rank}</span>
                    {medalFor(entry.rank)}
                  </td>
                  <td>
                    {entry.twitch_name ? (
                      <a
                        href={`https://twitch.tv/${entry.twitch_name}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                      >
                        {entry.player_name} <span style={{ opacity: 0.7, fontSize: '0.9em' }}>@</span>
                      </a>
                    ) : (
                      entry.player_name
                    )}
                  </td>
                  <td className="score-total">{entry.total_score || 0}</td>
                  <td>
                    {Number(entry.currently_playing) > 0 ? (
                      <span className="badge badge-success">● Playing</span>
                    ) : (
                      <span className="badge badge-warning">Idle</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditor(entry)}>
                      Set Score
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Update Score</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Player: <strong>{editing.player_name}</strong> — Current total: <strong>{editing.total_score}</strong>
            </p>
            <form onSubmit={submitScore}>
              <div className="form-group">
                <label>Score</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="e.g., 5000"
                  autoFocus
                />
              </div>
              {error && (
                <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '14px' }}>{error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Scoreboard;
