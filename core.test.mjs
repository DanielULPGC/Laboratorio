import assert from 'node:assert/strict';
import {acceleration,makeTrial,clearance,trajectory,isValidComparison,G,HEIGHT} from './core.mjs';
const tests=[];function test(name,fn){try{fn();tests.push({name,status:'PASS'});}catch(e){tests.push({name,status:'FAIL',reason:e.message});}}
test('a=F/m-g',()=>assert.ok(Math.abs(acceleration(20000,300000)-(15-G))<1e-10));
test('masa mayor disminuye a a fuerza fija',()=>assert.ok(makeTrial(40000,300).a<makeTrial(20000,300).a));
test('F<=mg impide elevarse',()=>assert.equal(trajectory(50000,100).possible,false));
test('pozo lateral despejado en reposo',()=>assert.equal(clearance(0,0).safe,true));
test('compuertas cerradas colisionan durante ascenso',()=>{assert.equal(clearance(0,6).safe,false);assert.equal(clearance(0,6).gateOverlap,true)});
test('apertura total sin solapamiento',()=>assert.equal(clearance(1,HEIGHT).safe,true));
test('holgura medible y monótona',()=>assert.ok(clearance(1,HEIGHT).marginX>clearance(.4,HEIGHT).marginX));
test('límites inválidos rechazados',()=>assert.throws(()=>clearance(1.4,0)));
test('trayectoria empieza en reposo y x=0',()=>{const p=trajectory(20000,300);assert.equal(p.x(0),0);assert.equal(p.v(0),0)});
test('trayectoria termina en reposo y altura final',()=>{const p=trajectory(20000,300);assert.ok(Math.abs(p.x(p.tTotal)-HEIGHT)<1e-9);assert.equal(p.v(p.tTotal),0)});
test('trayectoria posición continua en transición',()=>{const p=trajectory(20000,300);assert.ok(Math.abs(p.x(p.t1-1e-6)-p.x(p.t1+1e-6))<.001)});
test('trayectoria acotada y monótona',()=>{const p=trajectory(20000,300);let prev=0;for(let i=0;i<=100;i++){let x=p.x(i*p.tTotal/100);assert.ok(x>=prev-1e-9&&x<=HEIGHT+1e-9);prev=x}});
test('comparación requiere masas distintas con misma fuerza',()=>{assert.equal(isValidComparison([makeTrial(20000,300),makeTrial(40000,300)]),true);assert.equal(isValidComparison([makeTrial(20000,300),makeTrial(40000,400)]),false)});
console.log(JSON.stringify({total:tests.length,passed:tests.filter(t=>t.status==='PASS').length,results:tests},null,2));if(tests.some(t=>t.status==='FAIL'))process.exitCode=1;
