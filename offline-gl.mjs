/** MZ-02.3 — geometría WebGL2 offline. Motor GL minimalista, NO Three.js.
 * Coordenadas, alturas, encuadre y materiales interpretativos; NO reconstrucción canónica.
 */
function makeOfflineGL(host, state) {
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Recreación tridimensional WebGL local de la piscina, el pozo y el laboratorio, modelo interpretativo');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';host.append(canvas);
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true});
  if(!gl){canvas.remove();throw Error('WebGL2 no está disponible');}
  const vert=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform float uAngle; uniform float uZoom; uniform float uAspect;
uniform vec3 uOffset; uniform float uYTarget;
out vec3 vColor; out vec3 vNormal; out vec3 vWorld;
void main(){
 vec3 p=aPosition+uOffset; float c=cos(uAngle),s=sin(uAngle);
 float h=p.x*c-p.z*s; float depth=p.x*s+p.z*c;
 float elev=.58; float screenY=(p.y-uYTarget)*cos(elev)-depth*sin(elev);
 float cameraDepth=(p.y-uYTarget)*sin(elev)+depth*cos(elev);
 float halfH=21.0/uZoom;
 gl_Position=vec4(h/(halfH*uAspect),screenY/halfH,-cameraDepth/66.0,1.0);
 vWorld=p;vNormal=aNormal;vColor=aColor;
}`;
  const frag=`#version 300 es
precision highp float;
in vec3 vColor; in vec3 vNormal; in vec3 vWorld;
uniform float uNight;uniform float uRain;
out vec4 outColor;
void main(){
 vec3 n=normalize(vNormal); float sunlight=max(.0,dot(n,normalize(vec3(-.35,.83,.43))));
 float lit=.62+.38*sunlight; vec3 col=vColor*lit;
 col=mix(col,col*vec3(.44,.60,.86)+vec3(.006,.009,.024),uNight*.74);
 col=mix(col,col*vec3(.81,.88,.91),uRain*.28);
 outColor=vec4(pow(col,vec3(1.0/1.05)),1.);
}`;
  const compile=(kind,src)=>{const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,vert));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
  const loc={angle:gl.getUniformLocation(prog,'uAngle'),zoom:gl.getUniformLocation(prog,'uZoom'),aspect:gl.getUniformLocation(prog,'uAspect'),offset:gl.getUniformLocation(prog,'uOffset'),target:gl.getUniformLocation(prog,'uYTarget'),night:gl.getUniformLocation(prog,'uNight'),rain:gl.getUniformLocation(prog,'uRain')};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  const rgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
  const vec=(a,b)=>a.map((v,i)=>v-b[i]);
  class Geometry {
    constructor(){this.vertices=[];this.normals=[];this.colors=[];}
    tri(a,b,c,color){const u=vec(b,a),v=vec(c,a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;for(const p of [a,b,c]){this.vertices.push(...p);this.normals.push(...n.map(x=>x/len));this.colors.push(...rgb(color));}}
    quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
    box(x,y,z,w,h,d,c){let [x0,x1]=[x-w/2,x+w/2],[y0,y1]=[y-h/2,y+h/2],[z0,z1]=[z-d/2,z+d/2];const t=typeof c==='string'?c:c[0],front=typeof c==='string'?c:c[1]||c[0],side=typeof c==='string'?c:c[2]||c[0];this.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],t);this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],front);this.quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],side);this.quad([x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1],front);this.quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],side);this.quad([x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],side);}
    cyl(x,y,z,rx,h,rz,color,n=16){const c1=[x,y+h/2,z],c0=[x,y-h/2,z];for(let i=0;i<n;i++){let a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;let t0=[x+rx*Math.cos(a),y+h/2,z+rz*Math.sin(a)],t1=[x+rx*Math.cos(b),y+h/2,z+rz*Math.sin(b)],b0=[t0[0],y-h/2,t0[2]],b1=[t1[0],y-h/2,t1[2]];this.quad(t0,t1,b1,b0,color);this.tri(c1,t0,t1,color);this.tri(c0,b1,b0,color);}}
    sphere(x,y,z,rx,ry,rz,color,n=12,m=7){for(let j=0;j<m;j++){let v0=-Math.PI/2+j*Math.PI/m,v1=-Math.PI/2+(j+1)*Math.PI/m;for(let i=0;i<n;i++){let u0=i*2*Math.PI/n,u1=(i+1)*2*Math.PI/n;const p=(u,v)=>[x+rx*Math.cos(v)*Math.cos(u),y+ry*Math.sin(v),z+rz*Math.cos(v)*Math.sin(u)];this.quad(p(u0,v0),p(u1,v0),p(u1,v1),p(u0,v1),color);}}}
    ribbon(a,b,width,color){ // flat strip between two points, for structural ribs
      const dx=b[0]-a[0],dz=b[2]-a[2],norm=Math.hypot(dx,dz)||1;const nx=-dz/norm*width/2,nz=dx/norm*width/2;
      this.quad([a[0]+nx,a[1],a[2]+nz],[b[0]+nx,b[1],b[2]+nz],[b[0]-nx,b[1],b[2]-nz],[a[0]-nx,a[1],a[2]-nz],color);
    }
    finalize(){const v=new Float32Array(this.vertices),n=new Float32Array(this.normals),c=new Float32Array(this.colors),vao=gl.createVertexArray();gl.bindVertexArray(vao);for(const [i,arr] of [v,n,c].entries()){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);}gl.bindVertexArray(null);return {vao,count:v.length/3};}
  }
  const staticGeo=new Geometry(); const gateLGeo=new Geometry(),gateRGeo=new Geometry(),platformGeo=new Geometry(),robotGeo=new Geometry(),waterGeo=new Geometry(),roofRibGeo=new Geometry();
  const cream='#f0eadd',ivory='#f9f1d8',stone='#d6c7a8',teal='#72a8b4',red='#ad493c',gold='#d2ad52';
  // Floating land and excavated pool opening, no slab drawn across the mouth of the shaft.
  staticGeo.box(0,-12.75,0,54,1.25,45,['#756e55','#6b665a','#5f6661']);
  staticGeo.box(-18,0,0,18,.8,45,['#87b96d','#557f57','#5b8960']);staticGeo.box(18,0,0,18,.8,45,['#8dbb70','#6e8f61','#5b8960']);
  staticGeo.box(0,0,-14.7,18,.8,15.6,['#91b770','#6e9564','#5d8c63']);staticGeo.box(0,0,14.7,18,.8,15.6,['#8fb66e','#70935e','#5d8558']);
  // Paving around pit.
  for(const z of [-7.15,7.15])staticGeo.box(0,.3,z,21,.32,1.85,['#ddd4c2','#baa98f','#a59b87']);for(const x of [-10.2,10.2])staticGeo.box(x,.3,0,1.25,.32,12.7,['#e1d7c4','#baa98f','#a59b87']);
  staticGeo.box(0,-11.6,0,18,.25,12.5,'#3b4e5d');
  for(const x of [-9,9])staticGeo.box(x,-5.7,0,.43,11.7,12.5,['#81959f','#5d7480','#62727a']);
  for(const z of [-6.2,6.2])staticGeo.box(0,-5.7,z,18,11.7,.36,['#788b94','#60747e','#637682']);
  for(const x of [-7.1,7.1])for(const z of [-4.55,4.55])staticGeo.box(x,-5.55,z,.18,11.4,.18,'#c1d5d2');
  // Exterior promenade and front oval pool with rim.
  staticGeo.cyl(7.3,.57,15,8.3,.16,4.5,'#e9d7ae',40);staticGeo.cyl(7.3,.67,15,7.75,.055,4.0,'#6ba4bf',40);
  for(let i=0;i<12;i++){const a=i*Math.PI*2/12;staticGeo.cyl(7.3+Math.cos(a)*7.9,.78,15+Math.sin(a)*4.3,.17,.32,.17,'#f6eee0',8);}
  // Curved background path / visual guidance.
  for(let i=0;i<16;i++){let t=i/15;staticGeo.box(-16+12*t,.48,12-19*t,.4,.04,.44,'#e8dfba');}
  // Main futuristic building mass, central arched facade and raised, tapered sail roof.
  staticGeo.box(-11,2.75,-15.5,18,4.8,9.1,['#f2ecd9','#dcd9c8','#dad7c5']);
  // Swept pale roof: continuous triangulated triangular sail.
  const roofPart=(geo,frontZ,backZ,color)=>{const layers=24;for(let j=0;j<layers;j++){const v0=j/layers,v1=(j+1)/layers;const row=v=>{const half=.68+8.6*Math.pow(1-v,1.2),y=4.25+15*v,z=frontZ-3.3*v*v;return {half,y,z}};const a=row(v0),b=row(v1);geo.quad([-11-a.half,a.y,a.z],[-11+a.half,a.y,a.z],[-11+b.half,b.y,b.z],[-11-b.half,b.y,b.z],color);geo.quad([-11-a.half,a.y,backZ],[-11-b.half,b.y,backZ],[-11+b.half,b.y,backZ],[-11+a.half,a.y,backZ],'#d8d5c9');}};
  roofPart(staticGeo,-10.7,-19.3,cream);
  // Structural rib sweeping up and over the roof edges.
  for(const sign of [-1,1]){let last=null;for(let j=0;j<=35;j++){let v=j/35,half=.68+8.6*Math.pow(1-v,1.2),p=[-11+sign*half,4.35+15*v,-10.62-3.3*v*v];if(last)roofRibGeo.ribbon(last,p,.34,ivory);last=p;}}
  // Central dark arched door and fan-shaped upper window, both located near front facade.
  staticGeo.box(-10.9,2.0,-10.35,2.85,3.55,.22,'#344752');
  for(let i=0;i<=14;i++){let a=Math.PI*i/14,x=-10.9+1.43*Math.cos(a),y=3.8+1.38*Math.sin(a);staticGeo.sphere(x,y,-10.15,.09,.09,.11,'#d6dfe4',6,4);}
  staticGeo.box(-11,8.0,-10.50,3.3,1.65,.20,'#587887');
  for(let i=-1;i<=1;i++)staticGeo.box(-11+i*.98,7.95,-10.33,.09,1.65,.07,'#e8dfd4');
  // Thirty perforations: graphic analogy with source image, not measured.
  for(let r=0;r<4;r++)for(let c=0;c<6;c++){const x=-18.7+c*1.35+r*.30;staticGeo.cyl(x,1.05+r*.56,-10.42,.16,.16,.16,'#657f82',8);}
  // Curved wing extends to left, modeled with radial ribs and swept wall.
  for(let j=0;j<20;j++){let t0=j/20,t1=(j+1)/20;const wing=t=>[-26+16*t,2.8+13.3*t*t,-13.2-2.7*t];const a=wing(t0),b=wing(t1);staticGeo.quad([a[0],a[1],a[2]],[a[0],a[1]-1.15,a[2]],[b[0],b[1]-1.15,b[2]],[b[0],b[1],b[2]],'#e5d8c4');roofRibGeo.ribbon(a,b,.23,'#efe9d8');}
  // Separate cylindrical red tower on yellow annular podium.
  staticGeo.cyl(14.6,1.5,-15,5,2.6,5,'#cfad50',18);staticGeo.cyl(14.6,3.0,-15,5.65,.4,5.65,'#e1d2a7',20);staticGeo.cyl(14.6,8.0,-15,2.15,9.3,2.15,'#9d4d3e',18);
  for(let i=0;i<12;i++){const a=i*2*Math.PI/12;staticGeo.cyl(14.6+2.03*Math.cos(a),8,-15+2.03*Math.sin(a),.11,9.1,.11,'#c57a5b',6);}
  for(let i=0;i<14;i++){let a=i*2*Math.PI/14;staticGeo.box(14.6+4.5*Math.cos(a),1.38,-15+4.5*Math.sin(a),.5,1.3,.47,'#ece3c2');}
  // Low vegetation, stylized trees and a few rocks.
  const trees=[[-25,-17,2.5],[24,-17,3],[-24,14,3],[23,14,2.8],[19,-3,2],[-26,-3,2]];
  for(const [x,z,h] of trees){staticGeo.cyl(x,1.4,z,.25,2.5,.25,'#886748',7);staticGeo.sphere(x,3.3,z,1.6*h/3,1.3*h/3,1.7*h/3,'#467b57',12,7);}
  for(let i=0;i<22;i++){let x=-26+i*2.6,z=i%2===0?21:-21;staticGeo.sphere(x,.32,z,.7,.36,.58,i%3===0?'#9b9a80':'#66785c',8,5);}
  // Gates; when closed metal covers sit just below shallow symbolic water.
  gateLGeo.box(0,0,0,8.3,.55,12,['#ceb98d','#aa916c','#aa936f']);gateRGeo.box(0,0,0,8.3,.55,12,['#ceb98d','#aa916c','#aa936f']);
  for(const geo of [gateLGeo,gateRGeo])for(let i=-2;i<=2;i++)geo.box(i*1.7,.30,0,.10,.06,12,'#897b69');
  platformGeo.box(0,0,0,5.7,.42,4.5,['#d35b45','#a33e35','#963931']);platformGeo.box(0,.23,0,4.8,.10,3.7,'#c9bda1');
  // Robot with simple segmented silhouette (explicitly non-canonical).
  for(const s of [-1,1]){robotGeo.box(s*.88,1.7,0,1.05,3.25,1.2,['#365e7b','#23425a','#2d526d']);robotGeo.box(s*2.16,4.2,0,1.05,3.15,1.24,['#4d7791','#30506e','#30506e']);robotGeo.cyl(s*.89,.25,.02,.65,.47,.65,'#a2bdc5',9);}
  robotGeo.box(0,4.20,0,3.25,3.2,1.85,['#315570','#29465f','#223f54']);robotGeo.box(0,5.25,1.03,2.25,.35,.25,'#cc5944');robotGeo.box(0,6.0,0,1.65,1.55,1.5,['#e7e0d0','#c4c2bc','#b5b3ad']);robotGeo.box(0,6.9,0,.56,.55,1.75,'#b64337');
  for(const s of [-1,1])robotGeo.box(s*.45,6.08,.84,.48,.24,.2,'#f4b448');
  waterGeo.box(0,0,0,16,.09,11.5,'#5aa7bc');
  const groups={static:staticGeo.finalize(),ribs:roofRibGeo.finalize(),gateL:gateLGeo.finalize(),gateR:gateRGeo.finalize(),platform:platformGeo.finalize(),robot:robotGeo.finalize(),water:waterGeo.finalize()};
  const draw=(name,x=0,y=0,z=0)=>{const g=groups[name];gl.uniform3f(loc.offset,x,y,z);gl.bindVertexArray(g.vao);gl.drawArrays(gl.TRIANGLES,0,g.count);};
  let frames=0;
  function render(){
    const rect=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    const night=state.lightTime==='noche'?1:state.lightTime==='atardecer'?.34:0;
    gl.clearColor(...(state.lightTime==='noche'?[.10,.17,.24,1]:state.lightTime==='dia'?[.73,.83,.84,1]:[.89,.71,.60,1]));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);gl.uniform1f(loc.angle,state.angle);gl.uniform1f(loc.zoom,state.zoom);gl.uniform1f(loc.aspect,w/h);gl.uniform1f(loc.target,1.9);gl.uniform1f(loc.night,night);gl.uniform1f(loc.rain,state.weather==='lluvia'?1:0);
    draw('static');draw('ribs');draw('gateL',-4.25-8.8*state.opening,.55,0);draw('gateR',4.25+8.8*state.opening,.55,0);
    draw('platform',0,-11.15+state.lift,0);draw('robot',0,-10.8+state.lift,0);
    if(state.opening<.012)draw('water',0,.88,0);
    gl.bindVertexArray(null);frames++;
  }
  const ready=()=>!!(gl.getParameter(gl.VERSION)&&gl.getError()===gl.NO_ERROR);
  function dispose(){for(const g of Object.values(groups))gl.deleteVertexArray(g.vao);canvas.remove();}
  return {canvas,gl,render,ready,dispose,getFrames:()=>frames,geometryTriangles:Object.values(groups).reduce((n,g)=>n+g.count/3,0)};
}
