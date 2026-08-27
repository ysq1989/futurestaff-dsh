FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV DSH_HOME=/data/dsh

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@11.19.0 --activate \
    && pnpm add --global @deepseek-ai/dsh@0.1.1-rc.2

COPY package*.json pnpm-workspace.yaml tsconfig.base.json ./
COPY plugins ./plugins
COPY mcp ./mcp
COPY profile ./profile
COPY scripts ./scripts
COPY docker/entrypoint.sh /usr/local/bin/futurestaff-entrypoint

RUN npm ci \
    && npm run check \
    && chmod 0755 /usr/local/bin/futurestaff-entrypoint \
    && mkdir -p /data/dsh \
    && chown -R node:node /app /data/dsh

USER node
EXPOSE 3080
VOLUME ["/data/dsh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3080/',{redirect:'manual'}).then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["futurestaff-entrypoint"]
CMD ["--profile", "futurestaff-alpha", "--host", "0.0.0.0", "--port", "3080", "--no-open"]
