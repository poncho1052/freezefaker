// Bootstrap: wire settings, input, audio, UI and the game together.
import { loadSettings, saveSettings } from './store.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Ui } from './ui.js';
import { Game } from './game.js';
import { Net } from './net.js';
import { OnlineMatch } from './online.js';

const canvas = document.getElementById('stage');
const screens = document.getElementById('screens');
const live = document.getElementById('live');

const settings = loadSettings();

const audio = new Audio();
audio.volume = settings.volume;
const input = new Input(window);
const ui = new Ui(screens, settings);
const game = new Game({ canvas, input, audio, ui, settings, live });
game.applySettings();

const persist = () => { saveSettings(settings); game.applySettings(); audio.resume(); };

ui.on('play', () => game.start({ mode: 'classic' }));
ui.on('startMode', (m) => game.start({ mode: m }));
ui.on('tutorial', () => game.start({ tutorial: true }));
ui.on('resume', () => game.resume());
ui.on('restart', () => { if (online.match) return backToTitle(); game.start({ mode: game.mode, tutorial: game.tutorial }); });
ui.on('quit', () => { if (online.match) return backToTitle(); game.quitToTitle(); });
ui.on('settings', persist);

// ---------------- Online / multiplayer ----------------
const online = { net: null, youId: null, role: null, active: false, match: null };

function backToTitle() {
  if (online.net) { try { online.net.close(); } catch { /* ignore */ } }
  if (game.online) game.exitOnline();
  online.net = null; online.active = false; online.match = null;
  ui.show('title');
}

async function connect() {
  audio.resume();
  const net = new Net();
  net.on('lobby', (m) => { online.lobby = m; if (!online.active) ui.showLobby(m, online.youId); });
  net.on('error', (m) => ui.lobbyError(m.msg || 'error'));
  net.on('joined', (m) => { online.youId = m.id; online.role = m.role; });
  net.on('init', (m) => {
    online.role = m.role;
    online.match = new OnlineMatch({ canvas, input, audio, ui, settings, net, role: m.role, youId: m.you, onEnd: () => { online.active = false; } });
    online.match._init(m);
    online.active = true;
    game.enterOnline(online.match);
  });
  net.on('snap', (m) => online.match && online.match._snap(m));
  net.on('ev', (m) => online.match && online.match._event(m));
  net.on('end', (m) => online.match && online.match._end(m));
  net.on('_close', () => { if (online.active || ui.current === 'lobby') { ui.lobbyError(ui.t().connFail); if (!online.active) ui.show('online'); } });
  online.net = net;
  try { await net.connect(); } catch { ui.lobbyError(ui.t().connFail); return null; }
  return net;
}

ui.on('onlineCreate', async (name) => { const net = await connect(); if (net) net.send({ t: 'create', name }); });
ui.on('onlineJoin', async (name, code) => { if (!code) return ui.lobbyError('—'); const net = await connect(); if (net) net.send({ t: 'join', code, name }); });
ui.on('lobbyReady', (v) => online.net && online.net.send({ t: 'ready', v }));
ui.on('lobbyStart', () => online.net && online.net.send({ t: 'start' }));
ui.on('lobbyLeave', () => { if (online.net) online.net.send({ t: 'leave' }); backToTitle(); });

ui.show('title');

// Guard against zoom/scroll on space & arrows outside gameplay too.
window.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(e.key) && game.state !== 'menu') e.preventDefault();
}, { passive: false });
