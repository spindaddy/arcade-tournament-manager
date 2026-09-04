import React, { useState, useEffect } from 'react';

function Machines({ apiUrl }) {
  const [machines, setMachines] = useState([]);
  const [obsServers, setObsServers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', reader_id: '', location: '', is_active: true, obs_source_name: '', obs_server_id: '' });

  useEffect(() => {
    fetchMachines();
    fetchObsServers();
  }, []);

  const fetchObsServers = async () => {
    try {
      const response = await fetch(`${apiUrl}/obs/servers`);
      setObsServers(await response.json());
    } catch (error) {
      console.error('Failed to fetch OBS servers:', error);
    }
  };

  const fetchMachines = async () => {
    try {
      const response = await fetch(`${apiUrl}/machines`);
      const data = await response.json();
      setMachines(data);
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', reader_id: '', location: '', is_active: true, obs_source_name: '', obs_server_id: '' });
    setShowModal(true);
  };

  const openEdit = (machine) => {
    setEditing(machine);
    setFormData({
      name: machine.name,
      reader_id: machine.reader_id,
      location: machine.location || '',
      is_active: !!machine.is_active,
      obs_source_name: machine.obs_source_name || '',
      obs_server_id: machine.obs_server_id || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await fetch(`${apiUrl}/machines/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch(`${apiUrl}/machines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      setEditing(null);
      fetchMachines();
    } catch (error) {
      console.error('Failed to save machine:', error);
    }
  };

  const handleDelete = async (machine) => {
    if (!confirm(`Delete machine "${machine.name}"? This cannot be undone.`)) return;
    try {
      await fetch(`${apiUrl}/machines/${machine.id}`, {
        method: 'DELETE'
      });
      fetchMachines();
    } catch (error) {
      console.error('Failed to delete machine:', error);
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
          <button className="btn btn-primary" onClick={openCreate}>
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
                <th>OBS Server</th>
                <th>OBS Source</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td>{machine.obs_server_id ? (obsServers.find((s) => s.id === machine.obs_server_id)?.name || 'Unknown') : '-'}</td>
                  <td>{machine.obs_source_name ? <code style={{ color: 'var(--accent)' }}>{machine.obs_source_name}</code> : '-'}</td>
                  <td>
                    {machine.is_active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-warning">Inactive</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(machine)} style={{ marginRight: '8px' }}>
                      Edit
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(machine)}>
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
            <h2>{editing ? 'Edit Arcade Machine' : 'Add Arcade Machine'}</h2>
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
              <div className="form-group">
                <label>OBS Server</label>
                <select
                  value={formData.obs_server_id}
                  onChange={(e) => setFormData({ ...formData, obs_server_id: e.target.value })}
                >
                  <option value="">None</option>
                  {obsServers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.host}:{s.port})</option>
                  ))}
                </select>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                  Which OBS server this machine pushes its player name to.
                </p>
              </div>
              <div className="form-group">
                <label>OBS Source Name</label>
                <input
                  type="text"
                  placeholder="e.g., Player Name (optional)"
                  value={formData.obs_source_name}
                  onChange={(e) => setFormData({ ...formData, obs_source_name: e.target.value })}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                  If set, the current player name is pushed to this OBS text source on each check-in.
                </p>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Add Machine'}
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
