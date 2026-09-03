import React, { useState, useEffect } from 'react';

function Players({ apiUrl }) {
  const [players, setPlayers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', twitch_name: '' });
  const [badgeData, setBadgeData] = useState({ rfid_uid: '' });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`${apiUrl}/players`);
      const data = await response.json();
      setPlayers(data);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${apiUrl}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', twitch_name: '' });
      fetchPlayers();
    } catch (error) {
      console.error('Failed to create player:', error);
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                    <td>
                    {player.rfid_uid ? (
                      <span className="badge badge-success">{player.rfid_uid}</span>
                    ) : (
                      <span className="badge badge-warning">Not Assigned</span>
                    )}
                  </td>
                  <td>
                    {!player.rfid_uid && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setShowBadgeModal(true);
                        }}
                      >
                        Assign Badge
                      </button>
                    )}
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register
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
