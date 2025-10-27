<a id="visual-map"></a>
# Visual Map

Visual Map es una plataforma web Next.js que te permite subir escaneos XML de Nmap y visualizar hosts, puertos abiertos y servicios de una manera gráfica y amigable. Esta aplicación incluye un módulo de inteligencia artificial con la API de Gemini para priorizar los hosts más vulnerables, facilitar la identificación de riesgos de seguridad, buscar vulnerabilidades (CVEs) y generar resúmenes y recomendaciones de pentesting.

![Visual-Map Banner](https://github.com/user-attachments/assets/d5fdfe3d-f682-4659-ae91-74099bf31a2a)

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
    - [Hosts descubiertos](#hosts-descubiertos)
    - [Puertos abiertos](#puertos-abiertos)
    - [Servicios expuestos](#servicios-expuestos)
    - [Hosts más vulnerables](#hosts-mas-vulnerables)
    - [CVEs y Vulnerabilidades](#cves-y-vulnerabilidades)
    - [Remediaciones](#remediaciones)
    - [Grafo de red](#grafo-de-red)
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

<img width="3456" height="1856" alt="VM - API" src="https://github.com/user-attachments/assets/fcda6130-8fcf-4765-8ff3-cb18e3700461" />

<a id="como-usar"></a>
# Cómo Usar

<a id="1-sube-tu-escaneo"></a>
## 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3456" height="1816" alt="VM - Upload" src="https://github.com/user-attachments/assets/5782f17c-9136-43f4-8fbc-79fd2ae9a433" />

<a id="2-dashboard-principal"></a>
## 2. Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen y una tabla con todos los dispositivos ordenados por criticidad.

<img width="3456" height="1856" alt="VM - Dashboard" src="https://github.com/user-attachments/assets/4791a3d4-7ac5-4fa4-a4c2-a44b3b7e7df8" />

<a id="3-vistas-detalladas"></a>
## 3. Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.


<a id="hosts-descubiertos"></a>
### Hosts descubiertos
Un listado de todos los hosts descubiertos en el escaneo de Nmap, incluyendo la IP, nombre del host, sistema operativo, puertos abiertos y puntaje de crédito.

<img width="3838" height="1854" alt="VM - Hosts" src="https://github.com/user-attachments/assets/e139dcda-3812-4fd3-8dd3-0f6879ec6cef" />

<a id="puertos-abiertos"></a>
### Puertos abiertos
Consulta todos los puertos abiertos en el objetivo, con una gráfica de los 15 puertos abiertos más comunes.

<img width="3840" height="1852" alt="VM - Puertos" src="https://github.com/user-attachments/assets/e77cbbbe-2028-42e9-a6cb-9c2a7b42b22c" />

<a id="servicios-expuestos"></a>
### Servicios expuestos
Consulta todos los servicios expuestos en la infraestructura, con una gráfica de distribución de servicios.

<img width="3840" height="1854" alt="VM - Servicios" src="https://github.com/user-attachments/assets/410eda0e-c612-4397-9601-6503d394d265" />

<a id="hosts-mas-vulnerables"></a>
### Hosts más vulnerables
Visualiza de manera rápida los hosts más vulnerables de una infraestructura, con un gráfico de distribución de riesgo.

<img width="3456" height="1856" alt="VM - Vulns" src="https://github.com/user-attachments/assets/44ae4203-8d1b-4917-84f4-700482880eea" />

<a id="cves-y-vulnerabilidades"></a>
### CVEs y Vulnerabilidades
Escanea todos los servicios expuestos y detecta todos los CVEs asociados, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista y filtrar por cada host que tenga CVEs asociados.

<img width="3840" height="1852" alt="VM - CVEs" src="https://github.com/user-attachments/assets/b6878791-9588-4ba6-9fe9-e9e57517cafd" />

<a id="remediaciones"></a>
### Remediaciones
Después de escanear los CVEs en esta sección podrás generar remediaciones para todos los CVEs con IA. Estas remediaciones aparecerán en los informes HTML y PDF.

<img width="3840" height="1850" alt="VM - Remediaciones 1" src="https://github.com/user-attachments/assets/15f710f0-b959-4de8-9b4b-8983fe5d0a1f" />
<img width="3840" height="1856" alt="VM - Remediaciones 2" src="https://github.com/user-attachments/assets/13620858-189f-4f80-9fa7-72eb967cbbff" />

<a id="grafo-de-red"></a>
### Grafo de red
Visualiza un esquema de la red y las relaciones entre los hosts de manera super simple, identificando posibles rutas de pivoting.

<img width="3456" height="1856" alt="VM - Grafo" src="https://github.com/user-attachments/assets/0dfe475c-5ba4-4225-a852-c6871884eea6" />

<a id="4-profundiza-en-cada-host"></a>
## 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

<img width="3456" height="1856" alt="VM - Host 1" src="https://github.com/user-attachments/assets/e21fe72c-759b-4f38-bfee-5275f25f7c7e" />
<img width="3456" height="1816" alt="VM - Host 2" src="https://github.com/user-attachments/assets/89fa35dc-95d7-44de-8f78-83277af2ac04" />

<a id="5-configuracion-y-exportacion"></a>
## 5. Configuración y exportación
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Exporta los Resultados**: Genera informes profesionales en formato JSON, PDF o HTML con un solo clic.

<img width="3456" height="1858" alt="VM - Ponderación" src="https://github.com/user-attachments/assets/1fa56c0c-523c-4c27-a086-b1892e9cbd86" />
<img width="3456" height="1860" alt="VM - Report HTML" src="https://github.com/user-attachments/assets/e7bbd441-cb9d-4c42-ba41-bb448f3192e6" />
