# === STAGE 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json ./
COPY package-lock.json ./

# Instalar dependencias
# Usamos --omit=dev para no instalar las dependencias de desarrollo
RUN npm install --omit=dev

# Copiar el resto de los archivos de la aplicación
COPY . .

# Construir la aplicación para producción
RUN npm run build

# === STAGE 2: Production ===
FROM node:20-alpine AS production

WORKDIR /app

# Copiar archivos construidos desde el 'builder'
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/navigation.ts ./navigation.ts


# Exponer el puerto en el que corre la aplicación
EXPOSE 9002

# Comando para iniciar la aplicación en modo producción
CMD ["npm", "start", "--", "-p", "9002"]
