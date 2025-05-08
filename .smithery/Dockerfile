FROM node:23-bookworm-slim

WORKDIR /app

COPY ../ .

RUN npm ci

RUN npm run build

CMD ["sh", "-c", "mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db && node dist/index.js"]
