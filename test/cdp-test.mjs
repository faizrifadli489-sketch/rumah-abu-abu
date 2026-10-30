// Tes otomatis RUMAH ABU-ABU lewat CDP mentah (tanpa dependensi).
// Jalankan: node test/cdp-test.mjs [url] [cdpPort]
const URL_ = process.argv[2] || 'http://127.0.0.1:8099/';
const PORT = process.argv[3] || '9224';

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(targets.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    logs.push(`[LOG-ERROR] ${m.params.entry.text} ${m.params.entry.url || ''}`);
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id;
  pending.set(n, (m) => res(m.result ?? m.error));
  ws.send(JSON.stringify({ id: n, method, params }));
});

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r?.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL_ });
await sleep(4000);

// 1. halaman & WebGL hidup
check('three.js termuat (module)', await evalJs(`!!window.__GAME`), await evalJs(`document.title`));
const gl = await evalJs(`JSON.stringify(window.__GAME?.glInfo)`);
check('WebGL context hidup (tidak lost)', typeof gl === 'string' && gl.includes('"lost":false'), String(gl));
check('probe render: ada piksel terang', await evalJs(`(()=>{const p=window.__GAME.probe();return p.persenTerang>1})()`),
  await evalJs(`JSON.stringify(window.__GAME.probe())`));
check('latar putih -> probe ikut putih (bukan bug baca piksel)',
  await evalJs(`(()=>{const p=window.__GAME.probeLatarPutih();return p.persenTerang>90})()`),
  await evalJs(`JSON.stringify(window.__GAME.probeLatarPutih())`));

// 2. mulai game
await evalJs(`document.querySelector('#btnStart').click()`);
await sleep(1200);
check('game state = playing', (await evalJs(`window.__GAME.state`)) === 'playing', await evalJs(`window.__GAME.state`));
check('3 kunci spawn', (await evalJs(`window.__GAME.keysLeft`)) === 3, await evalJs(`String(window.__GAME.keysLeft)`));
const mapOk = await evalJs(`(()=>{const f=window.__GAME.floorCells();return f.length>20})()`);
check('labirin punya lantai', mapOk);

// 3. pathfinding
const pathLen = await evalJs(`(()=>{const f=window.__GAME.floorCells();let ok=0,tot=0;
 for(let i=0;i<12;i++){const a=f[(Math.random()*f.length)|0],b=f[(Math.random()*f.length)|0];
  if(a[0]===b[0]&&a[1]===b[1])continue;tot++;if(window.__GAME.testPath(a,b)>0)ok++;}
 return ok+'/'+tot})()`);
check('BFS temukan jalur antar sel acak', !String(pathLen).startsWith('0/'), pathLen);

// 4. gerak pemain
const p0 = await evalJs(`JSON.stringify(window.__GAME.player)`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
await sleep(900);
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
const p1 = await evalJs(`JSON.stringify(window.__GAME.player)`);
const moved = (() => { const a = JSON.parse(p0), b = JSON.parse(p1); return Math.hypot(a.x - b.x, a.z - b.z); })();
check('pemain bergerak dengan W', moved > 0.3, `jarak=${moved.toFixed(2)}`);
check('pemain tidak menembus dinding', await evalJs(`!window.__GAME.isWall(window.__GAME.player.x, window.__GAME.player.z)`));

// 5. ambil kunci (semua)
let took = 0;
for (let i = 0; i < 3; i++) {
  const ok = await evalJs(`window.__GAME.tpToKey(0)`);
  await sleep(520);
  if (ok) took++;
}
const stats = await evalJs(`JSON.stringify(window.__GAME.stats)`);
check('kunci bisa diambil', JSON.parse(stats).haveKeys === 3, stats);

// 6. menang
await evalJs(`window.__GAME.tpToExit()`);
await sleep(800);
check('menang setelah 3 kunci + pintu', (await evalJs(`window.__GAME.state`)) === 'win', await evalJs(`window.__GAME.state`));
check('overlay menang tampil', await evalJs(`!document.querySelector('#winOverlay').classList.contains('hidden')`));

// 7. restart bersih
await evalJs(`document.querySelector('#btnAgain').click()`);
await sleep(1200);
check('restart: state playing lagi', (await evalJs(`window.__GAME.state`)) === 'playing');
check('restart: kunci ter-reset 3', (await evalJs(`window.__GAME.keysLeft`)) === 3, String(await evalJs(`window.__GAME.keysLeft`)));
check('restart: HUD baterai 100', (await evalJs(`document.querySelector('#barSenter span').style.width`)) === '100%');
check('restart: render masih hidup', await evalJs(`(()=>{const p=window.__GAME.probe();return p.persenTerang>1})()`),
  await evalJs(`JSON.stringify(window.__GAME.probe())`));
check('restart: renderer tidak lost', await evalJs(`window.__GAME.ctxLost`) === false);

// 8. AI: monster mengejar saat dekat
await evalJs(`window.__GAME.setMonster(window.__GAME.player.x+3, window.__GAME.player.z)`);
await sleep(1500);
check('AI masuk mode chase', (await evalJs(`window.__GAME.ai.mode`)) === 'chase', await evalJs(`JSON.stringify(window.__GAME.ai)`));

// 9. jumpscare / mati
const beforeDecay = await evalJs(`window.__GAME.state`);
await evalJs(`window.__GAME.setMonster(window.__GAME.player.x+1, window.__GAME.player.z)`);
await sleep(2500);
check('tertangkap -> mati', (await evalJs(`window.__GAME.state`)) === 'dead', `sebelum=${beforeDecay} sesudah=${await evalJs(`window.__GAME.state`)}`);
check('overlay mati tampil', await evalJs(`!document.querySelector('#dieOverlay').classList.contains('hidden')`));

// 10. tanpa error konsol
const errs = logs.filter((l) => l.startsWith('[EXCEPTION]') || l.startsWith('[LOG-ERROR]'));
check('tanpa error konsol', errs.length === 0, errs.slice(0, 3).join(' | '));

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} lulus`);
if (logs.length) console.log('--- log ---\n' + logs.slice(0, 15).join('\n'));
ws.close();
process.exit(fails.length ? 1 : 0);
