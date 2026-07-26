FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN npm run build -w apps/api

EXPOSE 4000

CMD ["npm", "run", "start", "-w", "apps/api"]
