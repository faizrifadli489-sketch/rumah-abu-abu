// Cari kombinasi opsi WebGLRenderer yang stabil di SwiftShader.
const PORT = process.argv[2] || '9224';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Page.enable');

await send('Page.navigate', { url: 'http://127.0.0.1:8099/' });
await sleep(3000);

// konteks WebGL polos yang sudah terbukti stabil
const plain = await ev(`(()=>{const c=document.createElement('canvas');const gl=c.getContext('webgl2');
 if(!gl) return 'none'; gl.clearColor(1,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); return gl.isContextLost()?'LOST':'ok';})()`);
console.log('polos webgl2:', plain);

const tests = [
  ['default', `{}`],
  ['no-antialias', `{antialias:false}`],
  ['alpha-false', `{antialias:false,alpha:false}`],
  ['lowp', `{antialias:false,alpha:false,powerPreference:'default'}`],
];
for (const [name, opts] of tests) {
  const r = await ev(`(async()=>{
    const THREE = await import('/vendor/three.module.js');
    try {
      const r = new THREE.WebGLRenderer(${opts});
      r.setSize(160,120);
      const s = new THREE.Scene(); const c = new THREE.PerspectiveCamera(60,1.33,0.1,100);
      c.position.z = 3;
      s.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0x00ff00})));
      r.render(s,c);
      const lost = r.getContext().isContextLost();
      r.getContext().finish?.();
      r.dispose(); r.forceContextLoss?.();
      return lost ? 'LOST' : 'ok';
    } catch(e) { return 'ERR:'+e.message.slice(0,60); }
  })()`);
  console.log(name, '->', r);
  await sleep(400);
}
ws.close(); process.exit(0);
