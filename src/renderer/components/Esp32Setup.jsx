import React, { useState, useEffect } from 'react';

function Esp32Setup({ apiUrl }) {
  const [prereqs, setPrereqs] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [output, setOutput] = useState([]);
  const [doneStatus, setDoneStatus] = useState(null);

  useEffect(() => {
    loadPrereqs();
  }, [apiUrl]);

  const loadPrereqs = async () => {
    try {
      const r = await fetch(`${apiUrl}/firmware/prereqs`);
      setPrereqs(await r.json());
    } catch (e) { console.error('Failed to load prereqs', e); }
  };

  const installPlatformio = async () => {
    setOutput([]);
    setDoneStatus(null);
    setInstalling(true);
    setOutput(['Installing PlatformIO... this may take several minutes.']);
    try {
      const r = await fetch(`${apiUrl}/firmware/prereqs/install`, { method: 'POST' });
      const data = await r.json();
      streamJob(data.id);
    } catch (e) {
      console.error(e);
      setInstalling(false);
    }
  };

  const streamJob = (id) => {
    const es = new EventSource(`${apiUrl}/firmware/flash/${id}/stream`);
    es.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'line') {
        setOutput((o) => [...o, msg.line]);
      } else if (msg.type === 'done') {
        setDoneStatus(msg.status);
        es.close();
        setInstalling(false);
        loadPrereqs();
      }
    };
    es.onerror = () => {
      es.close();
      setInstalling(false);
    };
  };

  return (
    <div>
      <div className="page-header">
        <h1>ESP32 Setup</h1>
        <p>Check and install the tools needed to program ESP32 readers.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Prerequisites</h2>
          <button className="btn btn-secondary" onClick={loadPrereqs}>Re-check</button>
        </div>
        {prereqs == null ? (
          <p style={{ color: 'var(--text-secondary)' }}>Checking prerequisites...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <PrereqRow label="PlatformIO (compiler + flasher)" ok={prereqs.platformio.installed}
              detail={prereqs.platformio.path}
              action={!prereqs.platformio.installed && (
                <button className="btn btn-primary" onClick={installPlatformio} disabled={installing}>
                  {installing ? 'Installing...' : 'Install PlatformIO'}
                </button>
              )} />
            <PrereqRow label="Python" ok={prereqs.python.installed}
              detail={prereqs.python.installed
                ? `${prereqs.python.path}${prereqs.python.version ? ` (${prereqs.python.version})` : ''}`
                : (prereqs.python.note || 'Python 3 not found')} />
            <PrereqRow label="esptool (comes with PlatformIO)" ok={prereqs.esptool.installed} detail={prereqs.esptool.path} />
            <PrereqRow label="Serial port available"
              ok={prereqs.serialPortsPresent}
              detail={prereqs.serialPortsPresent && prereqs.serialPorts.length ? prereqs.serialPorts.map((p) => p.port).join(', ') : 'No device detected. Connect the ESP32 via USB.'} />
          </div>
        )}
      </div>

      {doneStatus && (
        <div className="card">
          <h2 className="card-title" style={{ color: doneStatus === 'success' ? 'var(--success, #4caf50)' : '#e57373' }}>
            {doneStatus === 'success' ? 'PlatformIO is ready.' : 'Install finished with errors. Review the output below.'}
          </h2>
        </div>
      )}

      {output.length > 0 && (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Output</h2></div>
          <pre style={{
            background: 'var(--bg-card)', padding: '12px', borderRadius: '8px',
            fontSize: '12px', maxHeight: '360px', overflow: 'auto', whiteSpace: 'pre-wrap'
          }}>
            {output.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}

function PrereqRow({ label, ok, detail, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ color: ok ? 'var(--success, #4caf50)' : '#e57373', fontWeight: 'bold' }}>
        {ok ? '✓' : '✗'}
      </span>
      <div style={{ flex: 1 }}>
        <div>{label}</div>
        {detail && <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{typeof detail === 'string' ? detail : JSON.stringify(detail)}</div>}
      </div>
      {action}
    </div>
  );
}

export default Esp32Setup;
