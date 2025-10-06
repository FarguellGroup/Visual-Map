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

# Instalar dependencias
npm install

# Ejecuta el servidor de desarrollo
npm run dev
```
## Generación del XML con Nmap

```bash
# Escaneo de infraestructura completa
sudo nmap -v -A 10.0.0.0/24 -oX scan.xml

# Escaneo de host completo
sudo nmap -v -A 10.0.0.1 -oX scan.xml

# Escaneo de subdominios
sudo nmap -v -A -iL subdomains.txt -oX scan.xml
```

Abre [http://localhost:9002](http://localhost:9002) en tu navegador para acceder a la interfaz de carga del XML.

## Configuración de la API de Gemini
Esta herramienta utiliza un módulo de inteligencia artificial a través de la API de Gemini que permite hacer una descripción avanzada de cada host encontrado, buscando vulnerabilidades y dándonos los pasos de explotación de la máquina. Puedes conseguir tu API de Gemini gratis aqui: https://aistudio.google.com/

Para importar la API solamente debemos dirigirnos al apartado "Configuración de la API" en el menú lateral e introducir la clave API generada. Automáticamente se verificará la autenticidad de la API y podrás elegir entre distintos modelos de Gemini:

<img width="3450" height="1536" alt="visual-api-false" src="https://github.com/user-attachments/assets/ed3eb56e-4469-479f-905e-7e3810dc20a5" />
<img width="3456" height="1928" alt="visual-api-true" src="https://github.com/user-attachments/assets/f91a480e-d2bf-494d-a4a1-2c78903f1207" />

## Cómo Usar

### 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3838" height="1670" alt="image" src="https://github.com/user-attachments/assets/da301ac1-65e4-4414-88e9-7c0690b412ca" />

### 2. Analiza el Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen, la lista de los hosts más vulnerables y una tabla con todos los dispositivos.

<img width="3456" height="1928" alt="visual-dashboard" src="https://github.com/user-attachments/assets/02f1fa55-0af7-4170-b94e-b5aaf36785fe" />

### 3. Explora las Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.

#### Hosts descubiertos
Un listado de todos los hosts descubiertos en el escaneo de Nmap, incluyendo la IP, nombre del host, sistema operativo, puertos abiertos y puntaje de crédito.

<img width="3456" height="1928" alt="visual-hosts" src="https://github.com/user-attachments/assets/7762b562-18a4-4750-9064-75136dc69ae5" />

#### Puertos abiertos
Consulta todos los puertos abiertos en el objetivo, con una gráfica de los 15 puertos abiertos más comunes.

<img width="3456" height="1926" alt="visual-ports" src="https://github.com/user-attachments/assets/85beaf2b-f4a4-4ebe-bfb5-c9eb3cc98de4" />

#### Servicios expuestos
Consulta todos los servicios expuestos en la infraestructura, con una gráfica de distribución de servicios.

<img width="3456" height="1924" alt="visual-services" src="https://github.com/user-attachments/assets/cbeab12e-e592-46b8-aa40-832cc1470a63" />

#### Hosts más vulnerables
Visualiza de manera rápida los hosts más vulnerables de una infraestructura, con un gráfico de distribución de riesgo.

<img width="3456" height="1926" alt="visual-vuln-hosts" src="https://github.com/user-attachments/assets/8af73f66-976a-4f70-a0b2-df157619bf4e" />

#### CVEs y Vulnerabilidades
Escanea todos los servicios expuestos y detecta todos los CVEs asociados, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista.

<img width="3456" height="1924" alt="visual-cves" src="https://github.com/user-attachments/assets/9eed556a-eb49-4529-9e6f-f24c500718e1" />

#### Grafo de red
Visualiza un esquema de la red y las relaciones entre los hosts de manera super simple.

<img width="3456" height="1928" alt="visual-network" src="https://github.com/user-attachments/assets/ecbbb12d-a532-4f9f-be47-2a132652b149" />

### 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

<img width="3456" height="1926" alt="visual-host" src="https://github.com/user-attachments/assets/52760d3e-1552-48ca-bb82-8f1cd76556b8" />
<img width="3456" height="1924" alt="visual-host-2" src="https://github.com/user-attachments/assets/aec5efba-29a1-442c-baf5-e6d4115b239b" />

### 5. Configura y Personaliza
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Gestiona tu API**: Desde la sección API, verifica tu clave de Gemini, cámbiala si es necesario y selecciona el modelo de IA que prefieras usar.
-   **Exporta los Resultados**: Genera informes profesionales en formato JSON, PDF o HTML con un solo clic.

<img width="3456" height="1924" alt="visual-ponderation" src="https://github.com/user-attachments/assets/988677d1-9b75-4ae2-aeb0-60ef14966df3" />
<img width="3456" height="2096" alt="visual-reports" src="https://github.com/user-attachments/assets/594fa34f-f42e-4bc0-9a92-a4dd4c0db242" />
