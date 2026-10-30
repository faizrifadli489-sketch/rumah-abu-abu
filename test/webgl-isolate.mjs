// Uji isolasi: apakah WebGL di environment ini stabil? (tanpa three.js)
const PORT = process.argv[2] || '9224';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Page.enable');

await send('Page.navigate', { url: 'data:text/html,<canvas id=c width=200 height=200></canvas>' });
await sleep(1500);
const info = await ev(`(()=>{const c=document.getElementById('c');
 const gl=c.getContext('webgl2')||c.getContext('webgl');
 if(!gl) return 'NO_WEBGL';
 const d=gl.getExtension('WEBGL_debug_renderer_info');
 gl.clearColor(0,1,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
 return JSON.stringify({v:gl.getParameter(gl.VERSION),r:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?',lost:gl.isContextLost()});})()`);
console.log('info:', info);

// gambar 20 frame berturut-turut dan cek kapan lost
const timeline = [];
for (let i = 0; i < 12; i++) {
  const s = await ev(`(()=>{const c=document.getElementById('c');const gl=c.getContext('webgl2')||c.getContext('webgl');
   if(!gl) return 'gone'; gl.clear(gl.COLOR_BUFFER_BIT); return gl.isContextLost()?'LOST':'ok';})()`);
  timeline.push(s);
  await sleep(200);
}
console.log('timeline:', timeline.join(','));
console.log('console:', logs.slice(0, 5).join(' | ') || '(kosong)');
ws.close(); process.exit(0);
