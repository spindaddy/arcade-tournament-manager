import React, { useState, useEffect } from 'react';

function Tournaments({ apiUrl }) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchTournament();
  }, []);

  const fetchTournament = async () => {
    try {
      const response = await fetch(`${apiUrl}/tournament/current`);
      const data = await response.json();
      setTournament(data);
      setFormData({
        name: data?.name || '',
        description: data?.description || '',
        start_date: data?.start_date ? toLocalInput(data.start_date) : '',
        end_date: data?.end_date ? toLocalInput(data.end_date) : ''
      });
    } catch (error) {
      console.error('Failed to fetch tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    try {
      const body = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      };
      const response = await fetch(`${apiUrl}/tournaments`, {
        method: tournament ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save tournament');
      }
      setTournament(await response.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save tournament:', error);
      alert(error.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Tournament</h1>
        <p>Set up the current tournament. Each tournament is configured here; the title is used across the app and scoreboard.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{tournament ? 'Current Tournament' : 'Create Tournament'}</h2>
          {saved && <span className="badge badge-success">Saved ✓</span>}
        </div>
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tournament Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Summer Arcade Cup 2026"
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
              <button type="submit" className="btn btn-primary">
                Save Tournament
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default Tournaments;
