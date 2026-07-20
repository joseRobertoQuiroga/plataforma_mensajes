FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY index.js ./
COPY public/ ./public/
EXPOSE 3100
CMD ["node", "index.js"]
