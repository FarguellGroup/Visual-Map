# 1. Install dependencies
FROM node:20-alpine AS installer
WORKDIR /app
COPY package*.json ./
RUN npm install

# 2. Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Final image for production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 9002

CMD ["node", "server.js"]
