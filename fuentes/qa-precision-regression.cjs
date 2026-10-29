const { chromium } = require(process.env.LAB_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const out = process.env.LAB_QA_OUT || path.join(__dirname, 'evidencia-qa');
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [], external = [], diagnostics = {};
async function check(name, fn) { try { const value = await fn(); assert.notEqual(value, false); results.push({ name, status: 'PASS' }); } catch (e) { results.push({ name, status: 'FAIL', detail: e.message }); } }
async function group(name, fn) { try { await fn(); } catch (e) { results.push({ name, status: 'BLOCKED', detail: e.message }); } }
async function load(page, url = 'http://127.0.0.1:8766/') { page.setDefaultTimeout(240000); page.on('pageerror', e => errors.push(e.message)); await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.laboratorio); }
async function waitFinished(page, count) { await page.waitForFunction(n => { const s = laboratorio.getState(); return s.phase === 'idle' && s.trials.length === n; }, count, { timeout: 240000 }); }
async function predict(page, value = 'down') { await page.locator(`input[name="prediction"][value="${value}"]`).check(); await page.locator('#predictBtn').click(); }
async function finishReflection(page) { await page.locator('#conclusion').selectOption('down'); await page.locator('#explanation').fill('Cambié la masa y mantuve la misma fuerza máxima. La aceleración inicial fue menor con el robot más pesado.'); await page.locator('#earnBtn').click(); }
async function sceneShot(pg,o){const bb=await pg.locator('#scene').boundingBox();return pg.screenshot({timeout:180000,...o,clip:bb});}
(async () => {
 const browser = await chromium.launch({ channel: process.env.LAB_BROWSER_CHANNEL || undefined, headless: true, args: process.env.LAB_BROWSER_CHANNEL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); diagnostics.browser = browser.version();
 await group('Recorrido WebGL de escritorio', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  await context.route('**/*', r => { if (r.request().url().startsWith('http://127.0.0.1:8766/')) r.continue(); else { external.push(r.request().url()); r.abort(); } });
  const page = await context.newPage(); await load(page); await page.waitForTimeout(600);
  diagnostics.desktop = await page.evaluate(() => laboratorio.diagnostics());
  await check('WebGL real con Three.js 160 empaquetado', () => diagnostics.desktop.engine.includes('WebGL') && diagnostics.desktop.renderer.revision === '160' && diagnostics.desktop.renderer.triangles > 1000);
  await check('Geometría real del robot incluida en la envolvente', () => { const b = diagnostics.desktop.renderer.robotBounds; return b.min[0] >= -2.7 && b.max[0] <= 2.7 && b.min[2] >= -1.05 && b.max[2] <= 1.05 && b.min[1] >= -10.8 && b.max[1] <= -4.1; });
  await check('Formulario sin predicción responde con una indicación', async () => { await page.locator('#predictBtn').click(); return (await page.locator('#feedback').innerText()).includes('Elige una idea'); });
  await check('Pestañas recorren el panel con flechas del teclado', async () => { await page.locator('#missionTab').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#notebookTab').getAttribute('aria-selected'), 'true'); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#inspectTab').getAttribute('aria-selected'), 'true'); await page.keyboard.press('Home'); return await page.locator('#missionTab').getAttribute('aria-selected') === 'true'; });
  await check('Pieza de la escena abre la inspección', async () => { await page.locator('[data-part="gates"]').click(); return (await page.locator('#partDetail').innerText()).includes('interbloqueo'); });
  await page.locator('#partList button').filter({ hasText: 'Elevador' }).click(); await page.locator('#partList button').filter({ hasText: 'Brezo' }).click();
  await check('Tres piezas distintas conceden logro de observación', async () => (await page.locator('#inspectedCount').innerText()).includes('3 de 3') && (await page.locator('#badgeObserver').getAttribute('class')).includes('earned'));
  await page.locator('#missionTab').click(); await predict(page, 'up');
  await check('Predicción inicial se conserva sin corregirla automáticamente', () => page.evaluate(() => laboratorio.getState().initialPrediction === 'up' && laboratorio.getState().stage === 1));
  await page.locator('#openBtn').click(); await page.waitForFunction(() => laboratorio.getState().opening > .05);
  await check('Compuertas y apertura animada comparten estado', () => page.evaluate(() => { const s = laboratorio.getState(); return s.phase === 'opening' && s.opening > 0 && s.opening < 1; }));
  await page.locator('#pauseBtn').click(); const openingPaused = await page.evaluate(() => laboratorio.getState().opening); await page.waitForTimeout(220);
  await check('Pausa detiene la apertura', async () => Math.abs((await page.evaluate(() => laboratorio.getState().opening)) - openingPaused) < .0001);
  await page.locator('#pauseBtn').click(); await page.waitForFunction(() => laboratorio.getState().observed);
  await check('Apertura completa habilita el ensayo', () => page.locator('#runBtn').isEnabled());
  await page.locator('#runBtn').click();
  await check('Masa y fuerza bloqueadas mientras se mueve', async () => await page.locator('#mass').isDisabled() && await page.locator('#thrust').isDisabled());
  await page.waitForFunction(() => laboratorio.getState().phase === 'lifting' && laboratorio.getState().lift > 3.5 && laboratorio.getState().lift < 8.9);
  await page.waitForFunction(() => document.getElementById('modelCaption').textContent.includes('Para frenar'));
  await check('Flechas distinguen empuje aplicado durante el frenado', async () => (await page.locator('#modelCaption').innerText()).includes('menor que el peso'));
  await waitFinished(page, 1);
  await check('Primer ensayo termina a 9 m y velocidad cero', () => page.evaluate(() => laboratorio.getState().lift === 9 && laboratorio.getState().velocity === 0 && laboratorio.getState().trials[0].status === 'completed'));
  await page.locator('[data-view="robot"]').click(); await page.waitForTimeout(600); await sceneShot(page,{path: path.join(out, '05-robot-elevado.png') });
  await page.locator('[data-view="corte"]').click(); await page.locator('[data-mass="40000"]').click(); await page.locator('#runBtn').click();
  await check('Segundo ensayo comienza con retorno a la base', () => page.evaluate(() => laboratorio.getState().phase === 'returning'));
  await waitFinished(page, 2);
  await check('Dos masas a igual fuerza habilitan explicación', () => page.evaluate(() => laboratorio.getState().stage === 3 && laboratorio.getState().trials[0].forceKN === laboratorio.getState().trials[1].forceKN && laboratorio.getState().trials[0].a > laboratorio.getState().trials[1].a));
  await check('La comparación muestra peso, fuerza neta y la pregunta sobre la proporcionalidad', async () => { const t = await page.locator('#comparisonSummary').innerText(); return t.includes('neta 304 kN') && t.includes('neta 108 kN') && t.includes('se multiplicó por 2,0') && t.includes('entre 5,6'); });
  await check('Ensayos de referencia sin tope: la animación usa la aceleración calculada', () => page.evaluate(() => laboratorio.getState().trials.every(t => !t.capped)));
  await page.locator('#earnBtn').click(); await check('No hay sello sin conclusión y justificación', () => page.evaluate(() => !laboratorio.getState().earned));
  await page.locator('#conclusion').selectOption('up'); await page.locator('#explanation').fill('He mantenido la fuerza y cambiado la masa para comparar las dos aceleraciones iniciales.'); await page.locator('#earnBtn').click();
  await check('Conclusión contradictoria pide volver a los datos', async () => (await page.locator('#feedback').innerText()).includes('Revisa la columna'));
  await page.locator('#conclusion').selectOption('down'); await page.locator('#earnBtn').click();
  await check('Predicción inicial incorrecta requiere revisión consciente', async () => await page.locator('#reviseBtn').isVisible() && !await page.evaluate(() => laboratorio.getState().earned));
  await page.locator('#reviseBtn').click(); await finishReflection(page);
  await check('Secuencia completa obtiene sello de participación', async () => await page.locator('#completionStep').isVisible() && await page.evaluate(() => laboratorio.getState().earned));
  const notebookDownload = page.waitForEvent('download'); await page.locator('#downloadFinal').click(); const notebook = await notebookDownload; await notebook.saveAs(path.join(out, 'cuaderno-exportado.txt'));
  await check('Cuaderno descargable conserva idea inicial, revisión y datos', () => { const text = fs.readFileSync(path.join(out, 'cuaderno-exportado.txt'), 'utf8'); return text.includes('Aumenta la aceleración') && text.includes('Disminuye la aceleración') && text.includes('15,19') && text.includes('2,69') && text.includes('Fuerza neta (kN)') && text.includes('| 304 |') && text.includes('| 108 |') && text.includes('Pendiente de evaluación docente') && !/mazinger/i.test(text); });
  await page.locator('#notebookTab').click(); await page.screenshot({ timeout: 180000, path: path.join(out, '06-cuaderno.png'), fullPage: true });
  await check('Tabla y gráfica coinciden con los ensayos terminados', async () => await page.locator('#trials tr').count() === 2 && await page.locator('.chart-row').count() === 2 && await page.locator('#trials tr').first().locator('td').count() === 7);
  await page.reload(); await page.waitForFunction(() => window.laboratorio);
  await check('Recarga conserva cuaderno y vuelve a un reposo seguro', () => page.evaluate(() => { const s = laboratorio.getState(); return s.earned && s.trials.length === 2 && s.initialPrediction === 'up' && s.lift === 0 && s.phase === 'idle'; }));
  await page.locator('#freeExploreBtn').click(); await page.locator('#mass').fill('50000'); await page.locator('#thrust').fill('100'); await page.locator('#runBtn').click(); await waitFinished(page, 3);
  await check('Fuerza insuficiente queda como evidencia, sin ascenso', () => page.evaluate(() => { const s = laboratorio.getState(); return s.lift === 0 && !s.trials.at(-1).canRise && s.trials.at(-1).status === 'completed'; }));
  await page.locator('#lightTime').selectOption('noche'); await page.locator('#weather').selectOption('lluvia'); await page.waitForTimeout(500);
  await check('Noche y lluvia actualizan estado y bitácora', () => page.evaluate(() => laboratorio.getState().lightTime === 'noche' && laboratorio.getState().weather === 'lluvia' && document.getElementById('events').textContent.includes('efecto visual')));
  await sceneShot(page,{path: path.join(out, '07-noche-lluvia.png') });
  const photoEvent = page.waitForEvent('download'); await page.locator('#photoBtn').click(); const photo = await photoEvent; await photo.saveAs(path.join(out, 'foto-exportada.png'));
  await check('Fotografía de la escena se descarga como PNG', () => fs.statSync(path.join(out, 'foto-exportada.png')).size > 1000);
  await page.locator('#settingsBtn').click(); await page.locator('#pixelSetting').check(); await page.locator('.dialog-close').click(); await page.waitForTimeout(300);
  diagnostics.pixel = await page.evaluate(() => laboratorio.diagnostics());
  await check('Diorama usa realmente la paleta fija de 64 colores', () => diagnostics.pixel.engine === 'Canvas local' && diagnostics.pixel.renderer.paletteValid && diagnostics.pixel.renderer.pixelColors <= 64);
  await sceneShot(page,{path: path.join(out, '08-diorama-64.png') });
  await page.locator('#settingsBtn').click(); await page.locator('#pixelSetting').uncheck(); await page.locator('#reduceSetting').check(); await page.locator('.dialog-close').click();
  await check('Salir del diorama recupera la escena WebGL y la misma misión', () => page.evaluate(() => laboratorio.diagnostics().engine.includes('WebGL') && laboratorio.getState().earned && laboratorio.getState().trials.length === 3));
  await page.locator('#textViewBtn').click(); await check('Descripción textual incluye medidas y roles', async () => (await page.locator('#textState').innerText()).includes('50 t') && (await page.locator('#textRoles').innerText()).includes('Supervisor')); await page.locator('.dialog-close').click();
  await page.locator('#helpBtn').click(); await check('Guía docente distingue participación y razonamiento', async () => (await page.locator('#dialogBody').innerText()).includes('no evalúan el sentido')); await page.locator('.dialog-close').click();
  await check('Controles de formulario tienen etiquetas', () => page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].every(el => el.type === 'radio' ? Boolean(el.closest('label')) : Boolean(el.labels?.length || el.getAttribute('aria-label')))));
  await page.locator('#resetBtn').click(); await check('Reinicio limpia misión, ensayos y sello', () => page.evaluate(() => { const s = laboratorio.getState(); return s.stage === 0 && !s.earned && s.trials.length === 0 && s.opening === 0; }));
  await page.screenshot({ timeout: 180000, path: path.join(out, '09-escritorio-final.png'), fullPage: true });
  await context.close();
 });
 await group('Canvas, móvil y movimiento reducido', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const page = await context.newPage(); await load(page, 'http://127.0.0.1:8766/?render=canvas');
  await check('Alternativa 2D arranca sin WebGL', () => page.evaluate(() => laboratorio.diagnostics().engine === 'Canvas local'));
  await check('Preferencia de movimiento reducido se respeta al iniciar', () => page.evaluate(() => laboratorio.getState().reducedMotion));
  for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); await check(`Sin desbordamiento horizontal a ${width}px`, () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ timeout: 180000, path: path.join(out, '10-movil-final.png'), fullPage: true });
  await predict(page); await page.locator('#openBtn').click(); await check('Apertura sin animación mantiene el interbloqueo', () => page.evaluate(() => laboratorio.getState().observed && laboratorio.getState().opening === 1));
  await page.locator('#runBtn').click(); await page.locator('[data-mass="40000"]').click(); await page.locator('#thrust').fill('600'); await page.locator('#runBtn').click();
  await check('Fuerzas distintas no permiten cerrar la comparación', () => page.evaluate(() => laboratorio.getState().stage === 2));
  await page.locator('#thrust').fill('500'); await page.locator('#runBtn').click(); await finishReflection(page);
  await check('Recorrido completo funciona en Canvas móvil sin animación', () => page.evaluate(() => laboratorio.getState().earned && laboratorio.getState().trials.length === 3));
  await page.locator('#jumpScene').click(); await sceneShot(page,{path: path.join(out, '11-canvas-movil.png') });
  await page.locator('#jumpMission').click(); await check('Navegación móvil vuelve al reto', async () => (await page.locator('#missionPanel').boundingBox()).y < 100);
  await context.close();
 });
 await group('Archivo autónomo sin red', async () => {
  const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage(); const requests = [];
  page.on('request', r => requests.push(r.url())); await load(page, pathToFileURL(path.join(__dirname, 'dist/index.html')).href);
  diagnostics.offline = await page.evaluate(() => laboratorio.diagnostics());
  await check('HTML abierto desde disco inicia WebGL con la red desconectada', () => diagnostics.offline.engine.includes('WebGL'));
  await predict(page); await page.locator('#openBtn').click(); await page.locator('#runBtn').click(); await page.locator('[data-mass="40000"]').click(); await page.locator('#runBtn').click(); await finishReflection(page);
  await check('Misión completa desde archivo sin conexión', () => page.evaluate(() => laboratorio.getState().earned));
  await check('Archivo autónomo no intenta acceder a HTTP ni HTTPS', () => !requests.some(url => /^https?:/.test(url)));
  await sceneShot(page,{path: path.join(out, '12-archivo-sin-red.png') }); await context.close();
 });
 await group('Almacenamiento no disponible', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' }); await context.addInitScript(() => Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Storage unavailable in this test'); } }));
  const page = await context.newPage(); await load(page, 'http://127.0.0.1:8766/?render=canvas'); await predict(page);
  await check('Fallo de guardado no bloquea la actividad', async () => (await page.locator('#saveStatus').innerText()).includes('no disponible') && await page.evaluate(() => laboratorio.getState().predicted)); await context.close();
 });
 await check('Ninguna dependencia externa solicitada durante el recorrido', () => external.length === 0);
 await check('Sin excepciones JavaScript en los recorridos', () => errors.length === 0);
 await browser.close();
 const report = { version: 'LA-03.0', date: new Date().toISOString(), status: results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', passed: results.filter(r => r.status === 'PASS').length, total: results.length, errors, externalRequests: external, diagnostics, results, notRun: ['Teléfono físico', 'Lector de pantalla real', 'Evaluación docente con alumnado', 'Fidelidad contrastada con fotogramas autorizados', 'Validación de rendimiento en varios dispositivos'] };
 fs.writeFileSync(path.join(out, 'browser-tests.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); if (report.status !== 'PASS') process.exitCode = 1;
})().catch(e => { fs.writeFileSync(path.join(out, 'browser-fatal.txt'), e.stack); console.error(e); process.exitCode = 1; });


