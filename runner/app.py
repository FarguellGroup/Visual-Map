'''
AIron Audit Runner - Farguell Group
Backend que ejecuta escaneres (nmap / whatweb / nuclei) contra activos PROPIOS
(lista blanca) y transmite la salida en vivo a una consola web (SSE).

Seguridad: solo se puede escanear un objetivo de la lista blanca TARGETS.
No hay entrada de objetivo libre -> imposible apuntar a terceros desde la app.
'''
import asyncio
import json
from asyncio.subprocess import PIPE, STDOUT

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

app = FastAPI(title='AIron Audit Runner')

# Lista blanca: SOLO activos propios de Farguell
TARGETS = {
    'audit':    {'label': 'AIron Audit (esta app)', 'url': 'https://audit.178.105.241.12.sslip.io', 'host': 'audit.178.105.241.12.sslip.io'},
    'audit_fq': {'label': 'audit.farguell.com',      'url': 'https://audit.farguell.com',            'host': 'audit.farguell.com'},
    'monitor':  {'label': 'Monitor POWER',           'url': 'https://monitor-power.farguell.com',    'host': 'monitor-power.farguell.com'},
    'brain':    {'label': 'AIron Brain',             'url': 'https://brain.farguell.com',            'host': 'brain.farguell.com'},
    'hub':      {'label': 'Portal Hub',              'url': 'https://hub.farguell.com',              'host': 'hub.farguell.com'},
}

# Perfiles de escaneo
PROFILES = {
    'recon': {'label': 'Reconocimiento (nmap)', 'cmds': [
        ['nmap', '-sV', '--top-ports', '200', '-T4', '-Pn', '{host}'],
    ]},
    'web': {'label': 'Web / OWASP (whatweb + nuclei)', 'cmds': [
        ['whatweb', '-a', '3', '{url}'],
        ['nuclei', '-u', '{url}', '-severity', 'info,low,medium,high,critical', '-rl', '40', '-timeout', '8', '-nc'],
    ]},
    'full': {'label': 'Completa (nmap + whatweb + nuclei)', 'cmds': [
        ['nmap', '-sV', '--top-ports', '200', '-T4', '-Pn', '{host}'],
        ['whatweb', '-a', '3', '{url}'],
        ['nuclei', '-u', '{url}', '-severity', 'low,medium,high,critical', '-rl', '40', '-nc'],
    ]},
}


def sse(v, c='out'):
    return 'data: ' + json.dumps({'c': c, 'v': v}) + '\n\n'


async def run_scan(tid, pid):
    t = TARGETS[tid]
    p = PROFILES[pid]
    yield sse('AIron Audit Runner - objetivo: ' + t['label'] + '  (' + t['url'] + ')', 'hdr')
    yield sse('perfil: ' + p['label'] + '  -  solo activos propios autorizados', 'hdr')
    yield sse('', 'out')
    for tmpl in p['cmds']:
        cmd = [a.format(host=t['host'], url=t['url']) for a in tmpl]
        yield sse('$ ' + ' '.join(cmd), 'cmd')
        try:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=PIPE, stderr=STDOUT)
        except FileNotFoundError:
            yield sse('[!] herramienta no encontrada: ' + cmd[0], 'err')
            continue
        assert proc.stdout is not None
        while True:
            raw = await proc.stdout.readline()
            if not raw:
                break
            line = raw.decode('utf-8', 'replace').rstrip('\n')
            if line.strip():
                yield sse(line)
        await proc.wait()
        yield sse('[OK] ' + cmd[0] + ' terminado (exit ' + str(proc.returncode) + ')', 'ok')
        yield sse('', 'out')
    yield sse('=== escaneo completado ===', 'ok')


@app.get('/health')
async def health():
    return {'ok': True}


@app.get('/api/targets')
async def targets():
    return JSONResponse({
        'targets': [{'id': k, 'label': v['label'], 'url': v['url']} for k, v in TARGETS.items()],
        'profiles': [{'id': k, 'label': v['label']} for k, v in PROFILES.items()],
    })


@app.get('/api/scan')
async def scan(target: str, profile: str):
    if target not in TARGETS:
        raise HTTPException(status_code=403, detail='objetivo no autorizado')
    if profile not in PROFILES:
        raise HTTPException(status_code=400, detail='perfil no valido')
    return StreamingResponse(
        run_scan(target, profile),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'},
    )


@app.get('/', response_class=HTMLResponse)
async def index():
    return HTML


HTML = '''<!doctype html><html lang='es'><head>
<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>AIron Audit Runner</title>
<style>
  :root{--bg:#0a0b0d;--panel:#131519;--line:#23262d;--txt:#e5e7eb;--mut:#8b909a;
        --grn:#34d399;--cyn:#22d3ee;--fux:#e879f9;--amb:#fbbf24;--red:#f87171;}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--txt);
    font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif}
  header{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
  .dot{width:11px;height:11px;border-radius:50%;background:var(--grn);box-shadow:0 0 10px var(--grn)}
  h1{font-size:15px;margin:0;font-weight:700;letter-spacing:.2px}
  .sub{font-size:11px;color:var(--mut)}
  .wrap{max-width:980px;margin:0 auto;padding:16px}
  .controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
  select{background:#0d0f12;color:var(--grn);border:1px solid var(--line);border-radius:8px;
    padding:9px 10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;min-width:280px}
  .prof{background:#1b1e24;color:var(--txt);border:1px solid var(--line);border-radius:8px;
    padding:8px 11px;font-size:12px;cursor:pointer}
  .prof.active{border-color:var(--grn);background:rgba(52,211,153,.12);color:var(--grn)}
  #go{margin-left:auto;background:var(--grn);color:#08110c;border:0;border-radius:9px;
    padding:10px 16px;font-weight:700;cursor:pointer;font-size:13px}
  #go:disabled{opacity:.5;cursor:not-allowed}
  #term{background:#000;border:1px solid var(--line);border-radius:12px;padding:12px;
    height:60vh;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.5}
  .ln{white-space:pre-wrap;word-break:break-all}
  .hdr{color:var(--fux)} .cmd{color:#fff;font-weight:600} .ok{color:var(--grn)}
  .err{color:var(--red)} .out{color:#c7ccd4}
  .note{color:var(--mut);font-size:11px;margin-top:10px}
</style></head><body>
<header><span class='dot'></span>
  <div><h1>AIron Audit - Runner de escaneo en vivo</h1>
  <div class='sub'>Escanea activos propios de Farguell - nmap - whatweb - nuclei</div></div>
</header>
<div class='wrap'>
  <div class='controls'>
    <select id='target'></select>
    <div id='profiles' style='display:flex;gap:8px;flex-wrap:wrap'></div>
    <button id='go'>Escanear</button>
  </div>
  <pre id='term'><div class='ln out'>Elige un objetivo y un perfil, y pulsa Escanear.</div></pre>
  <div class='note'>Solo activos propios autorizados (lista blanca). La primera vez, nuclei descarga sus plantillas (~1 min).</div>
</div>
<script>
let profile='web', es=null;
function line(v,c){const t=document.getElementById('term');const d=document.createElement('div');
  d.className='ln '+(c||'out');d.textContent=v;t.appendChild(d);t.scrollTop=t.scrollHeight;}
async function load(){
  const d=await (await fetch('api/targets')).json();
  const sel=document.getElementById('target');
  d.targets.forEach(function(t){const o=document.createElement('option');o.value=t.id;o.textContent=t.label+' - '+t.url;sel.appendChild(o);});
  const pc=document.getElementById('profiles');
  d.profiles.forEach(function(p){const b=document.createElement('button');b.className='prof'+(p.id==profile?' active':'');
    b.textContent=p.label;b.onclick=function(){profile=p.id;document.querySelectorAll('.prof').forEach(function(x){x.classList.remove('active');});b.classList.add('active');};
    pc.appendChild(b);});
}
document.getElementById('go').onclick=function(){
  if(es)es.close();
  const go=document.getElementById('go');go.disabled=true;
  document.getElementById('term').innerHTML='';
  const target=document.getElementById('target').value;
  line('Iniciando escaneo...','hdr');
  es=new EventSource('api/scan?target='+encodeURIComponent(target)+'&profile='+encodeURIComponent(profile));
  es.onmessage=function(e){const m=JSON.parse(e.data);line(m.v,m.c); if(m.v.indexOf('escaneo completado')>=0){es.close();go.disabled=false;}};
  es.onerror=function(){line('- conexion cerrada -','ok');es.close();go.disabled=false;};
};
load();
</script></body></html>'''
