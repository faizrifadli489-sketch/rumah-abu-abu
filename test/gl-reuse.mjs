// Pakai tab data: yang sudah berisi canvas & terbukti dapat WebGL, lalu import three dari server.
const PORT = process.argv[2] || '9224';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const tab = list.find(t => t.type === 'page' && t.url.startsWith('data:text/html,<canvas id=c'));
if (!tab) { console.log('tab data: tidak ditemukan'); process.exit(1); }
console.log('pakai tab:', tab.url.slice(0, 50));

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 150)); };
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r?.result?.value ?? r?.exceptionDetails?.text; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable');

console.log('webgl2 di tab ini:', await ev(`(()=>{const g=document.getElementById('c').getContext('webgl2');return g? (g.isContextLost()?'LOST':'ok') : 'none'})()`));

// import three lewat import() penuh (file vendor besar)
const r = await ev(`(async()=>{ try {
  const THREE = await import('http://127.0.0.1:8099/vendor/three.module.js');
  const r = new THREE.WebGLRenderer({canvas: document.getElementById('c')});
  r.setSize(200,200);
  const s = new THREE.Scene(); const c = new THREE.PerspectiveCamera(60,1,0.1,100); c.position.z=3;
  s.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0x00ff00})));
  for (let i=0;i<30;i++) r.render(s,c);
  return r.getContext().isContextLost() ? 'LOST' : 'ok';
} catch(e){ return 'ERR:'+e.message.slice(0,80);} })()`);
console.log('three renderer 30 frame:', r);

// cek kuota konteks: apakah membuat renderer lagi masih bisa
const r2 = await ev(`(async()=>{ try {
  const THREE = await import('http://127.0.0.1:8099/vendor/three.module.js');
  const cv = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({canvas: cv, antialias:true});
  r.setSize(100,100);
  return r.getContext().isContextLost() ? 'LOST' : 'ok';
} catch(e){ return 'ERR:'+e.message.slice(0,60);} })()`);
console.log('renderer kedua:', r2);
console.log('console:', logs.slice(0,5).join(' | ') || '(kosong)');
ws.close(); process.exit(0);
