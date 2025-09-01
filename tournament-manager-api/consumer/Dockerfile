FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install --save-dev @types/node

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./              
COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
