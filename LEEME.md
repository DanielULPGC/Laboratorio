# LA-03.0 · Operación despegue · Laboratorio Atlántico

Abre ABRIR.cmd o index.html. El HTML incorpora la biblioteca, los estilos y las texturas: funciona desde disco y sin conexión. No hay que instalar nada para usarlo.

Versión derivada de MZ-02.3.3. Conserva la secuencia didáctica (predecir, observar, experimentar y explicar), el cuaderno local y la alternativa 2D. Sustituye la figura anterior por un robot de diseño original y corrige dos problemas didácticos (véase CAMBIOS.md).

## El robot Brezo

Brezo es un robot de carga inventado para este laboratorio. No representa ningún personaje, serie ni producto comercial. Su geometría se genera por código y cabe dentro de la envolvente mecánica del simulador (5,4 × 6,7 × 2,1 m).

En Piezas, selecciona «Robot Brezo». El selector recorre diez zonas: cabeza, sensores, indicador de masa, torso, brazos, pinzas, cintura, piernas, pies y mochila. Pulsar una pieza del modelo 3D enfoca su zona. Arrastra para girar, usa +/− para acercar y «Aislar esta zona» para retirar las demás piezas. Cada zona propone una pregunta de observación sobre la función de la pieza. El dial del pecho señala la masa elegida en el experimento. «Guardar ficha» descarga las cotas y los materiales en JSON. FICHA_ROBOT.md ofrece la misma información en texto.

## Modelo físico y límites

- Fuerza neta = empuje − peso; a = fuerza neta / m = F/m − 9,81 (SI). El cuaderno muestra empuje, peso, fuerza neta y aceleración de cada ensayo.
- La animación reproduce la aceleración calculada hasta un tope de 16 m/s² y frena a 3 m/s²; recorrido de 9 m. Los ensayos que superan el tope se marcan con *.
- Masas (10–50 t) y empujes (100–900 kN) son valores hipotéticos para experimentar.
- Las colisiones usan envolventes rectangulares. El agua y la lluvia son efectos visuales. Las articulaciones del robot no se simulan.
- La alternativa Canvas es esquemática: enfoca zonas, pero no aísla mallas.

## Verificación

145/145 comprobaciones aprobadas: 62 unitarias (física, entorno, misión y geometría del robot), 48 del recorrido completo y 35 del inspector de zonas. VERIFICACION.json reúne los informes y evidencia/ contiene las capturas. Las pruebas de navegador se ejecutaron en Chromium sin interfaz con renderizado WebGL por software (SwiftShader), a 1440 px y con emulación móvil. No se han realizado validación en Microsoft Edge ni en un teléfono físico, prueba con lector de pantalla real, evaluación con alumnado ni medición de rendimiento en varios dispositivos.

Huella SHA-256 del HTML: fcab505fef725e976afdd6051b4607fe40417b65c0715f3fbf21ef04b344945f

## Fuentes y reproducción

fuentes/ contiene el código editable y Three.js 0.160.1 (licencia MIT). Para compilar: instalar Node.js, ejecutar `npm install` dentro de fuentes/ y después `npm run build`; la salida queda en fuentes/dist/. `npm test` ejecuta las pruebas unitarias.

Pruebas de navegador: instalar Playwright; si no está en la ruta de módulos, indicar su ubicación en LAB_PLAYWRIGHT_PATH. Para usar Edge, definir LAB_BROWSER_CHANNEL=msedge. Servir fuentes/dist con `python -m http.server 8766 --bind 127.0.0.1 --directory dist` desde fuentes/ y ejecutar `node qa-precision-regression.cjs` y `node precision-qa.cjs`. Las evidencias se guardan en fuentes/evidencia-qa/ (o LAB_QA_OUT).

THREE-LICENSE.txt conserva la licencia de Three.js.
