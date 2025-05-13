FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.build.json ./
RUN npm install --ignore-scripts
COPY src src
RUN npm run build

FROM node:22
WORKDIR /app
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/package-lock.json /app/package-lock.json
COPY --from=build /app/dist dist
RUN npm ci --omit=dev --ignore-scripts
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
