# ── Build stage ────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ .
# API calls go to /api/v1 — nginx proxies them to the backend container
ENV VITE_API_URL=/api/v1
RUN npm run build

# ── Serve stage ─────────────────────────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist          /usr/share/nginx/html
COPY frontend/nginx.conf             /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
