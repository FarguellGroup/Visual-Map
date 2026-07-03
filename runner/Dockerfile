FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    NUCLEI_DISABLE_UPDATE_CHECK=true \
    HOME=/root

# Herramientas de auditoria + utilidades
RUN apt-get update && apt-get install -y --no-install-recommends \
        nmap whatweb curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# nuclei (ultima release oficial de ProjectDiscovery)
RUN set -eux; \
    url=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest \
          | grep -o 'https://[^"]*_linux_amd64.zip' | head -1); \
    curl -sL "$url" -o /tmp/n.zip; \
    unzip -o /tmp/n.zip -d /usr/local/bin nuclei; \
    chmod +x /usr/local/bin/nuclei; \
    rm /tmp/n.zip; \
    nuclei -version || true

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
