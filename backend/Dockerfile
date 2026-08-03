FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY assets/ ./assets/

# Directories created at runtime via volumes
RUN mkdir -p /app/data /app/overlays

EXPOSE 3000
CMD ["node", "src/index.js"]
