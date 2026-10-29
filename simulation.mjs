/** MZ-02.2 — Modelo de entorno y agentes deterministas.
 * No IA autónoma; sin afirmaciones de hidráulica real ni canon audiovisual.
 */
export const LIGHT_STATES=['dia','atardecer','noche'];
export const WEATHER_STATES=['seco','lluvia'];
export function agentStatuses(s){
 const phase=s.phase||'idle';
 const halted=phase==='blocked';
 return {
  operador:halted?'DETENIDO — incidencia':phase==='opening'?'Activando compuertas':phase==='lifting'?'Controlando ascenso':s.observed?'Listo para ensayo':'Esperando predicción',
  supervisor:halted?'ALERTA — comprobar geometría':s.opening>=.999?'Apertura completada':phase==='opening'?'Verificando desplazamiento':'Comprobación preliminar',
  observador:(s.trials?.length||0)+' ensayos registrados'
 };
}
export function liftInterlock(s,check){
 if(!s.observed)return {allowed:false,reason:'Falta completar la observación de apertura'};
 if(s.opening<.999)return {allowed:false,reason:'Compuertas sin apertura completa'};
 if(s.phase==='opening'||s.phase==='blocked')return {allowed:false,reason:'Secuencia no autorizada por el estado actual'};
 if(!check.safe)return {allowed:false,reason:'Intersección entre envolventes'};
 return {allowed:true,reason:'Condiciones geométricas del modelo satisfechas'};
}
export function rippleRadius(age,velocity=2.4){return Math.max(0,age)*velocity;}
export function rippleOpacity(age,amplitude=1,damping=1.1){return Math.max(0,Math.min(1,amplitude*Math.exp(-damping*Math.max(0,age))));}
export function weatherLabel(w){return w==='lluvia'?'Lluvia (perturbaciones visuales)':'Seco';}
