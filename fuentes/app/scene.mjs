import * as THREE from './vendor/three.module.js';
import { forceVectors } from './mission.mjs';
import { createRobot } from './robot.mjs';
import { FIGURE_ZONES } from './figure-spec.mjs';
const TAU = Math.PI * 2;
export function createScene(host, onInspect) {
  const mobile = matchMedia('(max-width: 600px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.7));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.domElement.setAttribute('aria-label', 'Laboratorio tridimensional con el robot Brezo; controles y datos equivalentes en el panel');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#c6d4be', 63, 155);
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 300);
  const hemi = new THREE.HemisphereLight('#e7eee0', '#58644a', 2.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d1', 3.7); sun.position.set(-25, 35, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 31; sun.shadow.camera.bottom = -31; sun.shadow.camera.far = 100; sun.shadow.bias = -.0005; sun.shadow.normalBias = .025; scene.add(sun);
  const fill = new THREE.DirectionalLight('#bbdbde', 1); fill.position.set(20, 15, -10); scene.add(fill);
  const portraitLight = new THREE.DirectionalLight('#e1efff', 0); scene.add(portraitLight, portraitLight.target);
  const portraitRim = new THREE.DirectionalLight('#92b8ee', 0); scene.add(portraitRim, portraitRim.target);
  const envFaces = [];
  for (let i = 0; i < 6; i++) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#edf2f8'); g.addColorStop(.43, '#b5c0ce'); g.addColorStop(.65, '#66768b'); g.addColorStop(1, '#29394c'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); if (i % 2 === 0) { x.fillStyle = '#fffaf0'; x.fillRect(23, 8, 15, 62); x.fillStyle='#26364a'; x.fillRect(78,15,19,90); } envFaces.push(c); }
  const environment = new THREE.CubeTexture(envFaces); environment.needsUpdate = true; environment.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); const envTarget = pmrem.fromCubemap(environment); scene.environment = envTarget.texture; environment.dispose(); pmrem.dispose();
  const shaftLight = new THREE.PointLight('#86d9db', 38, 23, 1.1); shaftLight.position.set(0, -3, 3); scene.add(shaftLight);
  let seed = 2643;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function texture(kind, repeat = 1) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const colors = { concrete: '#b3b5a5', grass: '#718160', steel: '#b4bfc0', asphalt: '#50605c', soil: '#9b8e70' };
    x.fillStyle = colors[kind] || '#e0ae47'; x.fillRect(0, 0, 256, 256);
    if (kind === 'hazard') {
      x.fillStyle = '#e5b24b'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#263d38';
      for (let i = -256; i < 512; i += 70) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 288, 256); x.lineTo(i + 256, 256); x.fill(); }
    } else {
      for (let i = 0; i < 16000; i++) { const a = random() * .13; x.fillStyle = random() > .5 ? `rgba(255,255,240,${a})` : `rgba(13,32,27,${a})`; const s = kind === 'grass' ? 1 + random() * 5 : .4 + random() * 2; x.fillRect(random() * 256, random() * 256, s, s); }
      if (kind === 'concrete') { x.strokeStyle = '#64766b50'; x.lineWidth = 1; x.strokeRect(0, 0, 256, 256); x.strokeStyle = '#e7e7d955'; x.strokeRect(3, 3, 250, 250); }
      if (kind === 'steel') { for (let i = 0; i < 180; i++) { x.strokeStyle = `rgba(50,74,77,${random() * .1})`; const y = random() * 256; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); } x.strokeStyle = '#75878165'; x.strokeRect(1, 1, 254, 254); for (const a of [9, 247]) for (const b of [9, 247]) { x.fillStyle = '#5d7370'; x.beginPath(); x.arc(a, b, 2, 0, TAU); x.fill(); } }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const tex = { concrete: texture('concrete', 3), steel: texture('steel'), grass: texture('grass', 10), hazard: texture('hazard', 2), asphalt: texture('asphalt', 3) };
  const mat = (color, roughness = .7, metalness = 0, map = null, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, map, ...extra });
  const materials = {
    concrete: mat('#e5dfc9', .94, 0, tex.concrete), concreteDark: mat('#889c90', .95, 0, tex.concrete), steel: mat('#b4c2c0', .38, .65, tex.steel),
    dark: mat('#243d40', .55, .55, tex.steel), blue: mat('#123f65', .32, .68, tex.steel), blueLight: mat('#20618c', .34, .6, tex.steel),
    red: mat('#cc352f', .27, .5), white: mat('#dce3d7', .3, .65, tex.steel), brass: mat('#b39b63', .43, .64, tex.steel),
    hazard: mat('#ffffff', .7, .1, tex.hazard), glass: mat('#326b70', .18, .5, null, { emissive: '#397778', emissiveIntensity: .12 }),
    rubber: mat('#263837', .9), roof: mat('#356970', .42, .6, tex.steel), yellow: mat('#e3b34c', .32, .6),
    eye: mat('#f0d35b', .2, .2, null, { emissive: '#f8c835', emissiveIntensity: 1.1 }), lamp: mat('#dcf3db', .3, .2, null, { emissive: '#d1ffdf', emissiveIntensity: 1.4 }),
    grass: mat('#8b9c73', 1, 0, tex.grass), asphalt: mat('#7b8f80', .98, 0, tex.asphalt), trunk: mat('#65705a', 1), leaves: mat('#497357', 1), leavesLight: mat('#6e8b65', 1)
  };
  const geomCache = new Map(), pickables = [], nightLights = [];
  function geometry(key, factory) { if (!geomCache.has(key)) geomCache.set(key, factory()); return geomCache.get(key); }
  function mesh(g, m, x = 0, y = 0, z = 0, parent = scene, cast = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; }
  function box(w, h, d, m, x, y, z, parent = scene, bevel = 0) {
    let g;
    if (bevel) {
      const k = `b${w},${h},${d},${bevel}`;
      g = geometry(k, () => { const s = new THREE.Shape(); const a = w / 2 - bevel, b = h / 2 - bevel; s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(-a, b); s.closePath(); const geo = new THREE.ExtrudeGeometry(s, { depth: d - bevel * 2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel }); geo.translate(0, 0, -d / 2 + bevel); return geo; });
    } else g = geometry(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
    return mesh(g, m, x, y, z, parent);
  }
  function cylinder(rt, rb, h, m, x, y, z, parent = scene, segments = 20) { return mesh(geometry(`c${rt},${rb},${h},${segments}`, () => new THREE.CylinderGeometry(rt, rb, h, segments)), m, x, y, z, parent); }
  function ball(r, m, x, y, z, parent = scene, scale = [1, 1, 1]) { const o = mesh(geometry('s' + r, () => new THREE.SphereGeometry(r, 18, 12)), m, x, y, z, parent); o.scale.set(...scale); return o; }
  function rod(a, b, radius, m, parent = scene) { const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), dir = bv.clone().sub(av); const o = cylinder(radius, radius, dir.length(), m, 0, 0, 0, parent, 10); o.position.copy(av.add(bv).multiplyScalar(.5)); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return o; }
  function torus(r, tube, m, x, y, z, parent = scene) { const o = mesh(geometry(`t${r},${tube}`, () => new THREE.TorusGeometry(r, tube, 8, 36)), m, x, y, z, parent); o.rotation.x = Math.PI / 2; return o; }
  function label(text, w, h, bg, color, x, y, z, parent = scene, plane = 'ground') {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const cx = c.getContext('2d');
    if (bg) { cx.fillStyle = bg; cx.fillRect(0, 0, c.width, c.height); } cx.fillStyle = color; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = `700 ${Math.round(c.height * .58)}px Arial`; cx.fillText(text, 256, c.height * .52, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const o = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), x, y, z, parent, false);
    if (plane === 'ground') o.rotation.x = -Math.PI / 2; return o;
  }
  function mark(object, part) { object.traverse(o => { if (o.isMesh) { o.userData.part = part; pickables.push(o); } }); }

  // Landscape outside the laboratory yard: all geometry is authored here.
  const terrainShape = new THREE.Shape(); terrainShape.absarc(0, 0, 85, 0, TAU, false);
  const yardHole = new THREE.Path(); yardHole.moveTo(-26, -22); yardHole.lineTo(-26, 22); yardHole.lineTo(26, 22); yardHole.lineTo(26, -22); yardHole.closePath(); terrainShape.holes.push(yardHole);
  const terrain = mesh(new THREE.ShapeGeometry(terrainShape, 64), materials.grass, 0, -.5, 0, scene, false); terrain.rotation.x = -Math.PI / 2;
  const mountains = new THREE.Group(); scene.add(mountains);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, r = 74 + random() * 10, h = 12 + random() * 18; const mountain = cylinder(.2, 15 + random() * 12, h, mat(i % 2 ? '#809586' : '#8d9c88', 1), Math.sin(a) * r, h / 2 - 1, Math.cos(a) * r, mountains, 5 + Math.floor(random() * 3)); mountain.rotation.y = random() * 3; }
  for (let i = 0; i < (mobile ? 32 : 57); i++) {
    const a = i / (mobile ? 32 : 57) * TAU + random() * .1, r = 32 + random() * 17;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (z > 18 && Math.abs(x) < 12) continue;
    const h = 2.8 + random() * 3;
    cylinder(.18, .24, h * .55, materials.trunk, x, h * .22, z, scene, 7);
    for (let j = 0; j < 3; j++) cylinder(0, h * (.32 - j * .065), h * .58, j % 2 ? materials.leavesLight : materials.leaves, x, h * (.48 + j * .18), z, scene, 7);
  }
  const sky = mesh(new THREE.SphereGeometry(180, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color('#8aaea4') }, bottom: { value: new THREE.Color('#efdab4') } }, vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vP;void main(){float h=clamp(normalize(vP).y*.9+.15,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.6)),1.);}' }), 0, 0, 0, scene, false);
  const clouds = new THREE.Group(); scene.add(clouds); const cloudMat = mat('#e0e4d0', 1);
  for (let i = 0; i < 7; i++) { const a = i * .6 + .3; for (let j = 0; j < 4; j++) ball(3.8, cloudMat, Math.cos(a) * 65 + j * 3, 28 + i % 3, -Math.sin(a) * 65, clouds, [1.7, .35, .6]); }

  function yard(cut) {
    const shape = new THREE.Shape(); const points = cut ? [[-26, -22], [26, -22], [26, 22], [14, 22], [9.15, -6.4], [-9.15, -6.4], [-14, 22], [-26, 22]] : [[-26, -22], [26, -22], [26, 22], [-26, 22]];
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    if (!cut) { const hole = new THREE.Path(); hole.moveTo(-9.15, -6.4); hole.lineTo(9.15, -6.4); hole.lineTo(9.15, 6.4); hole.lineTo(-9.15, 6.4); hole.closePath(); shape.holes.push(hole); }
    const o = mesh(new THREE.ExtrudeGeometry(shape, { depth: .5, bevelEnabled: false }), materials.concrete, 0, -.63, 0); o.rotation.x = -Math.PI / 2; return o;
  }
  const yardFull = yard(false), yardCut = yard(true);
  // Paved circulation, tile seams and safety markings.
  for (const x of [-21, 21]) { box(3.2, .05, 39, materials.asphalt, x, -.07, 0); for (let z = -18; z < 20; z += 5) box(.13, .035, 2, materials.white, x, -.02, z); }
  for (const x of [-10.25, 10.25]) { box(1.7, .22, 14.8, materials.concreteDark, x, .05, 0, scene, .08); box(.48, .025, 13.2, materials.hazard, x, .175, 0); }
  for (const z of [-7, 7]) box(20, .25, .7, materials.concreteDark, 0, .05, z);
  label('SECTOR 02', 5.6, .85, null, '#ece8c7', -18.5, -.01, 7.5);
  label('LAB. ATLÁNTICO', 5.6, .9, null, '#566c60', -14, -.01, 16);
  const frontMark = label('▲', 4, 3.4, null, '#eee8cd', 0, -.01, 17);
  for (const x of [-16, 16]) for (const z of [-4, 11]) { box(3.8, .6, 1.7, materials.concreteDark, x, .25, z, scene, .12); for (let i = 0; i < 3; i++) ball(.65, materials.leavesLight, x + i * 1.15 - 1.15, .9, z, scene, [1.1, .6, .85]); }

  // The institute silhouette combines a circular laboratory, radial glazing and a service wing.
  const institute = new THREE.Group(); institute.position.set(-14.8, 0, -13.7); scene.add(institute);
  cylinder(4.3, 4.6, .6, materials.concreteDark, 0, .25, 0, institute, 40);
  cylinder(3.9, 4.15, 3.8, materials.concrete, 0, 2.4, 0, institute, 40);
  cylinder(4.25, 4.25, .24, materials.roof, 0, 4.4, 0, institute, 40);
  cylinder(3.75, 3.75, 1.25, materials.glass, 0, 5.05, 0, institute, 40);
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; box(.1, 1.35, .14, materials.white, Math.sin(a) * 3.79, 5.05, Math.cos(a) * 3.79, institute).rotation.y = a; }
  cylinder(4.05, 4.05, .3, materials.roof, 0, 5.82, 0, institute, 40);
  for (let i = 0; i < 6; i++) { const panel = box(1.5, .07, .95, materials.glass, -2.6 + (i % 3) * 2.6, 6.15, -1.1 + Math.floor(i / 3) * 2.2, institute); panel.rotation.x = -.3; }
  box(.9, 1.1, .9, materials.concrete, 2.6, 6.5, 2.2, institute, .06); cylinder(.07, .07, 1.6, materials.steel, 2.6, 7.8, 2.2, institute, 10); ball(.16, materials.lamp, 2.6, 8.65, 2.2, institute);
  const wing = box(7.8, 3.2, 4.5, materials.concrete, -5.4, 1.6, .3, institute, .13); box(8.2, .35, 4.9, materials.roof, -5.4, 3.3, .3, institute, .09);
  for (let i = 0; i < 6; i++) box(.75, 1.6, .06, materials.glass, -8.5 + i * 1.15, 1.9, 2.58, institute);
  box(1.5, 2.5, .12, materials.dark, -1, 1.25, 4.05, institute); label('LABORATORIO', 4.5, .6, '#294b46', '#e1e9ce', 0, 3.65, 4.14, institute, 'wall');
  label('ROBÓTICA · ENSAYOS', 3.5, .35, '#254841', '#e9e6c7', -5.4, 2.95, 2.63, institute, 'wall');
  for (const x of [-6.8, -4.2]) { box(1.5, .7, 1.5, materials.steel, x, 3.85, .2, institute, .08); cylinder(.45, .45, .1, materials.dark, x, 4.25, .2, institute, 16); }

  const tower = new THREE.Group(); tower.position.set(14.6, 0, -13.7); scene.add(tower);
  cylinder(3.4, 3.8, .5, materials.concreteDark, 0, .2, 0, tower, 32); cylinder(2.9, 3.15, 6.9, materials.concrete, 0, 3.7, 0, tower, 32);
  for (let y = 1.4; y < 7; y += 1.15) { torus(3.05, .08, materials.steel, 0, y, 0, tower); cylinder(2.94, 2.99, .24, materials.glass, 0, y + .25, 0, tower, 32); }
  cylinder(4, 4.1, .55, materials.roof, 0, 7.3, 0, tower, 32); cylinder(2.2, 2.6, 1, materials.glass, 0, 8, 0, tower, 24); cylinder(1.3, 3.1, .6, materials.roof, 0, 8.8, 0, tower, 24);
  const dish = mesh(new THREE.SphereGeometry(1.35, 24, 10, 0, TAU, 0, Math.PI * .43), materials.white, 0, 10.2, 0, tower); dish.rotation.x = -.6; dish.rotation.z = .3;
  rod([0, 9, 0], [.8, 11, .5], .08, materials.steel, tower); ball(.16, materials.red, .8, 11, .5, tower);
  const pipe = new THREE.CatmullRomCurve3([new THREE.Vector3(-9, .7, -17), new THREE.Vector3(0, .7, -18), new THREE.Vector3(8, .7, -17)]);
  mesh(new THREE.TubeGeometry(pipe, 30, .33, 10, false), materials.steel);
  for (let x = -8; x <= 8; x += 4) box(.25, 1, 1.3, materials.concreteDark, x, .3, -17.5);

  // Pool, sliding leaves and a cutaway shaft with physically shared motion.
  const well = new THREE.Group(); scene.add(well);
  box(18.5, .45, 13, materials.dark, 0, -11.7, 0, well, .1);
  const wallBack = box(18.2, 11.3, .4, materials.concreteDark, 0, -5.8, -6.15, well);
  const wallLeft = box(.4, 11.3, 12.4, materials.concreteDark, -8.95, -5.8, 0, well);
  const wallFront = box(18.2, 11.3, .4, materials.concreteDark, 0, -5.8, 6.15, well);
  const wallRight = box(.4, 11.3, 12.4, materials.concreteDark, 8.95, -5.8, 0, well);
  for (const x of [-6.8, 6.8]) for (const z of [-4.5, 4.5]) { box(.38, 11.1, .38, materials.dark, x, -5.75, z, well); box(.1, 11, .14, materials.steel, x, -5.75, z + .27, well); }
  for (let y = -10.5; y < 0; y += 2) { box(16.5, .09, .18, materials.steel, 0, y, -5.91, well); for (const x of [-7.8, 7.8]) box(.35, .9, .13, materials.lamp, x, y + .4, -5.88, well); }
  for (let y = -10; y < -.2; y += .55) rod([7.7, y, -5.7], [8.45, y, -5.7], .045, materials.yellow, well);
  for (const x of [7.7, 8.45]) rod([x, -10.3, -5.7], [x, -.2, -5.7], .05, materials.yellow, well);
  label('02', 4, 2, '#233b3a', '#829d85', 0, -5, -5.9, well, 'wall');
  const platform = new THREE.Group(); scene.add(platform);
  box(5.7, .38, 4.5, materials.dark, 0, 0, 0, platform, .1); box(5.4, .18, 4.2, materials.steel, 0, .28, 0, platform, .02);
  for (const x of [-2.65, 2.65]) box(.21, .035, 4.1, materials.hazard, x, .39, 0, platform);
  for (const z of [-2.06, 2.06]) box(5.3, .035, .22, materials.hazard, 0, .39, z, platform);
  const pistons = [];
  for (const x of [-2.2, 2.2]) for (const z of [-1.65, 1.65]) { cylinder(.29, .29, .6, materials.dark, x, -11.3, z, well); pistons.push(cylinder(.12, .12, 1, materials.steel, x, -11, z, well)); }
  mark(platform, 'lift');
  const gates = [-1, 1].map(side => {
    const g = new THREE.Group(); scene.add(g); g.userData.side = side;
    box(8.3, .55, 12, materials.brass, 0, .4, 0, g, .09);
    for (let z = -4.8; z <= 4.8; z += 1.6) box(7.9, .04, .035, materials.dark, 0, .7, z, g);
    for (const x of [-3.7, 3.7]) { box(.12, .06, 11.6, materials.steel, x, .72, 0, g); for (const z of [-5.35, 5.35]) cylinder(.09, .09, .04, materials.dark, x, .76, z, g, 10); }
    label(side < 0 ? '01' : '02', 1.3, 1, null, '#f2e4b9', 0, .75, 4.8, g); mark(g, 'gates'); return g;
  });
  for (const z of [-6.65, 6.65]) { box(37, .14, .18, materials.steel, 0, .24, z); for (const x of [-18, 18]) box(.45, .5, .65, materials.dark, x, .34, z, scene, .05); }
  const waterMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: { value: 0 }, opacity: { value: .54 }, waterColor: { value: new THREE.Color('#6eaead') } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time;uniform float opacity;uniform vec3 waterColor;varying vec2 vUv;void main(){float a=sin(vUv.x*65.+time*1.5+sin(vUv.y*25.))*sin(vUv.y*48.-time*.8);float b=sin(length((vUv-.5)*vec2(1.4,1.))*75.-time*2.);vec3 c=waterColor+(a*.06+b*.025);gl_FragColor=vec4(c,opacity+max(0.,a)*.14);}' });
  const water = mesh(new THREE.PlaneGeometry(16, 11.6), waterMat, 0, .8, 0, scene, false); water.rotation.x = -Math.PI / 2;

  // The original robot consumes the same lift transform and collision envelope.
  const robotModel = createRobot();
  const robot = robotModel.root; scene.add(robot); mark(robot, 'robot');
  const forceArrows = new THREE.Group(); scene.add(forceArrows);
  const upArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 3, '#9de6ce', .24, .18);
  const downArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 2, '#e78966', .24, .18); forceArrows.add(upArrow, downArrow);
  function forceLabel(text, color) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#173f38'; x.beginPath(); x.arc(32, 32, 27, 0, TAU); x.fill(); x.strokeStyle = color; x.lineWidth = 3; x.stroke(); x.fillStyle = color; x.font = `bold ${text.length > 1 ? 17 : 32}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 32, 34); const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false })); sprite.scale.set(.7, .7, .7); forceArrows.add(sprite); return sprite; }
  const fLabel = forceLabel('F', '#b0f1d4'), maxLabel = forceLabel('Fmáx', '#b0f1d4'), pLabel = forceLabel('P', '#f3aa82');

  // Railings, service figures and lamps give the yard a readable scale.
  for (const side of [-1, 1]) {
    for (let z = -7; z < 14; z += 3.5) cylinder(.055, .055, 1.05, materials.steel, side * 11.7, .55, z, scene, 8);
    rod([side * 11.7, 1.03, -7], [side * 11.7, 1.03, 10.5], .055, materials.steel);
    for (const z of [-19, 17]) { cylinder(.08, .13, 5.8, materials.dark, side * 23.8, 2.9, z, scene, 10); box(.65, .14, .9, materials.lamp, side * 23.8, 5.9, z); const l = new THREE.PointLight('#ffe0a3', 0, 12, 2); l.position.set(side * 23.8, 5.65, z); scene.add(l); nightLights.push(l); }
  }
  const people = [];
  for (const [x, z, color] of [[-12, 8, '#dd9f42'], [13, 7, '#b15140'], [-9, -10, '#467b88']]) { const p = new THREE.Group(); p.position.set(x, 0, z); scene.add(p); const clothing = mat(color, .9); for (const side of [-1, 1]) cylinder(.09, .1, .55, materials.dark, side * .13, .29, 0, p, 8); cylinder(.21, .23, .55, clothing, 0, .85, 0, p, 10); ball(.16, materials.white, 0, 1.3, 0, p); cylinder(.22, .22, .1, materials.yellow, 0, 1.43, 0, p, 12); people.push(p); }
  box(1.5, 1, .7, materials.dark, -12, .7, 9.1, scene, .08); box(1.2, .06, .55, materials.glass, -12, 1.24, 9.1).rotation.x = .3;
  const rainPositions = new Float32Array((mobile ? 230 : 450) * 3);
  for (let i = 0; i < rainPositions.length; i += 3) { rainPositions[i] = (random() - .5) * 70; rainPositions[i + 1] = random() * 35; rainPositions[i + 2] = (random() - .5) * 60; }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: '#e3f5ec', size: .075, transparent: true, opacity: .6, depthWrite: false })); scene.add(rain);
  const starPositions = new Float32Array(130 * 3); for (let i = 0; i < 130; i++) { const a = random() * TAU, h = .15 + random() * 1.2; starPositions[i * 3] = Math.cos(a) * 130 * Math.cos(h); starPositions[i * 3 + 1] = Math.sin(h) * 130; starPositions[i * 3 + 2] = Math.sin(a) * 130 * Math.cos(h); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3)); const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff5d2', size: .28, transparent: true, opacity: .75 })); scene.add(stars);

  const inspectionKeep = new Set([robot,platform,forceArrows,sky]);
  const inspectionEnvironment = scene.children.filter(o => !o.isLight && !inspectionKeep.has(o));
  const savedVisibility = new Map(); let isolated = false;
  let width = 1, height = 1, currentView = '', cameraKey='',minimumRadius=10,lightState = '', angle = .62, tilt = .43, radius = 46, radiusGoal = 46, target = new THREE.Vector3(0, -2.6, 0), targetGoal = target.clone(), lastState = null;
  const raycaster = new THREE.Raycaster(); let drag = null, moved = false;
  function resize() { const b = host.getBoundingClientRect(); width = Math.max(1, b.width); height = Math.max(1, b.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = false; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; angle -= dx * .006; tilt = THREE.MathUtils.clamp(tilt + dy * .003, .08, 1.15); drag = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => { if (!moved) { const b = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1), camera); const visible = pickables.filter(o => { for(let p=o;p;p=p.parent) if(!p.visible) return false; return true; }); const hit = raycaster.intersectObjects(visible, false)[0]; if (hit?.object.userData.part) onInspect(hit.object.userData.part,hit.object.userData.figureZone||null); } drag = null; });
  renderer.domElement.addEventListener('pointercancel', () => drag = null);
  renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); radiusGoal = THREE.MathUtils.clamp(radiusGoal * (e.deltaY > 0 ? 1.08 : .92), minimumRadius, 90); }, { passive: false });
  function cameraControl(action) { if (action === 'left') angle -= .2; if (action === 'right') angle += .2; if (action === 'in') radiusGoal = Math.max(minimumRadius, radiusGoal * .85); if (action === 'out') radiusGoal = Math.min(90, radiusGoal * 1.15); }
  function lighting(profile) {
    if (profile === lightState) return; lightState = profile;
    const night = profile === 'noche', day = profile === 'dia';
    hemi.color.set('#e7eee0'); hemi.groundColor.set('#58644a'); fill.color.set('#bbdbde');
    scene.fog.color.set(night ? '#183e42' : day ? '#c4d7ca' : '#d9c7a1');
    sky.material.uniforms.top.value.set(night ? '#0d233c' : day ? '#80b5b7' : '#9fbcb2'); sky.material.uniforms.bottom.value.set(night ? '#294c51' : day ? '#e0e4c9' : '#efd5aa');
    hemi.intensity = night ? .9 : 2.5; sun.intensity = night ? .6 : day ? 3.6 : 3.5; sun.color.set(night ? '#a2c4de' : day ? '#fff7de' : '#ffcf91');
    sun.position.set(day ? -20 : -28, day ? 40 : 24, 18); fill.intensity = night ? .55 : .9;
    materials.glass.emissiveIntensity = night ? 1.1 : .08; materials.eye.emissiveIntensity = night ? 2.4 : 1;
    for (const m of Object.values(materials)) m.envMapIntensity = night ? .22 : .65;
    robotModel.setLighting(night);
    materials.lamp.emissiveIntensity = night ? 3 : .9; shaftLight.intensity = night ? 65 : 35;
    nightLights.forEach(l => l.intensity = night ? 70 : 0); stars.visible = night; clouds.visible = !night;
    renderer.toneMappingExposure = night ? 1.15 : 1.08;
  }
  function update(s, dt) {
    const studio = ['robot','head','detail'].includes(s.view);
    if(studio !== isolated) { if(studio) inspectionEnvironment.forEach(o=>savedVisibility.set(o,o.visible)); else savedVisibility.forEach((v,o)=>o.visible=v); isolated=studio; lightState=''; }
    lastState = s; const cut = s.view !== 'base'; yardFull.visible = !cut; yardCut.visible = cut; wallFront.visible = wallRight.visible = !cut; frontMark.visible = !cut;
    platform.position.y = -11.15 + s.lift; robot.position.y = -10.8 + s.lift;
    robotModel.isolateZone(s.figureZone,s.view==='detail'&&s.figureIsolated); robotModel.setLoad(s.massKg);
    platform.visible=!(s.view==='detail'&&s.figureIsolated);
    forceArrows.visible = s.view === 'corte' && s.forces;
    const forces = forceVectors(s), upLength = forces.forceKN * .006, downLength = forces.weightKN * .006;
    upArrow.position.set(-3.3, -7.2 + s.lift, 1); upArrow.setLength(upLength, .24, .18); downArrow.position.set(3.3, -5.4 + s.lift, 1); downArrow.setLength(downLength, .24, .18);
    fLabel.position.set(-3.3, -6.65 + s.lift + upLength, 1); maxLabel.position.copy(fLabel.position); fLabel.visible = forces.mode === 'applied'; maxLabel.visible = !fLabel.visible; pLabel.position.set(3.3, -5.95 + s.lift - downLength, 1);
    gates.forEach(g => g.position.x = g.userData.side * (4.25 + 8.8 * s.opening));
    water.visible = s.opening < .97; water.scale.x = Math.max(.02, 1 - s.opening); waterMat.uniforms.time.value = s.reducedMotion ? 0 : s.time; waterMat.uniforms.opacity.value = cut ? .4 : .65;
    pistons.forEach(p => { const h = Math.max(.2, s.lift); p.scale.y = h; p.position.y = -11.25 + h / 2; });
    lighting(s.lightTime); rain.visible = s.weather === 'lluvia';
    if(studio) { const night=s.lightTime==='noche'; inspectionEnvironment.forEach(o=>o.visible=false); sky.material.uniforms.top.value.set(night?'#101d2d':'#243d57'); sky.material.uniforms.bottom.value.set(night?'#2a3a50':'#6d7c91'); hemi.color.set('#d5e2f5'); hemi.groundColor.set('#263447'); hemi.intensity=night?1.3:1.8; sun.color.set('#fff1de'); sun.intensity=night?1.4:2.4; fill.color.set('#80a8df'); fill.intensity=.65; shaftLight.intensity=0; renderer.toneMappingExposure=1.05; }
    if (rain.visible && !s.reducedMotion && !s.paused) { const d = rainGeo.attributes.position.array; for (let i = 1; i < d.length; i += 3) { d[i] -= dt * 17; if (d[i] < -.5) d[i] = 33; } rainGeo.attributes.position.needsUpdate = true; }
    const key=s.view+':'+s.figureZone+':'+Math.round(width/height*10),zone=FIGURE_ZONES[s.figureZone],zoneInfo=s.view==='detail'?robotModel.describeZone(s.figureZone):null;
    if (key !== cameraKey) { cameraKey=key;currentView = s.view;angle = s.view === 'head' ? .22 : s.view === 'robot' ? .36 : s.view === 'corte' ? .43 : .62;tilt=s.view==='head'?.075:s.view==='robot'?.15:s.view==='corte'?.33:.61;radiusGoal=s.view==='head'?4.8:s.view==='robot'?14.2:s.view==='corte'?43:57;minimumRadius=s.view==='head'?2.5:10;if(width<500)radiusGoal*=1.2;
      if(zoneInfo&&zone){angle=zone.angle;tilt=zone.tilt;const d=zoneInfo.dimensions,t=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),vw=d.width*Math.abs(Math.cos(angle))+d.depth*Math.abs(Math.sin(angle)),vh=d.height*Math.cos(tilt)+d.depth*Math.sin(tilt);radiusGoal=Math.max(zone.minRadius,(Math.max(vh/2/t,vw/2/t/(width/height))+d.depth/2)*1.12);minimumRadius=Math.max(.4,zone.minRadius*.55);}
    }
    if(zoneInfo&&zone)targetGoal.set(zoneInfo.center[0],zoneInfo.center[1]-10.8+s.lift,zoneInfo.center[2]);else targetGoal.set(0,s.view==='head'?-4.62+s.lift:s.view==='robot'?-7.2+s.lift:s.view==='corte'?-2.8:.6,s.view==='head'?.13:0);
    const ease = s.reducedMotion ? 1 : 1 - Math.exp(-dt * 6); radius += (radiusGoal - radius) * ease; target.lerp(targetGoal, ease);
    camera.position.set(target.x + radius * Math.sin(angle) * Math.cos(tilt), target.y + radius * Math.sin(tilt), target.z + radius * Math.cos(angle) * Math.cos(tilt)); camera.lookAt(target);
    portraitLight.intensity = studio ? s.lightTime === 'noche' ? .9 : 1.2 : 0; portraitLight.position.copy(camera.position); portraitLight.position.x -= 2; portraitLight.position.y += 3; portraitLight.target.position.copy(target);
    portraitRim.intensity=studio?1.1:0; portraitRim.position.set(target.x-(camera.position.x-target.x),target.y+4,target.z-(camera.position.z-target.z)); portraitRim.target.position.copy(target);
    people[0].rotation.y = s.phase === 'opening' ? .7 : -.4;
    renderer.render(scene, camera);
  }
  function hotspot(part) {
    if (!lastState) return { x: .5, y: .5, visible: false };
    if(isolated && part==='gates') return {x:.5,y:.5,visible:false};
    if(lastState.view==='detail')return{x:.5,y:.5,visible:false};
    const s = lastState, v = part === 'gates' ? new THREE.Vector3(-4.25 - s.opening * 8.8, 1, .8) : part === 'lift' ? new THREE.Vector3(-3.1, -10.6 + s.lift, 2) : new THREE.Vector3(3.1, -4.6 + s.lift, .7);
    v.project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, visible: v.z < 1 && Math.abs(v.x) < .9 && Math.abs(v.y) < .85 };
  }
  function projectRobotPoint(p) { const v = new THREE.Vector3(p[0], p[1] - 10.8 + (lastState?.lift || 0), p[2]).project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }
  return { kind: 'WebGL · Three.js local', project: projectRobotPoint, figureDetails: id=>robotModel.describeZone(id), specification: ()=>robotModel.specification(), canvas: renderer.domElement, update, hotspot, cameraControl, capture: () => renderer.domElement.toDataURL('image/png'), diagnostics: () => { const bounds = new THREE.Box3().setFromObject(robot); return { revision: THREE.REVISION, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, width, height, robotBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, character: robotModel.diagnostics(), inspection: { isolated, visibleEnvironmentNodes: inspectionEnvironment.filter(o=>o.visible).length } }; }, dispose: () => { renderer.dispose(); envTarget.dispose(); } };
}





