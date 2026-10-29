/** Paleta local fija de 64 colores, asignación por distancia euclídea en OKLab.
 * Uso: versión alternativa en Canvas; no es un posprocesado WebGL. */
export function srgbLinear(x){let c=x/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}
export function rgbOklab(r,g,b){
 const R=srgbLinear(r),G=srgbLinear(g),B=srgbLinear(b);
 const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B);
 const m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B);
 const s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
 return [.2104542553*l+.793617785*m-.0040720468*s,
  1.9779984951*l-2.428592205*m+.4505937099*s,
  .0259040371*l+.7827717662*m-.808675766*s];
}
// Ocho familias cromáticas y ocho niveles de luminosidad, sin degradados externos.
// La paleta está diseñada para dibujo técnico: papel, tierra, metal, vegetación y señales.
function hslRgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];}
const FAMILIES=[[35,5],[40,29],[42,52],[12,48],[95,34],[151,32],[190,44],[220,50]];
const LIGHTNESS=[12,23,34,45,56,67,78,90];
export const PALETTE=FAMILIES.flatMap(([h,s])=>LIGHTNESS.map(l=>hslRgb(h,s,l)));
export function buildOklabLut(){
 const labs=PALETTE.map(c=>rgbOklab(...c));const lut=new Uint8Array(16*16*16);
 for(let r=0;r<16;r++)for(let g=0;g<16;g++)for(let b=0;b<16;b++){
  const v=rgbOklab(r*17,g*17,b*17);let idx=0,dist=Infinity;
  for(let j=0;j<labs.length;j++){
   const c=labs[j],d=(v[0]-c[0])**2+(v[1]-c[1])**2+(v[2]-c[2])**2;
   if(d<dist){dist=d;idx=j;}
  }
  lut[r*256+g*16+b]=idx;
 }
 return lut;
}
export function quantizePixels(imageData,lut){
 const a=imageData.data;
 for(let i=0;i<a.length;i+=4){if(a[i+3]===0)continue;const idx=lut[(a[i]>>4)*256+(a[i+1]>>4)*16+(a[i+2]>>4)];const col=PALETTE[idx];a[i]=col[0];a[i+1]=col[1];a[i+2]=col[2];}
 return imageData;
}
