import React, { useState, useEffect } from 'react';

function Divisions({ apiUrl }) {
  const [entries, setEntries] = useState([]);
  const [divisions, setDivisions] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sbRes, settingsRes] = await Promise.all([
        fetch(`${apiUrl}/scoreboard`),
        fetch(`${apiUrl}/settings`)
      ]);
      const sb = await sbRes.json();
      const settings = await settingsRes.json();
      setEntries(sb);
      setDivisions(parseDivisions(settings.divisions));
    } catch (error) {
      console.error('Failed to fetch division data:', error);
    }
  };

  const groups = [];
  const divConfig = {};
  divisions.forEach((d) => { divConfig[d.name] = d; });
  entries.forEach((e) => {
    let key = e.division || 'Open';
    let group = groups.find((g) => g.name === key);
    if (!group) {
      group = { name: key, rows: [] };
      groups.push(group);
    }
    group.rows.push(e);
  });
  groups.sort((a, b) => {
    if (a.name === 'Open') return 1;
    if (b.name === 'Open') return -1;
    const sa = (divConfig[a.name] && divConfig[a.name].sort_order) || 0;
    const sb = (divConfig[b.name] && divConfig[b.name].sort_order) || 0;
    return sa - sb;
  });

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
        <h1>Divisions</h1>
        <p>Rankings broken out by division. Configure divisions and limits in Settings.</p>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>No scores yet. Scores will appear here once players start playing.</p>
          </div>
        </div>
      ) : (
        groups.map((group) => {
          const max = (divConfig[group.name] && divConfig[group.name].max) || 0;
          const limited = group.rows.slice(0, max || group.rows.length);
          let rank = 0;
          let lastScore = null;
          return (
            <div className="card" key={group.name}>
              <div className="card-header">
                <h2 className="card-title">{group.name}</h2>
                {max > 0 && <span className="badge badge-secondary">Top {Math.min(max, limited.length)}</span>}
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Division</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {limited.map((entry) => {
                    if (entry.total_score !== lastScore) { rank++; lastScore = entry.total_score; }
                    return (
                      <tr key={entry.player_id} className={rank <= 3 ? 'rank-top' : ''}>
                        <td className="rank-cell">
                          <span className="rank-number">{rank}</span>
                          {medalFor(rank)}
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
                        <td>{entry.division || 'Open'}</td>
                        <td className="score-total">{entry.total_score || 0}</td>
                        <td>
                          {Number(entry.currently_playing) > 0 ? (
                            <span className="badge badge-success">● Playing</span>
                          ) : (
                            <span className="badge badge-warning">Idle</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}

function parseDivisions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((d) => (typeof d === 'string' ? { name: d, active: true, sort_order: 0, max: 0 } : d))
      .filter((d) => d.active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  } catch (e) {
    return [];
  }
}

export default Divisions;
