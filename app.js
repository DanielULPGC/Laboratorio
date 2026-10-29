const $=id=>document.getElementById(id);
const state={stage:'predecir',predicted:false,prediction:'',observed:false,trials:[],explained:false,earned:false,opening:0,lift:0,elapsed:0,run:null,phase:'idle',paused:false,mode:'book',angle:.7,zoom:1,reason:'',engine:'iniciando',lastTime:0,lightTime:'atardecer',weather:'seco',pixel:false,events:[],waves:[],ambientClock:0,lastPixelFrame:0};
const els={scene:$('scene'),canvas:$('view'),feedback:$('feedback'),stamp:$('stamp')};
const number=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n);
function feedback(s){els.feedback.textContent=s;}
function logEvent(message){state.events.unshift({id:state.events.length?state.events[0].id+1:1,text:message});state.events=state.events.slice(0,12);const list=$('events');list.replaceChildren();for(const e of state.events){const li=document.createElement('li');li.textContent=String(e.id).padStart(2,'0')+' · '+e.text;list.append(li);}}
function addWave(amplitude=.9,x=0,z=0){state.waves.push({age:0,amplitude,x,z});state.waves=state.waves.slice(-12);}
function updateAgentUI(){const a=agentStatuses(state);$('agents').textContent='Operador: '+a.operador+' · Supervisor: '+a.supervisor+' · Observador: '+a.observador;}
function rendererLabel(){return state.pixel?'diorama Canvas · 64 colores OKLab':state.engine;}

function physical(){let massKg=+$('mass').value,forceKN=+$('thrust').value;return {massKg,forceKN,a:acceleration(massKg,forceKN*1000)}}
function updateUI(){const p=physical(),c=clearance(state.opening,state.lift),step=!state.predicted?'Predecir':!state.observed?'Observar':!isValidComparison(state.trials)?'Experimentar':!state.explained?'Explicar':'Evaluar';$('step').textContent='Etapa: '+step;$('height').textContent='Altura: '+number(state.lift)+' m';$('acc').textContent='Aceleración inicial ideal: '+number(p.a)+' m/s²';$('massVal').textContent=number(p.massKg);$('thrustVal').textContent=number(p.forceKN);$('margin').textContent='Holgura horizontal: '+number(c.marginX)+' m';$('safety').textContent='Comprobación de envolventes: '+(c.safe?'sin intersección detectada':'intersección detectada');$('progress').textContent=`Evidencias: predicción ${state.predicted?'✓':'—'} · apertura ${state.observed?'✓':'—'} · ensayos ${state.trials.length} · explicación ${state.explained?'✓':'—'}`;$('engineStatus').textContent='Representación: '+rendererLabel();updateAgentUI();
 $('run').disabled=state.phase==='lifting'||!liftInterlock(state,clearance(state.opening,state.lift)).allowed;$('observe').disabled=!state.predicted||state.phase==='opening';$('flapBtn').disabled=!isValidComparison(state.trials);
 $('pause').textContent=state.paused?'Reanudar':'Pausar';$('stamp').classList.toggle('earned',state.earned);
 $('stamp').textContent=state.earned?'SELLO OBTENIDO':'SELLO PENDIENTE';
 ['book','cinema','section'].forEach(m=>{$(m+'Mode').setAttribute('aria-pressed',String(m===state.mode))});
}
function setupControls(){
 $('predict').addEventListener('click',()=>{if(!$('answer').value){feedback('Selecciona una hipótesis.');return;}state.prediction=$('answer').value;state.predicted=true;logEvent('Predicción registrada');feedback('Hipótesis registrada. Observa ahora cómo se abren las compuertas.');updateUI()});
 $('observe').addEventListener('click',()=>{if(!state.predicted){feedback('Registra primero una predicción.');return;}state.phase='opening';state.paused=false;addWave(.95,0,0);logEvent('Compuertas: apertura iniciada');feedback('Apertura en curso: observa las compuertas y el margen del pozo.');updateUI()});
 $('run').addEventListener('click',()=>{if(state.phase==='lifting'){feedback('El ascenso ya está en marcha; espera a que finalice o modifica los parámetros.');return;}if(!state.observed||state.opening<.999){feedback('Apertura incompleta: elevación bloqueada.');return;}const permit=liftInterlock(state,clearance(state.opening,state.lift));if(!permit.allowed){feedback('Ascenso bloqueado: '+permit.reason);logEvent('Interbloqueo: '+permit.reason);return;}const {massKg,forceKN}=physical();const p=trajectory(massKg,forceKN);const trial=makeTrial(massKg,forceKN);state.trials.push(trial);logEvent('Ensayo '+state.trials.length+': '+number(massKg)+' kg y '+number(forceKN)+' kN');addWave(.45,-1.5,1);if(!p.possible){state.phase='idle';state.lift=0;feedback('Ensayo registrado: F ≤ mg; el robot no puede iniciar el ascenso. Prueba una masa distinta manteniendo la fuerza.');}else{state.run=p;state.elapsed=0;state.lift=0;state.phase='lifting';state.paused=false;feedback('Ensayo registrado. El elevador acelera y frena hasta detenerse a 9 m.')}renderTrials();updateUI()});
 ['mass','thrust'].forEach(id=>$(id).addEventListener('input',()=>{if(state.phase==='lifting'){state.phase='idle';state.run=null;state.lift=0;feedback('Parámetros modificados: se ha interrumpido el ensayo anterior.')}updateUI()}));
 $('pause').addEventListener('click',()=>{state.paused=!state.paused;logEvent(state.paused?'Secuencia pausada':'Secuencia reanudada');updateUI()});
 $('flapBtn').addEventListener('click',()=>{if(!isValidComparison(state.trials)){feedback('Realiza dos ensayos con masas distintas manteniendo la misma fuerza.');return;}state.explained=true;logEvent('Solapa explicativa abierta');$('flap').hidden=false;$('flapBtn').setAttribute('aria-expanded','true');feedback('Solapa abierta. Compara tus resultados y redacta una justificación.');updateUI()});
 $('earn').addEventListener('click',()=>{const justification=$('justification').value.trim();state.reason=justification;let complete=state.prediction===expectedPrediction()&&state.observed&&isValidComparison(state.trials)&&state.explained&&justification.length>=45;
 if(!complete){feedback('No se concede el sello: comprueba la hipótesis, los dos ensayos comparables y una justificación de al menos 45 caracteres.');return;}state.earned=true;logEvent('Sello de participación concedido (pendiente de revisión docente)');feedback('Sello de participación conseguido. La justificación está registrada, pero debe evaluarse académicamente por una persona docente.');updateUI()});
 $('reset').addEventListener('click',()=>{Object.assign(state,{stage:'predecir',predicted:false,prediction:'',observed:false,trials:[],explained:false,earned:false,opening:0,lift:0,elapsed:0,run:null,phase:'idle',paused:false,reason:'',waves:[],ambientClock:0,events:[]});logEvent('Sistema reiniciado');$('answer').value='';$('mass').value='20000';$('thrust').value='300';$('justification').value='';$('flap').hidden=true;$('flapBtn').setAttribute('aria-expanded','false');renderTrials();feedback('Modelo reiniciado. Registra una predicción para comenzar.');updateUI()});
 ['book','cinema','section'].forEach(m=>$(m+'Mode').addEventListener('click',()=>{state.mode=m;feedback(m==='section'?'Inspección: se muestran las envolventes del pozo y del robot.':m==='cinema'?'Cámara de exploración: vista automática en movimiento.':'Modo libro: sigue las cinco fases de aprendizaje.');updateUI()}));
 $('lightTime').addEventListener('change',()=>{state.lightTime=$('lightTime').value;logEvent('Iluminación: '+state.lightTime);draw()});
 $('weather').addEventListener('change',()=>{state.weather=$('weather').value;logEvent('Meteorología: '+weatherLabel(state.weather));draw()});
 $('pixelBtn').addEventListener('click',()=>{state.pixel=!state.pixel;const btn=$('pixelBtn');btn.setAttribute('aria-pressed',String(state.pixel));btn.textContent=state.pixel?'Volver a vista normal':'Diorama de 64 colores';if(state.pixel){active3D=false;$('view').hidden=false;$('three').hidden=true;}else if(threeReady){active3D=true;$('view').hidden=true;$('three').hidden=false;}logEvent(state.pixel?'Modo Canvas pixelado activado':'Modo pixelado desactivado');draw();updateUI()});
 $('left').addEventListener('click',()=>{state.angle-=Math.PI/8;draw()});$('right').addEventListener('click',()=>{state.angle+=Math.PI/8;draw()});$('zoomIn').addEventListener('click',()=>{state.zoom=Math.min(1.8,state.zoom*1.15);draw()});$('zoomOut').addEventListener('click',()=>{state.zoom=Math.max(.65,state.zoom/1.15);draw()});
 $('view').addEventListener('pointerdown',e=>{state.drag=[e.clientX,e.clientY];$('view').setPointerCapture(e.pointerId)});$('view').addEventListener('pointermove',e=>{if(!state.drag)return;state.angle+=(e.clientX-state.drag[0])*.009;state.drag=[e.clientX,e.clientY];draw()});$('view').addEventListener('pointerup',()=>state.drag=null);$('view').addEventListener('pointercancel',()=>state.drag=null);
 $('view').addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.65,Math.min(1.8,state.zoom*(e.deltaY>0?.92:1.08)));draw()},{passive:false});
 window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key==='ArrowLeft'){state.angle-=.15;draw()}if(e.key==='ArrowRight'){state.angle+=.15;draw()}});
}
function renderTrials(){const tbody=$('trials');tbody.replaceChildren();for(const [i,t] of state.trials.entries()){const tr=document.createElement('tr');[i+1,number(t.massKg),number(t.forceKN),number(t.a),t.canRise?'Sí':'No'].forEach(x=>{const td=document.createElement('td');td.textContent=String(x);tr.append(td)});tbody.appendChild(tr)}if(!state.trials.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='Todavía no hay ensayos registrados.';tr.append(td);tbody.append(tr)}}
const displayCtx=$('view').getContext('2d',{willReadFrequently:false});let ctx=displayCtx;let W=0,H=0,scale=1,dpr=1;let active3D=false,threeReady=false,glRenderer=null;
const pixelCanvas=document.createElement('canvas'),pixelCtx=pixelCanvas.getContext('2d',{willReadFrequently:true});
let pixelWidth=360,pixelHeight=220,oklabLut=null;
function paintPixelFrame(){if(!oklabLut)oklabLut=buildOklabLut();let frame=pixelCtx.getImageData(0,0,pixelWidth,pixelHeight);quantizePixels(frame,oklabLut);pixelCtx.setTransform(1,0,0,1,0,0);pixelCtx.putImageData(frame,0,0);displayCtx.setTransform(dpr,0,0,dpr,0,0);displayCtx.clearRect(0,0,W,H);displayCtx.imageSmoothingEnabled=false;displayCtx.drawImage(pixelCanvas,0,0,W,H);displayCtx.imageSmoothingEnabled=true;}

function resizeCanvas(){const bounds=els.scene.getBoundingClientRect();W=Math.max(300,Math.floor(bounds.width));H=Math.max(260,Math.floor(bounds.height));dpr=Math.min(window.devicePixelRatio||1,2);$('view').width=Math.round(W*dpr);$('view').height=Math.round(H*dpr);$('view').style.width=W+'px';$('view').style.height=H+'px';ctx=displayCtx;displayCtx.setTransform(dpr,0,0,dpr,0,0);pixelWidth=Math.max(220,Math.min(390,Math.round(W/3)));pixelHeight=Math.max(140,Math.round(pixelWidth*H/W));pixelCanvas.width=pixelWidth;pixelCanvas.height=pixelHeight;scale=Math.min(W/62,H/39)*state.zoom;draw()}
function project(x,y,z){const c=Math.cos(state.angle),s=Math.sin(state.angle);return [W*.50+(x*c-z*s)*scale,H*.53+((x*s+z*c)*.46-y*.89)*scale]}
function polygon(points,color,stroke='#334653',lw=.8){ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function cube(x,y,z,w,h,d,colors){const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;polygon([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],colors[0]);polygon([[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[x0,y0,z1]],colors[1]);polygon([[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],[x1,y0,z0]],colors[2]);}
function line3(a,b,color='#c78c4d',width=2,dash=[]){const p=project(...a),q=project(...b);ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(...p);ctx.lineTo(...q);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();ctx.setLineDash([])}
function label3(text,pos,color='#172d3b'){const [x,y]=project(...pos);ctx.save();ctx.font='bold 12px system-ui';ctx.fillStyle=color;ctx.fillText(text,x+5,y-6);ctx.restore()}
function draw(){if(active3D)return;if(!W||!H)return;
 if(state.pixel){ctx=pixelCtx;ctx.setTransform(pixelWidth/W,0,0,pixelHeight/H,0,0);}else{ctx=displayCtx;ctx.setTransform(dpr,0,0,dpr,0,0);}
 ctx.clearRect(0,0,W,H);const grad=ctx.createLinearGradient(0,0,0,H);
 const sky={dia:['#dce7db','#d0d2b2'],atardecer:['#efc5a5','#b8bdad'],noche:['#344957','#6a686a']}[state.lightTime];
 grad.addColorStop(0,sky[0]);grad.addColorStop(1,sky[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 // Floating technical plate; objects are deliberately simplified drawing primitives.
 cube(0,-.9,0,44,1.4,35,['#c6b99e','#897e67','#a99a7b']);
 // Paved perimeter and vegetation markers.
 for(const [x,z] of [[-19,13],[-17,14],[-18,-14],[18,14],[19,-14]]){cube(x,.5,z,.5,1.4,.5,['#456e55','#385e4a','#2c4f41']);cube(x,1.45,z,2,1,2,['#709775','#527b5e','#406b56'])}
 // Tres figuras informativas basadas en reglas, sin comportamiento autónomo ni personajes canónicos.
 const operatorX=-6.6+Math.sin(state.ambientClock*.4)*.3;
 cube(operatorX,0.5,-13.7,.55,.85,.5,['#f4d4b2','#bf9073','#ac7c60']);cube(operatorX,1.3,-13.7,.8,.85,.55,['#d0a044','#a97921','#9f762a']);
 cube(11.3,0.5,9,.55,.85,.5,['#f4d4b2','#bf9073','#ac7c60']);cube(11.3,1.3,9,.8,.85,.55,[state.phase==='blocked'?'#df4332':'#a34435','#883c38','#70302f']);
 cube(-13,0.5,8,.55,.85,.5,['#f4d4b2','#bf9073','#ac7c60']);cube(-13,1.3,8,.8,.85,.55,['#506f79','#3e5c67','#384e59']);
 // MZ-02.3: revised silhouette drawn from the supplied low-resolution screenshot.
 // This is a reasoned visual approximation, never a measured architectural reconstruction.
 cube(-12,2.7,-13,18,5.2,9,['#eee6d9','#d9d1c1','#c4c6b8']);
 // White, pointed, curved sail facade (projected hand-built mesh).
 const sailRow=t=>({x:8.1*Math.pow(1-t,1.18)+.38,y:4.8+14.6*t,z:-8.5-3.3*t*t});
 let left=[],right=[];for(let j=0;j<=32;j++){let t=j/32,a=sailRow(t);left.push([-12-a.x,a.y,a.z]);right.push([-12+a.x,a.y,a.z]);}
 polygon([...left,...right.slice().reverse()],'#eee9dc','#e5e6db',1.3);
 for(let j=0;j<32;j++){line3(left[j],left[j+1],'#faf9eb',3);line3(right[j],right[j+1],'#fffaf2',3);}
 // Archway and upper window, simplified as graphic shapes close to the facade.
 cube(-11.8,2.3,-8.34,2.6,3.8,.12,['#384651','#3f505a','#3a515e']);
 const arc=[];for(let j=0;j<=18;j++){let a=Math.PI*j/18;arc.push([-12+1.45*Math.cos(a),7.9+1.75*Math.sin(a),-8.18]);}
 polygon([[-13.5,7.75,-8.15],...arc,[-10.5,7.75,-8.15]],'#5f7580','#d0d8d6',1.3);
 for(let c=-1;c<=1;c++)line3([-12+c*.67,7.75,-8.0],[-12+c*.67,9.2-Math.abs(c)*.4,-8.0],'#e3e6df',1);
 // Left wing: curving roof, ridge and buttresses.
 let previous=null;for(let j=0;j<=24;j++){let t=j/24,cur=[-27+15*t,3.0+13.5*t*t,-10-2.1*t];if(previous){polygon([previous,[previous[0],previous[1]-1.25,previous[2]],[cur[0],cur[1]-1.25,cur[2]],cur],'#e2d9c7','#b4aca3',.8);line3(previous,cur,'#fcf4e4',2.2);}previous=cur;}
 for(let r=0;r<4;r++)for(let c=0;c<6;c++){const x=-19+c*1.1+r*.24;cube(x,1.1+r*.53,-8.13,.26,.23,.07,['#70818a','#4b5f69','#5e6c70']);}
 // Tower: reddish central chimney and yellow base, facade simplified.
 cube(13,1.5,-11.5,8,2.7,7,['#e5c962','#b79c45','#bda753']);
 cube(13,6,-11.5,3.1,9,3.1,['#b26550','#914f43','#8a4c45']);
 for(let i=-2;i<=2;i++)cube(13+i*.46,6.05,-9.9,.18,8.6,.2,['#cd8567','#985342','#bd7157']);
 cube(13,10.9,-11.5,3.45,.35,3.45,['#eee1c7','#c5b6a8','#d8c6ac']);
 // Front pond: white rim and turquoise water, traced as an ellipse rather than an exact plan.
 const ring=(rx,rz,y)=>Array.from({length:48},(_,i)=>{const a=i*2*Math.PI/48;return [5.8+Math.cos(a)*rx,y,14.4+Math.sin(a)*rz]});
 polygon(ring(9,4.6,.59),'#f5e8ce','#ede4d4',2);
 polygon(ring(8.4,4.0,.63),'#6da5bf','#f1ecdc',2.1);
 // Base slab surrounding pool drawn in four strips; actual opening visible.
 cube(0,-.1,-7.4,19,.65,2.2,['#c3b59e','#a89b87','#a29a87']);cube(0,-.1,7.4,19,.65,2.2,['#c3b59e','#a89b87','#a29a87']);cube(-10,-.1,0,1,.65,12.4,['#c3b59e','#a89b87','#a29a87']);cube(10,-.1,0,1,.65,12.4,['#c3b59e','#a89b87','#a29a87']);
 // Shaft walls and rails.
 cube(0,-11.55,0,18,.25,12.5,['#384f59','#293c44','#314651']);
 for(const x of [-8.9,8.9])cube(x,-5.6,0,.42,11.4,12.4,['#74848a','#596b73','#5e6974']);
 for(const z of [-6.1,6.1]){cube(0,-5.6,z,18,11.4,.32,['#849398','#677a82','#62737d']);}
 for(const x of [-7.2,7.2])for(const z of [-4.5,4.5])line3([x,-11,z],[x,0,z],'#a7c2c9',1.3);
 // Mobile platform with visual articulated robot envelope.
 cube(0,-11.15+state.lift,0,5.7,.38,4.5,['#c9664d','#a24132','#943a2f']);
 let by=-10.8+state.lift;
 for(const s of [-1,1])cube(s*.88,by+1.65,0,1.0,3.2,1.25,['#34566f','#21384d','#25445e']);
 cube(0,by+4.1,0,3.1,3,1.8,['#30506b','#263f59','#1f334b']);
 cube(0,by+5.95,0,1.65,1.5,1.5,['#e8e0d1','#c8c0b4','#bbb1a5']);
 cube(0,by+6.75,0,.7,.32,1.6,['#c9523f','#a44031','#96362c']);
 for(const s of [-1,1]){cube(s*2.12,by+4.05,0,1.05,3.1,1.2,['#49708a','#31516f','#2d4861']);}
 cube(0,by+5.05,.95,2.4,.3,.35,['#d8644b','#ab4637','#ba4734']);
 // Gate leaves and rail guides.
 for(const z of [-6.6,6.6])line3([-17,.66,z],[17,.66,z],'#8f6a44',2.5);
 const shift=state.opening*8.8;
 cube(-4.25-shift,.40,0,8.3,.55,12,['#d1b681','#aa9066','#aa946f']);cube(4.25+shift,.40,0,8.3,.55,12,['#d1b681','#aa9066','#aa946f']);
 for(const s of [-1,1]){const x=s*(4.25+shift);for(let i=-2;i<=2;i++)line3([x-3.6,.70,i*2.1],[x+3.6,.70,i*2.1],'#836746',1)}
 if(state.opening<.95){
 polygon([[-8,.72,-5.6],[8,.72,-5.6],[8,.72,5.6],[-8,.72,5.6]],'rgba(78,148,169,'+(0.22*(1-state.opening)).toFixed(3)+')',null);
 const waves=[...state.waves];
 if(state.weather==='lluvia')for(let i=0;i<5;i++){const clock=state.ambientClock+i*.78;const age=(clock%2.2);waves.push({age,amplitude:.22,x:Math.sin(i*5.7)*6,z:Math.cos(i*3.1)*4});}
 ctx.save();ctx.beginPath();[[-8,.73,-5.6],[8,.73,-5.6],[8,.73,5.6],[-8,.73,5.6]].forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();ctx.clip();
 for(const wave of waves){const r=rippleRadius(wave.age),alpha=rippleOpacity(wave.age,wave.amplitude);if(alpha<.012)continue;ctx.beginPath();for(let j=0;j<=32;j++){const theta=j*Math.PI*2/32;const q=project(wave.x+Math.cos(theta)*r,.75,wave.z+Math.sin(theta)*r);j?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.strokeStyle='rgba(232,251,255,'+alpha.toFixed(3)+')';ctx.lineWidth=1.8;ctx.stroke();}ctx.restore();
 }
 if(state.mode==='section'){
 for(const x of [-2.7,2.7])for(const z of [-1.05,1.05])line3([x,by,z],[x,by+6.9,z],'#d35543',1.6,[5,4]);
 line3([-8.8,-11.2,6.2],[8.8,-11.2,6.2],'#f4c468',3);label3('Envolventes simplificadas',[3,by+7,0],'#9e4c2d');
 }
 label3('INSTITUTO · maqueta interpretativa',[-18,8.5,-11]);label3('POZO',[1,0,6.2]);
 if(state.lightTime==='noche'){ctx.fillStyle='rgba(12,24,43,.22)';ctx.fillRect(0,0,W,H);}
 ctx.font='12px system-ui';ctx.fillStyle=state.lightTime==='noche'?'#f4e8d0':'#415260';ctx.fillText('Diorama interpretativo · dibujo 2D de geometría isométrica',14,H-13);
 if(state.pixel)paintPixelFrame();
}

function animate(t){if(!state.lastTime)state.lastTime=t;const dt=Math.min(.06,Math.max(0,(t-state.lastTime)/1000));state.lastTime=t;if(!state.paused){state.ambientClock+=dt;for(const wave of state.waves)wave.age+=dt;state.waves=state.waves.filter(w=>w.age<3.5);if(state.phase==='opening'){state.opening=Math.min(1,state.opening+dt*.42);if(state.opening>=1){state.phase='idle';state.observed=true;logEvent('Compuertas: apertura completada');feedback('Compuertas abiertas. Realiza al menos dos ensayos con la misma fuerza y masas diferentes.')}}else if(state.phase==='lifting'){state.elapsed+=dt;state.lift=state.run.x(state.elapsed);const check=clearance(state.opening,state.lift);if(!check.safe){state.paused=true;state.phase='blocked';logEvent('Alerta: intersección geométrica');feedback('Movimiento detenido: se ha detectado una intersección entre envolventes.')}else if(state.elapsed>=state.run.tTotal){state.lift=HEIGHT;state.phase='idle';logEvent('Elevación completada con frenado');feedback(`Elevación concluida y frenada en ${number(state.run.tTotal)} s (modelo idealizado).`)}}if(state.mode==='cinema')state.angle+=dt*.065;}if(!state.pixel||t-state.lastPixelFrame>65){draw();state.lastPixelFrame=t;}updateUI();if(active3D&&glRenderer){try{glRenderer.render();}catch(e){active3D=false;state.engine="Canvas de respaldo: error WebGL2";$("view").hidden=false;$("three").hidden=true;logEvent("Fallo de representación 3D: "+e.message);}}requestAnimationFrame(animate)}
// Local WebGL2 replaces the unverified network-based Three.js path.
function startOfflineGL(){
 try{
   glRenderer=makeOfflineGL($('three'),state);
   if(!glRenderer.ready())throw Error('Inicialización WebGL2 no válida');
   threeReady=true;active3D=!state.pixel;
   $('view').hidden=active3D;$('three').hidden=!active3D;
   state.engine='WebGL2 local sin conexión (NO Three.js)';
   glRenderer.render();
   const canvas=glRenderer.canvas;
   canvas.addEventListener('pointerdown',e=>{state.drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
   canvas.addEventListener('pointermove',e=>{if(state.drag){state.angle+=(e.clientX-state.drag[0])*.009;state.drag=[e.clientX,e.clientY];}});
   canvas.addEventListener('pointerup',()=>state.drag=null);
   canvas.addEventListener('pointercancel',()=>state.drag=null);
   canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.65,Math.min(1.8,state.zoom*(e.deltaY>0?.92:1.08)))},{passive:false});
   logEvent('WebGL2 local inicializado · '+glRenderer.geometryTriangles+' triángulos procedurales');
 }catch(e){active3D=false;threeReady=false;state.engine='Canvas 2D de respaldo: WebGL2 no disponible';$('view').hidden=false;$('three').hidden=true;logEvent('WebGL2 no disponible: '+e.message);}
 updateUI();draw();
}
setupControls();renderTrials();resizeCanvas();state.engine='Inicializando WebGL2 local';updateUI();new ResizeObserver(resizeCanvas).observe(els.scene);logEvent('Sistema iniciado · agentes regidos por estados');requestAnimationFrame(animate);startOfflineGL();
