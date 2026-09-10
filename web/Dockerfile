# =====================================================================
# WE DREAM — PWA
# Contexto de build: a RAIZ do repositório (precisa de shared/content.json)
#   docker build -f web/Dockerfile -t we-dream-web .
# =====================================================================

# ------------------------------------------------------------ build
FROM node:22-alpine AS build

WORKDIR /app

# O build não precisa dos navegadores do Playwright (usados só nos testes E2E)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    CI=1

# dependências primeiro (camada de cache)
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm ci --no-audit --no-fund

# código
COPY shared ./shared
COPY web ./web

RUN cd web && npm run build

# ------------------------------------------------------------ runtime
FROM nginx:1.27-alpine AS runtime

# tini para o entrypoint tratar sinais corretamente
RUN apk add --no-cache tini

COPY --from=build /app/web/dist /usr/share/nginx/html
COPY deploy/nginx-app.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx-security-headers.conf /etc/nginx/wedream-security-headers.conf
COPY deploy/docker-entrypoint.sh /docker-entrypoint-wedream.sh
RUN chmod +x /docker-entrypoint-wedream.sh

# Valores injetados em tempo de execução (a mesma imagem serve qualquer ambiente)
ENV WEB_SUPABASE_URL="" \
    WEB_SUPABASE_ANON_KEY="" \
    WEB_VAPID_PUBLIC_KEY="" \
    WEB_PUSH_API_URL=""

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint-wedream.sh"]
CMD ["nginx", "-g", "daemon off;"]
