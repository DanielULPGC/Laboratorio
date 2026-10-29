const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const { execFileSync } = require('node:child_process');
const app = path.join(__dirname, 'app'), dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });
const result = esbuild.buildSync({ entryPoints: [path.join(app, 'app.mjs')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', minify: true, legalComments: 'inline' });
const css = fs.readFileSync(path.join(app, 'style.css'), 'utf8');
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const license = fs.readFileSync(path.join(app, 'vendor/THREE-LICENSE.txt'), 'utf8');
const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8').replace('<link rel="stylesheet" href="style.css">', () => '<style>' + css + '</style>').replace('<script type="module" src="app.mjs"></script>', () => '<!-- Three.js 0.160.1 · ' + license + ' -->\n<script>' + js + '</script>');
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.copyFileSync(path.join(app, 'vendor/THREE-LICENSE.txt'), path.join(dist, 'THREE-LICENSE.txt'));
const manifest = { version: 'LA-03.0', builtAt: new Date().toISOString(), entry: 'index.html', bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex'), dependencies: [{ name: 'three', version: '0.160.1', license: 'MIT', source: 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(app, 'vendor/three.module.js'))).digest('hex') }], externalRuntimeDependencies: [], note: 'HTML con CSS, JavaScript, biblioteca y texturas procedurales embebidos. Sin service worker ni solicitudes externas necesarias.' };
execFileSync(process.execPath,[path.join(__dirname,'export-figure.mjs')],{stdio:'inherit'});
manifest.files=['index.html','THREE-LICENSE.txt','ROBOT_DETALLE.json','FICHA_ROBOT.md'].map(name=>{const bytes=fs.readFileSync(path.join(dist,name));return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
fs.writeFileSync(path.join(dist, 'INTEGRIDAD.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));


