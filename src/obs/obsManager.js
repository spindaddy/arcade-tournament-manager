const ObsClient = require('./obs');

// Manages one ObsClient per OBS server (keyed by server id).
const clients = new Map();

function getClient(server) {
  let client = clients.get(server.id);
  if (!client) {
    client = new ObsClient();
    clients.set(server.id, client);
  }
  client.setConfig({ host: server.host, port: server.port, password: server.password || '' });
  return client;
}

function clientStatus(serverId) {
  const client = clients.get(serverId);
  return client ? client.connected : false;
}

async function connect(server) {
  const client = getClient(server);
  await client.connect();
  return client;
}

async function updateTextSource(server, sourceName, text) {
  const client = await connect(server);
  await client.updateTextSource(sourceName, text || '');
}

async function testConnection(server) {
  const result = await connect(server).then((client) => client.testConnection());
  return result;
}

function disconnect(serverId) {
  const client = clients.get(serverId);
  if (client) {
    client.disconnect();
    clients.delete(serverId);
  }
}

function disconnectAll() {
  clients.forEach((client) => {
    try { client.disconnect(); } catch (e) {}
  });
  clients.clear();
}

module.exports = { getClient, clientStatus, connect, updateTextSource, testConnection, disconnect, disconnectAll };