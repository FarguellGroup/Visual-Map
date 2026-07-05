# AIron Audit Engine — Farguell Group

Motor **headless** de auditoría en vivo. Ejecuta `nmap` / `whatweb` / `nuclei` contra
**activos propios** de Farguell (lista blanca) y transmite la salida por **SSE**.

La **interfaz de usuario vive integrada en AIron Brain** (`https://brain.farguell.com`,
icono *AIron Audit* al fondo de la barra izquierda), que consume esta API same-origin a
través del proxy `/audit-api/` de su nginx. Este repo ya **no** contiene el antiguo dashboard
Next.js "Visual-Map" (retirado el 05-jul-2026 e integrado en Brain).

## Estructura
- `runner/` — el motor (FastAPI + nmap/whatweb/nuclei, puerto 8000). Es lo que se despliega.

## Despliegue (Coolify)
App **AIron Audit Engine** en el Coolify del `.24` · build pack **Dockerfile** ·
base directory **`/runner`** · puerto interno **8000** · dominio interno `audit-engine.internal`
(no público; solo lo alcanza el proxy de Brain).

## API
- `GET /api/targets` — lista blanca (16 activos: apps del ecosistema + 2 servidores) + perfiles.
- `GET /api/scan?target=<id>&profile=<recon|web|full>` — escaneo en vivo (SSE).
- `GET /health`.

> Escanea únicamente sistemas propios o con autorización escrita. Nunca terceros.
