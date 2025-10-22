# Visual Map

Visual Map es una plataforma web Next.js que te permite subir escaneos XML de Nmap y visualizar hosts, puertos abiertos y servicios de una manera gráfica y amigable. Esta aplicación incluye un módulo de inteligencia artificial con la API de Gemini para priorizar los hosts más vulnerables, facilitar la identificación de riesgos de seguridad, buscar vulnerabilidades (CVEs) y generar resúmenes y recomendaciones de pentesting.

![Visual-Map Banner](https://github.com/user-attachments/assets/d6f4e607-9243-4aa2-a11a-8df4f7183c3b)

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

## Instalación y despliegue

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
Abre [http://localhost:9002](http://localhost:9002) en tu navegador para acceder a la interfaz de carga del XML.

## Despliegue con Docker

También puedes desplegar la aplicación utilizando Docker para un entorno estandarizado.

```bash
# 1. Construye la imagen de Docker
docker build -t visual-map .

# 2. Ejecuta el contenedor (-d lo ejecuta en segundo plano)
docker run -p 9002:3000 -d visual-map
```
Una vez ejecutado, la aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

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

<img width="3456" height="1860" alt="VM - API" src="https://github.com/user-attachments/assets/d9031c0a-41c4-4730-8b6e-c562a47706b1" />

## Cómo Usar

### 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3456" height="1816" alt="VM - Upload" src="https://github.com/user-attachments/assets/5782f17c-9136-43f4-8fbc-79fd2ae9a433" />

### 2. Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen, la lista de los hosts más vulnerables y una tabla con todos los dispositivos.

<img width="3456" height="1858" alt="VM - Dashboard" src="https://github.com/user-attachments/assets/db92e253-aa28-4766-97ab-91be37ed5e9d" />

### 3. Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.

#### Hosts descubiertos
Un listado de todos los hosts descubiertos en el escaneo de Nmap, incluyendo la IP, nombre del host, sistema operativo, puertos abiertos y puntaje de crédito.

<img width="3454" height="1856" alt="VM - Hosts" src="https://github.com/user-attachments/assets/089b925d-42c1-432b-bf1e-98d3458be133" />

#### Puertos abiertos
Consulta todos los puertos abiertos en el objetivo, con una gráfica de los 15 puertos abiertos más comunes.

<img width="3456" height="1858" alt="VM - Puertos" src="https://github.com/user-attachments/assets/946e22f6-856b-41e4-b8b2-0c4b54a0c6c2" />

#### Servicios expuestos
Consulta todos los servicios expuestos en la infraestructura, con una gráfica de distribución de servicios.

<img width="3456" height="1856" alt="VM - Services" src="https://github.com/user-attachments/assets/37bbd2da-5e07-4e6c-9e37-5c73aab7f44e" />

#### Hosts más vulnerables
Visualiza de manera rápida los hosts más vulnerables de una infraestructura, con un gráfico de distribución de riesgo.

<img width="3456" height="1858" alt="VM - Vulns" src="https://github.com/user-attachments/assets/260f6517-03b3-4a27-9c72-b3676ec64fc0" />

#### CVEs y Vulnerabilidades
Escanea todos los servicios expuestos y detecta todos los CVEs asociados, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista.

<img width="3456" height="1856" alt="VM - CVEs" src="https://github.com/user-attachments/assets/fd8510cb-57fb-4ae6-b0b7-f19accab2c22" />

#### Grafo de red
Visualiza un esquema de la red y las relaciones entre los hosts de manera super simple, identificando posibles rutas de pivoting.

<img width="3456" height="1858" alt="VM - Grafo" src="https://github.com/user-attachments/assets/d88b69a3-871e-426d-9bf0-e140f54de3aa" />

### 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

<img width="3456" height="1858" alt="VM - Host 1" src="https://github.com/user-attachments/assets/c5c5097f-41dc-4bc5-9bf4-7c92d38ac861" />
<img width="3456" height="1858" alt="VM - Host 2" src="https://github.com/user-attachments/assets/cb8ffb13-6748-4130-8784-8fe809504516" />

### 5. Configura y Personaliza
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Gestiona tu API**: Desde la sección API, verifica tu clave de Gemini, cámbiala si es necesario y selecciona el modelo de IA que prefieras usar.
-   **Exporta los Resultados**: Genera informes profesionales en formato JSON, PDF o HTML con un solo clic.

<img width="3456" height="1856" alt="VM - Ponderación" src="https://github.com/user-attachments/assets/f2d04606-44eb-43ed-81f5-84e921ce0df3" />
<img width="3456" height="2096" alt="visual-reports" src="https://github.com/user-attachments/assets/594fa34f-f42e-4bc0-9a92-a4dd4c0db242" />
