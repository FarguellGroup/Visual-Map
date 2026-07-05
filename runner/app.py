'''
AIron Audit Engine - Farguell Group
Motor headless de auditoria en vivo. Ejecuta escaneres (nmap / whatweb / nuclei)
contra activos PROPIOS de Farguell (lista blanca) y transmite la salida en vivo por SSE.

La interfaz de usuario vive INTEGRADA en AIron Brain (https://brain.farguell.com),
que consume esta API same-origin a traves del proxy /audit-api/ de su nginx.

Seguridad: solo se puede escanear un objetivo de la lista blanca TARGETS.
No hay entrada de objetivo libre -> imposible apuntar a terceros desde la app.
El barrido "TODOS" (target=all) solo recorre esa misma lista blanca.
'''
import asyncio
import json
import socket
from asyncio.subprocess import PIPE, STDOUT

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

app = FastAPI(title='AIron Audit Engine')

# La UI vive integrada en Brain (mismo origen via proxy nginx). CORS acotado por si
# alguna vista de Brain llamara cross-origin; nunca abierto a terceros.
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
# Todo el ecosistema (apps + servidores). No hay entrada libre de objetivo.
TARGETS = {
    # Portal y nucleo
    'hub':    {'group': 'Portal y nucleo', 'label': 'AIron Hub',       'url': 'https://app.farguell.com',   'host': 'app.farguell.com'},
    'brain':  {'group': 'Portal y nucleo', 'label': 'AIron Brain',     'url': 'https://brain.farguell.com', 'host': 'brain.farguell.com'},
    'rps':    {'group': 'Portal y nucleo', 'label': 'RPS API Catalog', 'url': 'https://rps.farguell.com',   'host': 'rps.farguell.com'},
    'stack':  {'group': 'Portal y nucleo', 'label': 'Stack',           'url': 'https://stack.farguell.com', 'host': 'stack.farguell.com'},
    'ask':    {'group': 'Portal y nucleo', 'label': 'AIron Ask',       'url': 'https://ask.178.105.241.12.sslip.io', 'host': 'ask.178.105.241.12.sslip.io'},
    # Monitores y paneles
    'monitor_power':    {'group': 'Monitores y paneles', 'label': 'Monitor Flujo POWER',    'url': 'https://monitor-power.178.105.241.12.sslip.io',   'host': 'monitor-power.178.105.241.12.sslip.io'},
    'monitor_cierre':   {'group': 'Monitores y paneles', 'label': 'Monitor Cierre de Mes',  'url': 'https://monitor-cierre.178.105.241.12.sslip.io',  'host': 'monitor-cierre.178.105.241.12.sslip.io'},
    'monitor_vaillant': {'group': 'Monitores y paneles', 'label': 'Monitor Flujo Vaillant', 'url': 'https://qfxzw9csjly5y5cy7hqev87g.178.105.241.12.sslip.io', 'host': 'qfxzw9csjly5y5cy7hqev87g.178.105.241.12.sslip.io'},
    'direccion':        {'group': 'Monitores y paneles', 'label': 'AIron Direccion',        'url': 'https://planta.178.105.241.12.sslip.io',          'host': 'planta.178.105.241.12.sslip.io'},
    'pedidos':          {'group': 'Monitores y paneles', 'label': 'Estado Pedidos',         'url': 'https://pedidos.178.105.241.12.sslip.io',         'host': 'pedidos.178.105.241.12.sslip.io'},
    'tareas':           {'group': 'Monitores y paneles', 'label': 'AIron Tareas',           'url': 'https://tareas.178.105.241.12.sslip.io',          'host': 'tareas.178.105.241.12.sslip.io'},
    # RFQ y voz
    'rfq_web': {'group': 'RFQ y voz', 'label': 'RFQ INDRA Web',      'url': 'https://t11zxssdcj6nfk4c5pci7lav.178.105.241.12.sslip.io', 'host': 't11zxssdcj6nfk4c5pci7lav.178.105.241.12.sslip.io'},
    'token':   {'group': 'RFQ y voz', 'label': 'AIron Token Server', 'url': 'https://airon-token.178.105.241.12.sslip.io',             'host': 'airon-token.178.105.241.12.sslip.io'},
    # Backend / orquestacion
    'n8n':     {'group': 'Backend / n8n', 'label': 'n8n backend', 'url': 'https://n8n.farguell.com', 'host': 'n8n.farguell.com'},
    # Infraestructura (servidores propios)
    'srv_front': {'group': 'Infraestructura', 'label': 'Servidor Frontend (Hetzner relay)', 'url': 'https://178.105.241.12', 'host': '178.105.241.12'},
    'srv_back':  {'group': 'Infraestructura', 'label': 'Servidor Backend (Hetzner)',        'url': 'https://178.105.73.190', 'host': '178.105.73.190'},
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


async def _scan_one(tid, pid):
    '''Escanea UN objetivo y transmite su salida. NO emite el marcador final
    "escaneo completado" (para poder encadenar varios en el barrido TODOS).'''
    t = TARGETS[tid]
    p = PROFILES[pid]
    yield sse('AIron Audit Engine - objetivo: ' + t['label'] + '  (' + t['url'] + ')', 'hdr')
    yield sse('perfil: ' + p['label'] + '  -  solo activos propios autorizados', 'hdr')
    yield sse('', 'out')
    # Preflight: resolver DNS + comprobar que responde, para no soltar output confuso
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


async def run_scan(tid, pid):
    '''Escaneo de UN objetivo (uso normal). Cierra con el marcador que la consola
    de Brain reconoce para terminar el stream.'''
    async for chunk in _scan_one(tid, pid):
        yield chunk
    yield sse('=== escaneo completado ===', 'ok')


async def run_all(pid):
    '''Barrido TODOS: recorre secuencialmente la lista blanca completa con el mismo
    perfil, y solo al final emite el marcador de cierre. Sigue siendo lista blanca:
    imposible apuntar a terceros.'''
    ids = list(TARGETS.keys())
    total = len(ids)
    p = PROFILES[pid]
    yield sse('==== BARRIDO COMPLETO - ' + str(total) + ' activos - perfil: ' + p['label'] + ' ====', 'hdr')
    yield sse('Solo activos propios autorizados (lista blanca). Esto puede tardar varios minutos.', 'hdr')
    for i, tid in enumerate(ids, 1):
        yield sse('', 'out')
        yield sse('-------- [' + str(i) + '/' + str(total) + '] ' + TARGETS[tid]['label'] + ' --------', 'hdr')
        async for chunk in _scan_one(tid, pid):
            yield chunk
    yield sse('', 'out')
    yield sse('=== barrido de ' + str(total) + ' activos: escaneo completado ===', 'ok')


@app.get('/health')
async def health():
    return {'ok': True}


@app.get('/api/targets')
async def targets():
    real = [{'id': k, 'label': v['label'], 'url': v['url'], 'group': v.get('group', 'Activos')} for k, v in TARGETS.items()]
    # Objetivo sintetico "TODOS": primero, en su propio grupo -> aparece arriba y
    # queda seleccionado por defecto en la consola de Brain.
    todos = {'id': 'all', 'label': 'TODOS los activos (' + str(len(TARGETS)) + ')', 'url': 'barrido secuencial de toda la lista blanca', 'group': 'Barrido completo'}
    return JSONResponse({
        'targets': [todos] + real,
        'profiles': [{'id': k, 'label': v['label']} for k, v in PROFILES.items()],
    })


@app.get('/api/scan')
async def scan(target: str, profile: str):
    if profile not in PROFILES:
        raise HTTPException(status_code=400, detail='perfil no valido')
    if target == 'all':
        return StreamingResponse(
            run_all(profile),
            media_type='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'},
        )
    if target not in TARGETS:
        raise HTTPException(status_code=403, detail='objetivo no autorizado')
    return StreamingResponse(
        run_scan(target, profile),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'},
    )


@app.get('/', response_class=PlainTextResponse)
async def index():
    return (
        'AIron Audit Engine - motor headless (Farguell Group).\n'
        'La interfaz vive integrada en AIron Brain: https://brain.farguell.com '
        '(icono "AIron Audit" al fondo de la barra izquierda).\n\n'
        'API: GET /api/targets - GET /api/scan?target=..&profile=.. (SSE) - GET /health\n'
        'target=all -> barrido de toda la lista blanca.\n'
    )
