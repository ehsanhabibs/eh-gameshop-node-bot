FROM node:20-bookworm-slim

WORKDIR /app

# GitHub repository root is the single source of truth.
# Do not unpack a second, potentially stale application ZIP during deployment.
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Stop deployment if the uploaded source is incomplete or tests fail.
RUN npm run check && npm test

ENV NODE_ENV=production

CMD ["npm", "start"]
