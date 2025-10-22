# 1. Base Image
FROM node:20-alpine AS base
WORKDIR /app

# 2. Install Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 3. Build the Application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Production Image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 9002

CMD ["node", "server.js"]
