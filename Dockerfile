# Multi-stage Dockerfile for production build
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps using BuildKit cache to reduce network traffic
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy built output
COPY --from=builder /app/dist ./dist

# Install only production dependencies using BuildKit cache
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --only=production --prefer-offline --no-audit --no-fund || npm install --production

# Copy a small Node-based wait script (no apt downloads required)
COPY wait-for-db.js ./wait-for-db.js

# Copy init SQL so it's available in container (optional)
COPY drizzle /app/drizzle

EXPOSE 5173

CMD ["sh", "-c", "node wait-for-db.js && npm run start"]
