FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci --omit=dev

COPY --from=builder /app/client ./client
COPY --from=builder /app/server ./server
COPY --from=builder /app/README.md ./README.md
COPY --from=builder /app/LICENSE ./LICENSE

RUN addgroup -S pulse && adduser -S pulse -G pulse \
  && chown -R pulse:pulse /app

USER pulse

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["npm", "run", "start"]
