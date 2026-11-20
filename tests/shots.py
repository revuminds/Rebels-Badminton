#!/usr/bin/env python3
"""Contact sheet: Home / Players / Games (live) / Finance / Settings at phone 390, tablet 1194×834 + 834×1194, laptop 1280 (dark) + tablet light.
Usage: python3 tests/shots.py <copy-of-backup.txt> <out.png>"""
import sys, json, pathlib, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parent.parent; DATA = pathlib.Path(sys.argv[1]).read_text()
CLOCK = """(()=>{const off=Date.parse('2026-11-22T10:35:00+04:00')-Date.now(),D=Date;class FD extends D{constructor(...a){a.length?super(...a):super(D.now()+off)}static now(){return D.now()+off}};window.Date=FD})();"""
SETUP = """()=>{const d='2026-11-22',g=RB.G(d);delete g.fp;RB.planFull(g,false);RB.act.startsess();Object.keys(RB.S.days[d].on).forEach(id=>RB.act.ckin(id));RB.act.closeck&&RB.act.closeck();
  RB.act.cfopen('0');RB.act.cfok();RB.act.cfopen('1');RB.act.cfok();for(let k=0;k<9;k++)RB.act.sc('0','a+');for(let k=0;k<6;k++)RB.act.sc('0','b+');RB.ui.unlocked=true;RB.save()}"""
SCR = [('Home', "RB.act.tab('home')"), ('Players', "RB.act.tab('players')"), ('Games', "RB.act.tab('games')"), ('Finance', "RB.ui.unlocked=true;RB.act.tab('finance');RB.ui.unlocked=true;RB.render()"), ('Settings', "RB.act.tab('settings')")]
VP = [('Phone 390', 390, 844, 0), ('Tablet 1194×834', 1194, 834, 0), ('Tablet 834×1194', 834, 1194, 0), ('Laptop 1280', 1280, 800, 0), ('Tablet light', 1194, 834, 1)]
shots = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for lab, w, h, light in VP:
        c = b.new_context(timezone_id='Asia/Dubai', viewport={'width': w, 'height': h}, device_scale_factor=1)
        c.route('**/*', lambda r: r.continue_() if r.request.url.startswith(('file:', 'data:', 'blob:')) else r.abort())
        c.add_init_script(CLOCK + "localStorage.setItem('rebels.v1',%s);%s" % (json.dumps(DATA), "localStorage.setItem('rebels.theme','light');" if light else ''))
        pg = c.new_page(); pg.on('dialog', lambda d: d.accept())
        pg.goto('file://' + str(ROOT / 'dist/RebelsBadminton.html')); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('#wel')&&document.querySelector('#wel').click()"); pg.wait_for_timeout(800)
        pg.evaluate(SETUP)
        for name, js in (SCR if not light else SCR[:3]):
            pg.evaluate(js); pg.wait_for_timeout(300); pg.evaluate("window.scrollTo(0,0)")
            shots.append((lab, name, Image.open(io.BytesIO(pg.screenshot()))))
        c.close()
    b.close()
# compose: one row per viewport, thumbnails at fixed height
TH = 420; rows = {}
for lab, name, im in shots: rows.setdefault(lab, []).append((name, im.resize((int(im.width * TH / im.height), TH))))
W = max(sum(t.width + 16 for _, t in r) for r in rows.values()) + 16; H = len(rows) * (TH + 44) + 16
sheet = Image.new('RGB', (W, H), (40, 42, 48)); d = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: f = None
y = 16
for lab, r in rows.items():
    x = 16
    for name, t in r:
        d.text((x, y), lab + ' · ' + name, fill=(230, 230, 230), font=f); sheet.paste(t, (x, y + 26)); x += t.width + 16
    y += TH + 44
sheet.save(sys.argv[2], optimize=True); print(sys.argv[2], sheet.size)
