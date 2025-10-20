# Visual Map

Visual Map es una plataforma web Next.js que te permite subir escaneos XML de Nmap y visualizar hosts, puertos abiertos y servicios de una manera gráfica y amigable. Esta aplicación incluye un módulo de inteligencia artificial con la API de Gemini para priorizar los hosts más vulnerables, facilitar la identificación de riesgos de seguridad, buscar vulnerabilidades (CVEs) y generar resúmenes y recomendaciones de pentesting.

![Visual-Map Banner](https://github.com/user-attachments/assets/3e103f4f-46fa-4031-8842-0f38ae263d8f)

## Características

**📊 Dashboard Interactivo** - Estadísticas clave, hosts priorizados por criticidad y tabla completa de dispositivos descubiertos.

**🤖 Puntuación de Riesgo con IA** - Según puertos, servicios, versiones, scripts NSE y vulnerabilidades descubiertas.

**🔍 Análisis Detallado de Hosts** - Servicios, Sistema Operativo, scripts y análisis de riesgo generados por IA.

**🧠 Búsqueda de Vulnerabilidades (CVEs)** - Identifica CVEs conocidas para servicios detectados y obtén contexto en un clic.

**⚔️ Pentesting con IA** - Resumen de hallazgos de cada host y pasos de explotación sugeridos automáticamente.

**🧾 Exportación de Informes** - Genera reportes ejecutivos en JSON, HTML y PDF, con más contexto técnico y métricas de riesgo.

**🌍 Soporte Multilenguaje** - Interfaz disponible en Español e Inglés.

**🌗 Modo Claro / Oscuro** - Selecciona tu tema favorito con persistencia automática.

**🔒 Procesamiento Local** - Tus datos nunca salen de tu máquina (solo se envía a la IA lo estrictamente necesario.

## Instalación

```bash
# Clona el repositorio
git clone https://github.com/afsh4ck/Visual-Map.git
cd Visual-Map

# Instalar nodejs y npm (ejemplo en Kali Linux)
sudo apt install -y nodejs npm

# Instalar dependencias
npm install

# Ejecuta el servidor de desarrollo
npm run dev
```
Abre [http://localhost:9002](http://localhost:9002) en tu navegador para acceder a la interfaz de carga del XML.

## Generación del XML con Nmap

```bash
# Escaneo de infraestructura completa
sudo nmap -v -A 10.0.0.0/24 -oX scan.xml

# Escaneo de host completo
sudo nmap -v -A 10.0.0.1 -oX scan.xml

# Escaneo de subdominios
sudo nmap -v -A -iL subdomains.txt -oX scan.xml
```

## Configuración de la API de Gemini
Esta herramienta utiliza un módulo de inteligencia artificial a través de la API de Gemini que permite hacer una descripción avanzada de cada host encontrado, buscando vulnerabilidades y dándonos los pasos de explotación de la máquina. Puedes conseguir tu API de Gemini gratis aqui: https://aistudio.google.com/

Para importar la API solamente debemos dirigirnos al apartado "Configuración de la API" en el menú lateral e introducir la clave API generada. Automáticamente se verificará la autenticidad de la API y podrás elegir entre distintos modelos de Gemini:

<img width="3456" height="1858" alt="VM - API" src="https://github.com/user-attachments/assets/897432b9-fb83-4f69-84ef-7ef040a0c255" />

## Cómo Usar

### 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3456" height="1858" alt="VM - Upload" src="https://github.com/user-attachments/assets/25b9cc7a-2957-4918-bd62-abbb2ebca264" />

### 2. Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen, la lista de los hosts más vulnerables y una tabla con todos los dispositivos.

<img width="3456" height="1858" alt="VM - Dashboard" src="https://github.com/user-attachments/assets/5f1cc621-84c7-4cd5-9e99-80952bcddb41" />

### 3. Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.

#### Hosts descubiertos
Un listado de todos los hosts descubiertos en el escaneo de Nmap, incluyendo la IP, nombre del host, sistema operativo, puertos abiertos y puntaje de crédito.

<img width="3456" height="1858" alt="VM - Host 1" src="https://github.com/user-attachments/assets/95eab72c-2e10-4cdf-b6db-ddd1553a9390" />

#### Puertos abiertos
Consulta todos los puertos abiertos en el objetivo, con una gráfica de los 15 puertos abiertos más comunes.

<img width="3456" height="1858" alt="VM - Puertos" src="https://github.com/user-attachments/assets/af0e5e8e-d5b6-452e-a85a-9d19721aa0ba" />

#### Servicios expuestos
Consulta todos los servicios expuestos en la infraestructura, con una gráfica de distribución de servicios.

<img width="3456" height="1858" alt="VM - Services" src="https://github.com/user-attachments/assets/b6f43b37-773f-4eaf-86ce-348f28b9cce7" />

#### Hosts más vulnerables
Visualiza de manera rápida los hosts más vulnerables de una infraestructura, con un gráfico de distribución de riesgo.

<img width="3456" height="1858" alt="VM - Vulns" src="https://github.com/user-attachments/assets/c5c7853b-6c57-4971-91bf-b38b1b7caef8" />

#### CVEs y Vulnerabilidades
Escanea todos los servicios expuestos y detecta todos los CVEs asociados, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista.

<img width="3456" height="1860" alt="VM - CVEs" src="https://github.com/user-attachments/assets/47db32ce-baae-43ce-8142-4056d63bbfd9" />

#### Grafo de red
Visualiza un esquema de la red y las relaciones entre los hosts de manera super simple.

<img width="3456" height="1856" alt="VM - Grafo" src="https://github.com/user-attachments/assets/9219466d-9e09-486e-83cf-39325c4536d3" />

### 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

<img width="3456" height="1858" alt="VM - Host 1" src="https://github.com/user-attachments/assets/9d501f1f-2e34-4791-a5f4-8b82d1b82465" />
<img width="3456" height="1858" alt="VM - Host 2" src="https://github.com/user-attachments/assets/7e92d120-af7d-4bef-82e6-77e80190d3e9" />

### 5. Configura y Personaliza
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Gestiona tu API**: Desde la sección API, verifica tu clave de Gemini, cámbiala si es necesario y selecciona el modelo de IA que prefieras usar.
-   **Exporta los Resultados**: Genera informes profesionales en formato JSON, PDF o HTML con un solo clic.

<img width="3456" height="1854" alt="VM - Ponderación" src="https://github.com/user-attachments/assets/4d24bbb3-70ac-4d97-86a5-1b44bd50fd88" />
<img width="3456" height="2096" alt="visual-reports" src="https://github.com/user-attachments/assets/594fa34f-f42e-4bc0-9a92-a4dd4c0db242" />
