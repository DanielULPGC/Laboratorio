import { trajectory, makeTrial, clearance, isValidComparison, expectedPrediction, HEIGHT, G } from './core.mjs';
import { liftInterlock } from './simulation.mjs';
import { FIGURE_ZONES } from './figure-spec.mjs';

export const LESSONS = [
  { short: 'Predecir', title: 'Antes de pulsar el botón…', lead: 'Imagina dos robots: uno ligero y otro pesado. Si el elevador empuja con la misma fuerza, ¿cuál gana velocidad más deprisa?' },
  { short: 'Observar', title: 'Primero, despeja el camino', lead: 'Las compuertas cubren el pozo. Ábrelas y observa cómo cambia el espacio disponible para el robot.' },
  { short: 'Experimentar', title: 'Cambia una sola cosa', lead: 'Haz dos ensayos con masas diferentes y la misma fuerza. Así podrás averiguar qué cambia por la masa.' },
  { short: 'Explicar', title: 'Que hablen tus pruebas', lead: 'Compara los resultados del cuaderno. ¿Qué le dirías a alguien que piensa que un robot más pesado acelera más? Fíjate también en la fuerza neta: lo que sobra del empuje después de vencer el peso.' }
];
export const PARTS = {
  gates: { name: 'Compuertas', number: '01', tag: 'HIPÓTESIS DE INGENIERÍA', summary: 'Dos hojas se apartan para dejar libre el camino del elevador.', question: '¿Qué ocurriría si intentáramos subir con ellas cerradas?', detail: 'El interbloqueo impide el ascenso hasta terminar la apertura. Se comprueban envolventes rectangulares, no las mallas exactas.', evidence: 'HIPOTESIS_DE_INGENIERIA' },
  lift: { name: 'Elevador', number: '02', tag: 'RECURSO DIDÁCTICO', summary: 'Una plataforma sostiene al robot. Acelera, frena y se detiene arriba.', question: '¿Por qué no basta con empujar: también hay que frenar?', detail: 'Recorrido de trabajo: 9 m. La subida reproduce la aceleración calculada hasta un tope de 16 m/s²; el frenado es de 3 m/s². Son decisiones de este modelo.', evidence: 'RECURSO_DIDACTICO' },
  robot: { name: 'Robot Brezo', number: '03', tag: 'DISEÑO ORIGINAL', summary: 'Brezo, un robot de carga inventado para este laboratorio, es la carga del experimento. Puedes cambiar su masa hipotética.', question: '¿Su aspecto nos permite saber cuánto pesa de verdad?', detail: 'Su diseño es original y se genera por código. Las masas de 10 a 50 t son valores para experimentar; el dial del pecho señala la masa elegida.', evidence: 'DISENO_ORIGINAL' }
};
export function createState(reducedMotion = false) {
  return { version: 3, predicted: false, prediction: '', initialPrediction: '', observed: false, inspected: [], trials: [], explanation: '', conclusion: '', earned: false,
    opening: 0, lift: 0, velocity: 0, elapsed: 0, run: null, activeTrialId: null, phase: 'idle', paused: false,
    massKg: 20000, forceKN: 500, lightTime: 'atardecer', weather: 'seco', view: 'corte', mode: 'mission', selectedPart: null, figureZone:'all', figureIsolated:false,
    reducedMotion, sound: false, pixel: false, forces: true, time: 0, events: [{ id: 1, text: 'Base preparada. Tú diriges el experimento.' }],
    message: 'Explora el laboratorio y registra tu primera idea. No hace falta acertar a la primera.' };
}
export const completedTrials = s => s.trials.filter(t => t.status === 'completed');
export const comparable = s => isValidComparison(completedTrials(s));
export const stageOf = s => !s.predicted ? 0 : !s.observed ? 1 : !comparable(s) ? 2 : !s.earned ? 3 : 4;
export const busy = s => ['opening', 'lifting', 'returning'].includes(s.phase);
export function forceVectors(s) {
  const weightKN = s.massKg * G / 1000;
  const moving = s.phase === 'lifting' && s.run?.possible;
  const acceleration = moving ? s.elapsed <= s.run.t1 ? s.run.accUp : -s.run.accDown : 0;
  return { weightKN, forceKN: moving ? s.massKg * (G + acceleration) / 1000 : s.forceKN, mode: moving ? 'applied' : 'available', acceleration };
}
export function canRun(s) { return !busy(s) && !s.paused && liftInterlock(s, clearance(s.opening, s.lift)).allowed; }
function event(s, text) { return { ...s, events: [{ id: (s.events[0]?.id || 0) + 1, text }, ...s.events].slice(0, 20), message: text }; }
function finish(s) {
  const trials = s.trials.map(t => t.id === s.activeTrialId ? { ...t, status: 'completed' } : t);
  const result = { ...s, phase: 'idle', lift: s.run?.possible ? HEIGHT : 0, velocity: 0, trials, activeTrialId: null };
  return event(result, comparable(result) ? '¡Ya tienes una comparación! Abre el cuaderno y explica qué muestran tus pruebas.' : s.run?.possible ? 'Llegada con frenado. Ahora cambia la masa y conserva la fuerza para comparar.' : 'Esta fuerza no supera el peso: no hay ascenso. Este resultado también es una prueba útil.');
}
export function advance(s, dt) {
  if (!Number.isFinite(dt) || dt < 0 || s.paused) return s;
  let n = { ...s, time: s.time + dt };
  if (s.phase === 'opening') {
    n.opening = Math.min(1, s.opening + dt * .42);
    if (n.opening === 1) n = event({ ...n, phase: 'idle', observed: true }, 'Camino despejado. Ya puedes probar el elevador.');
  } else if (s.phase === 'returning') {
    n.lift = Math.max(0, s.lift - dt * 4);
    n.velocity = n.lift === 0 ? 0 : -4;
    if (n.lift === 0) n = s.run.possible ? { ...n, phase: 'lifting', elapsed: 0 } : finish(n);
  } else if (s.phase === 'lifting') {
    n.elapsed += dt;
    n.lift = s.run.x(n.elapsed);
    n.velocity = s.run.v(n.elapsed);
    if (!clearance(n.opening, n.lift).safe) return event({ ...n, phase: 'blocked', paused: true, velocity: 0 }, 'Movimiento detenido: revisa el espacio del pozo.');
    if (n.elapsed >= s.run.tTotal) n = finish(n);
  }
  return n;
}
function settle(s) { for (let i = 0; i < 4 && busy(s); i++) s = advance(s, 120); return s; }
export function act(s, action) {
  let n = s;
  switch (action.type) {
    case 'PREDICT':
      if (!['up', 'down', 'same'].includes(action.value)) return { ...s, message: 'Elige una idea antes de registrarla.' };
      n = event({ ...s, predicted: true, prediction: action.value, initialPrediction: s.initialPrediction || action.value }, 'Idea registrada. La comprobarás con tus propias pruebas.'); break;
    case 'OPEN':
      if (!s.predicted || busy(s) || s.observed) return { ...s, message: 'Registra primero tu predicción para comenzar la apertura.' };
      n = event({ ...s, phase: 'opening', paused: false }, 'Apertura en curso. Observa cómo se apartan las dos compuertas.'); break;
    case 'PARAM': {
      if (busy(s)) return { ...s, message: 'Espera a que termine este movimiento para cambiar el ensayo.' };
      const value = Number(action.value), mass = action.key === 'massKg';
      if (!['massKg', 'forceKN'].includes(action.key) || !Number.isFinite(value) || value < (mass ? 10000 : 100) || value > (mass ? 50000 : 900)) return s;
      n = { ...s, [action.key]: value }; break;
    }
    case 'RUN': {
      if (!canRun(s)) return { ...s, message: 'El elevador necesita compuertas abiertas y ningún movimiento en curso.' };
      const run = trajectory(s.massKg, s.forceKN), id = (s.trials.at(-1)?.id || 0) + 1;
      const trial = { ...makeTrial(s.massKg, s.forceKN), id, status: 'running', tTotal: run.tTotal, vPeak: run.vPeak || 0, motionAcceleration: run.accUp };
      n = event({ ...s, run, elapsed: 0, activeTrialId: id, trials: [...s.trials, trial].slice(-30), paused: false,
        phase: s.lift > .01 ? 'returning' : run.possible ? 'lifting' : 'idle', lift: s.lift > .01 ? s.lift : 0 }, s.lift > .01 ? 'El elevador vuelve a la base antes del siguiente ensayo.' : 'Ensayo iniciado. Sigue la altura y la velocidad del robot.');
      if (!run.possible && n.phase !== 'returning') n = finish(n); break;
    }
    case 'PAUSE': n = event({ ...s, paused: !s.paused }, s.paused ? 'Experimento reanudado.' : 'Experimento en pausa. Puedes mirar con calma.'); break;
    case 'INSPECT':
      if (!PARTS[action.value]) return s;
      n = { ...s, selectedPart: action.value, inspected: [...new Set([...s.inspected, action.value])] }; break;
    case 'FIGURE_ZONE':
      if(action.value!=='all'&&!Object.hasOwn(FIGURE_ZONES,action.value)) return s;
      n={...s,figureZone:action.value,view:action.value==='all'?'robot':'detail',selectedPart:'robot',mode:'inspect',inspected:[...new Set([...s.inspected,'robot'])]}; break;
    case 'REFLECT': n = { ...s, explanation: String(action.text ?? s.explanation).slice(0, 1500), conclusion: action.conclusion ?? s.conclusion }; break;
    case 'REVISE': n = event({ ...s, prediction: expectedPrediction() }, 'Has revisado tu predicción usando los resultados. ¡Así trabaja la ciencia!'); break;
    case 'EARN':
      if (!s.observed || !comparable(s)) return { ...s, message: 'Necesitas dos ensayos terminados con masas distintas y la misma fuerza.' };
      if (s.conclusion !== 'down') return { ...s, message: 'Revisa la columna de aceleración. ¿Qué ocurrió al aumentar la masa con la misma fuerza?' };
      if (s.prediction !== expectedPrediction()) return { ...s, message: 'Tus datos te han hecho cambiar de idea. Pulsa «Revisar mi predicción» y recoge ese cambio.' };
      if (s.explanation.trim().length < 30) return { ...s, message: 'Añade una explicación de al menos 30 caracteres: menciona qué cambiaste y qué observaste.' };
      n = event({ ...s, earned: true }, 'Misión completada. Has reunido pruebas y una explicación para comentar en clase.'); break;
    case 'SET': {
      const allowed = { lightTime: ['dia', 'atardecer', 'noche'], weather: ['seco', 'lluvia'], view: ['base', 'corte', 'robot', 'head', 'detail'], mode: ['mission', 'notebook', 'inspect'] };
      if (allowed[action.key]?.includes(action.value)) {
        n = { ...s, [action.key]: action.value };
        if (action.key === 'lightTime' && s.lightTime !== action.value) n = event(n, 'Iluminación: ' + ({ dia: 'día', atardecer: 'atardecer', noche: 'noche' }[action.value]) + '.');
        if (action.key === 'weather' && s.weather !== action.value) n = event(n, action.value === 'lluvia' ? 'Lluvia activada: efecto visual, sin cambio de masa ni de mecánica.' : 'Lluvia desactivada.');
      }
      else if (['reducedMotion', 'sound', 'pixel', 'forces','figureIsolated'].includes(action.key)) n = { ...s, [action.key]: Boolean(action.value) };
      break;
    }
    case 'RESET': return { ...createState(s.reducedMotion), sound: s.sound, lightTime: s.lightTime, weather: s.weather };
  }
  return n.reducedMotion && busy(n) ? settle(n) : n;
}
export function snapshot(s) {
  const keys = ['predicted', 'prediction', 'initialPrediction', 'observed', 'inspected', 'explanation', 'conclusion', 'earned', 'massKg', 'forceKN', 'lightTime', 'weather', 'reducedMotion'];
  return { version: 3, ...Object.fromEntries(keys.map(k => [k, s[k]])), trials: completedTrials(s) };
}
export function restore(data, reducedMotion = false) {
  const base = createState(reducedMotion);
  if (!data || data.version !== 3) return base;
  let s = base;
  for (const key of ['massKg', 'forceKN']) s = act(s, { type: 'PARAM', key, value: data[key] });
  for (const key of ['lightTime', 'weather']) s = act(s, { type: 'SET', key, value: data[key] });
  s.prediction = ['up', 'down', 'same'].includes(data.prediction) ? data.prediction : '';
  s.predicted = Boolean(data.predicted && s.prediction);
  s.initialPrediction = ['up', 'down', 'same'].includes(data.initialPrediction) ? data.initialPrediction : s.prediction;
  s.observed = Boolean(s.predicted && data.observed); s.opening = s.observed ? 1 : 0;
  s.trials = (Array.isArray(data.trials) ? data.trials : []).filter(t => t && t.status === 'completed' && Number.isFinite(t.massKg) && t.massKg >= 10000 && t.massKg <= 50000 && Number.isFinite(t.forceKN) && t.forceKN >= 100 && t.forceKN <= 900).slice(-30).map((t, i) => {
    const run = trajectory(t.massKg, t.forceKN);
    return { ...makeTrial(t.massKg, t.forceKN), id: i + 1, status: 'completed', tTotal: run.tTotal, vPeak: run.vPeak || 0, motionAcceleration: run.accUp };
  });
  s.inspected = [...new Set((Array.isArray(data.inspected) ? data.inspected : []).filter(id => PARTS[id]))];
  s.explanation = typeof data.explanation === 'string' ? data.explanation.slice(0, 1500) : '';
  s.conclusion = ['up', 'down', 'same'].includes(data.conclusion) ? data.conclusion : '';
  s.earned = Boolean(data.earned && act(s, { type: 'EARN' }).earned);
  s.reducedMotion = reducedMotion || Boolean(data.reducedMotion);
  s.message = 'Tu cuaderno está de vuelta. El elevador comienza en la base para observar otra vez.';
  return s;
}
