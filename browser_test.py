from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,threading,http.server,socketserver,os
directory=str(Path(__file__).parent)
class Silent(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=directory,**kwargs)
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Silent)
threading.Thread(target=server.serve_forever,daemon=True).start()
path=f'http://127.0.0.1:{server.server_port}/index.html'
results=[]
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
  page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda err: errors.append(str(err)))
  page.goto('about:blank')
  page.set_content(Path(__file__).with_name('index.html').read_text(),wait_until='domcontentloaded',timeout=18000)
  page.wait_for_timeout(3100)
  results.append(('Carga y texto',page.locator('h1').inner_text().startswith('La piscina')))
  results.append(('Fallback local', 'Canvas 2D de respaldo' in page.locator('#engineStatus').inner_text()))
  results.append(('Elevación bloqueada inicialmente',page.locator('#run').is_disabled()))
  page.screenshot(path=str(Path(__file__).with_name('captura_escritorio.png')),full_page=True)
  page.locator('#answer').select_option('down')
  page.locator('#predict').click()
  page.locator('#observe').click()
  page.wait_for_timeout(2600)
  results.append(('Apertura completada',page.locator('#run').is_enabled()))
  page.locator('#run').click()
  page.wait_for_timeout(1000)
  results.append(('Primer ensayo registrado',page.locator('#trials tr').count()==1))
  page.locator('#mass').fill('40000')
  page.locator('#run').click()
  results.append(('Segundo ensayo registrado',page.locator('#trials tr').count()==2))
  results.append(('Solapa habilitada',page.locator('#flapBtn').is_enabled()))
  page.locator('#flapBtn').click()
  results.append(('Solapa visible',page.locator('#flap').is_visible()))
  page.locator('#justification').fill('Con la misma fuerza vertical, una masa mayor produce menor aceleración porque la razón F/m disminuye y g permanece constante.')
  page.locator('#earn').click()
  results.append(('Sello condicionado', 'OBTENIDO' in page.locator('#stamp').inner_text()))
  page.locator('#sectionMode').click()
  results.append(('Modo inspección seleccionado',page.locator('#sectionMode').get_attribute('aria-pressed')=='true'))
  page.screenshot(path=str(Path(__file__).with_name('captura_interaccion.png')),full_page=True)
  page.locator('#reset').click()
  results.append(('Reinicio de sello', 'PENDIENTE' in page.locator('#stamp').inner_text()))
  results.append(('Sin errores de script',not errors))
  browser.close()
print(json.dumps({'tests':[{'name':n,'pass':ok} for n,ok in results],'passed':sum(ok for n,ok in results),'total':len(results),'errors':errors},ensure_ascii=False,indent=2))
if not all(ok for n,ok in results):raise SystemExit(1)
