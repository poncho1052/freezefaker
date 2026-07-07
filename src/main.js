// Bootstrap: wire settings, input, audio, UI and the game together.
import { loadSettings, saveSettings } from './store.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Ui } from './ui.js';
import { Game } from './game.js';

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
ui.on('restart', () => game.start({ mode: game.mode, tutorial: game.tutorial }));
ui.on('quit', () => game.quitToTitle());
ui.on('settings', persist);

ui.show('title');

// Guard against zoom/scroll on space & arrows outside gameplay too.
window.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(e.key) && game.state !== 'menu') e.preventDefault();
}, { passive: false });
