FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY server.mjs ./

EXPOSE 4100
CMD ["node", "server.mjs"]
