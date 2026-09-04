import React, { useState, useEffect, useRef } from 'react';

function Esp32Program({ apiUrl }) {
  const [form, setForm] = useState({
    ssid: '',
    password: '',
    serverUrl: '',
    readerId: 'reader-01',
    flash: true
  });
  const [toolStatus, setToolStatus] = useState(null);
  const [connection, setConnection] = useState(null);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState('');
  const [monitorOn, setMonitorOn] = useState(false);
  const [monitorJobId, setMonitorJobId] = useState(null);
  const [output, setOutput] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [doneStatus, setDoneStatus] = useState(null);
  const outputRef = useRef(null);

  useEffect(() => {
    fetch(`${apiUrl}/connection`).then((r) => r.json()).then((c) => {
      setConnection(c);
      setForm((f) => ({ ...f, serverUrl: c.scanEndpoint || f.serverUrl }));
    }).catch(() => {});
    fetch(`${apiUrl}/firmware/status`).then((r) => r.json()).then(setToolStatus).catch(() => {});
    loadPorts();
  }, [apiUrl]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const loadPorts = async () => {
    try {
      const r = await fetch(`${apiUrl}/firmware/ports`);
      const data = await r.json();
      setPorts(data.ports || []);
      if (!port && data.ports && data.ports.length) {
        const preferred = data.ports.find((p) => p.likelyEsp32) || data.ports[0];
        setPort(preferred.port);
      }
    } catch (e) { console.error('Failed to load ports', e); }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildConfig = () => ({
    ssid: form.ssid,
    password: form.password,
    serverUrl: form.serverUrl,
    readerId: form.readerId,
    port
  });

  const doPreview = async () => {
    setPreview(null);
    setDoneStatus(null);
    const r = await fetch(`${apiUrl}/firmware/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfig())
    });
    const data = await r.json();
    setPreview(data.ino);
  };

  const doFlash = async () => {
    setOutput([]);
    setDoneStatus(null);
    setMonitorOn(false);
    setBusy(true);
    const r = await fetch(`${apiUrl}/firmware/flash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: buildConfig(), flash: form.flash })
    });
    const data = await r.json();
    streamJob(data.id);
  };

  const streamJob = (id, opts = {}) => {
    const es = new EventSource(`${apiUrl}/firmware/flash/${id}/stream`);
    es.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'line') {
        setOutput((o) => [...o, msg.line]);
      } else if (msg.type === 'done') {
        setDoneStatus(msg.status);
        es.close();
        if (opts.onDone) opts.onDone(msg.status);
        if (opts.monitor) {
          setMonitorOn(false);
          setMonitorJobId(null);
          setBusy(false);
        } else {
          setBusy(false);
        }
      }
    };
    es.onerror = () => {
      es.close();
      setBusy(false);
      if (opts.monitor) { setMonitorOn(false); setMonitorJobId(null); }
    };
  };

  const startMonitor = async () => {
    if (!port) return;
    setOutput([]);
    setDoneStatus(null);
    setMonitorOn(true);
    setBusy(true);
    setOutput(['Listening on ' + port + ' @ 115200... (press Stop to end)']);
    const r = await fetch(`${apiUrl}/firmware/monitor/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port })
    });
    const data = await r.json();
    setMonitorJobId(data.id);
    streamJob(data.id, { monitor: true });
  };

  const stopMonitor = async () => {
    if (monitorJobId) {
      await fetch(`${apiUrl}/firmware/monitor/${monitorJobId}/stop`, { method: 'POST' }).catch(() => {});
    }
    setMonitorOn(false);
    setMonitorJobId(null);
    setDoneStatus(null);
    setBusy(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>ESP32 Program</h1>
        <p>Configure, build, flash, and monitor the RFID reader firmware.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Tooling</h2>
        </div>
        {toolStatus == null ? (
          <p style={{ color: 'var(--text-secondary)' }}>Checking for PlatformIO...</p>
        ) : toolStatus.available ? (
          <p style={{ color: 'var(--success, #4caf50)' }}>
            PlatformIO found — build &amp; flash is ready.
          </p>
        ) : (
          <p style={{ color: '#e57373' }}>
            PlatformIO was not found. Go to the ESP32 Setup screen to install it. Current IP
            for the server URL: <code>{connection ? connection.lanIp : '(unknown)'}</code>
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Configuration</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' }}>
          <label>ESP32 Serial Port
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={port} onChange={(e) => setPort(e.target.value)} style={{ flex: 1 }}>
                <option value="">(auto-detect)</option>
                {ports.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port}{p.likelyEsp32 ? '  (likely ESP32)' : ''}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={loadPorts}>Refresh</button>
            </div>
          </label>
          <label>Wi-Fi SSID
            <input type="text" value={form.ssid} onChange={set('ssid')} placeholder="MyArcadeWiFi" />
          </label>
          <label>Wi-Fi Password
            <input type="text" value={form.password} onChange={set('password')} placeholder="password" />
          </label>
          <label>Server URL (scan endpoint)
            <input type="text" value={form.serverUrl} onChange={set('serverUrl')} style={{ fontSize: '14px', fontFamily: 'monospace', width: '75%', minWidth: '380px' }} />
          </label>
          {connection && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '-6px 0 0' }}>
              Detected app address (same network): <code>{connection.scanEndpoint}</code>
            </p>
          )}
          <label>Reader ID (must match a Machine in the app)
            <input type="text" value={form.readerId} onChange={set('readerId')} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.flash} onChange={(e) => setForm((f) => ({ ...f, flash: e.target.checked }))} />
            Flash to ESP32 after compiling
          </label>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={doPreview}>Preview Firmware</button>
            <button className="btn btn-primary" onClick={doFlash} disabled={busy && !monitorOn}>
              {busy && !monitorOn ? 'Working...' : form.flash ? 'Build & Flash' : 'Build Only'}
            </button>
            <button className="btn btn-secondary" onClick={monitorOn ? stopMonitor : startMonitor} disabled={!port || (busy && !monitorOn)}>
              {monitorOn ? 'Stop Monitor' : 'Open Serial Monitor'}
            </button>
          </div>
        </div>
      </div>

      {doneStatus === 'success' && (
        <div className="card">
          <h2 className="card-title" style={{ color: 'var(--success, #4caf50)' }}>
            Success — firmware flashed.
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Click <strong>Open Serial Monitor</strong> on port <code>{port}</code> to watch the ESP32 boot up.
          </p>
        </div>
      )}

      {output.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{monitorOn ? 'Serial Monitor' : 'Output'}</h2>
          </div>
          <pre ref={outputRef} style={{
            background: 'var(--bg-card)', padding: '12px', borderRadius: '8px',
            fontSize: '12px', maxHeight: '360px', overflow: 'auto', whiteSpace: 'pre-wrap'
          }}>
            {output.join('\n')}
          </pre>
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Generated Firmware</h2></div>
          <pre style={{
            background: 'var(--bg-card)', padding: '12px', borderRadius: '8px',
            fontSize: '12px', maxHeight: '420px', overflow: 'auto'
          }}>{preview}</pre>
        </div>
      )}
    </div>
  );
}

export default Esp32Program;
