# Visual Map

Visual Map es una plataforma web Next.js que te permite subir escaneos XML de Nmap y visualizar hosts, puertos abiertos y servicios de una manera gráfica y amigable. Esta aplicación incluye un módulo de inteligencia artificial con la API de Gemini para priorizar los hosts más vulnerables, facilitar la identificación de riesgos de seguridad, buscar vulnerabilidades (CVEs) y generar resúmenes y recomendaciones de pentesting.

<img width="3799" height="1724" alt="image" src="https://github.com/user-attachments/assets/cfe8f3c9-42eb-4fdb-8321-15068aae8443" />

## Características

-   **Carga y Análisis Instantáneo**: Arrastra y suelta archivos XML de Nmap para un análisis y visualización inmediatos.
-   **Dashboard Interactivo**: Visualiza estadísticas clave de tu escaneo, una lista priorizada de los hosts más vulnerables y una tabla completa con todos los dispositivos descubiertos.
-   **Puntuación de Riesgo con IA**: Un sistema avanzado puntúa y clasifica los hosts por su nivel de riesgo, combinando información de puertos críticos, servicios, versiones, scripts NSE y vulnerabilidades (CVEs).
-   **Análisis Detallado de Hosts**: Explora en profundidad cada host con información sobre sus puertos, servicios, sistema operativo, scripts y un análisis de riesgo generado por IA.
-   **Búsqueda de Vulnerabilidades (CVEs)**: Identifica vulnerabilidades conocidas (CVEs) para los servicios y versiones detectados. Realiza búsquedas para un host específico o para todos los hosts del escaneo con un solo clic.
-   **Pentesting con IA**: Obtén un resumen de los hallazgos de los scripts NSE y una lista de los siguientes pasos de pentesting recomendados, todo ello generado por IA.
-   **Visualizaciones Avanzadas**:
    -   **Gráficos Interactivos**: Analiza la distribución de puertos, servicios y niveles de riesgo en toda tu infraestructura.
    -   **Grafo de Red**: Visualiza las conexiones y la topología de tu red de una forma gráfica e intuitiva.
-   **Exportación de Informes**: Genera informes completos de tus escaneos en formatos **JSON**, **HTML** navegable y **PDF**.
-   **Controles Personalizables**: Ajusta en tiempo real los pesos del algoritmo de riesgo para adaptar la puntuación a tus prioridades.
-   **Configuración de API desde la UI**: Verifica el estado de tu clave API de Gemini, consulta los modelos disponibles y cambia entre ellos fácilmente, todo desde la interfaz web.
-   **Soporte Multilenguaje**: Interfaz disponible en Español e Inglés.
-   **Modo Claro y Oscuro**: Un selector de tema persistente y fácil de usar para tu comodidad visual.
-   **Diseño Adaptable**: Totalmente adaptable y accesible, diseñado para su uso tanto en escritorio como en dispositivos móviles.
-   **Procesamiento Local**: Todo el procesamiento se realiza en tu navegador. Tus datos de escaneo nunca salen de tu máquina (solo se envían a la API de Gemini los datos necesarios para los análisis de IA).

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

## Configuración de la API de Gemini
Esta herramienta utiliza un módulo de inteligencia artificial a través de la API de Gemini que permite hacer una descripción avanzada de cada host encontrado, buscando vulnerabilidades y dándonos los pasos de explotación de la máquina. Puedes conseguir tu API de Gemini gratis aqui: https://aistudio.google.com/

Crea un archivo llamado `.env` en la raíz del proyecto y añade tu clave API:

```bash
# .env
NEXT_PUBLIC_GOOGLE_GENAI_API_KEY="AIza..."
```
También puedes configurar o cambiar la clave API directamente desde la interfaz de la aplicación en la sección de "API".

## Generación del XML con Nmap

```bash
# Escaneo de infraestructura completa
sudo nmap -v -A 10.0.0.0/24 -oX scan.xml

# Escaneo de host completo
sudo nmap -v -A 10.0.0.1 -oX scan.xml

# Escaneo de subdominios
sudo nmap -v -A -iL subdomains.txt -oX scan.xml
```

Abre [http://localhost:9002](http://localhost:9002) en tu navegador para ver el resultado.

## Cómo Usar

### 1. Sube tu Escaneo
Arrastra y suelta tu archivo XML de Nmap en la zona de carga, o haz clic para seleccionarlo. La plataforma lo procesará al instante.

<img width="3838" height="1670" alt="image" src="https://github.com/user-attachments/assets/da301ac1-65e4-4414-88e9-7c0690b412ca" />

### 2. Analiza el Dashboard Principal
Una vez procesado, obtendrás una vista general con tarjetas resumen, la lista de los hosts más vulnerables y una tabla con todos los dispositivos.

<img width="3799" height="1724" alt="image" src="https://github.com/user-attachments/assets/d96b135b-549f-4626-a35f-136e7eacd0b3" />

### 3. Explora las Vistas Detalladas
Usa el menú lateral para navegar por las distintas secciones y profundizar en la información de tu escaneo.

<img width="3796" height="1724" alt="image" src="https://github.com/user-attachments/assets/356fd4a6-3b54-46ab-947d-44134d4defd6" />

#### Hosts, Puertos y Servicios
Consulta tablas detalladas y ordenables para cada una de estas categorías, acompañadas de gráficos interactivos.

<img width="3798" height="1725" alt="image" src="https://github.com/user-attachments/assets/45ee819a-fb73-4f2d-910a-ed5f629b1c74" />

#### Vulnerabilidades (Threats)
Visualiza los hosts con mayor riesgo y accede a un desglose de las vulnerabilidades (CVEs) encontradas, con su puntuación CVSS. Puedes iniciar la búsqueda de CVEs para todos los hosts desde esta vista.

<img width="3805" height="1715" alt="image" src="https://github.com/user-attachments/assets/212a6d01-6eee-4787-aeb7-b7f15c913a59" />

### 4. Profundiza en cada Host
Haz clic en cualquier host para acceder a su página de detalle, donde encontrarás:
-   Un análisis de riesgo con IA.
-   Una sección dedicada a CVEs para buscar vulnerabilidades específicas de ese host.
-   Tablas de puertos y scripts NSE.
-   Resumen de scripts NSE y recomendaciones de pentesting con IA.

<img width="3802" height="1713" alt="image" src="https://github.com/user-attachments/assets/32b59ca0-46bc-45a7-a274-0ecc84c75c70" />

<img width="2166" height="1046" alt="image" src="https://github.com/user-attachments/assets/d116e7a0-ef7e-4e2a-b35f-bb75ed871131" />

### 5. Configura y Personaliza
-   **Ajusta los Pesos de Riesgo**: Modifica la importancia que se le da a cada factor (CVEs, puertos críticos, etc.) en el cálculo del riesgo.
-   **Gestiona tu API**: Desde la sección API, verifica tu clave de Gemini, cámbiala si es necesario y selecciona el modelo de IA que prefieras usar.
-   **Exporta los Resultados**: Genera informes profesionales en formato JSON, PDF o HTML con un solo clic.

<img width="3840" height="1808" alt="image" src="https://github.com/user-attachments/assets/b18400f0-e482-485c-a1c5-b9a66e54abd4" />
