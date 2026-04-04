FROM node:20-alpine
WORKDIR /app
COPY server.js canvas.html ./
COPY js/ js/
EXPOSE 3000
CMD ["node", "server.js"]
