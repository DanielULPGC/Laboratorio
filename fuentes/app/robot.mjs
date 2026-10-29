import * as THREE from './vendor/three.module.js';
import { FIGURE_ZONES, FIGURE_REFERENCE, ROBOT_NAME } from './figure-spec.mjs';

// Robot «Brezo»: diseño original del Laboratorio Atlántico.
// Toda la geometría se genera por código dentro de la envolvente mecánica
// de 5,4 × 6,7 × 2,1 m que usa el simulador (origen en la suela, frente en +Z).
export const ROBOT_ENVELOPE = { halfX: 2.7, halfZ: 1.05, height: 6.7 };
const SIDE_ZONES = ['arms', 'hands', 'legs', 'feet'];

export function createRobot() {
  const root = new THREE.Group(); root.name = 'RobotBrezo';
  const cache = new Map();
  const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

  // Textura procedural ligera para matizar la rugosidad (sin imágenes externas).
  const bytes = new Uint8Array(64 * 64 * 4); let seed = 2026;
  for (let i = 0; i < 64 * 64; i++) { seed = (1664525 * seed + 1013904223) >>> 0; const v = 205 + Math.round(seed / 4294967296 * 40); bytes.set([v, v, v, 255], i * 4); }
  const roughnessMap = new THREE.DataTexture(bytes, 64, 64, THREE.RGBAFormat); roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping; roughnessMap.needsUpdate = true;
  const paint = (color, roughness, metalness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, roughnessMap, clearcoat: .35, clearcoatRoughness: .4, ...extra });
  const materials = {
    ochre: paint('#d38b2c', .45, .35), cream: paint('#ece3cf', .55, .08), graphite: paint('#33393d', .42, .6),
    steel: paint('#9aa3a6', .26, .9, { clearcoat: .1 }), teal: paint('#2b7f7a', .4, .3), rubber: new THREE.MeshStandardMaterial({ color: '#1d2124', roughness: .85, metalness: .05 }),
    visor: paint('#14262b', .12, .5, { clearcoat: 1, clearcoatRoughness: .05 }),
    glow: new THREE.MeshBasicMaterial({ color: '#6fe3cf', toneMapped: false }), lamp: new THREE.MeshBasicMaterial({ color: '#ff8a5c', toneMapped: false }),
    dial: new THREE.MeshStandardMaterial({ color: '#f6f1e4', roughness: .6, metalness: 0 }), needle: new THREE.MeshBasicMaterial({ color: '#c8452f' })
  };
  for (const [id, m] of Object.entries(materials)) m.name = id;

  function rbox(w, h, d, r = .08) {
    return geo(`rb${w},${h},${d},${r}`, () => {
      const rr = Math.min(r, w / 2 - .005, h / 2 - .005, d / 2 - .005), iw = w - 2 * rr, ih = h - 2 * rr, c = Math.min(rr, iw / 2, ih / 2) * .9;
      const s = new THREE.Shape(), x = -iw / 2, y = -ih / 2;
      s.moveTo(x + c, y); s.lineTo(x + iw - c, y); s.quadraticCurveTo(x + iw, y, x + iw, y + c); s.lineTo(x + iw, y + ih - c); s.quadraticCurveTo(x + iw, y + ih, x + iw - c, y + ih); s.lineTo(x + c, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - c); s.lineTo(x, y + c); s.quadraticCurveTo(x, y, x + c, y);
      const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.002, d - 2 * rr), bevelEnabled: true, bevelThickness: rr, bevelSize: rr, bevelSegments: rr > .12 ? 6 : 3, curveSegments: rr > .12 ? 8 : 4 });
      g.translate(0, 0, -Math.max(.002, d - 2 * rr) / 2); g.computeVertexNormals(); return g;
    });
  }
  const cyl = (rt, rb, h, seg = 20) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  const sph = (r, seg = 20) => geo(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.round(seg * .7)));
  const tor = (r, t) => geo(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 10, 28));

  function part(g, mat, zone, parent, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], name = '') {
    const m = new THREE.Mesh(g, materials[mat]); m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
    m.castShadow = m.receiveShadow = true; m.userData.figureZone = zone; if (name) m.name = name; parent.add(m); return m;
  }
  const H = Math.PI / 2;

  // ── Piernas y pies (lado derecho = +X) ─────────────────────────────
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.name = side > 0 ? 'rightLeg' : 'leftLeg'; leg.position.x = side * .78; root.add(leg);
    part(rbox(1.08, .1, 1.65, .03), 'rubber', 'feet', leg, [0, .052, .12], [0, 0, 0], [1, 1, 1], 'footSole');
    part(rbox(1, .34, 1.55, .1), 'ochre', 'feet', leg, [0, .26, .1], [0, 0, 0], [1, 1, 1], 'footShell');
    for (const x of [-.3, 0, .3]) part(rbox(.26, .2, .3, .06), 'graphite', 'feet', leg, [x, .21, .79], [0, 0, 0], [1, 1, 1], 'toeCap');
    part(rbox(.4, .22, .22, .05), 'graphite', 'feet', leg, [0, .2, -.6], [0, 0, 0], [1, 1, 1], 'heelSpur');
    part(sph(.26), 'graphite', 'feet', leg, [0, .56, 0], [0, 0, 0], [1, 1, 1], 'ankleBall');

    part(rbox(.78, 1.25, .82, .14), 'ochre', 'legs', leg, [0, 1.36, 0], [0, 0, 0], [1, 1, 1], 'shinShell');
    part(rbox(.5, .9, .1, .04), 'cream', 'legs', leg, [0, 1.42, .43], [0, 0, 0], [1, 1, 1], 'shinPlate');
    for (const x of [-.2, .2]) {
      part(cyl(.06, .06, 1.1, 12), 'steel', 'legs', leg, [x, 1.25, -.5], [0, 0, 0], [1, 1, 1], 'shinPiston');
      part(cyl(.1, .1, .36, 12), 'graphite', 'legs', leg, [x, 1.86, -.5], [0, 0, 0], [1, 1, 1], 'pistonHousing');
    }
    part(cyl(.3, .3, .86, 20), 'graphite', 'legs', leg, [0, 2.12, 0], [0, 0, H], [1, 1, 1], 'kneeAxle');
    part(cyl(.25, .25, .12, 20), 'ochre', 'legs', leg, [0, 2.12, .38], [H, 0, 0], [1, 1, 1], 'kneeCap');
    part(cyl(.27, .27, .62, 16), 'graphite', 'legs', leg, [0, 2.7, 0], [0, 0, 0], [1, 1, 1], 'thighCore');
    for (let i = 0; i < 5; i++) part(tor(.29, .065), 'graphite', 'legs', leg, [0, 2.44 + i * .13, 0], [H, 0, 0], [1, 1, 1], 'thighBellow');
    part(sph(.3), 'steel', 'waist', leg, [0, 3.08, 0], [0, 0, 0], [1, 1, 1], 'hipBall');
  }

  // ── Cintura y cadera ───────────────────────────────────────────────
  part(rbox(2.1, .6, 1.2, .14), 'graphite', 'waist', root, [0, 3.28, 0], [0, 0, 0], [1, 1, 1], 'pelvis');
  part(rbox(2.2, .18, 1.28, .06), 'cream', 'waist', root, [0, 3.52, 0], [0, 0, 0], [1, 1, 1], 'beltBand');
  for (const side of [-1, 1]) part(rbox(.24, .55, .9, .08), 'ochre', 'waist', root, [side * 1.14, 3.24, 0], [0, 0, 0], [1, 1, 1], 'hipPlate');
  for (const y of [3.66, 3.76]) part(tor(.58, .07), 'graphite', 'waist', root, [0, y, 0], [H, 0, 0], [1, 1, .9], 'waistBellow');

  // ── Torso, escotilla e indicador ───────────────────────────────────
  part(rbox(2.6, 1.7, 1.4, .24), 'cream', 'chest', root, [0, 4.62, 0], [0, 0, 0], [1, 1, 1], 'torsoShell');
  part(rbox(2.84, .5, 1.46, .18), 'ochre', 'chest', root, [0, 5.32, 0], [0, 0, 0], [1, 1, 1], 'shoulderYoke');
  for (const side of [-1, 1]) {
    part(rbox(.06, 1.2, .9, .02), 'teal', 'chest', root, [side * 1.31, 4.5, 0], [0, 0, 0], [1, 1, 1], 'sideStripe');
    for (let i = 0; i < 3; i++) part(rbox(.42, .06, .06, .02), 'graphite', 'chest', root, [side * .86, 4.85 - i * .2, .71], [0, 0, 0], [1, 1, 1], 'chestVent');
    part(sph(.055, 12), 'lamp', 'chest', root, [side * .95, 5.36, .74], [0, 0, 0], [1, 1, 1], 'yokeLamp');
  }
  const hexShape = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * .44, y = Math.sin(a) * .44; i ? hexShape.lineTo(x, y) : hexShape.moveTo(x, y); } hexShape.closePath();
  const hex = part(geo('hex', () => new THREE.ExtrudeGeometry(hexShape, { depth: .05, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 1 })), 'graphite', 'gauge', root, [0, 4.6, .69], [0, 0, 0], [1, 1, 1], 'gaugeHatch');
  part(cyl(.3, .3, .03, 32), 'dial', 'gauge', root, [0, 4.6, .77], [H, 0, 0], [1, 1, 1], 'gaugeFace');
  part(tor(.31, .025), 'steel', 'gauge', root, [0, 4.6, .785], [0, 0, 0], [1, 1, 1], 'gaugeRim');
  for (let i = 0; i <= 4; i++) { const a = (-120 + i * 60) * Math.PI / 180; part(rbox(.02, .07, .012, .004), 'graphite', 'gauge', root, [Math.sin(a) * .24, 4.6 + Math.cos(a) * .24, .79], [0, 0, -a], [1, 1, 1], 'gaugeTick'); }
  const needlePivot = new THREE.Group(); needlePivot.name = 'gaugeNeedlePivot'; needlePivot.position.set(0, 4.6, .795); root.add(needlePivot);
  part(rbox(.03, .22, .012, .005), 'needle', 'gauge', needlePivot, [0, .1, 0], [0, 0, 0], [1, 1, 1], 'gaugeNeedle');
  part(cyl(.035, .035, .02, 12), 'graphite', 'gauge', needlePivot, [0, 0, .006], [H, 0, 0], [1, 1, 1], 'gaugeHub');

  // ── Mochila de baterías ────────────────────────────────────────────
  part(rbox(1.9, 1.4, .28, .08), 'graphite', 'back', root, [0, 4.7, -.84], [0, 0, 0], [1, 1, 1], 'backpack');
  for (const x of [-.5, .5]) { part(cyl(.13, .13, 1.1, 18), 'teal', 'back', root, [x, 4.68, -.89], [0, 0, 0], [1, 1, 1], 'batteryCell'); part(cyl(.14, .14, .08, 18), 'steel', 'back', root, [x, 5.25, -.89], [0, 0, 0], [1, 1, 1], 'batteryCap'); }
  for (let i = 0; i < 5; i++) part(rbox(.62, .05, .1, .02), 'steel', 'back', root, [0, 4.25 + i * .2, -.99], [0, 0, 0], [1, 1, 1], 'coolingFin');
  part(rbox(.5, .07, .03, .01), 'glow', 'back', root, [0, 5.25, -.99], [0, 0, 0], [1, 1, 1], 'statusBar');
  part(geo('handle', () => new THREE.TorusGeometry(.3, .045, 8, 20, Math.PI)), 'steel', 'back', root, [0, 5.4, -.84], [0, 0, 0], [1, 1, 1], 'carryHandle');

  // ── Brazos y pinzas ────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = side > 0 ? 'rightArm' : 'leftArm'; root.add(arm);
    const x = side * 1.86;
    part(sph(.55, 24), 'ochre', 'arms', arm, [side * 1.72, 5.22, 0], [0, 0, 0], [1, .9, 1], 'shoulderPod');
    part(cyl(.26, .26, .7, 18), 'graphite', 'arms', arm, [x, 4.55, 0], [0, 0, 0], [1, 1, 1], 'upperArm');
    for (let i = 0; i < 3; i++) part(tor(.29, .07), 'graphite', 'arms', arm, [x, 4.12 - i * .13, 0], [H, 0, 0], [1, 1, 1], 'elbowBellow');
    part(cyl(.36, .3, 1, 20), 'ochre', 'arms', arm, [x, 3.3, 0], [0, 0, 0], [1, 1, 1], 'forearm');
    part(tor(.355, .04), 'cream', 'arms', arm, [x, 3.55, 0], [H, 0, 0], [1, 1, 1], 'forearmBand');
    part(cyl(.2, .2, .22, 16), 'graphite', 'arms', arm, [x, 2.7, 0], [0, 0, 0], [1, 1, 1], 'wrist');
    const hand = new THREE.Group(); hand.name = side > 0 ? 'rightHand' : 'leftHand'; hand.position.set(x, 2.5, 0); arm.add(hand);
    part(rbox(.5, .3, .5, .09), 'graphite', 'hands', hand, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'palm');
    for (let f = 0; f < 3; f++) {
      const a = f / 3 * Math.PI * 2 + (side > 0 ? 0 : Math.PI), finger = new THREE.Group(); finger.name = 'finger'; finger.position.set(Math.sin(a) * .17, -.14, Math.cos(a) * .17); finger.rotation.y = a; hand.add(finger);
      part(sph(.065, 12), 'steel', 'hands', finger, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'knuckle');
      const p1 = part(rbox(.13, .3, .13, .04), 'graphite', 'hands', finger, [0, -.14, .05], [.35, 0, 0], [1, 1, 1], 'fingerBase');
      part(rbox(.12, .24, .12, .04), 'ochre', 'hands', finger, [0, -.34, .04], [-.45, 0, 0], [1, 1, 1], 'fingerTip');
      part(rbox(.09, .12, .03, .012), 'teal', 'hands', finger, [0, -.38, -.03], [-.45, 0, 0], [1, 1, 1], 'gripPad');
      void p1;
    }
  }

  // ── Cabeza, visor y sensores ───────────────────────────────────────
  part(cyl(.3, .34, .2, 18), 'graphite', 'head', root, [0, 5.66, 0], [0, 0, 0], [1, 1, 1], 'neck');
  part(rbox(1.2, .8, 1.05, .22), 'ochre', 'head', root, [0, 6.06, .02], [0, 0, 0], [1, 1, 1], 'headShell');
  part(rbox(1.26, .24, .92, .1), 'visor', 'head', root, [0, 6.12, .1], [0, 0, 0], [1, 1, 1], 'visorBand');
  part(rbox(.96, .05, .02, .01), 'glow', 'head', root, [0, 6.12, .565], [0, 0, 0], [1, 1, 1], 'visorGlow');
  for (const side of [-1, 1]) {
    part(cyl(.085, .085, .04, 20), 'glow', 'head', root, [side * .24, 6.12, .575], [H, 0, 0], [1, 1, 1], 'lens');
    part(tor(.1, .018), 'steel', 'head', root, [side * .24, 6.12, .58], [0, 0, 0], [1, 1, 1], 'lensRing');
    part(cyl(.17, .17, .08, 20), 'graphite', 'head', root, [side * .63, 6.02, 0], [0, 0, H], [1, 1, 1], 'earDisc');
    part(tor(.12, .02), 'teal', 'head', root, [side * .675, 6.02, 0], [0, H, 0], [1, 1, 1], 'earRing');
    for (let i = 0; i < 3; i++) part(rbox(.03, .05, .3, .01), 'graphite', 'head', root, [side * .6, 5.84 - i * .0, -.18 + i * .18], [0, 0, 0], [1, 1, 1], 'cheekGrille');
  }
  part(rbox(.7, .15, .32, .05), 'cream', 'head', root, [0, 5.76, .36], [0, 0, 0], [1, 1, 1], 'chin');
  part(cyl(.04, .04, .2, 10), 'steel', 'sensors', root, [-.34, 6.5, -.12], [0, 0, 0], [1, 1, 1], 'sensorMast');
  part(rbox(.26, .12, .22, .04), 'graphite', 'sensors', root, [-.34, 6.62, -.1], [0, 0, 0], [1, 1, 1], 'cameraPod');
  part(cyl(.04, .04, .03, 14), 'glow', 'sensors', root, [-.34, 6.62, .02], [H, 0, 0], [1, 1, 1], 'cameraLens');
  part(cyl(.012, .012, .26, 6), 'steel', 'sensors', root, [.4, 6.56, -.2], [0, 0, 0], [1, 1, 1], 'whipAntenna');
  part(sph(.028, 10), 'lamp', 'sensors', root, [.4, 6.66, -.2], [0, 0, 0], [1, 1, 1], 'antennaLamp');
  void hex;

  // ── Inventario, aislamiento y ficha ────────────────────────────────
  const meshes = []; root.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); meshes.push(o); } }); root.updateMatrixWorld(true);
  const isRight = o => { for (let p = o; p && p !== root; p = p.parent) if (/^right/.test(p.name)) return true; return false; };
  const zoneMeshes = id => id === 'all' ? meshes : meshes.filter(o => o.userData.figureZone === id);
  const representative = id => SIDE_ZONES.includes(id) ? zoneMeshes(id).filter(isRight) : zoneMeshes(id);
  const fullBox = new THREE.Box3().setFromObject(root), fullHeight = fullBox.max.y - fullBox.min.y, sheet = {};
  for (const id of ['all', ...Object.keys(FIGURE_ZONES)]) {
    const items = representative(id), box = new THREE.Box3();
    for (const o of items) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    sheet[id] = { id, label: FIGURE_ZONES[id]?.label || 'Robot completo', sample: SIDE_ZONES.includes(id) ? 'lado derecho' : 'conjunto de la zona', bounds: { min: box.min.toArray(), max: box.max.toArray() }, center: center.toArray(), dimensions: { width: size.x, height: size.y, depth: size.z }, heightPercent: size.y / fullHeight * 100, meshCount: items.length, materialIds: [...new Set(items.map(o => o.material.name))], observed: FIGURE_ZONES[id]?.observed || 'Robot de diseño original.', interpretation: FIGURE_ZONES[id]?.evidence || 'DISEÑO_ORIGINAL' };
  }
  let isolatedZone = null;
  function isolateZone(id, on) { const next = on && FIGURE_ZONES[id] ? id : null; if (next === isolatedZone) return; isolatedZone = next; const keep = next ? new Set(representative(next)) : null; meshes.forEach(o => o.visible = !keep || keep.has(o)); }
  let loadKg = 20000;
  function setLoad(massKg) { if (!Number.isFinite(massKg)) return; loadKg = Math.min(50000, Math.max(10000, massKg)); needlePivot.rotation.z = -((loadKg - 10000) / 40000 * 240 - 120) * Math.PI / 180; }
  setLoad(loadKg);
  function specification() {
    return { version: 'LA-03.0', robot: ROBOT_NAME, reference: FIGURE_REFERENCE, units: 'metros; dimensiones del modelo didáctico', measuringMethod: 'Límites locales de malla alineados con X/Y/Z; muestra del lado derecho en extremidades',
      figure: sheet.all, zones: Object.values(sheet).filter(z => z.id !== 'all'),
      materials: Object.entries(materials).map(([id, m]) => ({ id, color: '#' + m.color.getHexString(), metalness: m.metalness ?? 0, roughness: m.roughness ?? null, opacity: m.opacity })),
      mechanicalEnvelope: { ...ROBOT_ENVELOPE }, limits: ['Diseño original: no representa ningún personaje ni producto comercial', 'Las articulaciones son visuales; no se simula su movimiento', 'Las colisiones del simulador usan la envolvente rectangular, no estas mallas'] };
  }
  root.userData.design = 'Robot Brezo · diseño original generado por código.';
  return {
    root, materials, isolateZone, setLoad, specification,
    describeZone(id = 'all') { return sheet[id] ? JSON.parse(JSON.stringify(sheet[id])) : null; },
    setLighting(night) { for (const m of Object.values(materials)) m.envMapIntensity = night ? .35 : 1; },
    diagnostics() { let triangles = 0; for (const o of meshes) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; return { robot: ROBOT_NAME, meshes: meshes.length, triangles, isolatedZone, load: loadKg, needleAngle: needlePivot.rotation.z, zones: Object.keys(FIGURE_ZONES) }; }
  };
}
