# =====================================================================
# WE DREAM — servidor de notificações (coach diário)
# Contexto de build: a RAIZ do repositório (precisa de shared/content.json)
#   docker build -f push-server/Dockerfile -t we-dream-push .
# =====================================================================
FROM node:22-alpine

RUN apk add --no-cache tini wget

WORKDIR /app

COPY push-server/package.json push-server/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY push-server/src ./src
COPY shared ./shared

ENV NODE_ENV=production \
    PORT=8081 \
    TICK_MINUTES=15

# roda sem privilégios
USER node

EXPOSE 8081

HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8081/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
