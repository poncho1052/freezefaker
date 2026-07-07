// Minimal WebSocket client wrapper with a tiny typed pub/sub.
// The endpoint is <page-path>/ws so it works at the domain root (local Node
// server) and when the game is served under a subpath (hosted deploy).
export class Net {
  constructor(url) {
    if (!url) {
      const dir = location.pathname.replace(/\/[^/]*$/, ''); // strip trailing file or slash
      url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + dir + '/ws';
    }
    this.url = url;
    this.ws = null; this.open = false; this.queue = []; this.handlers = {};
  }
  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return reject(e); }
      this.ws = ws;
      ws.onopen = () => { this.open = true; for (const q of this.queue) ws.send(q); this.queue = []; resolve(); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        (this.handlers[m.t] || []).forEach((f) => f(m));
        (this.handlers['*'] || []).forEach((f) => f(m));
      };
      ws.onclose = () => { this.open = false; (this.handlers._close || []).forEach((f) => f()); };
      ws.onerror = () => { if (!this.open) reject(new Error('connect failed')); };
    });
  }
  on(t, fn) { (this.handlers[t] || (this.handlers[t] = [])).push(fn); return this; }
  send(obj) { const s = JSON.stringify(obj); if (this.open && this.ws) this.ws.send(s); else this.queue.push(s); }
  close() { try { this.ws && this.ws.close(); } catch { /* ignore */ } }
}
