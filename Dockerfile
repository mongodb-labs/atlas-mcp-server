ARG VERSION=latest
FROM node:22-alpine
RUN npm install -g mongodb-mcp-server@${VERSION}
CMD ["mongodb-mcp-server"]
