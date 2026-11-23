FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

COPY ehgs-source.zip /tmp/ehgs-source.zip

RUN unzip -q /tmp/ehgs-source.zip -d /tmp/ehgs-source \
    && PACKAGE_JSON="$(find /tmp/ehgs-source -type f -name package.json -print -quit)" \
    && test -n "$PACKAGE_JSON" \
    && PROJECT_DIR="$(dirname "$PACKAGE_JSON")" \
    && cp -a "$PROJECT_DIR"/. /app/ \
    && rm -rf /tmp/ehgs-source /tmp/ehgs-source.zip \
    && npm install --omit=dev

ENV NODE_ENV=production

CMD ["npm", "start"]
