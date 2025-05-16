FROM node:22-alpine
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp
ARG VERSION=latest
RUN npm install -g mongodb-mcp-server@${VERSION}
ENTRYPOINT ["mongodb-mcp-server"]
LABEL maintainer="MongoDB Inc <info@mongodb.com>"
LABEL description="MongoDB MCP Server"
LABEL version=${VERSION}
