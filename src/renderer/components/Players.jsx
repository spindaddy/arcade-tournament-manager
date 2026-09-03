import React, { useState, useEffect } from 'react';

function Players({ apiUrl }) {
  const [players, setPlayers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', twitch_name: '', division: '' });
  const [badgeData, setBadgeData] = useState({ rfid_uid: '' });

  useEffect(() => {
    fetchPlayers();
    fetchDivisions();
  }, []);

  const fetchDivisions = async () => {
    try {
      const response = await fetch(`${apiUrl}/settings`);
      const settings = await response.json();
      if (settings.divisions) {
        try {
          setDivisions(JSON.parse(settings.divisions));
        } catch (e) {
          setDivisions([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch divisions:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`${apiUrl}/players`);
      const data = await response.json();
      setPlayers(data);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', email: '', phone: '', twitch_name: '', division: '' });
    setShowModal(true);
  };

  const openEdit = (player) => {
    setEditing(player);
    setFormData({
      name: player.name,
      email: player.email || '',
      phone: player.phone || '',
      twitch_name: player.twitch_name || '',
      division: player.division || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await fetch(`${apiUrl}/players/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch(`${apiUrl}/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      setEditing(null);
      setFormData({ name: '', email: '', phone: '', twitch_name: '', division: '' });
      fetchPlayers();
    } catch (error) {
      console.error('Failed to save player:', error);
    }
  };

  const handleDelete = async (player) => {
    if (!confirm(`Delete player "${player.name}"? This will remove their scores and badge.`)) return;
    try {
      await fetch(`${apiUrl}/players/${player.id}`, {
        method: 'DELETE'
      });
      fetchPlayers();
    } catch (error) {
      console.error('Failed to delete player:', error);
    }
  };

  const handleAssignBadge = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/badges/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: selectedPlayer.id,
          rfid_uid: badgeData.rfid_uid
        })
      });
      
      if (response.ok) {
        setShowBadgeModal(false);
        setSelectedPlayer(null);
        setBadgeData({ rfid_uid: '' });
        fetchPlayers();
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to assign badge:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Players</h1>
        <p>Manage tournament participants and RFID badges</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Registered Players</h2>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add Player
          </button>
        </div>
        {players.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>No players registered yet. Add your first player to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Twitch</th>
                <th>Division</th>
                <th>RFID Badge</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.email || '-'}</td>
                  <td>{player.phone || '-'}</td>
                  <td>{player.twitch_name ? `@${player.twitch_name}` : '-'}</td>
                  <td>{player.division ? <span className="badge badge-success">{player.division}</span> : '-'}</td>
                  <td>
                    {player.rfid_uid ? (
                      <span className="badge badge-success">{player.rfid_uid}</span>
                    ) : (
                      <span className="badge badge-warning">Not Assigned</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(player)} style={{ marginRight: '8px' }}>
                      Edit
                    </button>
                    {!player.rfid_uid && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '8px' }}
                        onClick={() => {
                          setSelectedPlayer(player);
                          setShowBadgeModal(true);
                        }}
                      >
                        Assign Badge
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(player)}>
                      Delete
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
            <h2>{editing ? 'Edit Player' : 'Register Player'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Twitch Name</label>
                <input
                  type="text"
                  value={formData.twitch_name}
                  onChange={(e) => setFormData({ ...formData, twitch_name: e.target.value })}
                  placeholder="yourtwitchchannel"
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
                {divisions.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                    No divisions defined. Add them under Settings → Divisions.
                  </p>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBadgeModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => setShowBadgeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Assign RFID Badge</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Assigning badge to: <strong>{selectedPlayer.name}</strong>
            </p>
            <form onSubmit={handleAssignBadge}>
              <div className="form-group">
                <label>RFID UID *</label>
                <input
                  type="text"
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                  value={badgeData.rfid_uid}
                  onChange={(e) => setBadgeData({ rfid_uid: e.target.value })}
                  required
                />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                Scan the badge on any reader to get the UID, then paste it here.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBadgeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Assign Badge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Players;
