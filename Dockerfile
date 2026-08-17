# syntax=docker/dockerfile:1

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3131 \
    HOME=/app

WORKDIR /app

# Runtime only — the app has zero npm dependencies beyond Node built-ins.
COPY src/ ./src/
COPY demo/ ./demo/
COPY index.html ./
COPY scripts/amster ./scripts/amster
COPY package.json ./

# UID 1000 matches the node image user, so a mounted 0600 env file
# owned by the host user stays readable.
RUN mkdir -p data && chown -R node:node /app/data

USER node

EXPOSE 3131

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const p = process.env.PORT || 3131; fetch('http://127.0.0.1:' + p + '/api/billing').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
