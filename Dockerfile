FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-deps

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime

# Official PostgreSQL client tools for consistent backups and recovery checks.
# Repository setup: https://www.postgresql.org/download/linux/debian/
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && mkdir -p /usr/share/postgresql-common/pgdg \
    && curl --fail --show-error --silent -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main' > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV FRONTEND_DIST_DIR=/app/frontend/dist

COPY package.json ./
COPY backend ./backend
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/backend/uploads

EXPOSE 5000

CMD ["node", "backend/src/index.js"]
