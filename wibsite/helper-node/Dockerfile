FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY index.js ./
COPY middleware/ ./middleware/
COPY services/ ./services/
COPY templates/ ./templates/
COPY public/ ./public/
COPY wibsite-store.json* ./
EXPOSE 3100
CMD ["node", "index.js"]
