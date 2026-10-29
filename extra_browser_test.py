from playwright.sync_api import sync_playwright
from pathlib import Path
import json
r=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 pg.on('pageerror',lambda e: errors.append(str(e)))
 pg.set_content(Path(__file__).with_name('index.html').read_text(),wait_until='domcontentloaded')
 pg.wait_for_timeout(2900)
 r.append(('Sin desplazamiento horizontal móvil',pg.evaluate('document.documentElement.scrollWidth <= innerWidth')))
 r.append(('Canvas no vacío',pg.locator('#view').evaluate('(c)=>c.width>300&&c.height>300')))
 pg.screenshot(path=str(Path(__file__).with_name('captura_movil.png')),full_page=True)
 pg.locator('#answer').select_option('up');pg.locator('#predict').click();pg.locator('#observe').click();pg.wait_for_timeout(2600)
 pg.locator('#mass').fill('20000');pg.locator('#run').click();pg.locator('#thrust').fill('400');pg.locator('#mass').fill('40000');pg.locator('#run').click();
 r.append(('Dos fuerzas distintas no habilitan explicación',pg.locator('#flapBtn').is_disabled()))
 pg.locator('#thrust').fill('300');pg.locator('#run').click();r.append(('Comparación válida habilita explicación',pg.locator('#flapBtn').is_enabled()))
 pg.locator('#flapBtn').click();pg.locator('#justification').fill('Se ha realizado la comparación con masa distinta y fuerza constante: la aceleración resulta menor al aumentar la masa.');pg.locator('#earn').click()
 r.append(('Predicción errónea impide sello', 'PENDIENTE' in pg.locator('#stamp').inner_text()))
 pg.locator('#reset').click();r.append(('Reinicio limpia ensayos', pg.locator('#trials tr').count()==1 and 'Todavía' in pg.locator('#trials').inner_text()))
 r.append(('Sin errores de ejecución',len(errors)==0))
 b.close()
print(json.dumps({'tests':[{'name':n,'pass':ok} for n,ok in r],'passed':sum(ok for _,ok in r),'total':len(r),'errors':errors},ensure_ascii=False,indent=2))
if not all(ok for _,ok in r):raise SystemExit(1)
