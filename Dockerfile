
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

COPY ehgs-source.zip /tmp/ehgs-source.zip

RUN unzip -q /tmp/ehgs-source.zip -d /tmp/ehgs-source \
    && PKG="$(find /tmp/ehgs-source -maxdepth 3 -name package.json -not -path '*/node_modules/*' | awk '{print length, $0}' | sort -n | head -n 1 | cut -d' ' -f2-)" \
    && if [ -z "$PKG" ]; then echo "package.json not found in ehgs-source.zip"; exit 1; fi \
    && cp -a "$(dirname "$PKG")"/. /app/ \
    && rm -rf /tmp/ehgs-source /tmp/ehgs-source.zip \
    && npm install --omit=dev

ENV NODE_ENV=production

CMD ["npm", "start"]
