FROM node:22-alpine
RUN groupadd -g 1000 mcp && \
    useradd -m -u 1000 -g mcp mcp
USER mcp
ARG VERSION=latest
RUN npm install -g mongodb-mcp-server@${VERSION}
ENTRYPOINT ["mongodb-mcp-server"]
LABEL maintainer="MongoDB Inc <info@mongodb.com>"
LABEL description="MongoDB MCP Server"
LABEL version=${VERSION}
