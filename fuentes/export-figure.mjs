import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRobot } from './app/robot.mjs';
import { FIGURE_ZONES } from './app/figure-spec.mjs';
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const spec=createRobot().specification();
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'ROBOT_DETALLE.json'),JSON.stringify(spec,null,2));
const f=n=>n.toFixed(3).replace('.',','),full=spec.figure.dimensions;
const lines=['# Robot Brezo · Ficha del modelo LA-03.0','','Brezo es un diseño original creado para el Laboratorio Atlántico. No representa ningún personaje, serie ni producto comercial. Las medidas corresponden a las mallas generadas por código.','',`Envolvente visible: ${f(full.width)} m de ancho × ${f(full.height)} m de alto × ${f(full.depth)} m de fondo. Cabe en la envolvente mecánica del simulador (5,4 × 6,7 × 2,1 m). Los límites de colisión son rectangulares.`,'','Las cotas se obtienen de los límites locales alineados con X/Y/Z. Brazos, manos, piernas y pies usan el lado derecho como muestra. No se deben sumar sus alturas.','','| Zona | Ancho (m) | Alto (m) | Fondo (m) | Muestra |','| --- | ---: | ---: | ---: | --- |'];
for(const z of spec.zones)lines.push(`| ${z.label} | ${f(z.dimensions.width)} | ${f(z.dimensions.height)} | ${f(z.dimensions.depth)} | ${z.sample} |`);
for(const z of spec.zones){const d=FIGURE_ZONES[z.id];lines.push('',`## ${d.number}. ${d.label}`,'',`Rasgos: ${d.observed}`,'',`Construcción: ${d.detail}`,'',`Pregunta para observar: ${d.check}`,'',`Criterio: ${d.evidence}`);}
lines.push('','## Materiales','',...spec.materials.map(m=>`- ${m.id}: ${m.color}; metalicidad ${m.metalness}; rugosidad ${m.roughness}.`),'','## Límites','',...spec.limits.map(s=>'- '+s));
fs.writeFileSync(path.join(out,'FICHA_ROBOT.md'),lines.join('\n'));
