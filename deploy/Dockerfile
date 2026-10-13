FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig*.json ./
COPY src ./src
COPY scripts/build-portal.mjs ./scripts/build-portal.mjs
COPY scripts/release-output.mjs ./scripts/release-output.mjs
RUN npm run build:portal

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/portals /usr/share/nginx/html/portals
