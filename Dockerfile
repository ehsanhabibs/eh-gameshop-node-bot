
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

COPY ehgs-source.zip /tmp/ehgs-source.zip

RUN unzip -q /tmp/ehgs-source.zip -d /tmp/ehgs-source \
    && cp -a /tmp/ehgs-source/. /app/ \
    && rm -rf /tmp/ehgs-source /tmp/ehgs-source.zip \
    && npm install --omit=dev

ENV NODE_ENV=production

CMD ["npm", "start"]
