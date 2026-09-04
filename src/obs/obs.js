const WebSocket = require('ws');
const crypto = require('crypto');

// obs-websocket 5.x client (built into OBS 28+).
// Protocol ops: Hello=0, Identify=1, Identified=2, Reidentify=3, Event=5, Request=6, RequestResponse=7.
const OP = { Hello: 0, Identify: 1, Identified: 2, Reidentify: 3, Request: 6, RequestResponse: 7 };

class ObsClient {
  constructor() {
    this.config = { host: 'localhost', port: 4455, password: '' };
    this.ws = null;
    this.connected = false;
    this.identifying = false;
    this.pending = new Map(); // requestId -> {resolve, reject}
    this.requestSeq = 1;
    this._salt = null;
    this._challenge = null;
    this._handshakeReject = null;
    this.reconnectTimer = null;
  }

  setConfig(cfg) {
    this.config = Object.assign({}, this.config, cfg || {});
  }

  buildUrl() {
    const { host, port } = this.config;
    return `ws://${host}:${port}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.connected || this.identifying)) {
        return resolve(true);
      }
      clearTimeout(this.reconnectTimer);
      const url = this.buildUrl();
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        return reject(e);
      }
      this.ws = ws;
      this.identifying = true;

      const self = this;
      ws.on('open', () => { /* server sends Hello */ });
      ws.on('message', (data) => self._onMessage(data));
      ws.on('error', (err) => {
        if (self._handshakeReject) {
          const r = self._handshakeReject;
          self._handshakeReject = null;
          r(new Error(`Could not reach OBS at ${url}: ${err.message || err.code || err}`));
        }
      });
      ws.on('close', () => {
        if (self._handshakeReject) {
          const r = self._handshakeReject;
          self._handshakeReject = null;
          r(new Error(`OBS at ${url} closed the connection during handshake`));
        }
        self._onClose();
      });

      // Timeout for handshake
      const handshakeTimer = setTimeout(() => {
        if (!self.connected && self._handshakeReject) {
          const r = self._handshakeReject;
          self._handshakeReject = null;
          try { ws.close(); } catch (e) {}
          r(new Error('OBS handshake timed out'));
        }
      }, 8000);

      // Resolve once identified
      const onIdentified = () => {
        clearTimeout(handshakeTimer);
        self._handshakeResolve = null;
        self._handshakeReject = null;
        resolve(true);
      };
      self._handshakeResolve = onIdentified;
      self._handshakeReject = (err) => {
        clearTimeout(handshakeTimer);
        self._handshakeResolve = null;
        reject(err);
      };
    });
  }

  _onMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }
    const op = msg.op;
    if (op === OP.Hello) {
      const auth = msg.d && msg.d.authentication;
      this._salt = auth ? auth.salt : null;
      this._challenge = auth ? auth.challenge : null;
      this._sendIdentify();
    } else if (op === OP.Identified) {
      this.connected = true;
      this.identifying = false;
      if (this._handshakeResolve) this._handshakeResolve();
    } else if (op === OP.RequestResponse) {
      const id = msg.d && msg.d.requestId;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        if (msg.d.requestStatus && msg.d.requestStatus.result) {
          pending.resolve(msg.d.responseData);
        } else {
          const err = (msg.d && msg.d.requestStatus && msg.d.requestStatus.comment) || 'OBS request failed';
          pending.reject(new Error(err));
        }
      }
    }
  }

  _buildAuth(challenge) {
    if (!this._salt || !this.config.password) return '';
    const secret = crypto.createHash('sha256').update(this.config.password + this._salt).digest('base64');
    const auth = crypto.createHash('sha256').update(secret + challenge).digest('base64');
    return auth;
  }

  _sendIdentify() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const d = { rpcVersion: 1 };
    if (this.config.password && this._salt && this._challenge) {
      d.authentication = this._buildAuth(this._challenge);
    }
    this.ws.send(JSON.stringify({ op: OP.Identify, d }));
  }

  _sendRequest(requestType, requestData) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Not connected to OBS'));
      }
      const requestId = String(this.requestSeq++);
      this.pending.set(requestId, { resolve, reject });
      this.ws.send(JSON.stringify({
        op: OP.Request,
        d: { requestType, requestId, requestData: requestData || {} }
      }));
    });
  }

  _onClose() {
    const wasConnected = this.connected;
    this.connected = false;
    this.identifying = false;
    this.ws = null;
    this.pending.forEach((p) => p.reject(new Error('OBS connection closed')));
    this.pending.clear();
    if (wasConnected) {
      // schedule reconnect
      this.reconnectTimer = setTimeout(() => {
        if (this.autoReconnect) this.connect().catch(() => {});
      }, 3000);
    }
  }

  // Public: update a text source's content.
  async updateTextSource(sourceName, text) {
    await this.connect();
    await this._sendRequest('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { text: String(text) }
    });
  }

  // Public: test connection (connect + fetch version).
  async testConnection() {
    await this.connect();
    const v = await this._sendRequest('GetVersion', {});
    return { ok: true, version: v.obsVersion || v };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.autoReconnect = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.ws = null;
    this.connected = false;
  }
}

module.exports = ObsClient;
