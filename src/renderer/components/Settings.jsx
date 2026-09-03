import React, { useState, useEffect } from 'react';

const THEMES = [
  { id: 'dark', name: 'Dark', swatch: ['#1a1a2e', '#e94560'] },
  { id: 'light', name: 'Light', swatch: ['#f4f5f7', '#e94560'] },
  { id: 'neon', name: 'Neon', swatch: ['#0b0f1a', '#00f5ff'] },
  { id: 'forest', name: 'Forest', swatch: ['#10150f', '#8ee06e'] }
];

function Settings({ apiUrl, currentTheme, onThemeChange }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [divisions, setDivisions] = useState('');
  const [savedDivisions, setSavedDivisions] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/settings`)
      .then((r) => r.json())
      .then((settings) => {
        if (settings.divisions) {
          try {
            setDivisions(JSON.parse(settings.divisions).join('\n'));
          } catch (e) {
            setDivisions(settings.divisions);
          }
        }
      })
      .catch((error) => console.error('Failed to load settings:', error));
  }, []);

  const selectTheme = async (themeId) => {
    setSaving(true);
    setSaved(false);
    try {
      onThemeChange(themeId);
      const response = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeId })
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveDivisions = async (e) => {
    e.preventDefault();
    const list = divisions
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    try {
      const response = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisions: JSON.stringify(list) })
      });
      if (response.ok) {
        setSavedDivisions(true);
        setTimeout(() => setSavedDivisions(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save divisions:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure the color theme and division list used by the app</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Color Theme</h2>
          {saved && <span className="badge badge-success">Saved ✓</span>}
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The selected theme is saved to the server and applied to both this app and the
          scoreboard page (shown at the web root).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => selectTheme(theme.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'var(--bg-card)',
                border: `2px solid ${currentTheme === theme.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                textAlign: 'left',
                transition: 'border-color .2s'
              }}
            >
              <span style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', width: '40px', height: '28px', flexShrink: 0 }}>
                <span style={{ flex: 1, background: theme.swatch[0] }} />
                <span style={{ flex: 1, background: theme.swatch[1] }} />
              </span>
              <span style={{ fontWeight: 600 }}>{theme.name}</span>
              {currentTheme === theme.id && <span style={{ marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
        </div>
        {saving && (
          <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontSize: '13px' }}>Saving...</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Divisions</h2>
          {savedDivisions && <span className="badge badge-success">Saved ✓</span>}
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Enter one division per line. These become the options in the player's Division dropdown.
        </p>
        <form onSubmit={saveDivisions}>
          <div className="form-group">
            <label>Divisions</label>
            <textarea
              rows={6}
              value={divisions}
              onChange={(e) => setDivisions(e.target.value)}
              placeholder={'Arcade\nPinball\nRetro\nCombat'}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">
              Save Divisions
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
