# Build stage
FROM node:22-alpine AS build-stage
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

# ХАРДКОД ПЕРЕМЕННЫХ СБОРКИ
# Это гарантирует, что Vite подставит правильный URL, даже если в Dokploy пусто
ENV VITE_BACKEND_API_URL=/api

RUN pnpm run build-only

# Production stage
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
