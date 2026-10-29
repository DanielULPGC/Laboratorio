const {chromium}=require(process.env.LAB_PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.LAB_QA_OUT||path.join(__dirname,'evidencia-qa'),base=process.env.LAB_QA_URL||'http://127.0.0.1:8766/';fs.mkdirSync(out,{recursive:true});
const cases=[],errors=[],external=[];async function check(name,fn){try{assert.notEqual(await fn(),false);cases.push({name,status:'PASS'})}catch(e){cases.push({name,status:'FAIL',detail:e.message})}}
async function sceneShot(pg,o){const bb=await pg.locator('#scene').boundingBox();return pg.screenshot({timeout:180000,...o,clip:bb});}
(async()=>{
 const browser=await chromium.launch({channel:process.env.LAB_BROWSER_CHANNEL||undefined,headless:true,args:process.env.LAB_BROWSER_CHANNEL?[]:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',acceptDownloads:true});
 await context.route('**/*',r=>{if(r.request().url().startsWith(base))r.continue();else{external.push(r.request().url());r.abort()}});const p=await context.newPage();p.setDefaultTimeout(240000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?view=robot&zone=head');await p.waitForFunction(()=>window.laboratorio);await p.waitForTimeout(200);
 await check('El enlace de zona abre su cámara y su ficha accesible',()=>p.evaluate(()=>laboratorio.getState().view==='detail'&&laboratorio.getState().figureZone==='head'&&!document.getElementById('figureStudy').hidden));
 const before=await p.evaluate(()=>laboratorio.getState()),zones=await p.locator('#figureZone option').evaluateAll(os=>os.map(o=>o.value));
 await check('Diez zonas y una vista completa están disponibles',()=>zones.length===11&&new Set(zones).size===11);
 await check('Pulsar el indicador en la malla 3D selecciona su zona',async()=>{await p.locator('#figureZone').selectOption('chest');await p.waitForTimeout(400);const canvas=p.locator('#renderHost canvas:not([hidden])'),box=await canvas.boundingBox(),pt=await p.evaluate(()=>laboratorio.project?laboratorio.project([0,4.6,.79]):null);await canvas.click({position:pt?{x:pt.x*box.width,y:pt.y*box.height}:{x:box.width*.5,y:box.height*.5}});return await p.evaluate(()=>laboratorio.getState().figureZone==='gauge')});
 await check('La aguja del pecho sigue la masa del experimento',()=>p.evaluate(()=>{const d=laboratorio.diagnostics().renderer.character;return d.load===laboratorio.getState().massKg&&Math.abs(d.needleAngle-Math.PI/3)<1e-9}));
 await check('Los controles anterior y siguiente recorren las zonas',async()=>{await p.locator('#figureZone').selectOption('head');await p.locator('#nextZone').click();assert.equal(await p.locator('#figureZone').inputValue(),'sensors');await p.locator('#previousZone').click();return await p.locator('#figureZone').inputValue()==='head'});
 for(const zone of zones.filter(z=>z!=='all')){
  await p.locator('#figureZone').selectOption(zone);await p.waitForTimeout(80);
  await check('Enfoque y medidas: '+zone,async()=>{assert.equal((await p.evaluate(()=>laboratorio.getState())).figureZone,zone);assert.equal(await p.locator('#figureMetrics dd').count(),3);return (await p.locator('#figureTitle').textContent()).length>5});
  await sceneShot(p,{path:path.join(out,`zona-${zone}.png`)});
  await p.locator('#isolateZone').check();await check('Aislamiento real: '+zone,()=>p.evaluate(z=>laboratorio.diagnostics().renderer.character.isolatedZone===z,zone));
  if(['head','gauge','hands','back'].includes(zone))await sceneShot(p,{path:path.join(out,`aislado-${zone}.png`)});
  await p.locator('#isolateZone').uncheck();
 }
 await check('Recorrer e aislar no modifica el experimento',async()=>{const after=await p.evaluate(()=>laboratorio.getState());for(const k of ['opening','lift','phase','massKg','forceKN','trials','prediction'])assert.deepEqual(after[k],before[k]);return true});
 await p.locator('#figureZone').selectOption('head');
 await p.locator('#figureStudy summary').click();const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#downloadFigure').click()]);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const spec=JSON.parse(Buffer.concat(chunks).toString());
 await check('Ficha descargada contiene cotas, materiales y límites',()=>spec.zones.length===10&&spec.materials.length>5&&spec.figure.dimensions.height>6&&spec.limits.length>0);
 await check('La descarga coincide con la ficha producida al compilar',()=>{assert.deepEqual(spec,JSON.parse(fs.readFileSync(path.join(__dirname,'dist/ROBOT_DETALLE.json'),'utf8')));return true});
 await p.screenshot({timeout:180000,path:path.join(out,'inspector-escritorio.png'),fullPage:true});
 await p.locator('#figureZone').selectOption('all');await check('Volver al robot completo restaura las piezas y la cámara general',()=>p.evaluate(()=>laboratorio.getState().view==='robot'&&laboratorio.diagnostics().renderer.character.isolatedZone===null));
 await sceneShot(p,{path:path.join(out,'robot-completo.png')});
 for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.locator('#figureZone').selectOption('hands');await check('Inspector sin desbordamiento a '+width+' px',()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await sceneShot(p,{path:path.join(out,`movil-${width}.png`)});}
 await p.setViewportSize({width:1440,height:1100});await p.goto(base+'?render=canvas&zone=feet');await p.waitForFunction(()=>window.laboratorio);
 await check('La alternativa 2D enfoca la zona y explica sus límites',()=>p.evaluate(()=>laboratorio.getState().figureZone==='feet'&&laboratorio.diagnostics().engine==='Canvas local'&&document.getElementById('isolateZone').disabled&&document.getElementById('figureMeasureNote').textContent.includes('esquemática')));
 await p.locator('#settingsBtn').click();await p.locator('#pixelSetting').check();await p.locator('.dialog-close').click();await p.waitForTimeout(150);
 await check('La inspección 2D conserva la paleta de 64 colores',()=>p.evaluate(()=>{const d=laboratorio.diagnostics();return d.renderer.paletteValid&&d.renderer.pixelColors<=64}));
 await check('La ficha no contiene referencias a personajes o productos externos',()=>!/mazinger|bandai|tamashii|https?:/i.test(JSON.stringify(spec)));
 await check('Sin dependencias externas ni errores JavaScript',()=>errors.length===0&&external.length===0);
 await context.close();await browser.close();const report={version:'LA-03.0',status:cases.every(c=>c.status==='PASS')?'PASS':'FAIL',total:cases.length,passed:cases.filter(c=>c.status==='PASS').length,errors,external,cases};fs.writeFileSync(path.join(out,'precision-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
