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
  const [divisions, setDivisions] = useState([]);
  const [savedDivisions, setSavedDivisions] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/settings`)
      .then((r) => r.json())
      .then((settings) => {
        setDivisions(normalizeDivisions(settings.divisions));
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
    const sorted = divisions.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    try {
      const response = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisions: JSON.stringify(sorted) })
      });
      if (response.ok) {
        setSavedDivisions(true);
        setTimeout(() => setSavedDivisions(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save divisions:', error);
    }
  };

  const addDivision = () => {
    setDivisions((prev) => {
      const maxOrder = prev.reduce((m, d) => Math.max(m, d.sort_order || 0), 0);
      return [...prev, { name: '', active: true, sort_order: maxOrder + 1 }];
    });
  };

  const updateDivision = (index, field, value) => {
    setDivisions((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const removeDivision = (index) => {
    setDivisions((prev) => prev.filter((d, i) => i !== index));
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
          Configure divisions shown on the scoreboard. Inactive divisions are hidden on the web page;
          grids are ordered by sort order.
        </p>
        <form onSubmit={saveDivisions}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Division</th>
                <th style={{ width: '90px' }}>Sort</th>
                <th style={{ width: '90px' }}>Active</th>
                <th style={{ width: '70px' }}></th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((div, index) => (
                <tr key={index}>
                  <td>{index + 1}.</td>
                  <td>
                    <input
                      type="text"
                      value={div.name}
                      placeholder="e.g., Arcade"
                      onChange={(e) => updateDivision(index, 'name', e.target.value)}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', padding: '8px 10px', width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={div.sort_order || 0}
                      onChange={(e) => updateDivision(index, 'sort_order', parseInt(e.target.value || '0', 10))}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', padding: '8px 10px', width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={div.active}
                      onChange={(e) => updateDivision(index, 'active', e.target.checked)}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeDivision(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {divisions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                    No divisions defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={addDivision}>
              + Add Division
            </button>
            <button type="submit" className="btn btn-primary">
              Save Divisions
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function normalizeDivisions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((d) => {
        if (typeof d === 'string') {
          return { name: d, active: true, sort_order: 0 };
        }
        return { name: d.name || '', active: d.active !== false, sort_order: d.sort_order || 0 };
      });
    }
  } catch (e) {
    return [];
  }
  return [];
}

export default Settings;
