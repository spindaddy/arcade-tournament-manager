export function parseDbTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  const iso = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatElapsed(startTime) {
  const start = parseDbTime(startTime);
  if (!start) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}