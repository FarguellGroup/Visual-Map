<a id="visual-map"></a>
# Visual Map

Visual Map es una plataforma web Next.js que te permite subir escaneos XML de Nmap y visualizar hosts, puertos abiertos y servicios de una manera gráfica y amigable. Esta aplicación incluye un módulo de inteligencia artificial con la API de Gemini para priorizar los hosts más vulnerables, facilitar la identificación de riesgos de seguridad, buscar vulnerabilidades (CVEs) y generar resúmenes y recomendaciones de pentesting.

![Visual-Map Banner](https://github.com/user-attachments/assets/e4d82a59-1f50-4532-975a-c6be25269651)

## Índice

- [Visual Map](#visual-map)
- [Características](#caracteristicas)
- [Instalación y despliegue](#instalacion-y-despliegue)
  - [Despliegue con Docker](#despliegue-con-docker)
  - [Generación del XML con Nmap](#generacion-del-xml-con-nmap)
  - [Configuración de la API de Gemini](#configuracion-de-la-api-de-gemini)
- [Cómo Usar](#como-usar)
  - [1. Sube tu Escaneo](#1-sube-tu-escaneo)
  - [2. Dashboard Principal](#2-dashboard-principal)
  - [3. Vistas Detalladas](#3-vistas-detalladas)
    - [Resumen Ejecutivo con IA](#resumen-ejecutivo)
    - [Hosts descubiertos](#hosts-descubiertos)
    - [Puertos y Servicios](#puertos-y-servicios)
    - [Hosts Vulnerables y CVEs](#hosts-vulnerables-y-cves)
    - [Remediaciones](#remediaciones)
    - [Grafo de Red](#grafo-de-red)
    - [Rutas de Ataque con IA](#rutas-de-ataque)
  - [4. Profundiza en cada Host](#4-profundiza-en-cada-host)
  - [5. Configuración y exportación](#5-configuracion-y-exportacion)

<a id="caracteristicas"></a>
## Características

**📊 Dashboard Interactivo** - Estadísticas clave, hosts priorizados por criticidad y tabla completa de dispositivos descubiertos.

**🤖 Puntuación de Riesgo con IA** - Según puertos, servicios, versiones, scripts NSE y vulnerabilidades descubiertas.

**🔍 Análisis Detallado de Hosts** - Servicios, Sistema Operativo, scripts y análisis de riesgo generados por IA.

**🧠 Búsqueda de Vulnerabilidades (CVEs)** - Identifica CVEs conocidas para servicios detectados y obtén contexto en un clic.

**⚔️ Pentesting con IA** - Resumen de hallazgos de cada host y pasos de explotación sugeridos automáticamente.

**🧾 Exportación de Informes** - Genera reportes ejecutivos en JSON, HTML y PDF, con más contexto técnico y métricas de riesgo.

**🌍 Soporte Multilenguaje** - Interfaz disponible en Español e Inglés.

**🌗 Modo Claro / Oscuro** - Selecciona tu tema favorito con persistencia automática.

**🔒 Procesamiento Local** - Tus datos nunca salen de tu máquina, solo se envía a la IA lo estrictamente necesario.

<a id="instalacion-y-despliegue"></a>
# Instalación y despliegue

```bash
# 1. Clona el repositorio
git clone https://github.com/afsh4ck/Visual-Map.git
cd Visual-Map

# 2. Instalar nodejs y npm (ejemplo en Kali Linux)
sudo apt install -y nodejs npm

# 3. Instalar dependencias
npm install

# 4. Ejecuta el servidor de desarrollo
npm run dev
```
Una vez ejecutado, la aplicación estará disponible en [http://localhost:9002](http://localhost:9002).

<a id="despliegue-con-docker"></a>
## Despliegue con Docker

Puedes desplegar la aplicación utilizando Docker. Primero, necesitas tu clave de API de Gemini, que puedes obtener gratis en [Google AI Studio](https://aistudio.google.com/).

```bash
# 1. Clona el repositorio
git clone https://github.com/afsh4ck/Visual-Map.git
cd Visual-Map

# 2. Construye la imagen de Docker
docker build -t visual-map .

# 3. Ejecuta el contenedor con tu clave de API
docker run -p 9002:3000 -e NEXT_PUBLIC_GOOGLE_GENAI_API_KEY="TU_API_KEY" -d visual-map

# 4. Comprueba que está levantado
docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"               

CONTAINER ID   IMAGE        STATUS        PORTS
6fa2599b045a   visual-map   Up 1 minute   9002/tcp, 0.0.0.0:9002->3000/tcp, :::9002->3000/tcp

# 5. Detener y eliminar contenedor (al finalizar)
docker stop {container-id}
docker rm {container-id}
```
Una vez ejecutado, la aplicación estará disponible en [http://localhost:9002](http://localhost:9002).

<a id="generacion-del-xml-con-nmap"></a>
## Generación del XML con Nmap

```bash
# Escaneo de infraestructura completa
sudo nmap -v -A 10.0.0.0/24 -oX scan.xml

# Escaneo de host completo
sudo nmap -v -A 10.0.0.1 -oX scan.xml

# Escaneo de subdominios
sudo nmap -v -A -iL subdomains.txt -oX scan.xml
```

<a id="configuracion-de-la-api-de-gemini"></a>
## Configuración de la API de Gemini
Esta herramienta utiliza un módulo de inteligencia artificial a través de la API de Gemini que permite hacer una descripción avanzada de cada host encontrado, buscando vulnerabilidades y dándonos los pasos de explotación de la máquina. Puedes conseguir tu API de Gemini gratis aqui: https://aistudio.google.com/

Para usar la IA, debes proporcionar tu clave API al ejecutar el contenedor de Docker como se muestra en la sección de despliegue. En el apartado "Configuración de la API" podrás verificar el estado de tu clave y seleccionar el modelo de Gemini que prefieras. Si ejecutas la aplicación en modo desarrollo (`npm run dev`), podrás introducir la clave directamente en la interfaz.

![VM - API](https://github.com/user-attachments/assets/530bc9b6-88be-4ac2-a5a0-785f854e601f)

<a id="como-usar"></a>
# Cómo Usar

<a id="1-sube-tu-escaneo"></a>
## 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3456" height="1816" alt="VM - Upload" src="https://github.com/user-attachments/assets/5782f17c-9136-43f4-8fbc-79fd2ae9a433" />

<a id="2-dashboard-principal"></a>
## 2. Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen y una tabla con todos los dispositivos ordenados por criticidad.

![VM - Dashboard](https://github.com/user-attachments/assets/b2e28c0a-9f06-4a79-8031-ce479e883200)

<a id="3-vistas-detalladas"></a>
## 3. Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.

<a id="resumen-ejecutivo"></a>
### Resumen Ejecutivo con IA
Genera un informe de alto nivel con IA que resume la postura de seguridad, los hallazgos críticos y las recomendaciones estratégicas. Una vez generado se incluirá en los informes HTML y PDF.

![VM - Resumen Ejecutivo](https://github.com/user-attachments/assets/b8a2f942-f48d-4485-95f6-5c0d211aa166)

<a id="hosts-descubiertos"></a>
### Hosts descubiertos
Un listado de todos los hosts descubiertos en el escaneo de Nmap, incluyendo la IP, nombre del host, sistema operativo, puertos abiertos y puntaje de riesgo.

![VM - Hosts](https://github.com/user-attachments/assets/d18b4771-d836-410d-ae52-285ddd4fe85e)

<a id="puertos-abiertos"></a>
### Puertos abiertos
Consulta todos los puertos abiertos en los objetivos, con una gráfica de los 15 puertos abiertos más comunes.

![VM - Puertos](https://github.com/user-attachments/assets/bf9ea4ab-78ac-47cd-b969-3a3d40131a6e)

<a id="servicios-expuestos"></a>
### Servicios expuestos
Consulta todos los servicios expuestos en la infraestructura, con una gráfica de distribución de servicios.

![VM - Servicios](https://github.com/user-attachments/assets/6c9a0d9b-4727-4251-8c35-486a8c165ac9)

<a id="hosts-mas-vulnerables"></a>
### Hosts más vulnerables
Visualiza de manera rápida los hosts más vulnerables de una infraestructura, con un gráfico de distribución de riesgo.

![VM - Vulns](https://github.com/user-attachments/assets/a2dc5ec3-d1f0-4bc1-ae17-d4a1564cab95)

<a id="cves-y-vulnerabilidades"></a>
### CVEs y Vulnerabilidades
Escanea todos los servicios expuestos y detecta todos los CVEs asociados, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista y filtrar por cada host que tenga CVEs asociados.

![VM - CVEs](https://github.com/user-attachments/assets/5b899d7d-2ee5-4638-906f-d08c98a1827a)

<a id="remediaciones"></a>
### Remediaciones
Después de escanear los CVEs, en esta sección podrás generar remediaciones para todos los CVEs con IA. Una vez generado se incluirá en los informes HTML y PDF.

![VM - Remediaciones](https://github.com/user-attachments/assets/d3243dbf-af0e-474c-9f88-144a9b70557f)

<a id="grafo-de-red"></a>
### Grafo de red
Visualiza un esquema de la red y las relaciones entre los hosts de manera super simple, identificando posibles rutas de pivoting.

![VM - Grafo](https://github.com/user-attachments/assets/8ebeeadc-3b14-465c-9cf5-139d11e75dd2)

<a id="rutas-de-ataque"></a>
### Rutas de Ataque con IA
Utiliza la IA para analizar y visualizar posibles rutas de ataque y pivoting entre los hosts de alto riesgo, ayudándote a entender cómo un atacante podría moverse lateralmente por la red.

![VM - Attack Paths](https://github.com/user-attachments/assets/36bdad6a-d2ff-479c-8fe7-04ce2cfcef37)

<a id="4-profundiza-en-cada-host"></a>
## 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

![VM - Host 1](https://github.com/user-attachments/assets/8f3da569-b858-47af-ac1e-92fdf3f21a19)
![VM - Host 2](https://github.com/user-attachments/assets/44e8b998-7efc-4bbc-980a-e4d82cee02d5)

<a id="5-configuracion-y-exportacion"></a>
## 5. Configuración y exportación
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Exporta los Resultados**: Genera informes profesionales en formato PDF, HTML, JSON o XLSX con un solo clic.

![VM - Ponderación](https://github.com/user-attachments/assets/184a5b87-8ddc-45b7-a88d-da406556573c)
<img width="3456" height="1860" alt="VM - Report HTML" src="https://github.com/user-attachments/assets/e7bbd441-cb9d-4c42-ba41-bb448f3192e6" />

## Créditos
- Autor:       afsh4ck 
- Instagram:   <a href="https://www.instagram.com/afsh4ck">afsh4ck</a>
- Youtube:     <a href="https://youtube.com/@afsh4ck">afsh4ck</a>

## Soporte

<a href="https://www.buymeacoffee.com/afsh4ck" rel="nofollow"><img width="250" align="left">
![buy-me-a-coffe](https://github.com/user-attachments/assets/8c8f9e81-334e-469e-b25e-29888cfc9fcc)
</a>
