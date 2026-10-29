# MZ-02.3 — Arquitectura interpretativa y representación WebGL2 local

## Resultado y condición de uso

Versión derivada de MZ-02.2 que conserva las cinco etapas didácticas, las pruebas de cinemática, las reglas de seguridad y el modo de 64 colores. Introduce una nueva **malla 3D procedural WebGL2 sin conexión ni bibliotecas** y una mejora visible en la arquitectura del modo Canvas de respaldo. **No contiene Three.js.** La implementación WebGL2 no ha podido validarse visualmente en este entorno, porque Chromium no proporciona contextos WebGL2 incluso con SwiftShader; por tanto, no debe presentarse como WebGL verificado.

## Ejecución

Extraer todos los archivos. Abrir `index.html` en Chrome/Edge actualizado; el HTML y el código de representación son autónomos, sin solicitudes de red. Para la comparación visual interna, mantener `referencia_original.jpg` en la misma carpeta. Si WebGL2 no está disponible, el documento cambia al dibujo isométrico Canvas (este camino sí se ha probado en Chromium).

Alternativa desde una carpeta con Python instalado: `python -m http.server 8000` y acceder a `http://localhost:8000`. **No es requisito** para la parte HTML con scripts embebidos, pero las políticas locales del navegador pueden exigirlo.

## Organización

- `index.html`: lección funcional y representación WebGL2/Canvas con JS embebido.
- `base.html`, `app.js`, `core.mjs`, `simulation.mjs`, `palette.mjs`, `offline-gl.mjs`: fuentes para reconstrucción.
- `build.py`: reconstruye el HTML determinísticamente a partir de las fuentes.
- `referencia_original.jpg`: imagen suministrada por la persona usuaria, empleada como referencia visual, **no como plano**.
- `MATRIZ_REFERENCIAS.csv`: separación entre observación y elementos hipotéticos.
- `core.test.mjs`, `extension.test.mjs`: pruebas lógicas reproducibles.
- `browser_test.py`, `extra_browser_test.py`, `extension_browser_test.py`: pruebas Playwright del modo Canvas en Chromium headless.
- `webgl_browser_test.py`: intento gráfico WebGL2; en el entorno de creación demuestra el BLOQUEO del contexto, no que funcione.
- `resultado_webgl.json`: reporte explícito del intento no superado (10/17 pruebas; 7 fallan al no crearse WebGL2).
- `AUDITORIA_MZ-02_3.md`: dictamen y pendientes.
- `captura_escena_canvas.png`, `comparativa_referencia_vs_canvas.png`: capturas reales y comparación rotulada.

## Verificaciones ejecutadas

- `node core.test.mjs`: **13/13 PASS**.
- `node extension.test.mjs`: **12/12 PASS**.
- `python browser_test.py`: **12/12 PASS** (Canvas).
- `python extra_browser_test.py`: **7/7 PASS** (Canvas).
- `python extension_browser_test.py`: **15/15 PASS** (Canvas).
- Subtotal **59/59** para lógica y UI Canvas con el Chromium disponible.
- `python webgl_browser_test.py`: **10/17**, resultado **BLOCKED** para el objetivo de representación 3D; WebGL2 no disponible. No computar este intento como prueba positiva de 3D.

## Limitaciones científicas y didácticas

No hay hidráulica modelada, ni una simulación de cuerpos rígidos ni cálculo estructural. Las comprobaciones de colisiones son envolventes simplificadas y la física de ascenso procede de un modelo didáctico ideal. La arquitectura no se ha ajustado a planos. El sello solo registra la participación y el registro de una explicación; la corrección conceptual exige evaluación humana. La aplicación no se ha probado con lector de pantalla real. No se ha obtenido autorización de publicación sobre elementos protegidos de la franquicia, por lo que el prototipo se considera de uso experimental y no publicado.

## Puerta de continuación

Antes de declarar GO de una versión WebGL/Three.js: (1) disponibilidad comprobada de Three.js local y versionado; (2) renderización GPU o software en un navegador real autorizado; (3) 10 capturas de estados, cámaras, pantalla móvil y regresión; (4) colisiones 3D; (5) comparación visual supervisada con más fotogramas.
