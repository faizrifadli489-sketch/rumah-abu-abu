const PORT = process.argv[2] || '9224';
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Log.entryAdded') logs.push(m.params.entry.level + ': ' + m.params.entry.text.slice(0, 160)); };
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, m => res(m.result ?? m.error)); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r?.result?.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

// tab baru murni (bukan tab game yang sudah menghabiskan kuota konteks)
await send('Page.navigate', { url: 'data:text/html,<canvas id=a></canvas>' });
await sleep(1200);
console.log('webgl2:', await ev(`!!document.getElementById('a').getContext('webgl2')`));
console.log('webgl1:', await ev(`!!document.createElement('canvas').getContext('webgl')`));
console.log('experimental:', await ev(`!!document.createElement('canvas').getContext('experimental-webgl')`));
console.log('gpuInfo available:', await ev(`!!navigator.gpu`));
await sleep(1500);
console.log('log:', logs.slice(-6).join('\n      ') || '(kosong)');
ws.close(); process.exit(0);
