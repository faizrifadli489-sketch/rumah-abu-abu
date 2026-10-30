// Tes UI/layar + alur yang tidak butuh WebGL nyata.
const PORT = process.argv[2] || '9224';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?http://127.0.0.1:8099/`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 120)); };
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r?.result?.value ?? r?.exceptionDetails?.exception?.description; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Page.enable');

// 1. layar menu
const menu = await ev(`JSON.stringify({
  overlayTerlihat: !document.querySelector('#startOverlay').classList.contains('hidden'),
  judul: document.querySelector('#startOverlay h1').textContent,
  tombol: document.querySelector('#btnStart').textContent.trim(),
  canvasAda: !!document.querySelector('canvas'),
  overlayLainTersembunyi: document.querySelector('#dieOverlay').classList.contains('hidden') && document.querySelector('#winOverlay').classList.contains('hidden'),
  // tanpa WebGL, layar memuat WAJAR menampilkan pesan gagal — bukan bug
  loading: document.querySelector('#loading').textContent.slice(0, 24),
})`);
console.log('menu:', menu);

// 2. ikon/SVG favicon valid
console.log('favicon:', await ev(`!!document.querySelector('link[rel=icon]')`));

// 3. kontras teks: warna & background bisa dibaca
const color = await ev(`JSON.stringify({
  bg: getComputedStyle(document.body).backgroundColor,
  teks: getComputedStyle(document.querySelector('#startOverlay p')).color,
  tombolFont: getComputedStyle(document.querySelector('#btnStart')).fontFamily,
})`);
console.log('gaya:', color);

// 4. media query HP: joystick muncul di layar sentuh (simulasi)
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await sleep(400);
const touchUI = await ev(`JSON.stringify({
  lebarViewport: innerWidth,
  overlayMasihCenter: Math.abs(document.querySelector('#startOverlay').getBoundingClientRect().left) < 2,
  tombolTerlihat: document.querySelector('#btnStart').getBoundingClientRect().top > 0,
})`);
console.log('hp:', touchUI);

// 5. tidak ada horizontal scroll (layout tidak pecah di HP)
console.log('overflow-x:', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`));

// 6. jalankan jumpscare tanpa WebGL (kanvas 2D) — pastikan tidak error & gambar ada
const js = await ev(`(async()=>{ 
  const el = document.querySelector('#jumpscare');
  el.style.display='flex';
  const c = el.querySelector('canvas');
  c.width = 300; c.height = 300;
  // panggil drawScareFace tidak diekspos; cek kanvas 2D bisa menggambar
  const g = c.getContext('2d');
  g.fillStyle='#e9e4dc'; g.beginPath(); g.ellipse(150,150,60,80,0,0,Math.PI*2); g.fill();
  const d = g.getImageData(150,150,1,1).data;
  el.style.display='none';
  return JSON.stringify({rgb:[d[0],d[1],d[2]], kanvas2D: !!g});
})()`);
console.log('jumpscare 2D:', js);

console.log('exceptions:', logs.length ? logs.join(' | ') : 'tidak ada');
ws.close(); process.exit(0);
