import { PALETTE, buildOklabLut, quantizePixels } from './palette.mjs';
import { forceVectors } from './mission.mjs';
import { FIGURE_ZONES } from './figure-spec.mjs';
export function createCanvasScene(host) {
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Corte isométrico del laboratorio. La misión y las medidas también están disponibles en texto.'); host.appendChild(canvas);
  const display = canvas.getContext('2d'); const buffer = document.createElement('canvas'), pixel = buffer.getContext('2d', { willReadFrequently: true });
  let ctx = display, W = 1, H = 1, angle = .65, zoom = 1, scale = 12, lastView = '', state = null, lastFrame = -1, lut;
  function resize() { const b = host.getBoundingClientRect(); W = b.width || 800; H = b.height || 580; canvas.width = W * Math.min(devicePixelRatio, 1.5); canvas.height = H * Math.min(devicePixelRatio, 1.5); buffer.width = Math.min(360, W); buffer.height = Math.round(buffer.width * H / W); }
  new ResizeObserver(resize).observe(host); resize();
  function project(x, y, z) { const c = Math.cos(angle), s = Math.sin(angle), f=state?.view==='detail'?FIGURE_ZONES[state.figureZone]?.frame:null,focusY=f?f[1]-10.8+state.lift:state?.view === 'head' ? -4.62 + state.lift : state?.view === 'robot' ? -7.2 + state.lift : 0;x-=f?.[0]||0;z-=f?.[2]||0;return [W * .5 + (x * c - z * s) * scale, H * .47 + ((x * s + z * c) * .42 - (y - focusY) * .9) * scale]; }
  function poly(points, color, stroke = '#233d3b55') { ctx.beginPath(); points.forEach((p, i) => { const q = project(...p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .7; ctx.stroke(); } }
  function box(x, y, z, w, h, d, c) { const a = x - w / 2, b = x + w / 2, e = y - h / 2, f = y + h / 2, k = z - d / 2, l = z + d / 2; poly([[a, f, k], [b, f, k], [b, f, l], [a, f, l]], c[0]); poly([[a, f, l], [b, f, l], [b, e, l], [a, e, l]], c[1]); poly([[b, f, k], [b, f, l], [b, e, l], [b, e, k]], c[2]); }
  function line(a, b, c, w = 1) { const p = project(...a), q = project(...b); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); }
  function arrow(a, b, color, text) { line(a, b, color, 2.5); const p = project(...a), q = project(...b), theta = Math.atan2(q[1] - p[1], q[0] - p[0]); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - Math.cos(theta - .4) * 9, q[1] - Math.sin(theta - .4) * 9); ctx.lineTo(q[0] - Math.cos(theta + .4) * 9, q[1] - Math.sin(theta + .4) * 9); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.font = 'bold 13px Arial'; ctx.fillText(text, q[0] + 8, q[1]); }
  const concrete = ['#dbd6bc', '#9fae9b', '#b6c1a5'], steel = ['#c1d1c9', '#718a84', '#8ba39a'], ochre = ['#e3a24a', '#a8661c', '#c27f2a'], cream = ['#f4ede0', '#c9bfa9', '#ddd3bd'], graphite = ['#4a5257', '#24292c', '#353c40'], teal = ['#4aa49c', '#225e5a', '#2f7a74'];
  function update(s, dt) {
    state = s;
    const key=s.view+':'+s.figureZone,zone=s.view==='detail'?FIGURE_ZONES[s.figureZone]:null;
    if (s.time - lastFrame < (s.pixel ? .11 : .032) && lastView === key && dt > 0) return;
    lastFrame = s.time;
    if (lastView !== key) { lastView = key; zoom = 1; if (s.view === 'head') angle = .22; if(zone)angle=zone.angle; }
    const ratio = canvas.width / W; ctx = s.pixel ? pixel : display; ctx.setTransform(s.pixel ? buffer.width / W : ratio, 0, 0, s.pixel ? buffer.height / H : ratio, 0, 0);
    scale = (zone?Math.min(W/(zone.frame[3]*1.25),H/(zone.frame[3]*1.35)):s.view === 'head' ? Math.min(W / 3.1, H / 2.8) : s.view === 'robot' ? Math.min(W / 8, H / 9) : Math.min(W / 49, H / 37)) * zoom;
    const studio=['robot','head','detail'].includes(s.view);
    const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, studio ? '#182c43' : s.lightTime === 'noche' ? '#15343e' : s.lightTime === 'dia' ? '#c2d8cb' : '#dbd2ae'); grad.addColorStop(1, studio ? '#52657e' : s.lightTime === 'noche' ? '#52756d' : '#a5b79c'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if(!studio) {
    for (let i = 0; i < 9; i++) { const x = (i - 4) * 9; poly([[x - 9, 0, -32], [x, 12 + i % 3 * 2, -34], [x + 12, 0, -32]], i % 2 ? '#8a9d85' : '#91a78f', null); }
    if (s.view === 'base') box(0, -.45, 0, 44, .8, 34, concrete); else { box(0, -.45, -12, 44, .8, 10, concrete); for (const x of [-16, 16]) box(x, -.45, 4, 12, .8, 23, concrete); }
    for (const [x, z] of [[-19, 12], [-20, -10], [20, 12], [21, -12]]) { box(x, 1, z, .4, 2, .4, ['#6a7054', '#59674f', '#4a634c']); for (let j = 0; j < 3; j++) box(x, 2 + j, z, 2.6 - j * .5, 1.6, 2.6 - j * .5, ['#7b986a', '#456d50', '#5a805e']); }
    box(-14, 2.4, -12.5, 8.4, 4.8, 7.7, concrete); box(-14, 5.5, -12.5, 7.4, 1.3, 7.1, ['#6e9b95', '#3f7375', '#5a8888']); box(-14, 6.4, -12.5, 10, .5, 9, ['#548b88', '#386c73', '#4b7c7d']);
    for (let i = 0; i < 5; i++) box(-17 + i * 1.4, 2.6, -8.6, .8, 1.7, .12, ['#80b9ad', '#4c827e', '#62988d']);
    for (let i = 0; i < 5; i++) box(14, .8 + i * 1.3, -12, 5.5, 1.2, 5.5, concrete); box(14, 7, -12, 7.5, .5, 7.5, ['#518e8d', '#346973', '#427c7f']); line([14, 7.2, -12], [14, 10, -12], '#556f67', 2);
    box(0, -11.6, 0, 18, .35, 12.5, ['#52746b', '#314a46', '#3c5d56']); box(0, -5.7, -6.1, 18, 11.5, .35, ['#839f8d', '#536f65', '#628075']); box(-8.9, -5.7, 0, .35, 11.5, 12.4, concrete);
    if (s.view === 'base') { box(8.9, -5.7, 0, .35, 11.5, 12.4, concrete); box(0, -5.7, 6.1, 18, 11.5, .35, concrete); }
    for (const x of [-6.8, 6.8]) for (const z of [-4.5, 4.5]) line([x, -11.3, z], [x, -.2, z], '#c5d6b7', 2);
    for (let y = -10; y < 0; y += 2) { line([-8.4, y, -5.9], [8.4, y, -5.9], '#a1b995', 1); }
    }
    const by = -10.8 + s.lift;
    box(0, -11.15 + s.lift, 0, 5.7, .38, 4.5, ['#d2bd72', '#5d7268', '#79917e']);
    const hv = s.view === 'head' || s.figureZone === 'head' || s.figureZone === 'sensors';
    box(0, by + 4.7, -.86, 1.9, 1.4, .28, graphite); for (const x of [-.5, .5]) box(x, by + 4.68, -.92, .26, 1.1, .2, teal);
    for (const side of [-1, 1]) {
      const lx = side * .78; box(lx, by + .05, .12, 1.08, .1, 1.65, graphite); box(lx, by + .26, .1, 1, .34, 1.55, ochre); for (const x of [-.3, 0, .3]) box(lx + x, by + .21, .82, .26, .2, .26, graphite);
      box(lx, by + 1.36, 0, .78, 1.25, .82, ochre); box(lx, by + 1.42, .43, .5, .9, .08, cream); box(lx, by + 2.12, 0, .86, .5, .55, graphite); box(lx, by + 2.12, .38, .45, .45, .1, ochre); box(lx, by + 2.7, 0, .58, .62, .58, graphite);
    }
    box(0, by + 3.28, 0, 2.1, .6, 1.2, graphite); box(0, by + 3.52, 0, 2.2, .18, 1.28, cream); box(0, by + 3.71, 0, 1.15, .2, 1, graphite);
    box(0, by + 4.62, 0, 2.6, 1.7, 1.4, cream); box(0, by + 5.32, 0, 2.84, .5, 1.46, ochre); for (const side of [-1, 1]) box(side * 1.31, by + 4.5, 0, .06, 1.2, .9, teal);
    poly(Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * .44, by + 4.6 + Math.sin(a) * .44, .74]; }), '#353c40');
    const ga = -(((s.massKg || 20000) - 10000) / 40000 * 240 - 120) * Math.PI / 180; poly(Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return [Math.cos(a) * .3, by + 4.6 + Math.sin(a) * .3, .76]; }), '#f6f1e4'); line([0, by + 4.6, .77], [-Math.sin(ga) * .24, by + 4.6 + Math.cos(ga) * .24, .77], '#c8452f', s.figureZone === 'gauge' ? 4 : 2);
    for (const side of [-1, 1]) {
      const ax = side * 1.86; box(side * 1.72, by + 5.22, 0, 1.05, .95, 1.05, ochre); box(ax, by + 4.4, 0, .52, 1, .52, graphite); box(ax, by + 3.3, 0, .68, 1, .68, ochre); box(ax, by + 3.55, 0, .74, .08, .74, cream);
      box(ax, by + 2.5, 0, .5, .3, .5, graphite); for (const dz of [-.16, .16]) box(ax + side * .05, by + 2.2, dz, .12, .4, .12, ochre); box(ax - side * .16, by + 2.2, 0, .12, .4, .12, ochre);
    }
    box(0, by + 5.66, 0, .62, .2, .62, graphite); box(0, by + 6.06, .02, 1.2, .8, 1.05, ochre); box(0, by + 6.12, .1, 1.26, .24, .92, ['#2b3f45', '#14262b', '#1d3237']);
    line([-.48, by + 6.12, .57], [.48, by + 6.12, .57], '#6fe3cf', hv ? 5 : 2); for (const side of [-1, 1]) { box(side * .24, by + 6.12, .58, .17, .17, .03, ['#9ff2e2', '#6fe3cf', '#6fe3cf']); box(side * .63, by + 6.02, 0, .08, .34, .34, graphite); }
    box(0, by + 5.76, .36, .7, .15, .32, cream); line([-.34, by + 6.4, -.12], [-.34, by + 6.56, -.12], '#9aa3a6', 2); box(-.34, by + 6.62, -.1, .26, .12, .22, graphite); line([.4, by + 6.43, -.2], [.4, by + 6.69, -.2], '#9aa3a6', 1.5);
    if(!studio) {
    for (const z of [-6.65, 6.65]) line([-18, .25, z], [18, .25, z], '#54776b', 2);
    for (const side of [-1, 1]) { const x = side * (4.25 + 8.8 * s.opening); box(x, .4, 0, 8.3, .55, 12, ['#c4b77f', '#9b8b5b', '#aea371']); for (let z = -4.8; z <= 4.8; z += 1.6) line([x - 3.8, .71, z], [x + 3.8, .71, z], '#74826c', 1); }
    if (s.opening < .9) { poly([[-8, .76, -5.6], [8, .76, -5.6], [8, .76, 5.6], [-8, .76, 5.6]], '#72a99b70'); for (let i = 0; i < 5; i++) { const z = -4 + i * 1.8; line([-6, .78, z], [6, .78, z], '#e5eed05c'); } }
    if (s.weather === 'lluvia') { ctx.strokeStyle = '#edf2e16b'; ctx.lineWidth = 1; for (let i = 0; i < 75; i++) { const x = ((i * 113.7) % W), y = ((i * 61.3 + (s.reducedMotion ? 0 : s.time * 180)) % H); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11); ctx.stroke(); } }
    if (s.lightTime === 'noche') { ctx.fillStyle = '#0a263c55'; ctx.fillRect(0, 0, W, H); }
    }
    if (s.forces && s.view === 'corte') { const f = forceVectors(s); arrow([-3.3, by + 3.6, 1], [-3.3, by + 3.6 + f.forceKN * .006, 1], '#bbf4d9', f.mode === 'applied' ? 'F' : 'F máx'); arrow([3.3, by + 5.4, 1], [3.3, by + 5.4 - f.weightKN * .006, 1], '#efa37c', 'P'); }
    if (s.pixel) { if (!lut) lut = buildOklabLut(); const frame = pixel.getImageData(0, 0, buffer.width, buffer.height); quantizePixels(frame, lut); pixel.setTransform(1, 0, 0, 1, 0, 0); pixel.putImageData(frame, 0, 0); display.setTransform(ratio, 0, 0, ratio, 0, 0); display.imageSmoothingEnabled = false; display.drawImage(buffer, 0, 0, W, H); }
  }
  let drag;
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); }); canvas.addEventListener('pointermove', e => { if (drag == null) return; angle += (e.clientX - drag) * .009; drag = e.clientX; lastFrame = -1; }); canvas.addEventListener('pointerup', () => drag = null); canvas.addEventListener('pointercancel', () => drag = null);
  function cameraControl(action) { if (action === 'left') angle -= .2; if (action === 'right') angle += .2; if (action === 'in') zoom = Math.min(2.6, zoom * 1.15); if (action === 'out') zoom = Math.max(.6, zoom / 1.15); lastFrame = -1; }
  canvas.addEventListener('wheel', e => { e.preventDefault(); cameraControl(e.deltaY > 0 ? 'out' : 'in'); }, { passive: false });
  return { kind: 'Canvas local', canvas, update, cameraControl, capture: () => canvas.toDataURL('image/png'), diagnostics: () => { const result = { engine: 'Canvas', palette: PALETTE.length, width: W, height: H }; if (state?.pixel) { const data = pixel.getImageData(0, 0, buffer.width, buffer.height).data, colors = new Set(), palette = new Set(PALETTE.map(c => c.join(','))); for (let i = 0; i < data.length; i += 4) colors.add([data[i], data[i + 1], data[i + 2]].join(',')); result.pixelColors = colors.size; result.paletteValid = [...colors].every(c => palette.has(c)); } return result; }, hotspot(part) { if(state?.view === 'detail') return {x:.5,y:.5,visible:false}; const p = part === 'gates' ? [-4.25 - state.opening * 8.8, 1.2, 1] : part === 'lift' ? [-3.1, -10.4 + state.lift, 2] : [3.1, -4.7 + state.lift, 1]; const [x, y] = project(...p); return { x: x / W, y: y / H, visible: x > 20 && x < W - 20 && y > 40 && y < H - 40 }; } };
}
