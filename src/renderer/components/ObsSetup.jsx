import React, { useState, useEffect } from 'react';

function ObsSetup({ apiUrl }) {
  const [servers, setServers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', host: '', port: '4455', password: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [updateFor, setUpdateFor] = useState(null); // server id awaiting a source name
  const [sourceName, setSourceName] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadServers();
  }, [apiUrl]);

  const loadServers = async () => {
    try {
      const r = await fetch(`${apiUrl}/obs/servers`);
      setServers(await r.json());
    } catch (e) {
      console.error('Failed to load OBS servers', e);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', host: '', port: '4455', password: '' });
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (server) => {
    setEditing(server);
    setForm({ name: server.name, host: server.host, port: String(server.port), password: '' });
    setShowForm(true);
  };

  const saveServer = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload = { ...form };
    if (editing && !payload.password) delete payload.password;
    try {
      const r = await fetch(editing ? `${apiUrl}/obs/servers/${editing.id}` : `${apiUrl}/obs/servers`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (r.ok) {
        setMsg(editing ? 'Server updated.' : 'Server added.');
        resetForm();
        loadServers();
      } else {
        setMsg(data.error || 'Failed to save server.');
      }
    } catch (err) {
      setMsg('Failed to save server: ' + err.message);
    }
    setSaving(false);
  };

  const deleteServer = async (server) => {
    if (!confirm(`Delete OBS server "${server.name}"? Machines linked to it will be unassigned.`)) return;
    try {
      await fetch(`${apiUrl}/obs/servers/${server.id}`, { method: 'DELETE' });
      loadServers();
    } catch (err) {
      console.error(err);
    }
  };

  const testServer = async (server) => {
    setTestingId(server.id);
    try {
      const r = await fetch(`${apiUrl}/obs/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id })
      });
      const data = await r.json();
      setTestResults((t) => ({ ...t, [server.id]: data }));
    } catch (err) {
      setTestResults((t) => ({ ...t, [server.id]: { ok: false, error: err.message } }));
    }
    setTestingId(null);
    loadServers();
  };

  const openUpdate = (server) => {
    setUpdateFor(server.id);
    setSourceName('');
    setTestResults((t) => ({ ...t, [server.id]: undefined }));
  };

  const sendUpdate = async (server) => {
    if (!sourceName.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${apiUrl}/obs/test-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.id, sourceName: sourceName.trim() })
      });
      const data = await r.json();
      setTestResults((t) => ({ ...t, [server.id]: data }));
      setUpdateFor(null);
    } catch (err) {
      setTestResults((t) => ({ ...t, [server.id]: { ok: false, error: err.message } }));
    }
    setSending(false);
  };

  const disconnect = async () => {
    try {
      await fetch(`${apiUrl}/obs/disconnect`, { method: 'POST' });
      loadServers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>OBS Connection</h1>
        <p>Manage multiple OBS servers. Each machine can be assigned to one of them.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">OBS Servers</h2>
          <div>
            <button className="btn btn-secondary" onClick={disconnect} style={{ marginRight: '8px' }}>Disconnect All</button>
            <button className="btn btn-primary" onClick={openCreate}>+ Add Server</button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={saveServer} style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '10px' }}>{editing ? 'Edit Server' : 'Add Server'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Name *</label>
                <input type="text" placeholder="e.g., Main Stage" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Host *</label>
                <input type="text" placeholder="192.168.1.50" value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Port</label>
                <input type="number" value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Password</label>
                <input type="password" placeholder={editing ? 'Leave blank to keep' : ''} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
            {msg && <p style={{ color: 'var(--success, #4caf50)', marginTop: '8px' }}>{msg}</p>}
          </form>
        )}

        {servers.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📺</div>
            <p>No OBS servers configured. Add one to push player names to your stream.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => {
                const result = testResults[server.id];
                return (
                  <tr key={server.id}>
                    <td><strong>{server.name}</strong></td>
                    <td>
                      <code style={{ color: 'var(--accent)' }}>{server.host}:{server.port}</code>
                    </td>
                    <td>
                      {server.connected ? (
                        <span className="badge badge-success">Connected</span>
                      ) : (
                        <span className="badge badge-warning">Disconnected</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => testServer(server)} disabled={testingId === server.id}>
                          {testingId === server.id ? 'Testing...' : 'Test'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openUpdate(server)}>
                          Send Test
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(server)}>
                          Edit
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => deleteServer(server)}>
                          Delete
                        </button>
                      </div>
                      {updateFor === server.id && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <input type="text" placeholder="Text source name, e.g. Player Name"
                            style={{ flex: 1, minWidth: '180px' }}
                            value={sourceName}
                            onChange={(e) => setSourceName(e.target.value)} />
                          <button className="btn btn-primary btn-sm" onClick={() => sendUpdate(server)} disabled={sending || !sourceName.trim()}>
                            {sending ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      )}
                      {result && result.ok && (
                        <div style={{ fontSize: '13px', color: 'var(--success, #4caf50)', marginTop: '6px' }}>
                          {result.result && result.result.version ? `Connected - OBS ${result.result.version}` : `Sent to "${result.sourceName}".`}
                        </div>
                      )}
                      {result && !result.ok && (
                        <div style={{ fontSize: '13px', color: '#e57373', marginTop: '6px' }}>
                          {result.error || 'Failed'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">How to enable OBS WebSocket</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          OBS 28+ includes a built-in WebSocket server. Open <strong>OBS</strong>, go to <strong>Tools &gt; WebSocket Server Settings</strong>.
          Make sure <strong>Enable WebSocket server</strong> is checked (default port is 4455). Set a password if you want, then press
          <strong> Apply</strong>. You can test the connection above with this app.
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Linking a machine</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          In <strong>Machines</strong>, pick the <strong>OBS Server</strong> that machine should use and set the <strong>OBS Source</strong>
          (a text source name, e.g. "Player Name"). When a player checks into that machine, the app updates that source with the player's
          display name. Create the text source in OBS first (e.g. <em>Sources &gt; Add &gt; Text (GDI+)</em> on Windows or <em>Text</em> on
          Mac) and use its exact name.
        </p>
      </div>
    </div>
  );
}

export default ObsSetup;