FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server.js og.js migrate.js canvas.html og-home.png ./
COPY migrations/ migrations/
COPY js/ js/
COPY fonts/ fonts/
EXPOSE 3000
CMD ["node", "server.js"]
