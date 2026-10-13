# Production Dockerfile for PULSE360
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy application files
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY manifest.json ./
COPY knowledge/ ./knowledge/
COPY src/ ./src/
COPY assets/ ./assets/

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "server.js"]
