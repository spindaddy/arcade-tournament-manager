import React, { useState, useEffect } from 'react';

function Machines({ apiUrl }) {
  const [machines, setMachines] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', reader_id: '', location: '' });

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await fetch(`${apiUrl}/machines`);
      const data = await response.json();
      setMachines(data);
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${apiUrl}/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ name: '', reader_id: '', location: '' });
      fetchMachines();
    } catch (error) {
      console.error('Failed to create machine:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Arcade Machines</h1>
        <p>Register arcade machines and their RFID readers</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Machines</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Machine
          </button>
        </div>
        {machines.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🕹️</div>
            <p>No machines registered. Add each arcade machine with a unique reader ID.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Reader ID</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr key={machine.id}>
                  <td>{machine.name}</td>
                  <td>
                    <code style={{ color: 'var(--accent)' }}>{machine.reader_id}</code>
                  </td>
                  <td>{machine.location || '-'}</td>
                  <td>
                    {machine.is_active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-warning">Inactive</span>
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
            <h2>Add Arcade Machine</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Machine Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Pac-Man Turbo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Reader ID *</label>
                <input
                  type="text"
                  placeholder="e.g., reader-01"
                  value={formData.reader_id}
                  onChange={(e) => setFormData({ ...formData, reader_id: e.target.value })}
                  required
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                  This must match the reader_id your ESP32 sends with each scan.
                </p>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  placeholder="e.g., West corner"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Machines;