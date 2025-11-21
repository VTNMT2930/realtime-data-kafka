# Build Stage
FROM node:22-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 1. Khai báo tham số nhận từ docker-compose
ARG VITE_PRODUCER_URL
ARG VITE_CONSUMER_URL
# 2. Gán vào biến môi trường (ENV) để Vite "nhúng" vào code
ENV VITE_PRODUCER_API_URL=$VITE_PRODUCER_URL
ENV VITE_CONSUMER_API_URL=$VITE_CONSUMER_URL

RUN npm run build

# Production Stage (Dùng Nginx)
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Cấu hình để Nginx hỗ trợ Vue Router (tránh lỗi 404 khi reload)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]