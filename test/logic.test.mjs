// Unit test logika murni (tanpa DOM/WebGL), diambil dari algoritma game.js.
// Jalankan: node test/logic.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CELL = 4, COLS = 8, ROWS = 8;
const MAP_W = COLS * 2 + 1, MAP_H = ROWS * 2 + 1;

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

const mk = (map) => {
  const cellToWorld = (cx, cy) => ({ x: (cx - MAP_W / 2 + 0.5) * CELL, z: (cy - MAP_H / 2 + 0.5) * CELL });
  const worldToCell = (wx, wz) => [Math.floor(wx / CELL + MAP_W / 2), Math.floor(wz / CELL + MAP_H / 2)];
  const isWall = (wx, wz) => {
    const [cx, cy] = worldToCell(wx, wz);
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return true;
    return map[cy][cx] === 1;
  };
  const collides = (wx, wz, r) => isWall(wx - r, wz - r) || isWall(wx + r, wz - r) || isWall(wx - r, wz + r) || isWall(wx + r, wz + r);
  const floorCells = () => { const o = []; for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) if (map[y][x] === 0) o.push([x, y]); return o; };
  function findPath(fromPos, toPos) {
    const [sx, sy] = worldToCell(fromPos.x, fromPos.z);
    const [gx, gy] = worldToCell(toPos.x, toPos.z);
    const idx = (x, y) => y * MAP_W + x;
    const valid = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && map[y][x] === 0;
    if (!valid(sx, sy) || !valid(gx, gy)) return [];
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    const seen = new Uint8Array(MAP_W * MAP_H);
    const queue = [idx(sx, sy)]; seen[idx(sx, sy)] = 1;
    const goal = idx(gx, gy); let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === goal) break;
      const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (!valid(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (seen[ni]) continue;
        seen[ni] = 1; prev[ni] = cur; queue.push(ni);
      }
    }
    if (!seen[goal]) return [];
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
      if (Math.abs(cross) > 0.001) out.push(b);
    }
    return out;
  }
  return { cellToWorld, worldToCell, isWall, collides, floorCells, findPath };
};

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('PASS  ' + name); pass++; }
  catch (e) { console.log('FAIL  ' + name + ' — ' + e.message); fail++; }
};

// --- 30 labirin acak: cek invarian ---
t('labirin: selalu terhubung penuh (semua sel lantai terjangkau)', () => {
  for (let n = 0; n < 30; n++) {
    const map = genMaze();
    const g = mk(map);
    const fc = g.floorCells();
    assert.ok(fc.length > 30, 'lantai terlalu sedikit: ' + fc.length);
    const a = g.cellToWorld(fc[0][0], fc[0][1]);
    for (const [x, y] of fc) {
      const b = g.cellToWorld(x, y);
      assert.ok(g.findPath(a, b).length > 0, `sel ${x},${y} tidak terjangkau`);
    }
  }
});

t('labirin: border tetap dinding', () => {
  for (let n = 0; n < 15; n++) {
    const map = genMaze();
    for (let x = 0; x < MAP_W; x++) { assert.equal(map[0][x], 1); assert.equal(map[MAP_H - 1][x], 1); }
    for (let y = 0; y < MAP_H; y++) { assert.equal(map[y][0], 1); assert.equal(map[y][MAP_W - 1], 1); }
  }
});

t('sel (1,1) selalu lantai (titik spawn pemain)', () => {
  for (let n = 0; n < 20; n++) assert.equal(genMaze()[1][1], 0);
});

t('pathfinding: rute tidak menembus dinding', () => {
  for (let n = 0; n < 20; n++) {
    const g = mk(genMaze());
    const fc = g.floorCells();
    const a = g.cellToWorld(...fc[0]);
    const b = g.cellToWorld(...fc[fc.length - 1]);
    const path = g.findPath(a, b);
    assert.ok(path.length >= 1, 'jalur kosong');
    let prev = a;
    for (const p of path) {
      // titik perantara di tengah sel -> aman; pastikan tidak jatuh di dinding
      assert.equal(g.isWall(p.x, p.z), false, 'titik jalur di dinding');
      prev = p;
    }
  }
});

t('pathfinding: jalur dirapikan (jumlah titik <= jumlah sel)', () => {
  const g = mk(genMaze());
  const fc = g.floorCells();
  const path = g.findPath(g.cellToWorld(...fc[0]), g.cellToWorld(...fc[fc.length - 1]));
  assert.ok(path.length <= fc.length);
});

t('pathfinding: target di dinding -> array kosong', () => {
  const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(1));
  map[1][1] = 0;
  const g = mk(map);
  assert.deepEqual(g.findPath(g.cellToWorld(1, 1), g.cellToWorld(0, 0)), []);
});

t('collides: di luar peta dianggap dinding', () => {
  const g = mk(genMaze());
  assert.equal(g.isWall(-999, 0), true);
  assert.equal(g.isWall(0, 999), true);
});

t('collides: radius pemain mencegah tembus dinding tipis', () => {
  const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(0));
  for (let i = 0; i < MAP_W; i++) { map[0][i] = 1; map[MAP_H - 1][i] = 1; }
  for (let i = 0; i < MAP_H; i++) { map[i][0] = 1; map[i][MAP_W - 1] = 1; }
  map[3][4] = 1; // satu balok dinding di tengah
  const g = mk(map);
  const c = g.cellToWorld(4, 3);
  assert.equal(g.isWall(c.x, c.z), true, 'dinding tengah harus dinding');
  assert.equal(g.collides(c.x, c.z, 0.55), true, 'pemain tidak boleh berada di dinding');
  assert.equal(g.collides(c.x + CELL, c.z, 0.55), false, 'sel sebelah harus bebas');
});

/* ---- regresi: joystick harus bisa menerima sentuhan ---- */
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const cssRule = (sel) => new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(html)?.[1] ?? '';
const joyCss = cssRule('#joyL,#joyR'), knobCss = cssRule('.knob'), ctlCss = cssRule('#controls');

t('joystick: pointer-events auto (menimpa #controls none)', () => assert.match(joyCss, /pointer-events:\s*auto/));
t('joystick: touch-action none (tidak ikut scroll)', () => assert.match(joyCss, /touch-action:\s*none/));
t('joystick: knob tidak mencuri event', () => assert.match(knobCss, /pointer-events:\s*none/));
t('joystick: kontainer induk tetap pointer-events none', () => assert.match(ctlCss, /pointer-events:\s*none/));
t('joystick: pakai pointer capture', () => assert.match(js, /setPointerCapture/));
t('joystick: reset saat jari lepas di luar elemen', () => assert.match(js, /lostpointercapture/));
t('joystick: di-reset saat startGame', () => assert.match(js, /resetJoy\(\)/));

console.log(`\n${pass}/${pass + fail} lulus`);
process.exit(fail ? 1 : 0);
