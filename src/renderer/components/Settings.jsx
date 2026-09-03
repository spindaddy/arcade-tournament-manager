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

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Choose the color theme used by the app and the scoreboard web page</p>
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
    </div>
  );
}

export default Settings;
