from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'base.html').read_text(encoding='utf-8')
core=(root/'core.mjs').read_text(encoding='utf-8').replace('export const','const').replace('export function','function')
app=(root/'app.js').read_text(encoding='utf-8')
sim=(root/'simulation.mjs').read_text(encoding='utf-8').replace('export const','const').replace('export function','function')
palette=(root/'palette.mjs').read_text(encoding='utf-8').replace('export const','const').replace('export function','function')
offline=(root/'offline-gl.mjs').read_text(encoding='utf-8')
output=html.replace('/*CORE_JS*/',core+'\n'+sim+'\n'+palette+'\n'+offline).replace('/*APP_JS*/',app)
(root/'index.html').write_text(output,encoding='utf-8')
print('Generado index.html:',len(output),'caracteres')
