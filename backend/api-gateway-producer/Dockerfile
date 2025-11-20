FROM node:22-alpine As build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# Cài đặt Docker CLI và Docker Compose Plugin để container có thể chạy lệnh docker
RUN apk add --no-cache docker-cli docker-cli-compose
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]