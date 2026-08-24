FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src ./src
# COPY assets ./assets

RUN mkdir -p /app/data /app/overlays

EXPOSE 4005

CMD ["node", "src/index.js"]
