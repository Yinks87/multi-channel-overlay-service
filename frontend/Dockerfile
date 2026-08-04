FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite bakes these into the static bundle at build time
ARG VITE_API_BASE_URL
ARG VITE_BASE_OVERLAY_API_URL
ARG VITE_BASE_OVERLAY_SERVICE_URL
ARG VITE_PLATFORM=linux
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_OVERLAY_API_URL=$VITE_BASE_OVERLAY_API_URL
ENV VITE_BASE_OVERLAY_SERVICE_URL=$VITE_BASE_OVERLAY_SERVICE_URL
ENV VITE_PLATFORM=$VITE_PLATFORM

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
