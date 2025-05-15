FROM node:22-alpine
ARG VERSION=latest
RUN npm install -g mongodb-mcp-server@${VERSION}
ENTRYPOINT ["mongodb-mcp-server"]
LABEL maintainer="MongoDB Inc <info@mongodb.com>"
LABEL description="MongoDB MCP Server"
LABEL version=${VERSION}
