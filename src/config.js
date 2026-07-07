// Central configuration: palette, tunables, and localization.
// Values are drawn from docs/ART_DIRECTION.md and docs/DEVELOPMENT_SPEC.md.

export const PALETTE = {
  navy: '#0E1621',
  slate: '#242B36',
  offwhite: '#F2F1EC',
  gray: '#9AA3AD',
  red: '#E53935',
  amber: '#FFC107',
  green: '#2ECC71',
};

// Muted, desaturated clothing hues per the character design rules.
export const CLOTHING = [
  '#2b3550', // navy
  '#4a4f57', // charcoal gray
  '#6e5844', // brown
  '#c9bc9c', // beige
  '#6b6b3a', // olive
  '#5a7355', // muted green
  '#7c93a8', // dusty blue
  '#8a8f95', // gray
  '#7a5a56', // clay
  '#556b6e', // slate teal
];

export const SKIN = ['#e8c9a8', '#d9ad86', '#c68e63', '#a97748', '#8a5d3b'];
export const HAIR = ['#1c1a19', '#2b2320', '#3a2a1c', '#4a3526', '#6b5a48', '#20242b'];

// Gameplay tunables (Classic: Freeze Run defaults, adapted for single-Watcher solo play).
export const TUNING = {
  world: { w: 1680, h: 1040 },
  round: { seconds: 140 },

  // Light cycle (seconds) — punchy cadence so freeze decisions come fast.
  light: {
    greenMin: 5.5, greenMax: 8.5,
    redMin: 3.6, redMax: 5.6,
    warning: 1.0,          // Red Light warning length
    resumeStaggerMax: 0.5, // NPC resume offset
    firstGreen: 3.5,       // extra intro green so players orient
  },

  // Screen-feel effects.
  fx: { slowmo: 0.3, slowmoPlayer: 0.85, slowmoDecoy: 0.42 },

  faker: {
    walk: 118,             // px/s, close to NPC speed
    jog: 205,              // faster but suspicious
    turnRate: 7.5,         // rad/s cap to avoid unnatural snapping
    radius: 13,
  },

  npc: {
    walkMin: 96, walkMax: 132,
    radius: 13,
    idleMin: 1.6, idleMax: 5.5, // seconds spent at a waypoint
  },

  suspicion: {
    max: 100,
    moveOnRed: 44,     // per second while moving during Red Light
    jog: 9,            // per second while jogging on green
    sharpTurn: 16,     // impulse on a hard direction snap
    npcCollision: 10,  // impulse on bumping an NPC
    wrongContextAction: 22,
    isolation: 6,      // per second while far from any crowd
    facingChurn: 7,    // per second spinning the camera during red light
    // decays / rewards
    decayGreen: 5,     // passive calm per second on green while behaving
    validAction: -30,  // impulse for a valid context action
    goodFreeze: 9,     // per second frozen naturally in a good spot on red
    syncBonus: -22,    // impulse for a successful NPC Sync
    isolationRadius: 150, // distance beyond which you read as "isolated"
  },

  watcher: {
    marks: 5,               // accusation marks (false accusations consume marks)
    scanInterval: 0.45,     // seconds between suspicion re-evaluations
    reticleSpeed: 580,      // px/s the focus reticle travels
    lockTime: 0.85,         // seconds the reticle must dwell to accuse
    accuseThreshold: 58,    // perceived-human score needed to commit
    perceptionNoise: 14,    // random slack so the AI is beatable and fair
    onlyOnRed: true,        // accuses during Red Light (per spec)
  },

  disguise: {
    actionDuration: 2.4,    // seconds an action pose holds
    syncCooldown: 14,       // seconds (dev spec suggests 10-20)
    syncRange: 170,
  },

  // Freeze-conformity: the heart of the game. During Red Light a Faker is
  // judged by how far their frozen facing / pose / spacing drifts from the
  // local NPC crowd baseline — not merely by whether they moved.
  conform: {
    neighborRadius: 250,    // px: who counts as "the local crowd"
    facingTolDeg: 52,       // within this angle you read as aligned
    attractorRange: 360,    // NPCs face the nearest attractor within this
    redRise: 42,            // suspicion/sec at full human-ness on red
    goodFreeze: 30,         // suspicion/sec decay when well-blended
    tellShow: 0.30,         // human-ness above which a personal tell shows
  },

  // Player-Watcher tuning.
  watch: {
    marks: 6,
    pickRadius: 46,         // px from cursor to select a character
    viewW: 1720, viewH: 1080,
  },
};

// Blend Task objectives (Mission mode). `ctx` matches a disguise action; `red`
// tasks require standing in the zone during a Red Light.
export const MISSIONS = [
  { id: 'shop',    ctx: 'shop',    labelEN: 'Look at a shop window', labelJA: 'ショーウィンドウを見る' },
  { id: 'vending', ctx: 'vending', labelEN: 'Check a vending machine', labelJA: '自販機をチェック' },
  { id: 'bench',   ctx: 'bench',   labelEN: 'Sit on a bench', labelJA: 'ベンチに座る' },
  { id: 'cross',   ctx: 'sign', red: true, labelEN: 'Wait at the crossing on Red', labelJA: '赤の間、横断歩道で待つ' },
];

// Disguise / mimic actions. `ctx` is the interaction-zone tag that makes it valid.
export const ACTIONS = [
  { id: 'phone',     key: '1', icon: 'phone',    ctx: 'any',      labelEN: 'Phone',    labelJA: 'スマホ' },
  { id: 'shop',      key: '2', icon: 'shop',     ctx: 'shop',     labelEN: 'Shop Look',labelJA: 'ウィンドウ' },
  { id: 'vending',   key: '3', icon: 'vending',  ctx: 'vending',  labelEN: 'Vending',  labelJA: '自販機' },
  { id: 'sit',       key: '4', icon: 'bench',    ctx: 'bench',    labelEN: 'Bench Sit',labelJA: 'ベンチ' },
  { id: 'sign',      key: '5', icon: 'sign',     ctx: 'sign',     labelEN: 'Look Sign',labelJA: '看板' },
  { id: 'look',      key: '6', icon: 'look',     ctx: 'any',      labelEN: 'Look Around', labelJA: '見回す' },
];

// Localized UI strings. Keep text short — the game reads visually (dev spec §18).
export const I18N = {
  en: {
    play: 'Play', howto: 'How to Play', settings: 'Settings', back: 'Back',
    resume: 'Resume', restart: 'Restart', quit: 'Quit to Title', tutorial: 'Tutorial',
    subtitle: 'Blend into an NPC crowd. Freeze when the Red Light hits. But don’t just stop — stop like an NPC.',
    modeClassic: 'Classic · Freeze Run', modeSub: 'Reach the station gate without the Watcher catching you.',
    green: 'GREEN LIGHT', greenSub: 'Move. Blend in.',
    red: 'RED LIGHT', redSub: 'Stop. Don’t move.',
    warn: 'GET READY', warnSub: 'Red Light incoming…',
    survival: 'Survival', objective: 'Reach the Gate', marks: 'Marks', tension: 'Tension',
    sync: 'NPC Sync', ready: 'Ready', cooling: 'Cooling',
    win: 'You Blended In', winSub: 'The Faker reached the gate',
    lose: 'You Were Caught', loseSub: 'The Watcher read your body language',
    timeUp: 'Time’s Up', timeUpSub: 'The Watchers outlasted you',
    statTime: 'Survival', statProgress: 'To Goal', statActions: 'Disguises', statSync: 'Syncs Used',
    caught: 'CAUGHT', accused: 'ACCUSED',
    pausedTitle: 'Paused',
    language: 'Language', volume: 'Volume', colorblind: 'Colorblind Assist', hudScale: 'HUD Scale',
    cbHint: 'Adds shapes + text to the light signals',
    howToLead: 'You are a Faker hiding in the crowd. Reach the station gate. Don’t act human.',
    hMoveT: 'Move', hMove: 'WASD or Arrow keys to walk. Hold Shift to jog — faster, but the Watcher notices.',
    hFreezeT: 'Freeze', hFreeze: 'On RED LIGHT, stop completely. Moving spikes your Tension and gets you accused.',
    hDisguiseT: 'Disguise', hDisguise: 'Press 1–6 (or hold Q for the wheel) near the right spot — phone, bench, vending — to look natural.',
    hSyncT: 'NPC Sync', hSync: 'Press E near an NPC to copy its facing and pose. Great right before a freeze.',
    hWatchT: 'The Watcher', hWatch: 'During Red Light a focus reticle hunts the crowd. Stay boring and it moves on.',
    startRun: 'Start Run',
    tutHint1: 'Use WASD / Arrows to move toward the glowing gate.',
    tutHint2: 'RED LIGHT! Stop moving now.',
    tutHint3: 'Press E next to an NPC to sync your pose.',
    clickStart: 'Click or press any key to start',
    // mode select
    chooseMode: 'Choose a Mode',
    classicName: 'Classic · Freeze Run', classicDesc: 'Blend through the crowd to the gate while an AI Watcher hunts you.',
    missionName: 'Blend Task', missionDesc: 'Complete disguise tasks around the plaza, then reach the gate.',
    watchName: 'Watcher · Spot the Human', watchDesc: 'You watch the crowd. Find the hidden Fakers and accuse them.',
    // freeze tells (shown over your own head on Red)
    tellFacing: 'Wrong way', tellIso: 'Too alone', tellPose: 'Odd pose', tellMove: 'Moving!', tellOk: 'Blended',
    faceCrowd: 'Face where the crowd faces',
    penaltyT: 'YOU LOOK HUMAN', penaltySub: 'Match the crowd’s stance',
    bSpotted: 'SPOTTED!', bClose: 'CLOSE!', bCaught: 'CAUGHT', bGotcha: 'GOTCHA!', bSafe: 'SURVIVED', bMiss: 'MISFIRE',
    // watcher HUD / results
    fakersLeft: 'Fakers', accuseHint: 'RED LIGHT — click a suspect to accuse', pinHint: 'Right-click to pin a suspect',
    observeHint: 'GREEN — watch how they move', pinned: 'Pinned',
    watchWin: 'All Fakers Caught', watchWinSub: 'You read the crowd',
    watchLose: 'A Faker Escaped', watchLoseSub: 'One reached the gate',
    watchMarks: 'Out of Marks', watchMarksSub: 'Too many false accusations',
    watchTimeUp: 'Fakers Survived', watchTimeUpSub: 'You ran out of time',
    // missions
    objectives: 'Objectives', taskGate: 'Reach the gate', missionDone: 'Tasks done — reach the gate!',
    // reveal
    revealTitle: 'The humans were',
    statCaught: 'Caught', statAccuracy: 'Accuracy',
  },
  ja: {
    play: 'あそぶ', howto: 'あそびかた', settings: '設定', back: 'もどる',
    resume: 'つづける', restart: 'やりなおす', quit: 'タイトルへ', tutorial: 'チュートリアル',
    subtitle: 'NPCの群衆に紛れ、Red Lightでピタッと停止。動いていなくても、止まり方が人間っぽければバレる。',
    modeClassic: 'クラシック · Freeze Run', modeSub: '見抜かれずに駅の改札までたどり着け。',
    green: 'GREEN LIGHT', greenSub: '動いて、紛れろ。',
    red: 'RED LIGHT', redSub: '止まれ。動くな。',
    warn: 'そなえろ', warnSub: 'まもなく Red Light…',
    survival: '生存時間', objective: '改札まで', marks: '指摘', tension: '違和感',
    sync: 'NPC Sync', ready: '使用可', cooling: '待機中',
    win: '紛れきった', winSub: 'Faker は改札にたどり着いた',
    lose: '見抜かれた', loseSub: 'Watcher に人間らしさを読まれた',
    timeUp: '時間切れ', timeUpSub: 'Watcher に耐えきられた',
    statTime: '生存時間', statProgress: 'ゴール到達', statActions: '擬態回数', statSync: 'Sync回数',
    caught: 'CAUGHT', accused: 'ACCUSED',
    pausedTitle: '一時停止',
    language: '言語', volume: '音量', colorblind: '色覚サポート', hudScale: 'HUDサイズ',
    cbHint: '信号に形と文字を追加します',
    howToLead: 'あなたは群衆に紛れた Faker。駅の改札を目指せ。人間らしく振る舞うな。',
    hMoveT: '移動', hMove: 'WASD / 矢印で歩く。Shiftで小走り — 速いが目立つ。',
    hFreezeT: '停止', hFreeze: 'RED LIGHT では完全に止まれ。動くと違和感が跳ね上がり指摘される。',
    hDisguiseT: '擬態', hDisguise: '1〜6（またはQ長押しでホイール）。スマホ・ベンチ・自販機など、場所に合う擬態を。',
    hSyncT: 'NPC Sync', hSync: 'NPCの近くでEを押すと向きとポーズを真似る。停止直前に有効。',
    hWatchT: 'Watcher', hWatch: 'Red Light中、監視レティクルが群衆を探る。退屈でいれば通り過ぎる。',
    startRun: 'はじめる',
    tutHint1: 'WASD / 矢印で、光る改札へ向かおう。',
    tutHint2: 'RED LIGHT！ いますぐ止まれ。',
    tutHint3: 'NPCの隣でEを押してポーズを合わせよう。',
    clickStart: 'クリックまたはキーで開始',
    // mode select
    chooseMode: 'モード選択',
    classicName: 'クラシック · Freeze Run', classicDesc: 'AI Watcherに見抜かれずに、群衆に紛れて改札へ。',
    missionName: 'Blend Task', missionDesc: '広場で擬態ミッションをこなし、改札を目指せ。',
    watchName: 'Watcher · 人間を探せ', watchDesc: 'あなたが監視者。群衆に紛れたFakerを見つけて指摘しろ。',
    // freeze tells
    tellFacing: '向きがズレてる', tellIso: '一人ぼっち', tellPose: 'ポーズが変', tellMove: '動いてる！', tellOk: '紛れてる',
    faceCrowd: '群衆と同じ向きを向け',
    penaltyT: '人間っぽい', penaltySub: '群衆と同じ姿勢に',
    bSpotted: '見つかった！', bClose: 'あぶない！', bCaught: '御用', bGotcha: '確保！', bSafe: '逃げ切った', bMiss: '誤指摘',
    // watcher HUD / results
    fakersLeft: 'Faker', accuseHint: 'RED LIGHT — 怪しい人をクリックして指摘', pinHint: '右クリックでマーク',
    observeHint: 'GREEN — 動きをよく見ろ', pinned: 'マーク中',
    watchWin: '全員捕まえた', watchWinSub: '群衆を読み切った',
    watchLose: 'Fakerに逃げられた', watchLoseSub: '改札に到達された',
    watchMarks: '指摘切れ', watchMarksSub: '誤指摘が多すぎた',
    watchTimeUp: 'Fakerが生き残った', watchTimeUpSub: '時間切れ',
    // missions
    objectives: 'ミッション', taskGate: '改札にたどり着く', missionDone: 'ミッション完了 — 改札へ！',
    // reveal
    revealTitle: '人間はこの中に',
    statCaught: '捕まえた', statAccuracy: '正解率',
  },
};
