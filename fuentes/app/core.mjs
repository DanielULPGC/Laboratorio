/** LA-03.0 (desde MZ-02.1): modelo físico (SI) y comprobaciones de envolvente deliberadamente simplificadas. */
export const G=9.81;
/** Tope de aceleración del elevador en la animación y frenado fijo (decisiones didácticas del modelo). */
export const LIFT_ACC_CAP=16, BRAKE_ACC=3;
export const HEIGHT=9;
export const MODEL={robotHalfX:2.7,robotHalfZ:1.05,shaftHalfX:8.8,shaftHalfZ:6.2,gateHalfWidth:4.15,gateInnerAtRest:.1,gateTravel:8.8,gateYMin:.10,gateYMax:.68,robotBaseBottom:-10.8,robotBaseTop:-4.10,platformBaseY:-11.15};
export function acceleration(massKg,forceN){if(!(massKg>0)||!(forceN>=0))throw Error('Parámetros no válidos');return forceN/massKg-G;}
export function makeTrial(massKg,forceKN){const a=acceleration(massKg,forceKN*1000),weightKN=massKg*G/1000,netKN=forceKN-weightKN;return {massKg,forceKN,weightKN,netKN,a,canRise:a>0,capped:a>LIFT_ACC_CAP};}
/** Bounding envelope check against lateral walls and both sliding gate slabs.
 * All dimensions are illustrative and expressed in metres. */
export function clearance(opening,lift=0){
 if(!Number.isFinite(opening)||!Number.isFinite(lift)||opening<0||opening>1||lift<0||lift>HEIGHT)throw Error('Estado fuera de límites');
 const m=MODEL,rx=m.robotHalfX,rz=m.robotHalfZ;
 const leftInner=-m.gateInnerAtRest-opening*m.gateTravel;
 const rightInner=m.gateInnerAtRest+opening*m.gateTravel;
 const robotTop=m.robotBaseTop+lift, robotBottom=m.robotBaseBottom+lift;
 const yOverlaps=robotTop>m.gateYMin&&robotBottom<m.gateYMax;
 const gateOverlap=yOverlaps&&(leftInner>-rx||rightInner<rx);
 const wallOverlap=(rx>=m.shaftHalfX||rz>=m.shaftHalfZ);
 const gap=rightInner-leftInner;
 return {safe:!gateOverlap&&!wallOverlap,gap,marginX:gap/2-rx,marginZ:m.shaftHalfZ-rz,gateOverlap,wallOverlap,verticalCrossing:yOverlaps};
}
/** A compact illustrative actuator: accelerate and brake to arrive at rest.
 * The capped accelerating and braking phases should not be read as a real hydraulic design. */
export function trajectory(massKg,forceKN,height=HEIGHT){
 const raw=acceleration(massKg,forceKN*1000);
 if(raw<=0)return {possible:false,raw,tTotal:0,t1:0,t2:0,x:()=>0,v:()=>0,accUp:0,accDown:0};
 const accUp=Math.min(raw,LIFT_ACC_CAP),accDown=BRAKE_ACC;
 const d1=height*accDown/(accUp+accDown);
 const t1=Math.sqrt(2*d1/accUp);
 const vPeak=accUp*t1;
 const t2=vPeak/accDown;
 const tTotal=t1+t2;
 return {possible:true,raw,accUp,accDown,d1,t1,t2,tTotal,vPeak,
  x(t){const u=Math.max(0,Math.min(t,tTotal));return Math.max(0,Math.min(height,u<=t1?.5*accUp*u*u:d1+vPeak*(u-t1)-.5*accDown*(u-t1)**2));},
  v(t){const u=Math.max(0,Math.min(t,tTotal));return u>=tTotal?0:u<=t1?accUp*u:vPeak-accDown*(u-t1);}};
}
export function isValidComparison(trials){if(trials.length<2)return false;for(let i=0;i<trials.length;i++)for(let j=i+1;j<trials.length;j++)if(trials[i].forceKN===trials[j].forceKN&&trials[i].massKg!==trials[j].massKg)return true;return false;}
export function expectedPrediction(){return 'down';}
