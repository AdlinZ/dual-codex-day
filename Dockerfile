FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="codex-day" \
      org.opencontainers.image.description="Local-first Codex token activity dashboard" \
      org.opencontainers.image.source="https://github.com/AdlinZ/codex-day" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production \
    TZ=Asia/Shanghai

COPY --chown=node:node package.json LICENSE ./
COPY --chown=node:node assets/codex-day-mark.svg ./assets/codex-day-mark.svg
COPY --chown=node:node config ./config
COPY --chown=node:node src/index.template.html src/token-dashboard.css ./src/
COPY --chown=node:node scripts/codex-day.mjs ./scripts/codex-day.mjs
COPY --chown=node:node scripts/lib ./scripts/lib

RUN mkdir -p /app/dist /data && chown -R node:node /app/dist /data

USER node

EXPOSE 8765
VOLUME ["/data"]
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8765/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "scripts/codex-day.mjs", "--codex-root", "/codex", "--database", "/data/codex-day.sqlite", "--dashboard", "/app/dist/index.html", "--host", "0.0.0.0"]
