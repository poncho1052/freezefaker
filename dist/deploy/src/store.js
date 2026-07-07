// Persisted settings (Steam Cloud stand-in: localStorage).
const KEY = 'freezefaker.settings.v1';

const DEFAULTS = {
  lang: 'en',
  volume: 0.7,
  colorblind: false,
  hudScale: 1,
  difficulty: 'normal',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, lang: guessLang() };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore quota / privacy mode */ }
}

// Personal best match scores, keyed by mode.
const BEST_KEY = 'freezefaker.best.v1';
export function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
}
export function saveBest(best) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
}

// Best-effort language default from the browser, only on first ever run.
export function guessLang() {
  try {
    const l = (navigator.language || 'en').toLowerCase();
    return l.startsWith('ja') ? 'ja' : 'en';
  } catch { return 'en'; }
}
