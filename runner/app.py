'''
AIron Audit Engine - Farguell Group
Motor headless de auditoria en vivo. Ejecuta escaneres (nmap / whatweb / nuclei)
contra activos PROPIOS de Farguell (lista blanca) y transmite la salida en vivo por SSE.

La interfaz de usuario vive INTEGRADA en AIron Brain (https://brain.farguell.com),
que consume esta API same-origin a traves del proxy /audit-api/ de su nginx.

Seguridad: solo se puede escanear un objetivo de la lista blanca TARGETS.
No hay entrada de objetivo libre -> imposible apuntar a terceros desde la app.
El barrido "TODOS" (target=all) solo recorre esa misma lista blanca.
Las herramientas se eligen a la carta (?tools=nmap,whatweb,nuclei); si no se pasan,
se usa el perfil (?profile=recon|web|full) por compatibilidad.
'''
import asyncio
import json
import socket
from asyncio.subprocess import PIPE, STDOUT

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

app = FastAPI(title='AIron Audit Engine')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'https://brain.farguell.com',
        'https://brain.178.105.241.12.sslip.io',
    ],
    allow_methods=['GET'],
    allow_headers=['*'],
)

# ── Lista blanca: SOLO activos propios de Farguell ────────────────────────────
TARGETS = {
    'hub':    {'group': 'Portal y nucleo', 'label': 'AIron Hub',       'url': 'https://app.farguell.com',   'host': 'app.farguell.com'},
    'brain':  {'group': 'Portal y nucleo', 'label': 'AIron Brain',     'url': 'https://brain.farguell.com', 'host': 'brain.farguell.com'},
    'rps':    {'group': 'Portal y nucleo', 'label': 'RPS API Catalog', 'url': 'https://rps.farguell.com',   'host': 'rps.farguell.com'},
    'stack':  {'group': 'Portal y nucleo', 'label': 'Stack',           'url': 'https://stack.farguell.com', 'host': 'stack.farguell.com'},
    'ask':    {'group': 'Portal y nucleo', 'label': 'AIron Ask',       'url': 'https://ask.178.105.241.12.sslip.io', 'host': 'ask.178.105.241.12.sslip.io'},
    'monitor_power':    {'group': 'Monitores y paneles', 'label': 'Monitor Flujo POWER',    'url': 'https://monitor-power.178.105.241.12.sslip.io',   'host': 'monitor-power.178.105.241.12.sslip.io'},
    'monitor_cierre':   {'group': 'Monitores y paneles', 'label': 'Monitor Cierre de Mes',  'url': 'https://monitor-cierre.178.105.241.12.sslip.io',  'host': 'monitor-cierre.178.105.241.12.sslip.io'},
    'monitor_vaillant': {'group': 'Monitores y paneles', 'label': 'Monitor Flujo Vaillant', 'url': 'https://qfxzw9csjly5y5cy7hqev87g.178.105.241.12.sslip.io', 'host': 'qfxzw9csjly5y5cy7hqev87g.178.105.241.12.sslip.io'},
    'direccion':        {'group': 'Monitores y paneles', 'label': 'AIron Direccion',        'url': 'https://planta.178.105.241.12.sslip.io',          'host': 'planta.178.105.241.12.sslip.io'},
    'pedidos':          {'group': 'Monitores y paneles', 'label': 'Estado Pedidos',         'url': 'https://pedidos.178.105.241.12.sslip.io',         'host': 'pedidos.178.105.241.12.sslip.io'},
    'tareas':           {'group': 'Monitores y paneles', 'label': 'AIron Tareas',           'url': 'https://tareas.178.105.241.12.sslip.io',          'host': 'tareas.178.105.241.12.sslip.io'},
    'rfq_web': {'group': 'RFQ y voz', 'label': 'RFQ INDRA Web',      'url': 'https://t11zxssdcj6nfk4c5pci7lav.178.105.241.12.sslip.io', 'host': 't11zxssdcj6nfk4c5pci7lav.178.105.241.12.sslip.io'},
    'token':   {'group': 'RFQ y voz', 'label': 'AIron Token Server', 'url': 'https://airon-token.178.105.241.12.sslip.io',             'host': 'airon-token.178.105.241.12.sslip.io'},
    'n8n':     {'group': 'Backend / n8n', 'label': 'n8n backend', 'url': 'https://n8n.farguell.com', 'host': 'n8n.farguell.com'},
    'srv_front': {'group': 'Infraestructura', 'label': 'Servidor Frontend (Hetzner relay)', 'url': 'https://178.105.241.12', 'host': '178.105.241.12'},
    'srv_back':  {'group': 'Infraestructura', 'label': 'Servidor Backend (Hetzner)',        'url': 'https://178.105.73.190', 'host': '178.105.73.190'},
}

# ── Herramientas a la carta (checkbox en Brain) ───────────────────────────────
TOOL_CMDS = {
    'nmap':    {'label': 'nmap',    'desc': 'puertos y servicios', 'cmds': [
        ['nmap', '-sV', '--top-ports', '200', '-T4', '-Pn', '{host}'],
    ]},
    'whatweb': {'label': 'whatweb', 'desc': 'tecnologia web',      'cmds': [
        ['whatweb', '-a', '3', '{url}'],
    ]},
    'nuclei':  {'label': 'nuclei',  'desc': 'vulnerabilidades conocidas', 'cmds': [
        ['nuclei', '-u', '{url}', '-severity', 'info,low,medium,high,critical', '-rl', '40', '-timeout', '8', '-nc'],
    ]},
}
TOOL_ORDER = ['nmap', 'whatweb', 'nuclei']
DEFAULT_TOOLS = ['whatweb', 'nuclei']

PROFILE_TOOLS = {
    'recon': ['nmap'],
    'web':   ['whatweb', 'nuclei'],
    'full':  ['nmap', 'whatweb', 'nuclei'],
}
PROFILES = {
    'recon': {'label': 'Reconocimiento (nmap)'},
    'web':   {'label': 'Web / OWASP (whatweb + nuclei)'},
    'full':  {'label': 'Completa (nmap + whatweb + nuclei)'},
}


def sse(v, c='out'):
    return 'data: ' + json.dumps({'c': c, 'v': v}) + '\n\n'


def resolve_tools(tools_param, profile):
    if tools_param:
        req = {t.strip() for t in tools_param.split(',') if t.strip()}
        return [t for t in TOOL_ORDER if t in req]
    if profile in PROFILE_TOOLS:
        return list(PROFILE_TOOLS[profile])
    return list(DEFAULT_TOOLS)


def build_cmds(tools):
    cmds = []
    for t in tools:
        cmds.extend(TOOL_CMDS[t]['cmds'])
    return cmds


async def _scan_one(tid, tools):
    t = TARGETS[tid]
    yield sse('AIron Audit Engine - objetivo: ' + t['label'] + '  (' + t['url'] + ')', 'hdr')
    yield sse('herramientas: ' + ' + '.join(tools) + '  -  solo activos propios autorizados', 'hdr')
    yield sse('', 'out')
    host = t['host']
    yield sse('[preflight] comprobando ' + host + ' ...', 'out')
    try:
        ip = socket.gethostbyname(host)
    except Exception:
        yield sse('[X] ' + host + ' NO resuelve en DNS accesible desde el motor. No hay nada que escanear.', 'err')
        yield sse('    Sugerencia: falta el registro DNS publico, o el activo solo vive en otra red.', 'out')
        return
    reachable = False
    for port in (443, 80):
        try:
            s = socket.create_connection((ip, port), timeout=5)
            s.close()
            reachable = True
            break
        except Exception:
            pass
    if reachable:
        yield sse('[preflight] ' + host + ' -> ' + ip + '  (accesible)', 'ok')
    else:
        yield sse('[X] ' + host + ' resuelve a ' + ip + ' pero no responde en 80/443. No hay nada que escanear.', 'err')
        return
    yield sse('', 'out')
    for tmpl in build_cmds(tools):
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


async def run_scan(tid, tools):
    async for chunk in _scan_one(tid, tools):
        yield chunk
    yield sse('=== escaneo completado ===', 'ok')


async def run_all(tools):
    ids = list(TARGETS.keys())
    total = len(ids)
    yield sse('==== BARRIDO COMPLETO - ' + str(total) + ' activos - herramientas: ' + ' + '.join(tools) + ' ====', 'hdr')
    yield sse('Solo activos propios autorizados (lista blanca). Esto puede tardar varios minutos.', 'hdr')
    for i, tid in enumerate(ids, 1):
        yield sse('', 'out')
        yield sse('-------- [' + str(i) + '/' + str(total) + '] ' + TARGETS[tid]['label'] + ' --------', 'hdr')
        async for chunk in _scan_one(tid, tools):
            yield chunk
    yield sse('', 'out')
    yield sse('=== barrido de ' + str(total) + ' activos: escaneo completado ===', 'ok')


@app.get('/health')
async def health():
    return {'ok': True}


@app.get('/api/targets')
async def targets():
    real = [{'id': k, 'label': v['label'], 'url': v['url'], 'group': v.get('group', 'Activos')} for k, v in TARGETS.items()]
    todos = {'id': 'all', 'label': 'TODOS los activos (' + str(len(TARGETS)) + ')', 'url': 'barrido secuencial de toda la lista blanca', 'group': 'Barrido completo'}
    return JSONResponse({
        'targets': [todos] + real,
        'tools': [{'id': k, 'label': TOOL_CMDS[k]['label'], 'desc': TOOL_CMDS[k]['desc'], 'default': k in DEFAULT_TOOLS} for k in TOOL_ORDER],
        'profiles': [{'id': k, 'label': v['label']} for k, v in PROFILES.items()],
    })


@app.get('/api/scan')
async def scan(target: str, profile: str = 'web', tools: str = None):
    sel = resolve_tools(tools, profile)
    if not sel:
        raise HTTPException(status_code=400, detail='ninguna herramienta valida seleccionada')
    if target == 'all':
        return StreamingResponse(
            run_all(sel),
            media_type='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'},
        )
    if target not in TARGETS:
        raise HTTPException(status_code=403, detail='objetivo no autorizado')
    return StreamingResponse(
        run_scan(target, sel),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'},
    )


@app.get('/', response_class=PlainTextResponse)
async def index():
    return (
        'AIron Audit Engine - motor headless (Farguell Group).\n'
        'La interfaz vive integrada en AIron Brain: https://brain.farguell.com '
        '(icono "AIron Audit" al fondo de la barra izquierda).\n\n'
        'API: GET /api/targets - GET /api/scan?target=..&tools=nmap,whatweb,nuclei (SSE) - GET /health\n'
        'target=all -> barrido de toda la lista blanca. profile= sigue soportado.\n'
    )
