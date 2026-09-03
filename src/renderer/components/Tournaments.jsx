import React, { useState, useEffect } from 'react';

function Tournaments({ apiUrl }) {
  const [tournaments, setTournaments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`${apiUrl}/tournaments`);
      const data = await response.json();
      setTournaments(data);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${apiUrl}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ name: '', description: '', start_date: '', end_date: '' });
      fetchTournaments();
    } catch (error) {
      console.error('Failed to create tournament:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'completed':
        return <span className="badge badge-danger">Completed</span>;
      default:
        return <span className="badge badge-warning">Pending</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Tournaments</h1>
        <p>Create and manage your arcade tournaments</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Tournaments</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Tournament
          </button>
        </div>
        {tournaments.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>No tournaments created yet. Start by creating your first tournament.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((tournament) => (
                <tr key={tournament.id}>
                  <td>{tournament.name}</td>
                  <td>{tournament.description || '-'}</td>
                  <td>
                    {tournament.start_date
                      ? new Date(tournament.start_date).toLocaleDateString()
                      : '-'}
                  </td>
                  <td>
                    {tournament.end_date
                      ? new Date(tournament.end_date).toLocaleDateString()
                      : '-'}
                  </td>
                  <td>{getStatusBadge(tournament.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Tournament</h2>
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
                <label>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tournaments;
