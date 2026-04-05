FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json build.js ./
COPY src/ src/
RUN npm ci
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
