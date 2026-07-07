// Zero-dependency HTTP static server + WebSocket (RFC 6455) server.
// Keeps the project dependency-free: run with `node server/server.js`.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
};

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// A thin socket wrapper: .send(str), events 'message' and 'close'.
class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.handlers = { message: [], close: [] };
    this.buf = Buffer.alloc(0);
    this.alive = true;
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  on(ev, fn) { (this.handlers[ev] || (this.handlers[ev] = [])).push(fn); return this; }
  _emit(ev, ...a) { for (const fn of this.handlers[ev] || []) { try { fn(...a); } catch (e) { console.error(e); } } }

  _closed() { if (!this.alive) return; this.alive = false; this._emit('close'); }

  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    // Parse as many complete frames as we have.
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const needed = off + (masked ? 4 : 0) + len;
      if (this.buf.length < needed) return;
      let payload;
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) payload[i] = this.buf[off + 4 + i] ^ mask[i & 3];
      } else {
        payload = this.buf.subarray(off, off + len);
      }
      this.buf = this.buf.subarray(needed);

      if (opcode === 0x8) { this.close(); return; }                 // close
      else if (opcode === 0x9) { this._sendFrame(0xA, payload); }    // ping -> pong
      else if (opcode === 0x1) { this._emit('message', payload.toString('utf8')); } // text
      // ignore binary/continuation for our JSON protocol
    }
  }

  _sendFrame(opcode, payload) {
    if (!this.alive) return;
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.alloc(2); header[1] = len; }
    else if (len < 65536) { header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    header[0] = 0x80 | opcode;
    try { this.socket.write(Buffer.concat([header, payload])); } catch { this._closed(); }
  }

  send(str) { this._sendFrame(0x1, Buffer.from(str, 'utf8')); }
  close() { try { this._sendFrame(0x8, Buffer.alloc(0)); this.socket.end(); } catch {} this._closed(); }
}

export function createServer({ root, onConnection }) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    onConnection(new WSConn(socket));
  });

  return server;
}
