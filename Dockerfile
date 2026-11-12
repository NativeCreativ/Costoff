# Costaff ATS production image. Build from the repo root:
#   docker compose build
#   docker build -t costaff-ats .

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma generate loads prisma7.config.ts, which reads DATABASE_URL. It does not connect.
ENV DATABASE_URL=postgresql://costaff:build@127.0.0.1:5432/costaff_ats
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS run

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Full install so `npm run create-super-admin` (tsx) works inside the container.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker/costaff-ats-entrypoint.sh /usr/local/bin/costaff-ats-entrypoint.sh

RUN chmod +x /usr/local/bin/costaff-ats-entrypoint.sh \
  && mkdir -p /app/public/uploads \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/costaff-ats-entrypoint.sh"]
