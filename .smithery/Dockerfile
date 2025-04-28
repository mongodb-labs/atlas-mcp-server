FROM node:23-bookworm-slim

# Install MongoDB Community Edition
RUN apt-get update && \
    apt-get install -y gnupg curl python3 build-essential && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ../ .

RUN npm ci

RUN npm run build

RUN mongod --fork --logpath /var/log/mongodb.log
ENV MDB_MCP_CONNECTION_STRING mongodb://localhost:27017
CMD ["sh", "-c", "mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db && node dist/index.js"]
