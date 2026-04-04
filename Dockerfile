FROM node:20-alpine
WORKDIR /app
COPY server.js canvas.html ./
EXPOSE 3000
CMD ["node", "server.js"]
