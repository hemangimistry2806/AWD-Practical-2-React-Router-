FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/server ./src/server
RUN mkdir -p logs && chown -R node:node /app

USER node

ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/server/server.cjs"]
