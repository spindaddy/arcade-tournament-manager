const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Shared store for mount options (set from config each run).
let mountOptions = null;

function setMountOptions(opts) {
  mountOptions = {
    sharePath: (opts && opts.sharePath) || '',
    username: (opts && opts.username) || '',
    password: (opts && opts.password) || ''
  };
  return mountOptions;
}

function getMountOptions() {
  return mountOptions;
}

// Normalize a user-provided share path into { server, share } form.
// Accepts "//server/share", "smb://server/share", "\\\\server\\share".
function parseSharePath(raw) {
  if (!raw) return null;
  let p = raw.trim();
  p = p.replace(/^smb:\/\//i, '');
  p = p.replace(/^\\\\/i, '');   // windows-style
  p = p.replace(/^\/\//i, '');   // posix-style
  p = p.replace(/\/+$/, '');
  const idx = p.indexOf('/');
  if (idx === -1) {
    return { server: p, share: '' };
  }
  return { server: p.slice(0, idx), share: p.slice(idx + 1) };
}

// Derive a stable local mount point for the share.
function mountPoint() {
  const parsed = mountOptions ? parseSharePath(mountOptions.sharePath) : null;
  const tag = (parsed ? (parsed.server + '/' + parsed.share) : 'atm-share')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(os.tmpdir(), 'atm-share-' + tag);
}

function isMounted() {
  const dir = mountPoint();
  try {
    const st = fs.statSync(dir);
    if (!st.isDirectory()) return false;
    const out = spawnSync('mount', [], { encoding: 'utf8' });
    if (!out.stdout) return false;
    // Windows-style check
    if (process.platform === 'win32') {
      const net = spawnSync('net', ['use'], { encoding: 'utf8' });
      return net.stdout && net.stdout.includes(parseSharePath(mountOptions.sharePath).server);
    }
    return out.stdout.includes(dir);
  } catch (e) {
    return false;
  }
}

// Mount the share if not already mounted. Returns { ok, error }.
function mount() {
  const parsed = parseSharePath(mountOptions.sharePath);
  if (!parsed) return { ok: false, error: 'No share path configured' };
  if (isMounted()) return { ok: true, mounted: true };

  const dir = mountPoint();
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}

  const unc = `//${parsed.server}/${parsed.share}`;

  if (process.platform === 'win32') {
    // Use a drive-letter-free mount via net use with a temp drive letter
    const drive = 'Z:';
    const args = ['use', drive, unc];
    if (mountOptions.username) args.push(`/user:${mountOptions.username}`, mountOptions.password || '');
    const res = spawnSync('net', args, { encoding: 'utf8' });
    if (res.status !== 0) {
      return { ok: false, error: (res.stderr || res.stdout || 'net use failed').trim() };
    }
    return { ok: true, drive };
  }

  // macOS / Linux
  let cmd = 'mount_smbfs'; // macOS
  let args = [];
  if (process.platform === 'linux') {
    cmd = 'sudo';
    args.push('mount', '-t', 'cifs');
  }

  const target = `//${mountOptions.username ? mountOptions.username + '@' : ''}${parsed.server}/${parsed.share}`;
  const mountArgs = process.platform === 'linux'
    ? [...args, unc, dir, '-o', `username=${mountOptions.username || 'guest'},password=${mountOptions.password || ''},guest,uid=$(id -u),gid=$(id -g)`]
    : [target, dir];

  const res = spawnSync(cmd, mountArgs, { encoding: 'utf8' });
  if (res.status !== 0) {
    // Some mac builds mount with a trailing username mount
    return { ok: false, error: (res.stderr || res.stdout || 'mount failed').trim() };
  }
  return { ok: true, dir };
}

// Write (overwrite) a file on the share. Returns { ok, file, error }.
function writeMachineFile(machineName, content) {
  const parsed = parseSharePath(mountOptions.sharePath);
  if (!parsed) return { ok: false, error: 'No share configured' };

  const safeName = String(machineName || 'unknown').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, '_');
  const file = safeName + '.txt';

  // Resolve the writable directory for this platform
  let dir;
  if (process.platform === 'win32') {
    const m = mount();
    if (!m.ok) return { ok: false, error: m.error || 'could not mount share' };
    dir = m.drive + '\\';
  } else {
    if (!isMounted()) {
      const m = mount();
      if (!m.ok) return { ok: false, error: m.error || 'could not mount share' };
    }
    dir = mountPoint() + path.sep;
  }

  const filePath = path.join(dir, file);
  try {
    fs.writeFileSync(filePath, content);
    return { ok: true, file: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Test the share connection by attempting an anonymous-status write of a
// scratch file (then removing it). Returns { ok, error }.
function testShare() {
  const parsed = parseSharePath(mountOptions.sharePath);
  if (!parsed) return { ok: false, error: 'No share path configured' };

  try {
    const w = writeMachineFile('__atm_test__', 'ok');
    if (!w.ok) {
      // try to clean up
      return { ok: false, error: w.error || 'could not write to share' };
    }
    const filePath = w.file;
    try {
      if (filePath.endsWith('__atm_test__.txt')) fs.unlinkSync(filePath);
    } catch (e) { /* ignore */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  setMountOptions,
  getMountOptions,
  parseSharePath,
  mount,
  isMounted,
  writeMachineFile,
  testShare
};
