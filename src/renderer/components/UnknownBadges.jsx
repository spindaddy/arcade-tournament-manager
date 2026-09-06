import React, { useState, useEffect, useRef } from 'react';
import { parseDbTime } from '../lib/time';

function UnknownBadges({ apiUrl }) {
  const [unknown, setUnknown] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [formData, setFormData] = useState({ rfid_uid: '', name: '', email: '', division: '' });
  const [lastScan, setLastScan] = useState(null);
  const listRef = useRef(null);

  const refresh = async () => {
    try {
      const response = await fetch(`${apiUrl}/scan/unknown`);
      if (!response.ok) return;
      const data = await response.json();
      setUnknown(data || []);
    } catch (e) {
      // Ignore transient errors
    }
  };

  const fetchDivisions = async () => {
    try {
      const response = await fetch(`${apiUrl}/settings`);
      const settings = await response.json();
      setDivisions(parseDivisions(settings.divisions));
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    refresh();
    fetchDivisions();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [apiUrl]);

  // Track the most recent scan so we can highlight fresh unknown badges.
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/scan/last`);
        if (!response.ok) return;
        const row = await response.json();
        if (row && row.badge_uid) setLastScan(row);
      } catch (e) {
        // Ignore
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, [apiUrl]);

  // Keep a pointer to the latest list for the modal auto-capture.
  useEffect(() => {
    listRef.current = unknown;
  }, [unknown]);

  const isFresh = (badgeUid) => {
    if (!lastScan || lastScan.badge_uid !== badgeUid) return false;
    const t = parseDbTime(lastScan.scan_time);
    return !!t && Date.now() - t.getTime() < 8000;
  };

  const openRegister = (row) => {
    setFormData({ rfid_uid: row.badge_uid, name: '', email: '', division: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const playerRes = await fetch(`${apiUrl}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || '',
          twitch_name: '',
          phone: '',
          division: formData.division || ''
        })
      });
      const player = await playerRes.json();
      if (!player.id) throw new Error('Failed to create player');

      const badgeRes = await fetch(`${apiUrl}/badges/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id, rfid_uid: formData.rfid_uid })
      });
      if (!badgeRes.ok) {
        const err = await badgeRes.json();
        alert(err.error || 'Failed to assign badge');
      } else {
        alert(`${formData.name} registered with badge ${formData.rfid_uid}`);
      }
      setShowModal(false);
      refresh();
    } catch (error) {
      console.error('Failed to register player:', error);
      alert('Failed to register player');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Unknown Badges</h1>
        <p>Badges scanned on readers that are not registered to a player yet. Scan a badge, then register the player.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Unregistered Badges</h2>
          <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
        </div>
        {unknown.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📡</div>
            <p>
              No unknown badges. Tap or swipe a badge on any reader and it will appear here
              (with its single long beep) ready to register.
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Badge UID</th>
                <th>Last Scanned</th>
                <th>Reader</th>
                <th>Scans</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unknown.map((row) => (
                <tr key={row.badge_uid}>
                  <td>
                    <code>{row.badge_uid}</code>{' '}
                    {isFresh(row.badge_uid) && (
                      <span className="badge badge-success">just scanned</span>
                    )}
                  </td>
                  <td>{formatTime(row.last_scan_time)}</td>
                  <td><code>{row.last_reader_id || '-'}</code></td>
                  <td>{row.scan_count}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => openRegister(row)}>
                      Register Player
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Register Player</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Badge UID</label>
                <input type="text" value={formData.rfid_uid} readOnly style={{ fontFamily: 'monospace' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                  This badge's UID, captured from the reader.
                </p>
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Division</label>
                <select
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                >
                  <option value="">— Select Division —</option>
                  {divisions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={registering}>
                  {registering ? 'Registering...' : 'Register Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(value) {
  const d = parseDbTime(value);
  if (!d) return '-';
  return d.toLocaleString();
}

function parseDivisions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((d) => (typeof d === 'string' ? { name: d, active: true, sort_order: 0 } : d))
      .filter((d) => d.active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((d) => d.name);
  } catch (e) {
    return [];
  }
}

export default UnknownBadges;