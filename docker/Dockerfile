FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable
COPY package*.json tsconfig.base.json ./
COPY plugins ./plugins
COPY profile ./profile
COPY scripts ./scripts
RUN npm ci && npm run check && DSH_HOME=/app/.dsh npm run profile:install

ENV DSH_HOME=/app/.dsh
EXPOSE 3080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3080", "--no-open"]
