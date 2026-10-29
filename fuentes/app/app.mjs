import { createState, act, advance, snapshot, restore, stageOf, completedTrials, comparable, busy, canRun, forceVectors, LESSONS, PARTS } from './mission.mjs';
import { clearance, acceleration } from './core.mjs';
import { agentStatuses } from './simulation.mjs';
import { createCanvasScene } from './canvas.mjs';
import { FIGURE_ZONES, FIGURE_ZONE_IDS } from './figure-spec.mjs';
const $ = id => document.getElementById(id), $$ = selector => [...document.querySelectorAll(selector)];
const fmt = (n, decimals = 1) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
const STORAGE_KEY = 'la-lab-mission-v3';
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createState(prefersReducedMotion), lessonOverride = null, scene3d, renderer, audio, toastTimer, bootError = '';
try { state = restore(JSON.parse(localStorage.getItem(STORAGE_KEY)), prefersReducedMotion); } catch { /* A malformed or unavailable saved notebook never blocks the experiment. */ }
const canvasScene = createCanvasScene($('renderHost'));
const phaseNames = { idle: 'En la base', opening: 'Abriendo el camino', lifting: 'Subiendo y frenando', returning: 'Volviendo a la base', blocked: 'Revisión necesaria' };
function chooseRenderer() {
  renderer = state.pixel || !scene3d ? canvasScene : scene3d;
  canvasScene.canvas.hidden = renderer !== canvasScene;
  if (scene3d) scene3d.canvas.hidden = renderer !== scene3d;
  $('engineLabel').textContent = state.pixel ? 'Diorama · 64 colores' : renderer === canvasScene ? 'Maqueta 2D local' : 'Maqueta 3D local';
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(state))); $('saveStatus').textContent = 'Cuaderno guardado'; } catch { $('saveStatus').textContent = 'Guardado no disponible'; } }
function sound(type) {
  if (!state.sound || !['OPEN', 'RUN', 'EARN', 'INSPECT'].includes(type)) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const notes = type === 'EARN' ? [440, 550, 660] : [type === 'RUN' ? 220 : type === 'OPEN' ? 330 : 520]; notes.forEach((frequency, i) => { const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * .12; o.type = 'sine'; o.frequency.value = frequency; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .25); }); } catch { /* Sound is optional. */ }
}
function dispatch(action) {
  const previous = state;
  state = act(state, action);
  if (['PREDICT', 'OPEN'].includes(action.type) || (action.type === 'RUN' && !state.earned)) lessonOverride = null;
  if (action.type === 'RESET') lessonOverride = null;
  if (action.type === 'INSPECT') state = act(state, { type: 'SET', key: 'mode', value: 'inspect' });
  chooseRenderer(); renderer.update(state, 0); render(); save();
  if (['RUN', 'OPEN'].includes(action.type) && innerWidth <= 1050) $('scene').scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'start' });
  if (state !== previous) sound(action.type);
}
function tab(mode) { dispatch({ type: 'SET', key: 'mode', value: mode }); }
function goMission(step) { lessonOverride = step; tab('mission'); $('missionPanel').scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'nearest' }); }
function node(tag, text, className) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
function pairOfTrials() { const ts = completedTrials(state); for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) if (ts[i].forceKN === ts[j].forceKN && ts[i].massKg !== ts[j].massKg) return [ts[i], ts[j]].sort((a, b) => a.massKg - b.massKg); return []; }
function renderNotebook() {
  const ts = completedTrials(state); $('trialCount').textContent = ts.length;
  const body = $('trials'); body.replaceChildren();
  if (!state.trials.length) { const tr = node('tr'); const td = node('td', 'Tus ensayos aparecerán aquí.'); td.colSpan = 7; tr.append(td); body.append(tr); }
  state.trials.forEach(t => { const tr = node('tr'); [t.id, fmt(t.massKg / 1000, 0) + ' t', fmt(t.forceKN, 0) + ' kN', fmt(t.weightKN, 0) + ' kN', fmt(t.netKN, 0) + ' kN', fmt(t.a, 2) + ' m/s²' + (t.capped ? ' *' : ''), t.status !== 'completed' ? 'En curso' : t.canRise ? 'Sí' : 'No'].forEach(v => tr.append(node('td', v))); body.append(tr); });
  $('capNote').hidden = !state.trials.some(t => t.capped);
  const chart = $('trialChart'); chart.replaceChildren();
  const recent = ts.slice(-6); const max = Math.max(1, ...recent.map(t => Math.abs(t.a)));
  recent.forEach(t => { const row = node('div', null, 'chart-row'); const label = node('span', fmt(t.massKg / 1000, 0) + ' t'); label.title = 'Ensayo ' + t.id + ': fuerza de ' + t.forceKN + ' kN'; const track = node('div', null, 'chart-track'); const bar = node('div', null, 'chart-bar' + (t.a <= 0 ? ' negative' : '')); bar.style.width = Math.abs(t.a) / max * 100 + '%'; track.append(bar); row.append(label, track, node('strong', fmt(t.a, 2))); row.append(node('small', 'Ensayo ' + t.id + ' · ' + t.forceKN + ' kN · ' + (t.canRise ? 'Puede iniciar el ascenso' : 'No supera el peso'), 'chart-legend')); chart.append(row); });
  if (recent.length) chart.prepend(node('p', 'Aceleración inicial (m/s²). Compara las pruebas con igual fuerza.', 'small-note'));
  const pair = pairOfTrials(); $('comparisonSummary').replaceChildren();
  if (pair.length) { const [a, b] = pair; $('comparisonSummary').append(node('strong', 'Misma fuerza: ' + a.forceKN + ' kN'), node('div', `${fmt(a.massKg / 1000, 0)} t → peso ${fmt(a.weightKN, 0)} kN · neta ${fmt(a.netKN, 0)} kN → ${fmt(a.a, 2)} m/s²`), node('div', `${fmt(b.massKg / 1000, 0)} t → peso ${fmt(b.weightKN, 0)} kN · neta ${fmt(b.netKN, 0)} kN → ${fmt(b.a, 2)} m/s²`)); if (a.a > 0 && b.a > 0) $('comparisonSummary').append(node('p', `Para pensar: la masa se multiplicó por ${fmt(b.massKg / a.massKg, 1)}, pero la aceleración se dividió entre ${fmt(a.a / b.a, 1)}. ¿Por qué no entre ${fmt(b.massKg / a.massKg, 1)}? Pista: al aumentar la masa también aumenta el peso, y queda menos fuerza neta.`, 'think-prompt')); else $('comparisonSummary').append(node('p', 'Para pensar: en uno de los ensayos el empuje no superó al peso. ¿Qué fuerza neta quedó?', 'think-prompt')); }
  const last = ts.at(-1); $('lastResult').hidden = !last;
  if (last) $('lastResult').textContent = `Última prueba: ${fmt(last.massKg / 1000, 0)} t · ${last.forceKN} kN · peso ${fmt(last.weightKN, 0)} kN · fuerza neta ${fmt(last.netKN, 0)} kN. ${last.canRise ? 'Llegada a 9 m con frenado.' : 'La fuerza no supera el peso: sin ascenso.'} Aceleración inicial: ${fmt(last.a, 2)} m/s².${last.capped ? ' La animación la limita a 16 m/s²; la tabla muestra el valor calculado.' : ''}`;
  $('comparisonHint').textContent = ts.length && !comparable(state) ? `Prueba ahora otra masa y conserva ${ts[0].forceKN} kN para comparar con tu primer ensayo.` : 'Conserva la fuerza y cambia solo la masa.';
}
function renderParts() {
  const list = $('partList'); list.replaceChildren();
  Object.entries(PARTS).forEach(([key, p]) => { const btn = node('button'); btn.setAttribute('aria-pressed', String(state.selectedPart === key)); btn.append(node('i', p.number), node('span', p.name), node('b', state.inspected.includes(key) ? '✓' : '↗')); btn.addEventListener('click', () => dispatch({ type: 'INSPECT', value: key })); list.append(btn); });
  const part = PARTS[state.selectedPart]; const target = $('partDetail'); target.replaceChildren();
  if (part) target.append(node('span', part.tag, 'part-tag'), node('h3', part.name), node('p', part.summary), node('div', part.question, 'part-question'), node('p', part.detail));
  else target.append(node('p', 'Empieza por las compuertas. Después sigue el camino que recorre la plataforma.'));
  $('inspectedCount').textContent = state.inspected.length + ' de 3 piezas exploradas';
  $$('[data-part]').forEach(btn => btn.dataset.seen = String(state.inspected.includes(btn.dataset.part)));
  renderFigure();
}
function renderFigure() {
  $('figureStudy').hidden = state.selectedPart !== 'robot';
  if($('figureStudy').nextElementSibling!==$('partList')) $('partList').before($('figureStudy'));
  $('partDetail').hidden = state.selectedPart==='robot' && state.view==='detail';
  $('figureZone').value = state.figureZone;
  const zone = FIGURE_ZONES[state.figureZone];
  $('figureTitle').textContent = zone ? zone.number + ' / ' + zone.label : 'El robot, pieza a pieza';
  $('figureObserved').textContent = zone?.observed || 'Recorre diez zonas. Puedes seleccionar una pieza directamente sobre el modelo 3D.';
  $('figureBuilt').textContent = zone?.detail || 'Gira la cámara, acerca el robot o aísla una zona para examinar sus uniones.';
  $('figureCheck').textContent = zone?.check || 'Compara las dos mitades: silueta, proporciones, apoyo y continuidad entre piezas.';
  $('figureEvidence').textContent = 'Criterio: ' + (zone?.evidence || 'DISEÑO_ORIGINAL') + '. Robot inventado para este laboratorio; las medidas corresponden a esta maqueta.';
  const available = renderer === scene3d && !!scene3d;
  $('isolateZone').disabled = !zone || !available;
  $('isolateZone').checked = !!zone && available && state.figureIsolated;
  $('isolateHint').textContent = available ? 'Muestra la zona seleccionada sin las demás piezas.' : 'El aislamiento y las medidas de malla están disponibles en la vista 3D.';
  const info = available ? scene3d.figureDetails(state.figureZone) : null;
  $('figureMetrics').replaceChildren();
  if(info){ for(const [label,value] of [['Ancho',info.dimensions.width],['Alto',info.dimensions.height],['Fondo',info.dimensions.depth]]) { const cell=node('div');cell.append(node('dt',label),node('dd',fmt(value,3)+' m'));$('figureMetrics').append(cell); } }
  $('figureMeasureNote').textContent = info ? `Límites de malla · ${info.sample}. ${fmt(info.heightPercent,1)} % de la altura total. Medidas del modelo didáctico.` : 'Vista 2D esquemática. No contiene el detalle de las mallas 3D.';
  $('downloadFigure').disabled = !scene3d;
}
function render() {
  const stage = stageOf(state), current = lessonOverride ?? stage;
  document.body.dataset.night = String(state.lightTime === 'noche');
  document.body.dataset.studio = String(['robot','head','detail'].includes(state.view));
  $('missionCount').textContent = stage === 4 ? 'MISIÓN COMPLETADA' : `MISIÓN ${String(stage + 1).padStart(2, '0')} / 04`;
  $('missionName').textContent = ['La primera idea', 'Un camino despejado', 'Dos pruebas, una pregunta', 'La historia de tus datos', 'Explorador del laboratorio'][stage];
  $$('[data-panel]').forEach(b => { b.setAttribute('aria-selected', String(state.mode === b.dataset.panel)); b.tabIndex = state.mode === b.dataset.panel ? 0 : -1; });
  ['mission', 'notebook', 'inspect'].forEach(id => $(id + 'Content').hidden = state.mode !== id);
  $('steps').replaceChildren(); LESSONS.forEach((lesson, i) => { const li = node('li', null, i < stage ? 'done' : i === current ? 'current' : ''); const btn = node('button'); btn.disabled = i > stage; if (i === current) btn.setAttribute('aria-current', 'step'); btn.append(node('span', i < stage ? '✓' : i + 1, 'step-dot'), node('span', lesson.short)); btn.addEventListener('click', () => goMission(i)); li.append(btn); $('steps').append(li); });
  const lesson = LESSONS[current]; $('lessonNumber').textContent = String(Math.min(current + 1, 4)).padStart(2, '0'); $('lessonEyebrow').textContent = ['PREDICE SIN MIEDO', 'OBSERVA EL MECANISMO', 'COMPARA CON CUIDADO', 'EXPLICA CON TUS PRUEBAS', 'UNA MISIÓN PARA COMPARTIR'][current];
  $('lessonTitle').textContent = lesson?.title || ''; $('lessonLead').textContent = lesson?.lead || ''; $('lessonTitle').hidden = $('lessonLead').hidden = current === 4;
  ['prediction', 'observation', 'experiment', 'reflection', 'completion'].forEach((id, i) => $(id + 'Step').hidden = i !== current);
  const choice = document.querySelector(`input[name="prediction"][value="${state.prediction}"]`); if (choice) choice.checked = true;
  $('openBtn').disabled = busy(state) || state.observed; $('openBtn').firstChild.textContent = state.observed ? 'Compuertas abiertas ' : state.phase === 'opening' ? 'Abriendo… ' : 'Abrir compuertas ';
  $('mass').value = state.massKg; $('thrust').value = state.forceKN; $('massValue').textContent = fmt(state.massKg / 1000, 0); $('forceValue').textContent = fmt(state.forceKN, 0);
  $('mass').disabled = $('thrust').disabled = busy(state); $$('[data-mass]').forEach(b => { b.classList.toggle('active', +b.dataset.mass === state.massKg); b.disabled = busy(state); });
  $('runBtn').disabled = !canRun(state); $('runBtn').firstChild.textContent = state.phase === 'lifting' ? 'Ensayo en curso… ' : state.phase === 'returning' ? 'Volviendo a la base… ' : 'Ensayar ascenso ';
  $('explanation').value = state.explanation; $('conclusion').value = state.conclusion; $('explanationCount').textContent = `${state.explanation.trim().length} caracteres · mínimo 30. Tu docente revisará la explicación.`;
  $('reviseBtn').hidden = state.prediction === 'down';
  $('lightTime').value = state.lightTime; $('weather').value = state.weather;
  $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(state.view === b.dataset.view || state.view === 'detail' && b.dataset.view === 'robot')));
  $('viewLabel').textContent = state.view === 'detail' ? 'DETALLE · '+(FIGURE_ZONES[state.figureZone]?.label || 'ROBOT') : { base: 'LABORATORIO COMPLETO', corte: 'CORTE DIDÁCTICO', robot: 'ROBOT · VISTA DE ESTUDIO', head: 'CABEZA · LUZ DE INSPECCIÓN' }[state.view];
  $('modelCaption').textContent = state.view === 'base' ? 'Una maqueta del laboratorio. Abre las compuertas para descubrir el pozo.' : state.forces ? 'F ↑ es el empuje; P ↓ es el peso. Las flechas usan una escala común de fuerzas.' : 'Corte para ver el mecanismo. El aspecto y las medidas son interpretativos.';
  $('feedback').querySelector('p').textContent = state.message;
  $('badgeObserver').classList.toggle('earned', state.inspected.length === 3); $('badgeScientist').classList.toggle('earned', comparable(state)); $('badgeExplorer').classList.toggle('earned', state.earned);
  $('events').replaceChildren(); state.events.forEach(e => $('events').append(node('li', String(e.id).padStart(2, '0') + ' / ' + e.text))); $('eventCount').textContent = state.events.length + ' eventos';
  renderNotebook(); renderParts(); telemetry();
}
function telemetry() {
  $('height').textContent = fmt(state.lift); $('velocity').textContent = fmt(Math.abs(state.velocity)); $('opening').textContent = fmt(state.opening * 100, 0); $('heightBar').style.width = state.lift / 9 * 100 + '%';
  $('phaseLabel').textContent = state.paused ? 'En pausa' : state.phase === 'idle' && state.lift > 8.99 ? 'Arriba y en reposo' : phaseNames[state.phase];
  const c = clearance(state.opening, state.lift); $('clearanceText').textContent = state.opening < .999 ? 'Ascenso bloqueado' : `Margen lateral: ${fmt(c.marginX)} m`;
  if (state.view === 'head') $('modelCaption').textContent = 'Cabeza de Brezo: visor envolvente, lentes, discos laterales y mástil de sensores. Diseño original.';
  else if(state.view === 'detail') $('modelCaption').textContent = (FIGURE_ZONES[state.figureZone]?.check || '') + (renderer === canvasScene ? ' Vista 2D esquemática.' : ' Arrastra para girar; usa + y − para acercarte.');
  else if(state.view === 'robot') $('modelCaption').textContent = 'Vista de estudio: gira el robot para explorar su volumen. Las flechas de fuerza se muestran en Corte.';
  else if (state.forces && state.view !== 'base') { const f = forceVectors(state); $('modelCaption').textContent = f.mode === 'applied' ? `F aplicada ↑ ${fmt(f.forceKN, 0)} kN · P ↓ ${fmt(f.weightKN, 0)} kN. ${f.acceleration < 0 ? 'Para frenar, el empuje es menor que el peso.' : 'El elevador regula el empuje para acelerar.'}` : `F máx ↑ ${fmt(f.forceKN, 0)} kN · P ↓ ${fmt(f.weightKN, 0)} kN. Compara el empuje disponible y el peso antes de arrancar.`; }
  $('pauseBtn').setAttribute('aria-pressed', String(state.paused)); $('pauseBtn').setAttribute('aria-label', state.paused ? 'Reanudar el experimento' : 'Pausar el experimento'); $('pauseBtn').innerHTML = state.paused ? '▶ <span>Reanudar</span>' : 'Ⅱ <span>Pausar</span>'; $('pausedLabel').hidden = !state.paused;
}
function toast(text) { document.querySelector('.toast')?.remove(); const el = node('div', text, 'toast'); el.setAttribute('role', 'status'); document.body.append(el); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3200); }
function download(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function exportNotebook() {
  const names = { down: 'Disminuye la aceleración', up: 'Aumenta la aceleración', same: 'No cambia la aceleración', '': 'Sin registrar' };
  const text = ['OPERACIÓN DESPEGUE · MI CUADERNO', 'LA–03.0 · Física y Tecnología · 10–12 años', new Date().toLocaleString('es-ES', { timeZone: 'Atlantic/Canary' }), '', 'PREGUNTA', 'Con la misma fuerza, ¿cómo cambia la aceleración al aumentar la masa?', '', 'MI PRIMERA IDEA', names[state.initialPrediction], 'MI PREDICCIÓN REVISADA', names[state.prediction], '', 'MIS ENSAYOS TERMINADOS', 'N.º | Masa (t) | Empuje (kN) | Peso (kN) | Fuerza neta (kN) | a inicial (m/s²) | ¿Puede subir?'];
  completedTrials(state).forEach(t => text.push(`${t.id} | ${t.massKg / 1000} | ${t.forceKN} | ${fmt(t.weightKN, 0)} | ${fmt(t.netKN, 0)} | ${fmt(t.a, 2)}${t.capped ? ' *' : ''} | ${t.canRise ? 'Sí' : 'No'}`));
  if (completedTrials(state).some(t => t.capped)) text.push('* La animación limitó este ensayo a 16 m/s²; la cifra es la calculada.');
  text.push('', 'MI CONCLUSIÓN', names[state.conclusion], '', 'MI EXPLICACIÓN', state.explanation || 'Todavía no escrita.', '', 'PIEZAS EXPLORADAS', state.inspected.map(k => PARTS[k].name).join(', ') || 'Ninguna todavía.', '', 'PARTICIPACIÓN', state.earned ? 'Secuencia completada. Pendiente de evaluación docente de la explicación.' : 'Secuencia en curso.', '', 'MODELO', 'Fuerza neta = empuje − peso; a = fuerza neta / m = F/m − 9,81. Masa y fuerza son parámetros hipotéticos. La animación reproduce la aceleración calculada hasta 16 m/s² y frena a 3 m/s²; recorrido de 9 m.', 'Compuertas: HIPOTESIS_DE_INGENIERIA. Robot Brezo: DISENO_ORIGINAL. Ensayos y sello: RECURSO_DIDACTICO.', 'Colisiones mediante envolventes rectangulares; agua y lluvia son efectos visuales.', '', 'PARA CONVERSAR EN CLASE', '¿Qué mantuviste igual? ¿Qué dato apoya tu conclusión? Si la masa se duplica, ¿la aceleración se reduce a la mitad? ¿Qué papel tiene el peso? ¿Qué harías para poner a prueba otra explicación?');
  download(new Blob([text.join('\n')], { type: 'text/plain;charset=utf-8' }), 'mi-cuaderno-operacion-despegue.txt'); toast('Cuaderno preparado para guardar y compartir en clase.');
}
function dialog(html) { $('dialogBody').innerHTML = html; $('infoDialog').showModal(); }
function teacherGuide() { dialog('<p class="eyebrow">PARA ACOMPAÑAR EL DESCUBRIMIENTO</p><h2>Una pregunta, dos pruebas.</h2><p>Propuesta para 10–12 años, en parejas y con una puesta en común. No es necesario usar la fórmula al principio.</p><ol><li><strong>Antes de probar:</strong> cada persona predice y cuenta por qué. Una idea inicial equivocada es una oportunidad para revisar.</li><li><strong>Observa:</strong> abre las compuertas. Relaciona el espacio disponible con el interbloqueo.</li><li><strong>Compara:</strong> prueba 20 t y 40 t con 500 kN. Cambia solo la masa. Busca la aceleración inicial en el cuaderno. Con estos valores la animación reproduce la aceleración calculada.</li><li><strong>Explica:</strong> pide «cambié…, mantuve…, observé…, por eso…». Separa lo observado de la explicación.</li><li><strong>Transfiere:</strong> ¿qué pasaría con 30 t? ¿Cómo comprobaríamos esa predicción?</li></ol><h3>Dos fuerzas, dos direcciones</h3><p>El elevador empuja hacia arriba; el peso tira hacia abajo. Para iniciar el ascenso, el empuje debe superar al peso. La masa es la cantidad de materia; el peso es una fuerza.</p><h3>Un error previsible: «el doble de masa, la mitad de aceleración»</h3><p>Con 500 kN, 20 t aceleran 15,19 m/s² y 40 t, 2,69 m/s²: la masa se duplica, pero la aceleración se divide entre 5,6. El peso también se duplica (196 → 392 kN) y la fuerza neta cae de 304 a 108 kN. La proporcionalidad inversa a = F/m solo vale cuando F es la fuerza neta. Las columnas «Peso» y «F. neta» del cuaderno permiten llegar a esta idea sin fórmulas.</p><h3>Qué revisar</h3><p>Que mantengan la fuerza, comparen datos pertinentes y justifiquen el cambio de aceleración. La longitud del texto y el sello solo registran participación: no evalúan el sentido de la respuesta.</p><div class="dialog-help"><p><strong>Puente con el modelo:</strong> a = (F − m·g)/m = F/m − g. La tabla muestra ese valor. La animación lo reproduce hasta 16 m/s² (los ensayos que superan el tope se marcan con *) y añade un frenado de 3 m/s²; no representa un mecanismo hidráulico real.</p></div>'); }
function settings() {
  dialog('<p class="eyebrow">HAZ TUYO EL LABORATORIO</p><h2>A tu ritmo.</h2><label class="setting-row"><span>Reducir movimiento<small>Sin animación de apertura ni ascenso. Los resultados y los controles siguen disponibles.</small></span><input id="reduceSetting" type="checkbox"></label><label class="setting-row"><span>Sonidos del laboratorio<small>Señales suaves al activar piezas y completar la misión.</small></span><input id="soundSetting" type="checkbox"></label><label class="setting-row"><span>Diorama de 64 colores<small>Vista 2D de resolución reducida; comparte la misma misión y las mismas medidas.</small></span><input id="pixelSetting" type="checkbox"></label><h3>Con el teclado</h3><p><strong>Tab</strong>: recorrer controles. <strong>1, 2, 3, 4</strong>: cambiar vista. <strong>Flechas</strong>: girar la cámara cuando no estás en un campo. <strong>Espacio</strong>: pausar o reanudar. Las piezas también están en la pestaña «Piezas».</p><p>El cuaderno se guarda en este navegador cuando el almacenamiento está disponible. Para conservar una copia fuera del equipo, usa «Guardar cuaderno».</p>');
  const forcesRow = node('label', null, 'setting-row'); forcesRow.innerHTML = '<span>Flechas de fuerza<small>Antes de arrancar: empuje máximo y peso. Durante el ascenso: empuje regulado, que se reduce al frenar.</small></span><input id="forcesSetting" type="checkbox">'; $('pixelSetting').closest('label').before(forcesRow);
  for (const [id, key] of [['reduceSetting', 'reducedMotion'], ['soundSetting', 'sound'], ['forcesSetting', 'forces'], ['pixelSetting', 'pixel']]) { $(id).checked = state[key]; $(id).addEventListener('change', () => dispatch({ type: 'SET', key, value: $(id).checked })); }
}
function description() { const roles = agentStatuses(state); dialog('<p class="eyebrow">EL LABORATORIO, EN PALABRAS</p><h2>Del pozo a la superficie.</h2><p>Detrás de una piscina rectangular hay un laboratorio circular con paneles solares y una torre de observación. El recinto tiene árboles, caminos, tuberías y barandillas. Bajo la piscina está un pozo con guías y un elevador que sostiene a Brezo, un robot de carga ocre y crema con articulaciones grafito, visor verde, mochila de baterías y un dial en el pecho que señala su masa.</p><p>Las dos compuertas se separan lateralmente. En la vista de corte se retiran visualmente dos paredes y parte del suelo para mostrar el mecanismo; esto no cambia las comprobaciones geométricas del modelo.</p><p id="textState"></p><h3>Equipo del laboratorio</h3><p id="textRoles"></p><p>Todos los ensayos se pueden realizar con los botones del panel, sin arrastrar ni pulsar la escena.</p>'); $('textState').textContent = `Ahora: compuertas al ${fmt(state.opening * 100, 0)} %, altura ${fmt(state.lift)} m y velocidad ${fmt(Math.abs(state.velocity))} m/s. Masa: ${state.massKg / 1000} t. Fuerza: ${state.forceKN} kN. ${phaseNames[state.phase]}.`; $('textRoles').textContent = `Operador: ${roles.operador}. Supervisor: ${roles.supervisor}. Observador: ${roles.observador}. Son roles basados en reglas, no IA aprendida.`; }
function credits() { dialog('<p class="eyebrow">CÓMO ESTÁ HECHA ESTA MAQUETA</p><h2>Ficción para investigar.</h2><p>Versión LA–03.0, derivada del prototipo MZ–02.3.3. La geometría, las texturas, la vegetación y los sonidos se generan por código. No se descargan imágenes, modelos ni audios de terceros al usar la aplicación.</p><p>La biblioteca Three.js 0.160.1 está incluida localmente con <a href="https://github.com/mrdoob/three.js/blob/r160/LICENSE" target="_blank" rel="noopener">su licencia MIT</a>.</p><h3>Lo que sabemos y lo que suponemos</h3><p>El robot Brezo es un diseño original creado para este laboratorio: no representa ningún personaje, serie ni producto comercial. El edificio y el mecanismo son hipótesis de ingeniería. Las masas, la fuerza, el recorrido y el sello son recursos didácticos.</p><p>El agua y la lluvia son efectos visuales. Las colisiones usan envolventes rectangulares, no colisiones exactas de malla. No se simulan hidráulica ni resistencia de materiales.</p><p id="renderDetails"></p>'); $('renderDetails').textContent = `Representación activa: ${renderer.kind}. ${bootError ? 'La vista 3D no pudo iniciarse; el modo 2D conserva la actividad.' : 'El rendimiento depende del dispositivo; no se garantiza una tasa de fotogramas.'}`; }

$$('[data-view]').forEach(b => b.addEventListener('click', () => dispatch({ type: 'SET', key: 'view', value: b.dataset.view })));
$$('[data-panel]').forEach(b => b.addEventListener('click', () => tab(b.dataset.panel)));
document.querySelector('.panel-tabs').addEventListener('keydown', e => { const tabs = $$('[data-panel]'), i = tabs.indexOf(document.activeElement); if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[j].focus(); tab(tabs[j].dataset.panel); });
$$('[data-part]').forEach(b => b.addEventListener('click', () => dispatch({ type: 'INSPECT', value: b.dataset.part })));
$$('[data-camera]').forEach(b => b.addEventListener('click', () => { renderer.cameraControl(b.dataset.camera); renderer.update(state, 0); }));
$$('[data-mass]').forEach(b => b.addEventListener('click', () => dispatch({ type: 'PARAM', key: 'massKg', value: b.dataset.mass })));
$('figureZone').addEventListener('change',()=>dispatch({type:'FIGURE_ZONE',value:$('figureZone').value}));
for(const [id,step] of [['previousZone',-1],['nextZone',1]]) $(id).addEventListener('click',()=>{const zones=['all',...FIGURE_ZONE_IDS];dispatch({type:'FIGURE_ZONE',value:zones[(zones.indexOf(state.figureZone)+step+zones.length)%zones.length]});});
$('isolateZone').addEventListener('change',()=>dispatch({type:'SET',key:'figureIsolated',value:$('isolateZone').checked}));
$('downloadFigure').addEventListener('click',()=>{if(scene3d)download(new Blob([JSON.stringify(scene3d.specification(),null,2)],{type:'application/json'}),'brezo-ficha-del-robot.json');});
for (const [id, key] of [['mass', 'massKg'], ['thrust', 'forceKN']]) $(id).addEventListener('input', () => dispatch({ type: 'PARAM', key, value: $(id).value }));
for (const key of ['lightTime', 'weather']) $(key).addEventListener('change', () => dispatch({ type: 'SET', key, value: $(key).value }));
$('predictBtn').addEventListener('click', () => dispatch({ type: 'PREDICT', value: document.querySelector('input[name="prediction"]:checked')?.value }));
$('openBtn').addEventListener('click', () => dispatch({ type: 'OPEN' })); $('runBtn').addEventListener('click', () => dispatch({ type: 'RUN' })); $('pauseBtn').addEventListener('click', () => dispatch({ type: 'PAUSE' }));
$('explanation').addEventListener('input', () => dispatch({ type: 'REFLECT', text: $('explanation').value })); $('conclusion').addEventListener('change', () => dispatch({ type: 'REFLECT', conclusion: $('conclusion').value }));
$('earnBtn').addEventListener('click', () => dispatch({ type: 'EARN' })); $('reviseBtn').addEventListener('click', () => dispatch({ type: 'REVISE' }));
$('notebookShortcut').addEventListener('click', () => tab('notebook')); $('moreTrialsBtn').addEventListener('click', () => goMission(2)); $('freeExploreBtn').addEventListener('click', () => goMission(2));
['downloadBtn', 'downloadFinal'].forEach(id => $(id).addEventListener('click', exportNotebook));
$('helpBtn').addEventListener('click', teacherGuide); $('settingsBtn').addEventListener('click', settings); $('creditsBtn').addEventListener('click', credits); $('textViewBtn').addEventListener('click', description);
$('jumpScene').addEventListener('click', () => $('scene').scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'start' }));
$('jumpMission').addEventListener('click', () => $('missionPanel').scrollIntoView({ behavior: state.reducedMotion ? 'instant' : 'smooth', block: 'start' }));
$('resetBtn').addEventListener('click', () => { dispatch({ type: 'RESET' }); toast('Misión reiniciada. Puedes comenzar otra investigación.'); });
$('photoBtn').addEventListener('click', () => { try { const a = document.createElement('a'); a.href = renderer.capture(); a.download = 'laboratorio-atlantico.png'; a.click(); toast('Foto del laboratorio preparada.'); } catch { toast('Este navegador no ha permitido guardar la imagen.'); } });
$('infoDialog').addEventListener('click', e => { if (e.target === $('infoDialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
window.addEventListener('keydown', e => { if (e.ctrlKey || e.metaKey || e.altKey || $('infoDialog').open || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName)) return; if (['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); dispatch({ type: 'SET', key: 'view', value: ['base', 'corte', 'robot', 'head'][+e.key - 1] }); } if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); renderer.cameraControl(e.key === 'ArrowLeft' ? 'left' : 'right'); } if (e.code === 'Space') { e.preventDefault(); dispatch({ type: 'PAUSE' }); } });

async function boot() {
  const query = new URLSearchParams(location.search), forceCanvas = query.get('render') === 'canvas';
  if (['base', 'corte', 'robot', 'head'].includes(query.get('view'))) state = act(state, { type: 'SET', key: 'view', value: query.get('view') });
  if (Object.hasOwn(FIGURE_ZONES,query.get('zone'))) state = act(state,{type:'FIGURE_ZONE',value:query.get('zone')});
  $('figureZone').append(new Option('Robot completo','all'),...FIGURE_ZONE_IDS.map(id=>new Option(FIGURE_ZONES[id].number+' · '+FIGURE_ZONES[id].label,id)));
  if (!forceCanvas) {
    try { const module = await import('./scene.mjs'); scene3d = module.createScene($('renderHost'), (id,zone) => dispatch(zone ? { type: 'FIGURE_ZONE', value: zone } : { type: 'INSPECT', value: id })); scene3d.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); scene3d.canvas.hidden = true; scene3d = null; bootError = 'Contexto WebGL interrumpido'; chooseRenderer(); renderFigure(); toast('La vista 3D se interrumpió. Seguimos en la maqueta 2D.'); }); }
    catch (error) { bootError = String(error.message || error); console.warn('Vista 3D no disponible; se utiliza la alternativa Canvas:', bootError); }
  }
  chooseRenderer(); renderer.update(state, .2); $('sceneLoading').hidden = true; render();
  let previous = performance.now(), lastUI = 0;
  function frame(now) {
    const dt = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now; const before = state;
    state = advance(state, dt); renderer.update(state, dt);
    $$('[data-part]').forEach(btn => { const p = renderer.hotspot(btn.dataset.part); btn.hidden = !p.visible; if (p.visible) { const mobile = innerWidth < 500, low = mobile ? .14 : .08, high = mobile ? .8 : .9; btn.style.left = Math.min(high, Math.max(low, p.x)) * 100 + '%'; btn.style.top = Math.min(.86, Math.max(.17, p.y)) * 100 + '%'; } });
    if (before.phase !== state.phase || before.trials !== state.trials || before.observed !== state.observed) { if (state.trials !== before.trials && state.sound) sound('INSPECT'); render(); save(); }
    if (now - lastUI > 110) { telemetry(); lastUI = now; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.laboratorio = Object.freeze({ getState: () => ({ ...snapshot(state), opening: state.opening, lift: state.lift, velocity: state.velocity, phase: state.phase, paused: state.paused, stage: stageOf(state), view: state.view, figureZone:state.figureZone,figureIsolated:state.figureIsolated,pixel: state.pixel, forces: state.forces, message: state.message }), diagnostics: () => ({ engine: renderer.kind, renderer: renderer.diagnostics(), bootError }), project: p => renderer.project ? renderer.project(p) : null });
}
boot().catch(error => { $('sceneLoading').innerHTML = '<strong>No se pudo preparar la vista</strong><span>Recarga la página para volver a intentarlo.</span>'; console.error(error); });

