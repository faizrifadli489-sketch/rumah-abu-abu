import * as THREE from 'three';

/* ============================================================
   RUMAH ABU-ABU — horror 3D
   ============================================================ */

const CELL = 4, COLS = 8, ROWS = 8;
const MAP_W = COLS * 2 + 1, MAP_H = ROWS * 2 + 1;
const WALL_H = 3.4;
const WX = MAP_W * CELL, WZ = MAP_H * CELL;

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const startOverlay = $('#startOverlay'), dieOverlay = $('#dieOverlay'), winOverlay = $('#winOverlay');
const noteEl = $('#note'), flashHUD = $('#flashHUD'), barSenter = $('#barSenter span');
const jumpscareEl = $('#jumpscare'), jsCanvas = jumpscareEl.querySelector('canvas');
const flashVign = $('#flashVign'), hintEl = $('#hint'), loadingEl = $('#loading');
const joyL = $('#joyL'), joyR = $('#joyR'), knobL = joyL.querySelector('.knob'), knobR = joyR.querySelector('.knob');

function note(text, ms = 2200) {
  noteEl.textContent = text;
  noteEl.classList.add('show');
  clearTimeout(note._t);
  note._t = setTimeout(() => noteEl.classList.remove('show'), ms);
}

/* ---------- AUDIO (disintesis, tanpa file) ---------- */
const A = { ctx: null, master: null, droneGain: null, droneNodes: [], noise: null };

function audioInit() {
  if (A.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  A.ctx = new Ctx();
  A.master = A.ctx.createGain();
  A.master.gain.value = 0.85;
  A.master.connect(A.ctx.destination);

  // white-noise buffer dipakai ulang
  const len = A.ctx.sampleRate * 2;
  const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noise = buf;

  // drone latar (diredam, volumenya naik saat bahaya dekat)
  const dg = A.ctx.createGain(); dg.gain.value = 0.0; dg.connect(A.master);
  const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 2;
  lp.connect(dg);
  [41, 41.6, 82.3].forEach((f) => {
    const o = A.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    const g = A.ctx.createGain(); g.gain.value = 0.33;
    o.connect(g); g.connect(lp); o.start();
    A.droneNodes.push(o);
  });
  A.droneGain = dg;
}

function sfxThump(vol = 0.9, freq = 62) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime, o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.35);
}

function sfxWhisper(pan = 0) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime, s = A.ctx.createBufferSource(), bp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
  s.buffer = A.noise; s.playbackRate.value = 0.75 + Math.random() * 0.6;
  bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1400; bp.Q.value = 8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  const p = A.ctx.createStereoPanner ? A.ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; s.connect(bp); bp.connect(g); g.connect(p); p.connect(A.master); }
  else { s.connect(bp); bp.connect(g); g.connect(A.master); }
  s.start(t); s.stop(t + 1.2);
}

function sfxPickup() {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  [660, 990, 1320].forEach((f, i) => {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.07 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.45);
    o.connect(g); g.connect(A.master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.5);
  });
}

function sfxStep() {
  if (!A.ctx) return;
  const t = A.ctx.currentTime, s = A.ctx.createBufferSource(), lp = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
  s.buffer = A.noise; s.playbackRate.value = 0.35;
  lp.type = 'lowpass'; lp.frequency.value = 320;
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  s.connect(lp); lp.connect(g); g.connect(A.master); s.start(t); s.stop(t + 0.15);
}

function sfxScream() {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = i === 0 ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(420 + i * 130, t);
    o.frequency.exponentialRampToValueAtTime(70 + i * 10, t + 1.0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 1.2);
  }
  const s = A.ctx.createBufferSource(), g2 = A.ctx.createGain(), hp = A.ctx.createBiquadFilter();
  s.buffer = A.noise; hp.type = 'highpass'; hp.frequency.value = 700;
  g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  s.connect(hp); hp.connect(g2); g2.connect(A.master); s.start(t); s.stop(t + 1.0);
}

/* ---------- MAZE ---------- */
let map = [];
function genMaze() {
  const m = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(1));
  const seen = new Set(), key = (x, y) => x + ',' + y;
  const stack = [[0, 0]]; seen.add(key(0, 0)); m[1][1] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(key(nx, ny));
    });
    if (!dirs.length) { stack.pop(); continue; }
    const [dx, dy] = dirs[(Math.random() * dirs.length) | 0];
    const nx = cx + dx, ny = cy + dy;
    seen.add(key(nx, ny));
    m[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
    m[ny * 2 + 1][nx * 2 + 1] = 0;
    stack.push([nx, ny]);
  }
  // buka sebagian dinding -> lorong bercabang, terasa lebih luas & menyeramkan
  const openings = Math.floor(COLS * ROWS * 0.55);
  for (let i = 0; i < openings; i++) {
    const x = 1 + ((Math.random() * (MAP_W - 2)) | 0);
    const y = 1 + ((Math.random() * (MAP_H - 2)) | 0);
    const isPillar = x % 2 === 0 && y % 2 === 0;
    const isWallBetween = (x % 2 === 0) !== (y % 2 === 0);
    if (!isPillar && isWallBetween) m[y][x] = 0;
  }
  return m;
}

const cellToWorld = (cx, cy) => new THREE.Vector3(
  (cx - MAP_W / 2 + 0.5) * CELL, 0, (cy - MAP_H / 2 + 0.5) * CELL
);
const worldToCell = (wx, wz) => [
  Math.floor(wx / CELL + MAP_W / 2),
  Math.floor(wz / CELL + MAP_H / 2),
];
function isWall(wx, wz) {
  const [cx, cy] = worldToCell(wx, wz);
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return true;
  return map[cy][cx] === 1;
}
function collides(wx, wz, r) {
  return isWall(wx - r, wz - r) || isWall(wx + r, wz - r) ||
         isWall(wx - r, wz + r) || isWall(wx + r, wz + r);
}
function floorCells() {
  const out = [];
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++)
      if (map[y][x] === 0) out.push([x, y]);
  return out;
}

/* ---------- TEXTURES ---------- */
function noiseTex(base, speck, repeat = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = speck;
  for (let i = 0; i < 2600; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = Math.random() * 2;
    g.beginPath(); const x = Math.random() * 256; g.moveTo(x, 0); g.lineTo(x + (Math.random() * 20 - 10), 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  return t;
}

/* ---------- STATE ---------- */
let scene, camera, renderer;
let player, flashlight, spotTarget;
let keys3 = [], exitDoor = null, exitPos = null, exitLight = null;
let monster, foeEyes = [];
const keysHeld = new Set();
let haveKeys = 0;
let gameState = 'menu';
let yaw = 0, pitch = 0;
let vel = new THREE.Vector3();
let stamina = 100, battery = 100, flashlightOn = true;
let elapsed = 0, distance = 0;
let stepTimer = 0, damage = 0;
let foeTarget = new THREE.Vector3(), foeRepath = 0, foeMode = 'wander';
let foePath = [], lastKnown = new THREE.Vector3(), forgetTimer = 0;
let danger = 0, whisperTimer = 12 + Math.random() * 12;
let beatTimer = 0, flicker = 0, caught = false;
let flickerLights = [];

/* ---------- INIT RENDERER (hanya sekali) ---------- */
function initRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
  } catch (err) {
    loadingEl.style.display = 'flex';
    loadingEl.style.color = '#c66';
    loadingEl.style.textAlign = 'center';
    loadingEl.style.padding = '0 30px';
    loadingEl.innerHTML = 'GAGAL MEMULAI 3D<br><br>Browser di perangkat ini tidak mendukung WebGL.<br>' +
      'Coba: perbarui browser, aktifkan akselerasi hardware,<br>atau buka di browser/HP lain (Chrome, Firefox, Safari).';
    throw err;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.inset = '0';

  camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // objek yang menempel di kamera (senter) cukup dibuat sekali
  flashlight = new THREE.SpotLight(0xffe6b3, 42, 34, Math.PI / 7, 0.42, 1.1);
  flashlight.position.set(0, 0, 0);
  spotTarget = new THREE.Object3D(); spotTarget.position.set(0, 0, -1);
  camera.add(flashlight); camera.add(spotTarget);
  flashlight.target = spotTarget;
}

/* ---------- BANGUN DUNIA (tiap mulai game) ---------- */
function buildWorld() {
  // dispose scene lama + lepas kamera (kamera berisi senter, dipakai ulang)
  if (scene) {
    scene.remove(camera);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.075);

  scene.add(new THREE.AmbientLight(0x101820, 0.35));

  // ---- lantai & langit-langit ----
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WX, WZ),
    new THREE.MeshStandardMaterial({ map: noiseTex('#141416', 'rgba(255,255,255,0.05)', 30), roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(WX, WZ),
    new THREE.MeshStandardMaterial({ map: noiseTex('#0d0d10', 'rgba(255,255,255,0.03)', 22), roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
  scene.add(ceil);

  // ---- dinding (instanced) ----
  const wallMat = new THREE.MeshStandardMaterial({
    map: noiseTex('#2a2622', 'rgba(0,0,0,0.35)', 2), roughness: 0.95, metalness: 0.02,
  });
  const cells = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[y][x] === 1) cells.push([x, y]);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMat, cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach(([x, y], i) => {
    const p = cellToWorld(x, y);
    m4.makeTranslation(p.x, WALL_H / 2, p.z);
    inst.setMatrixAt(i, m4);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  // ---- pemain ----
  const startP = cellToWorld(1, 1);
  player = { pos: startP.clone(), r: 0.55 };
  camera.position.set(startP.x, 1.68, startP.z);

  // ---- senter: pastikan terpasang di kamera (kamera dipakai ulang) ----
  scene.add(camera);
  flashlight.visible = true;
  flashlight.intensity = 42;

  // rakitan lampu redup yang bisa berkedip
  const dimSpots = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffdcae, 0, 12, 2);
    l.userData.base = 0;
    dimSpots.push(l);
    scene.add(l);
  }
  flickerLights = dimSpots;

  // ---- posisi objek-posisi penting ----
  const floors = floorCells();
  const startCell = [1, 1];
  const far = floors
    .map(([x, y]) => ({ x, y, d: Math.hypot(x - startCell[0], y - startCell[1]) }))
    .sort((a, b) => b.d - a.d);

  // pintu keluar = cell terjauh
  exitPos = cellToWorld(far[0].x, far[0].y);
  const doorGeo = new THREE.PlaneGeometry(2.4, 2.9);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x0affa0, emissive: 0x0affa0, emissiveIntensity: 1.1,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  exitDoor = new THREE.Mesh(doorGeo, doorMat);
  exitDoor.position.set(exitPos.x, 1.5, exitPos.z);
  scene.add(exitDoor);
  exitLight = new THREE.PointLight(0x33ffaa, 3.2, 16, 2);
  exitLight.position.set(exitPos.x, 1.6, exitPos.z);
  scene.add(exitLight);

  // 3 kunci tersebar
  const chosen = [];
  const pool = far.filter((c) => c.d > 4);
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  const keyGeo = new THREE.TorusKnotGeometry(0.22, 0.075, 90, 12);
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0xffd35c, emissive: 0xffb300, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.3,
  });
  chosen.forEach((c, i) => {
    const p = cellToWorld(c.x, c.y);
    const k = new THREE.Mesh(keyGeo, keyMat);
    k.position.set(p.x, 1.15, p.z);
    k.userData.pickLight = null;
    const pl = new THREE.PointLight(0xffc247, 2.0, 8, 2);
    pl.position.copy(k.position);
    scene.add(k); scene.add(pl);
    keys3.push({ mesh: k, light: pl, taken: false, i: keys3.length });
  });

  // ---- sosok pengejar ----
  const mg = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.55, metalness: 0.15 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.5, 6, 14), bodyMat);
  torso.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), bodyMat);
  head.position.y = 2.42; head.scale.set(0.9, 1.15, 0.9);
  mg.add(torso, head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });
  [-0.13, 0.13].forEach((dx) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
    e.position.set(dx, 2.45, -0.29);
    mg.add(e); foeEyes.push(e);
  });
  const gl = new THREE.PointLight(0xff2020, 1.1, 5, 2);
  gl.position.set(0, 2.4, -0.3);
  mg.add(gl);
  monster = mg;
  scene.add(monster);

  // spawn jauh dari pemain
  const spawn = far[Math.min(2, far.length - 1)];
  const sp = cellToWorld(spawn.x, spawn.y);
  monster.position.copy(sp);
  foeTarget.copy(player.pos);

  loadingEl.classList.add('hidden');
  keysHeld.clear();
}

/* ---------- INPUT ---------- */
const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) keysHeld.add(KEYMAP[e.code]);
  if (e.code === 'KeyF') toggleFlash();
  if (e.code === 'KeyP' && gameState === 'playing') {
    paused = !paused;
    if (paused) {
      if (A.droneGain) A.droneGain.gain.value = 0;
      note('⏸ TERJEDA — tekan P untuk lanjut', 100000);
    } else {
      note('▶ LANJUT', 1200);
      clock.getDelta();
    }
  }
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keysHeld.delete(KEYMAP[e.code]); });

function toggleFlash() {
  if (gameState !== 'playing' || battery <= 0) return;
  flashlightOn = !flashlightOn;
  flashlight.visible = flashlightOn;
  flashHUD.textContent = flashlightOn ? '🔦 SENTER: ON' : '🔦 SENTER: OFF';
}

/* mouse look + pointer lock */
addEventListener('mousemove', (e) => {
  if (gameState !== 'playing' || isTouch) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0023;
  pitch -= e.movementY * 0.0023;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});
function requestLock() {
  const el = renderer.domElement;
  if (!isTouch && el.requestPointerLock) {
    // Chrome modern mengembalikan Promise; kalau ditolak, jangan sampai unhandled rejection
    const p = el.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
}

/* touch joystick */
const joy = {
  L: { id: null, x: 0, y: 0 },
  R: { id: null, x: 0, y: 0 },
};
function bindJoy(el, knob, side) {
  const R = 52;
  const center = () => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    joy[side].id = e.pointerId;
    move(e);
  });
  el.addEventListener('pointermove', (e) => { if (joy[side].id === e.pointerId) move(e); });
  const end = (e) => {
    if (joy[side].id !== e.pointerId) return;
    joy[side].id = null; joy[side].x = joy[side].y = 0;
    knob.style.transform = 'translate(-50%,-50%)';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  function move(e) {
    const c = center();
    let dx = e.clientX - c.x, dy = e.clientY - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    dx = dx / len * cl; dy = dy / len * cl;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy[side].x = dx / R; joy[side].y = dy / R;
  }
}
bindJoy(joyL, knobL, 'L');
bindJoy(joyR, knobR, 'R');

/* ---------- JUMPSCARE ---------- */
function drawScareFace(t) {
  const c = jsCanvas; c.width = innerWidth; c.height = innerHeight;
  const g = c.getContext('2d');
  const w = c.width, h = c.height, cx = w / 2, cy = h / 2 + Math.sin(t * 30) * 6;
  const s = Math.min(w, h) * 0.34 * (1 + Math.sin(t * 22) * 0.05);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  // kepala pucat
  const grad = g.createRadialGradient(cx, cy, s * 0.2, cx, cy, s);
  grad.addColorStop(0, '#e9e4dc'); grad.addColorStop(0.7, '#b9b1a6'); grad.addColorStop(1, '#2a2622');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(cx, cy, s * 0.72, s, 0, 0, Math.PI * 2); g.fill();
  // mata
  const jitter = () => (Math.random() - 0.5) * 10;
  [-1, 1].forEach((side) => {
    const ex = cx + side * s * 0.3 + jitter(), ey = cy - s * 0.22 + jitter();
    g.fillStyle = 'rgba(0,0,0,0.92)';
    g.beginPath(); g.ellipse(ex, ey, s * 0.16, s * 0.12, side * 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff1a1a';
    g.beginPath(); g.arc(ex, ey, s * 0.045, 0, Math.PI * 2); g.fill();
    g.shadowColor = '#ff0000'; g.shadowBlur = 40;
    g.beginPath(); g.arc(ex, ey, s * 0.045, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  });
  // mulut terbuka + gigi
  g.fillStyle = '#120404';
  g.beginPath(); g.ellipse(cx, cy + s * 0.52, s * 0.34, s * 0.24, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8d2c6';
  for (let i = 0; i < 9; i++) {
    const tx = cx - s * 0.3 + i * (s * 0.6 / 8);
    g.beginPath(); g.moveTo(tx, cy + s * 0.3);
    g.lineTo(tx + s * 0.05, cy + s * 0.3); g.lineTo(tx + s * 0.025, cy + s * 0.44);
    g.closePath(); g.fill();
  }
  // noise film
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.13})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.globalAlpha = 0.35; g.fillStyle = '#500'; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
}

function triggerJumpscare(cause) {
  if (caught) return;
  caught = true; gameState = 'dead';
  if (A.droneGain) A.droneGain.gain.value = 0;
  sfxScream();
  jumpscareEl.style.display = 'flex';
  const t0 = performance.now();
  (function anim() {
    const t = (performance.now() - t0) / 1000;
    drawScareFace(t);
    if (t < 1.15) requestAnimationFrame(anim);
    else {
      jumpscareEl.style.display = 'none';
      dieOverlay.classList.remove('hidden');
      $('#dieCause').textContent = cause;
      $('#dieProgress').textContent = `Kunci terkumpul: ${haveKeys}/3 · Bertahan ${fmt(elapsed)}`;
      if (document.exitPointerLock) document.exitPointerLock();
    }
  })();
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- LOOP ---------- */
const clock = new THREE.Clock();
let paused = false;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameState !== 'playing' || paused) { renderer.render(scene, camera); return; }
  elapsed += dt;

  /* --- gerak pemain --- */
  let mf = 0, ms = 0;
  if (keysHeld.has('fwd')) mf += 1;
  if (keysHeld.has('back')) mf -= 1;
  if (keysHeld.has('right')) ms += 1;
  if (keysHeld.has('left')) ms -= 1;
  if (joy.L.id !== null) { mf += -joy.L.y; ms += joy.L.x; }

  const mag = Math.hypot(mf, ms);
  if (mag > 1) { mf /= mag; ms /= mag; }

  const wantSprint = keysHeld.has('sprint') && stamina > 1 && mag > 0.1;
  const speed = wantSprint ? 5.6 : 3.0;
  if (wantSprint) stamina = Math.max(0, stamina - dt * 15);
  else stamina = Math.min(100, stamina + dt * 11);

  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const vx = (fx * mf + rx * ms) * speed;
  const vz = (fz * mf + rz * ms) * speed;

  let nx = player.pos.x + vx * dt, nz = player.pos.z + vz * dt;
  if (!collides(nx, player.pos.z, player.r)) player.pos.x = nx;
  if (!collides(player.pos.x, nz, player.r)) player.pos.z = nz;
  distance += Math.hypot(vx * dt, vz * dt);

  // langkah kaki + goyangan kamera
  if (mag > 0.15) {
    stepTimer -= dt * (wantSprint ? 2.3 : 1.35);
    if (stepTimer <= 0) { stepTimer = 0.5; sfxStep(); }
  }
  const bob = mag > 0.15 ? Math.sin(elapsed * (wantSprint ? 13 : 8.5)) * (wantSprint ? 0.055 : 0.035) : 0;
  camera.position.set(player.pos.x, 1.68 + bob, player.pos.z);
  camera.rotation.set(pitch, yaw, Math.sin(elapsed * 6) * 0.004 + (damage > 0 ? (Math.random() - 0.5) * 0.05 : 0));

  // lihat kanan (HP)
  if (joy.R.id !== null) {
    yaw -= joy.R.x * dt * 2.3;
    pitch -= joy.R.y * dt * 1.9;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  }

  /* --- senter & baterai --- */
  if (flashlightOn) {
    battery = Math.max(0, battery - dt * 1.15);
    if (battery <= 0) { flashlightOn = false; flashlight.visible = false; flashHUD.textContent = '🔦 SENTER: MATI'; note('Baterai habis…', 2000); }
  } else battery = Math.min(100, battery + dt * 0.7);
  barSenter.style.width = battery + '%';

  if (flicker > 0) {
    flicker -= dt;
    const on = Math.random() > 0.4;
    flashlight.intensity = on ? 42 : 6;
    flashVign.style.display = on ? 'none' : 'block';
    if (flicker <= 0) { flashVign.style.display = 'none'; flashlight.intensity = 42; }
  }

  /* --- kunci --- */
  keys3.forEach((k) => {
    if (k.taken) return;
    k.mesh.rotation.y += dt * 1.4;
    k.mesh.rotation.x += dt * 0.7;
    k.mesh.position.y = 1.15 + Math.sin(elapsed * 2 + k.i) * 0.14;
    const d = Math.hypot(k.mesh.position.x - player.pos.x, k.mesh.position.z - player.pos.z);
    if (d < 1.5) {
      k.taken = true; haveKeys++;
      scene.remove(k.mesh); scene.remove(k.light);
      sfxPickup();
      note(haveKeys >= 3
        ? 'Selesai! Cari pintu hijau untuk keluar.'
        : `Kunci didapat (${haveKeys}/3)`, 2600);
      if (haveKeys >= 3) exitLight.intensity = 6;
    }
  });

  /* --- pintu keluar --- */
  exitDoor.material.emissiveIntensity = 1.0 + Math.sin(elapsed * 3) * 0.35;
  const dExit = Math.hypot(exitPos.x - player.pos.x, exitPos.z - player.pos.z);
  if (dExit < 2.0) {
    if (haveKeys >= 3) { winGame(); return; }
    if (elapsed - (note._lastExit || -9) > 3) { note._lastExit = elapsed; note('Terkunci. Butuh 3 kunci.', 1800); }
  }

  /* --- SOSOK: AI (BFS pathfinding + pendengaran) --- */
  const pd = new THREE.Vector3(player.pos.x, 0, player.pos.z);
  const dist = pd.distanceTo(new THREE.Vector3(monster.position.x, 0, monster.position.z));

  const seesPlayer = dist < 24 && hasLOS(monster.position, pd);
  const heardPlayer = dist < 7.5; // mendengar langkah walau tanpa garis pandang
  foeRepath -= dt;

  if (seesPlayer || heardPlayer) {
    foeMode = 'chase';
    lastKnown.copy(pd);        // ingat posisi terakhir yang diketahui
    forgetTimer = 6.5;         // terus mencari selama ini
  } else if (foeMode === 'chase') {
    forgetTimer -= dt;
    if (forgetTimer <= 0) foeMode = 'wander';
  }

  if (foeMode === 'chase') foeTarget.copy(lastKnown);
  else if (foeRepath <= 0) {
    const f = floorCells();
    const c = f[(Math.random() * f.length) | 0];
    foeTarget.copy(cellToWorld(c[0], c[1]));
  }

  if (foeRepath <= 0) {
    foeRepath = foeMode === 'chase' ? 0.35 : 3.0 + Math.random() * 2;
    // hitung ulang rute BFS menuju target
    foePath = findPath(monster.position, foeTarget);
  }

  // ikuti rute, satu titik per waktu
  const spd = foeMode === 'chase' ? 3.2 : 1.1;
  while (foePath.length && monster.position.distanceTo(foePath[0]) < 1.1) foePath.shift();
  const aim = foePath.length ? foePath[0] : foeTarget;
  const dir = new THREE.Vector3().subVectors(aim, monster.position); dir.y = 0;
  if (dir.length() > 0.05) {
    dir.normalize();
    const step = spd * dt;
    const nx = monster.position.x + dir.x * step;
    const nz = monster.position.z + dir.z * step;
    if (!collides(nx, monster.position.z, 0.42)) monster.position.x = nx;
    if (!collides(monster.position.x, nz, 0.42)) monster.position.z = nz;
    const targetYaw = Math.atan2(dir.x, dir.z);
    let d = targetYaw - monster.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    monster.rotation.y += d * Math.min(1, dt * 6);
  }

  // animasi sosok
  monster.position.y = Math.sin(elapsed * (foeMode === 'chase' ? 7 : 2.4)) * 0.06;
  monster.scale.setScalar(foeMode === 'chase' ? 1.06 : 1);
  foeEyes.forEach((e) => { e.material.color.setHex(foeMode === 'chase' ? 0xff0000 : 0x992222); });

  /* --- PROXIMITY: jantung, drone, getar --- */
  const raw = Math.max(0, 1 - dist / 22);
  danger += (raw - danger) * Math.min(1, dt * 2);
  A.droneGain && (A.droneGain.gain.value = 0.02 + danger * 0.16);
  beatTimer -= dt * (0.8 + danger * 2.6);
  if (beatTimer <= 0 && danger > 0.06) {
    beatTimer = 1;
    sfxThump(0.25 + danger * 0.8);
    if (danger > 0.55) sfxThump(0.18 + danger * 0.5, 46);
    if (isTouch && 'vibrate' in navigator && danger > 0.5) navigator.vibrate(18);
  }
  damage = Math.max(0, damage - dt);
  if (dist < 1.45 && hasLOS(monster.position, pd)) {
    triggerJumpscare('Sosok abu-abu itu meraihmu.');
    return;
  }

  /* --- kejadian acak: bisikan + lampu berkedip --- */
  whisperTimer -= dt;
  if (whisperTimer <= 0) {
    whisperTimer = 14 + Math.random() * 16;
    const pan = (player.pos.x - monster.position.x) * 0.02;
    sfxWhisper(Math.max(-1, Math.min(1, pan)));
    if (Math.random() < 0.4) { flicker = 1.1; }
    if (Math.random() < 0.22) {
      const l = flickerLights[(Math.random() * flickerLights.length) | 0];
      const c = floorCells()[(Math.random() * floorCells().length) | 0];
      const p = cellToWorld(c[0], c[1]);
      l.position.set(p.x, WALL_H - 0.5, p.z);
      l.intensity = 4 + Math.random() * 3;
      l.userData.base = l.intensity;
      const base = l.userData.base;
      let t = 0;
      const tick = setInterval(() => {
        t += 0.09;
        l.intensity = base * (0.35 + Math.random() * 0.9) * Math.max(0, 1 - t / 1.6);
        if (t > 1.6) { clearInterval(tick); l.intensity = 0; }
      }, 90);
    }
  }

  updateHUD();
  renderer.render(scene, camera);
}

function hasLOS(from, to, steps = 30) {
  const a = new THREE.Vector3(from.x, 0, from.z);
  const b = new THREE.Vector3(to.x, 0, to.z);
  for (let i = 1; i < steps; i++) {
    const p = a.clone().lerp(b, i / steps);
    if (isWall(p.x, p.z)) return false;
  }
  return true;
}

/* BFS di grid labirin -> daftar titik jalan (world space).
   Jauh lebih andal daripada sekadar jalan lurus ke target. */
function findPath(fromPos, toPos) {
  const [sx, sy] = worldToCell(fromPos.x, fromPos.z);
  const [gx, gy] = worldToCell(toPos.x, toPos.z);
  const idx = (x, y) => y * MAP_W + x;
  const valid = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && map[y][x] === 0;
  if (!valid(sx, sy) || !valid(gx, gy)) return [];

  const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
  const seen = new Uint8Array(MAP_W * MAP_H);
  const queue = [idx(sx, sy)];
  seen[idx(sx, sy)] = 1;
  const goal = idx(gx, gy);
  let head = 0, found = false;

  while (head < queue.length && !found) {
    const cur = queue[head++];
    if (cur === goal) { found = true; break; }
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of nb) {
      if (!valid(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
      if (ni === goal) { found = true; break; }
    }
  }
  if (!seen[goal]) return [];

  // rekonstruksi lintasan (buang sel awal — monster sudah ada di sana)
  const cells = [];
  for (let c = goal; c !== -1; c = prev[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => cellToWorld(c % MAP_W, (c / MAP_W) | 0));
  if (pts.length > 1) pts.shift();
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0 || i === pts.length - 1) { out.push(pts[i]); continue; }
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) > 0.001) out.push(b); // simpan hanya saat arah berubah (tikungan)
  }
  return out;
}

function updateHUD() {
  const near = Math.hypot(monster.position.x - player.pos.x, monster.position.z - player.pos.z);
  document.title = near < 8 ? '⚠ ADA DI DEKATMU' : 'RUMAH ABU-ABU';
}

/* ---------- FLOW GAME ---------- */
function winGame() {
  gameState = 'win';
  sfxPickup();
  $('#winStats').textContent = `Waktu keluar: ${fmt(elapsed)} · Jarak ditempuh: ${distance.toFixed(0)} m · Baterai sisa: ${battery.toFixed(0)}%`;
  winOverlay.classList.remove('hidden');
  if (document.exitPointerLock) document.exitPointerLock();
}

function startGame() {
  audioInit();
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();

  // reset
  map = genMaze();
  keys3 = []; foeEyes = []; haveKeys = 0; elapsed = 0; distance = 0;
  stamina = 100; battery = 100; flashlightOn = true; danger = 0; caught = false;
  yaw = 0; pitch = 0; paused = false; flicker = 0; stepTimer = 0; damage = 0;
  whisperTimer = 12 + Math.random() * 12; beatTimer = 0;
  foePath = []; foeMode = 'wander'; foeRepath = 0; forgetTimer = 0;
  flashVign.style.display = 'none';
  startOverlay.classList.add('hidden');
  dieOverlay.classList.add('hidden');
  winOverlay.classList.add('hidden');
  jumpscareEl.style.display = 'none';

  buildWorld();
  flashlight.visible = true;
  flashHUD.textContent = '🔦 SENTER: ON';
  gameState = 'playing';
  hintEl.textContent = isTouch ? '' : 'Klik untuk mengunci mouse · WASD gerak · F senter · Shift lari';
  note('Cari 3 kunci. Jangan biarkan dia melihatmu.', 3200);
  if (!isTouch) requestLock();
  checkTouchUI();
  clock.getDelta();
}

/* hook debug ringan: dipakai untuk pengujian otomatis */
window.__GAME = {
  get state() { return gameState; },
  get player() { return player ? { x: player.pos.x, z: player.pos.z } : null; },
  get monster() { return monster ? { x: monster.position.x, z: monster.position.z, mode: foeMode } : null; },
  get camera() { return camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw, pitch } : null; },
  get stats() { return { haveKeys, battery, stamina, elapsed, distance, danger }; },
  get keysLeft() { return keys3.filter((k) => !k.taken).length; },
  get ai() { return { mode: foeMode, pathLen: foePath.length, forget: forgetTimer }; },
  get exit() { return exitPos ? { x: exitPos.x, z: exitPos.z } : null; },
  /* teleport ke sebuah kunci, untuk menguji alur pengambilan kunci */
  tpToKey(i) {
    const k = keys3.filter((x) => !x.taken)[i];
    if (!k) return false;
    player.pos.set(k.mesh.position.x, 0, k.mesh.position.z);
    return true;
  },
  tpToExit() { if (exitPos) player.pos.set(exitPos.x, 0, exitPos.z); },
  tpNearMonster(d = 2) {
    player.pos.set(monster.position.x + d, 0, monster.position.z);
  },
  /* utilitas peta untuk pengujian */
  isWall: (x, z) => isWall(x, z),
  cellToWorld: (cx, cy) => { const v = cellToWorld(cx, cy); return { x: v.x, z: v.z }; },
  worldToCell: (x, z) => worldToCell(x, z),
  floorCells: () => floorCells().slice(0, 500),
  setMonster(x, z) { monster.position.set(x, 0, z); foePath = []; foeRepath = 0; },
  setPlayer(x, z) { player.pos.set(x, 0, z); },
  /* jalankan pencarian jalur langsung untuk diuji */
  testPath(fromCell, toCell) {
    const a = cellToWorld(fromCell[0], fromCell[1]);
    const b = cellToWorld(toCell[0], toCell[1]);
    return findPath(a, b).length;
  },
  /* probe tampilan: render ke render target lalu baca piksel.
     (membaca framebuffer utama tidak andal saat antialias aktif) */
  probe(w = 120, h = 68) {
    const rt = new THREE.WebGLRenderTarget(w, h);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prev);
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    rt.dispose();
    let sum = 0, max = 0, lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      sum += v; if (v > max) max = v; if (v > 8) lit++;
    }
    const n = px.length / 4;
    return {
      rataRata: +(sum / n).toFixed(2),
      maksimum: max,
      persenTerang: +((lit / n) * 100).toFixed(1),
    };
  },
  /* putar pandangan pemain (untuk menguji berbagai sudut) */
  setYaw(v) { yaw = v; },
  get ctxLost() { return renderer.getContext().isContextLost(); },
  get glInfo() {
    const gl = renderer.getContext();
    return {
      lost: gl.isContextLost(),
      version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER),
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
  },
  /* uji pembeda: paksa latar putih; kalau probe tetap 0 berarti pembacaan piksel yang gagal */
  probeLatarPutih(w = 120, h = 68) {
    const bg = scene.background, fog = scene.fog;
    scene.background = new THREE.Color(0xffffff);
    scene.fog = null;
    const r = this.probe(w, h);
    scene.background = bg; scene.fog = fog;
    return r;
  },
};

function checkTouchUI() {
  const show = isTouch;
  joyL.style.display = show ? 'block' : 'none';
  joyR.style.display = show ? 'block' : 'none';
}

$('#btnStart').addEventListener('click', startGame);
$('#btnRetry').addEventListener('click', startGame);
$('#btnAgain').addEventListener('click', startGame);
if (!isTouch) {
  addEventListener('click', () => {
    if (gameState === 'playing' && document.pointerLockElement !== renderer.domElement) requestLock();
  });
}

/* boot: buat renderer + dunia sekali supaya terlihat "hidup" di menu */
/* boot: buat renderer + dunia sekali, lalu tampilkan menu */
map = genMaze();
try {
  initRenderer();
  buildWorld();
  gameState = 'menu';
  checkTouchUI();
  animate();
} catch (e) {
  /* pesan sudah ditampilkan oleh initRenderer */
}
