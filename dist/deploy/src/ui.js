// DOM UI: title, how-to, settings, pause, and result screens + the logo.
import { I18N } from './config.js';

// Brand logo per the design board: watcher eye + focus brackets, stencil-cut
// FREEZE, glitch-sliced red FAKER with a signal-person chip, bracketed tagline.
function logoSVG(small) {
  const uid = small ? 's' : 'l';
  return `<svg class="logosvg ${small ? 'small' : ''}" viewBox="0 0 640 ${small ? 300 : 470}" role="img" aria-label="FREEZE FAKER — Don't Act Human.">
  <defs>
    <mask id="cut-${uid}">
      <rect x="0" y="0" width="640" height="470" fill="#fff"/>
      <g fill="#000" transform="rotate(-10 320 160)">
        <rect x="118" y="118" width="404" height="5"/>
        <rect x="60" y="166" width="250" height="4"/>
        <rect x="360" y="176" width="220" height="4"/>
      </g>
    </mask>
    <text id="fk-${uid}" x="320" y="330" text-anchor="middle" textLength="548" lengthAdjust="spacingAndGlyphs"
      font-family="'Arial Black','Arial Bold',sans-serif" font-weight="900"
      font-size="128">FAKER</text>
    <clipPath id="b1-${uid}"><rect x="0" y="222" width="640" height="42"/></clipPath>
    <clipPath id="b2-${uid}"><rect x="0" y="264" width="640" height="34"/></clipPath>
    <clipPath id="b3-${uid}"><rect x="0" y="298" width="640" height="44"/></clipPath>
  </defs>

  ${small ? '' : `
  <!-- watcher eye + focus brackets -->
  <g transform="translate(320 34)">
    <path d="M-34 0 Q0 -25 34 0 Q0 25 -34 0Z" fill="none" stroke="#F2F1EC" stroke-width="4"/>
    <circle r="8.5" fill="#F2F1EC"/><circle r="4.5" fill="#E53935"/>
  </g>
  <g stroke="#9AA3AD" stroke-width="4" fill="none" opacity="0.85">
    <path d="M56 22 L56 6 L84 6"/><path d="M584 22 L584 6 L556 6"/>
    <path d="M56 400 L56 416 L84 416"/><path d="M584 400 L584 416 L556 416"/>
  </g>`}

  <!-- FREEZE: stencil-cut offwhite -->
  <g mask="url(#cut-${uid})">
    <text x="320" y="196" text-anchor="middle" textLength="548" lengthAdjust="spacingAndGlyphs"
      font-family="'Arial Black','Arial Bold',sans-serif" font-weight="900"
      font-size="126" fill="#F2F1EC">FREEZE</text>
  </g>
  <!-- signal chip hanging on the last E -->
  <g transform="translate(586 118)">
    <rect x="-17" y="-24" width="34" height="52" rx="7" fill="#141c28" stroke="#3a4350" stroke-width="2"/>
    <circle cx="0" cy="-9" r="5.4" fill="#E53935"/>
    <path d="M-5.5 12 L0 -1.5 L5.5 12 Z M-1.8 12 L-1.8 2 L1.8 2 L1.8 12 Z" fill="#E53935"/>
  </g>

  <!-- FAKER: red glitch bands (subtle slice misregistration) -->
  <use href="#fk-${uid}" fill="#0E1621" transform="translate(4 4)" opacity="0.6"/>
  <g class="gband gband1" clip-path="url(#b1-${uid})"><use href="#fk-${uid}" fill="#E53935" transform="translate(-2.5 0)"/></g>
  <g class="gband gband2" clip-path="url(#b2-${uid})"><use href="#fk-${uid}" fill="#ef4640" transform="translate(4 0)"/></g>
  <g class="gband gband3" clip-path="url(#b3-${uid})"><use href="#fk-${uid}" fill="#d23430" transform="translate(-1.5 0)"/></g>
  <g fill="#E53935">
    <rect x="52" y="256" width="26" height="8"/>
    <rect x="562" y="288" width="34" height="7"/>
  </g>

  ${small ? '' : `
  <!-- tagline -->
  <g>
    <rect x="76" y="408" width="42" height="3" fill="#5a636e"/>
    <text x="320" y="420" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="24" letter-spacing="6">
      <tspan fill="#F2F1EC">DON'T </tspan><tspan fill="#E53935">ACT</tspan><tspan fill="#F2F1EC"> HUMAN.</tspan>
    </text>
    <rect x="522" y="408" width="42" height="3" fill="#5a636e"/>
  </g>`}
</svg>`;
}

function logoHTML(small = false) {
  return `<div class="logo ${small ? 'small' : ''}">${logoSVG(small)}</div>`;
}

export class Ui {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.cb = {};                 // callbacks set by the game
    this._build();
  }

  on(name, fn) { this.cb[name] = fn; }
  t() { return I18N[this.settings.lang] || I18N.en; }

  _build() {
    this.root.innerHTML = '';
    this.screens = {};
    this.screens.title = this._titleScreen();
    this.screens.modeselect = this._modeScreen();
    this.screens.online = this._onlineScreen();
    this.screens.lobby = this._lobbyScreen();
    this.screens.howto = this._howToScreen();
    this.screens.settings = this._settingsScreen();
    this.screens.pause = this._pauseScreen();
    this.screens.result = this._resultScreen();
    for (const k in this.screens) this.root.appendChild(this.screens[k]);
    this.refresh();
  }

  show(name) {
    for (const k in this.screens) this.screens[k].classList.toggle('active', k === name);
    this.current = name;
  }
  hideAll() { for (const k in this.screens) this.screens[k].classList.remove('active'); this.current = null; }

  // rebuild dynamic text after language change
  refresh() {
    const scrolled = this.current;
    this._fill();
    if (scrolled) this.show(scrolled);
  }

  // ---------------- screens ----------------
  _titleScreen() {
    const el = div('screen');
    el.innerHTML = `
      ${logoHTML()}
      <p class="subtitle" data-i="subtitle"></p>
      <div class="menu">
        <button class="btn primary" data-act="play"><span data-i="play"></span></button>
        <button class="btn accent" data-act="online"><span data-i="online"></span></button>
        <button class="btn" data-act="tutorial"><span data-i="tutorial"></span></button>
        <button class="btn ghost" data-act="howto"><span data-i="howto"></span></button>
        <button class="btn ghost" data-act="settings"><span data-i="settings"></span></button>
      </div>
      <div class="credits">Freeze Faker — prototype build</div>`;
    el.querySelector('[data-act=play]').onclick = () => this.show('modeselect');
    el.querySelector('[data-act=online]').onclick = () => this.show('online');
    el.querySelector('[data-act=tutorial]').onclick = () => this.cb.tutorial?.();
    el.querySelector('[data-act=howto]').onclick = () => this.show('howto');
    el.querySelector('[data-act=settings]').onclick = () => { this._returnTo = 'title'; this.show('settings'); };
    return el;
  }

  _modeScreen() {
    const el = div('screen');
    el.innerHTML = `
      ${logoHTML(true)}
      <h2 class="mode-h" data-i="chooseMode" style="letter-spacing:.14em;text-transform:uppercase;z-index:1"></h2>
      <div class="mode-grid">
        <button class="mode-card" data-mode="classic">
          <div class="mc-ic">🚦</div><h3 data-i="classicName"></h3><p data-i="classicDesc"></p>
        </button>
        <button class="mode-card" data-mode="mission">
          <div class="mc-ic">✅</div><h3 data-i="missionName"></h3><p data-i="missionDesc"></p>
        </button>
        <button class="mode-card" data-mode="watch">
          <div class="mc-ic">👁</div><h3 data-i="watchName"></h3><p data-i="watchDesc"></p>
        </button>
      </div>
      <div class="actions"><button class="btn ghost" data-act="back"><span data-i="back"></span></button></div>`;
    el.querySelectorAll('.mode-card').forEach((b) => b.onclick = () => this.cb.startMode?.(b.dataset.mode));
    el.querySelector('[data-act=back]').onclick = () => this.show('title');
    return el;
  }

  _onlineScreen() {
    const el = div('screen');
    el.innerHTML = `
      ${logoHTML(true)}
      <h2 class="mode-h" data-i="onlineTitle" style="letter-spacing:.12em;text-transform:uppercase;z-index:1"></h2>
      <div class="online-wrap">
        <input class="tf" data-ctl="name" maxlength="16" data-ph="yourName" />
        <div class="online-cols">
          <div class="online-card">
            <div class="oc-ic">👁</div><h3 data-i="createRoom"></h3><p data-i="createHint"></p>
            <button class="btn primary" data-act="create"><span data-i="createRoom"></span></button>
          </div>
          <div class="online-card">
            <div class="oc-ic">🚶</div><h3 data-i="joinRoom"></h3><p data-i="joinHint"></p>
            <input class="tf code" data-ctl="code" maxlength="4" data-ph="roomCodePh" />
            <button class="btn" data-act="join"><span data-i="joinRoom"></span></button>
          </div>
        </div>
        <div class="online-err" data-r="err"></div>
      </div>
      <div class="actions"><button class="btn ghost" data-act="back"><span data-i="back"></span></button></div>`;
    const name = () => (el.querySelector('[data-ctl=name]').value.trim() || 'Player');
    el.querySelector('[data-act=create]').onclick = () => { this.lobbyError(''); this.cb.onlineCreate?.(name()); };
    el.querySelector('[data-act=join]').onclick = () => { this.lobbyError(''); const code = el.querySelector('[data-ctl=code]').value.trim().toUpperCase(); this.cb.onlineJoin?.(name(), code); };
    el.querySelector('[data-act=back]').onclick = () => this.show('title');
    return el;
  }

  _lobbyScreen() {
    const el = div('screen');
    el.innerHTML = `
      <div class="panel lobby-panel">
        <h2>${eyeMini()} <span data-i="lobby"></span></h2>
        <div class="room-code"><span data-i="roomCode"></span>: <b data-r="code">----</b></div>
        <div class="player-list" data-r="players"></div>
        <div class="lobby-hint" data-r="hint"></div>
      </div>
      <div class="actions">
        <button class="btn" data-act="ready"><span data-r="readyLabel"></span></button>
        <button class="btn primary" data-act="start"><span data-i="startMatch"></span></button>
        <button class="btn ghost" data-act="leave"><span data-i="leaveRoom"></span></button>
      </div>`;
    el.querySelector('[data-act=ready]').onclick = () => { this._ready = !this._ready; this.cb.lobbyReady?.(this._ready); };
    el.querySelector('[data-act=start]').onclick = () => this.cb.lobbyStart?.();
    el.querySelector('[data-act=leave]').onclick = () => this.cb.lobbyLeave?.();
    return el;
  }

  showLobby(data, youId) {
    const el = this.screens.lobby, t = this.t();
    el.querySelector('[data-r=code]').textContent = data.code;
    const isHost = data.host === youId;
    const me = data.players.find((p) => p.id === youId);
    this._ready = me ? me.ready : false;
    el.querySelector('[data-r=players]').innerHTML = data.players.map((p) => {
      const role = p.role === 'watcher' ? t.roleWatcher : t.roleFaker;
      const tags = (p.id === data.host ? `<span class="tag host">${t.hostTag}</span>` : '')
        + `<span class="tag ${p.role}">${role}</span>`
        + (p.ready ? '<span class="tag ok">✓</span>' : '');
      return `<div class="prow ${p.id === youId ? 'me' : ''}"><span class="pname">${escapeHtml(p.name)}</span><span class="ptags">${tags}</span></div>`;
    }).join('');
    el.querySelector('[data-r=readyLabel]').textContent = this._ready ? t.cancelReady : t.ready;
    const startBtn = el.querySelector('[data-act=start]');
    startBtn.style.display = isHost ? '' : 'none';
    startBtn.disabled = data.players.length < 2;
    el.querySelector('[data-act=ready]').style.display = isHost ? 'none' : '';
    el.querySelector('[data-r=hint]').textContent = isHost ? (data.players.length < 2 ? t.needTwo : t.hostStartHint) : t.waitingHost;
    this.show('lobby');
  }

  lobbyError(msg) { const e = this.screens.online.querySelector('[data-r=err]'); if (e) e.textContent = msg || ''; }

  _howToScreen() {
    const el = div('screen');
    el.innerHTML = `
      <div class="panel">
        <h2>${eyeMini()} <span data-i="howto"></span></h2>
        <p class="lead" data-i="howToLead"></p>
        <div class="howto-grid">
          ${card('hMoveT', 'hMove')}
          ${card('hFreezeT', 'hFreeze')}
          ${card('hDisguiseT', 'hDisguise')}
          ${card('hSyncT', 'hSync')}
          ${card('hWatchT', 'hWatch')}
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" data-act="play"><span data-i="startRun"></span></button>
        <button class="btn ghost" data-act="back"><span data-i="back"></span></button>
      </div>`;
    el.querySelector('[data-act=play]').onclick = () => this.cb.play?.();
    el.querySelector('[data-act=back]').onclick = () => this.show('title');
    return el;
  }

  _settingsScreen() {
    const el = div('screen');
    el.innerHTML = `
      <div class="panel">
        <h2>${eyeMini()} <span data-i="settings"></span></h2>
        <div class="rows">
          <div class="row">
            <div><div class="label" data-i="language"></div></div>
            <div class="seg" data-seg="lang">
              <button data-val="en">EN</button><button data-val="ja">日本語</button>
            </div>
          </div>
          <div class="row">
            <div><div class="label" data-i="volume"></div></div>
            <input type="range" min="0" max="1" step="0.05" data-ctl="volume" />
          </div>
          <div class="row">
            <div><div class="label" data-i="colorblind"></div><div class="hint" data-i="cbHint"></div></div>
            <div class="toggle" data-ctl="colorblind" role="switch" tabindex="0"></div>
          </div>
          <div class="row">
            <div><div class="label" data-i="hudScale"></div></div>
            <div class="seg" data-seg="hud">
              <button data-val="0.85">S</button><button data-val="1">M</button><button data-val="1.2">L</button>
            </div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost" data-act="back"><span data-i="back"></span></button>
      </div>`;
    // wire controls
    el.querySelectorAll('[data-seg=lang] button').forEach((b) => b.onclick = () => {
      this.settings.lang = b.dataset.val; this.cb.settings?.(); this.refresh();
    });
    el.querySelectorAll('[data-seg=hud] button').forEach((b) => b.onclick = () => {
      this.settings.hudScale = parseFloat(b.dataset.val); this.cb.settings?.(); this._syncControls();
    });
    const vol = el.querySelector('[data-ctl=volume]');
    vol.oninput = () => { this.settings.volume = parseFloat(vol.value); this.cb.settings?.(); };
    const cb = el.querySelector('[data-ctl=colorblind]');
    const toggleCb = () => { this.settings.colorblind = !this.settings.colorblind; this.cb.settings?.(); this._syncControls(); };
    cb.onclick = toggleCb;
    cb.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCb(); } };
    el.querySelector('[data-act=back]').onclick = () => this.show(this._returnTo || 'title');
    return el;
  }

  _pauseScreen() {
    const el = div('screen overlay');
    el.innerHTML = `
      ${logoHTML(true)}
      <div class="verdict-sub" data-i="pausedTitle"></div>
      <div class="menu">
        <button class="btn primary" data-act="resume"><span data-i="resume"></span></button>
        <button class="btn" data-act="restart"><span data-i="restart"></span></button>
        <button class="btn ghost" data-act="settings"><span data-i="settings"></span></button>
        <button class="btn ghost" data-act="quit"><span data-i="quit"></span></button>
      </div>`;
    el.querySelector('[data-act=resume]').onclick = () => this.cb.resume?.();
    el.querySelector('[data-act=restart]').onclick = () => this.cb.restart?.();
    el.querySelector('[data-act=settings]').onclick = () => { this._returnTo = 'pause'; this.show('settings'); };
    el.querySelector('[data-act=quit]').onclick = () => this.cb.quit?.();
    return el;
  }

  _resultScreen() {
    const el = div('screen');
    el.innerHTML = `
      <div class="verdict" data-r="verdict"></div>
      <div class="verdict-sub" data-r="sub"></div>
      <div class="statgrid" data-r="stats"></div>
      <div class="actions">
        <button class="btn primary" data-act="restart"><span data-i="restart"></span></button>
        <button class="btn ghost" data-act="quit"><span data-i="quit"></span></button>
      </div>`;
    el.querySelector('[data-act=restart]').onclick = () => this.cb.restart?.();
    el.querySelector('[data-act=quit]').onclick = () => this.cb.quit?.();
    return el;
  }

  // data: { win, title, sub, stats:[{k,v}] }
  showResult(data) {
    const el = this.screens.result;
    const v = el.querySelector('[data-r=verdict]');
    v.textContent = data.title;
    v.className = 'verdict ' + (data.win ? 'win' : 'lose');
    el.querySelector('[data-r=sub]').textContent = data.sub || '';
    el.querySelector('[data-r=stats]').innerHTML = data.stats.map((s) => stat(s.k, s.v)).join('');
    this.show('result');
  }

  // ---------------- text/state sync ----------------
  _fill() {
    const t = this.t();
    this.root.querySelectorAll('[data-i]').forEach((n) => { n.textContent = t[n.dataset.i] ?? n.dataset.i; });
    this.root.querySelectorAll('[data-ph]').forEach((n) => { n.placeholder = t[n.dataset.ph] ?? n.dataset.ph; });
    this._syncControls();
  }

  _syncControls() {
    const s = this.settings;
    const set = this.screens.settings;
    if (!set) return;
    set.querySelectorAll('[data-seg=lang] button').forEach((b) => b.classList.toggle('on', b.dataset.val === s.lang));
    set.querySelectorAll('[data-seg=hud] button').forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.val) === s.hudScale));
    const vol = set.querySelector('[data-ctl=volume]'); if (vol) vol.value = s.volume;
    const cb = set.querySelector('[data-ctl=colorblind]'); if (cb) { cb.classList.toggle('on', s.colorblind); cb.setAttribute('aria-checked', s.colorblind); }
  }
}

// ---------- small builders ----------
function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
function eyeMini() {
  return `<svg width="26" height="16" viewBox="0 0 64 30" aria-hidden="true"><path d="M4 15 Q32 -6 60 15 Q32 36 4 15Z" fill="none" stroke="#F2F1EC" stroke-width="4"/><circle cx="32" cy="15" r="6" fill="#E53935"/></svg>`;
}
function card(titleKey, bodyKey) {
  return `<div class="howto-card"><h3 data-i="${titleKey}"></h3><p data-i="${bodyKey}"></p></div>`;
}
function stat(k, v) {
  return `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
