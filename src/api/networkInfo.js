const os = require('os');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }
  // Prefer common local-network addresses (192.168.x, 10.x, 172.16-31.x)
  const priority = candidates
    .filter((c) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address))
    .sort((a, b) => {
      const pa = a.address.startsWith('192.168.') ? 0 : 1;
      const pb = b.address.startsWith('192.168.') ? 0 : 1;
      return pa - pb;
    });
  return (priority.length ? priority : candidates)[0]?.address || '127.0.0.1';
}

module.exports = { getLanIp };
