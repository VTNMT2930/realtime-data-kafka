# realtime-data-platform

Tổng hợp dự án realtime-data-platform: hệ thống demo xử lý dữ liệu thời gian thực sử dụng Kafka, WebSocket và một frontend quản lý.

Mục đích của README này là cung cấp cái nhìn tổng quan, hướng dẫn chạy nhanh (dev & Docker) và chỉ dẫn tham khảo cho các module con trong repo.

---

## Mục lục

- [realtime-data-platform](#realtime-data-platform)
  - [Mục lục](#mục-lục)
  - [Tổng quan](#tổng-quan)
  - [Kiến trúc \& Thành phần](#kiến-trúc--thành-phần)
  - [Chạy nhanh (Quick start)](#chạy-nhanh-quick-start)
  - [Chạy bằng Docker / Production](#chạy-bằng-docker--production)
  - [Biến môi trường và cấu hình](#biến-môi-trường-và-cấu-hình)
  - [Cấu trúc thư mục chính](#cấu-trúc-thư-mục-chính)
  - [Kafka topics \& WebSocket](#kafka-topics--websocket)
  - [Scripts \& Hỗ trợ phát triển](#scripts--hỗ-trợ-phát-triển)
  - [Tài liệu tham khảo \& hướng dẫn chi tiết](#tài-liệu-tham-khảo--hướng-dẫn-chi-tiết)
  - [Ghi chú vận hành \& khắc phục lỗi thường gặp](#ghi-chú-vận-hành--khắc-phục-lỗi-thường-gặp)
  - [Góp phần \& Liên hệ](#góp-phần--liên-hệ)
  - [License](#license)

---

## Tổng quan

Repo chứa một dự án mẫu realtime-data-platform gồm:

- `backend/api-gateway-producer`: API gateway và producer (NestJS) — chịu trách nhiệm nhận lệnh từ frontend và gửi message tới Kafka.
- `backend/consumer-service`: Các consumer đọc message từ Kafka và phát tới client qua WebSocket.
- `frontend`: Giao diện quản lý (Vite + Vue) cho dashboard, producer, consumer, topic.
- `documents/`: Hướng dẫn vận hành, quản lý topic, logs, resume, pagination.
- Các file cấu hình Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) và cấu hình Nginx.

Hệ thống dùng Kafka làm message bus, WebSocket để push realtime đến trình duyệt, và Docker để triển khai nhanh.

---

## Kiến trúc & Thành phần

- Producers: REST/WebSocket endpoints cho phép gửi message (thông qua `api-gateway-producer`).
- Kafka: trung tâm truyền thông giữa producer và consumer.
- Consumers: `consumer-service` lắng nghe topic và xử lý/forward dữ liệu.
- Frontend: dashboard cho phép gửi message, xem consumer, debug logs, và cấu hình topic.

Sơ đồ đơn giản:

frontend <-> api-gateway-producer -> Kafka -> consumer-service -> frontend (WebSocket)

---

## Chạy nhanh (Quick start)

Yêu cầu:

- Node.js >= 16 (để build frontend và backend)
- Docker & Docker Compose (nếu chạy trong container)

Chạy local (không Docker):

1. Backend - api-gateway-producer

```powershell
cd backend\api-gateway-producer
npm install
npm run start:dev
```

2. Backend - consumer-service

```powershell
cd backend\consumer-service
npm install
npm run start:dev
```

3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Lưu ý: cả backend và consumer cần Kafka hoạt động (có thể chạy bằng Docker Compose trong phần dưới).

---

## Chạy bằng Docker / Production

Repo có `docker-compose.yml` (dev) và `docker-compose.prod.yml` (production). Để chạy toàn bộ stack (Kafka + Zookeeper + service + frontend):

### Development (Local)

```powershell
docker-compose up --build
```

### Production (AWS EC2 với domain nhanit.id.vn)

```bash
# Chạy script tự động (khuyến nghị)
bash setup-aws-ec2.sh

# Hoặc chạy thủ công
docker-compose -f docker-compose.prod.yml up -d --build
```

**📚 Hướng dẫn chi tiết deploy lên AWS:** Xem file [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md)

**🔍 Kiểm tra cấu hình trước khi deploy:**
```bash
bash check-config.sh
```

Các dịch vụ chính sẽ được cấu hình trong file compose. Kiểm tra logs bằng `docker-compose logs -f` hoặc `docker logs` cho container cụ thể.

---

## Biến môi trường và cấu hình

- Mỗi module backend/frontend có file `package.json` và thường chấp nhận các biến môi trường (ví dụ: Kafka broker URL, WS port, NODE_ENV, DATABASE_URL).
- Kiểm tra `backend/api-gateway-producer` và `backend/consumer-service` để biết các biến cụ thể (README riêng hoặc `src/main.ts` / config files).

---

## Cấu trúc thư mục chính

- `backend/api-gateway-producer/` : NestJS app — producer + api gateway
- `backend/consumer-service/` : NestJS app — consumers & WebSocket broadcaster
- `frontend/` : Vite + Vue frontend dashboard
- `documents/` : hướng dẫn vận hành và tài liệu (CONSUMER_API.md, WEBSOCKET_REALTIME_GUIDE.md, ...)
- `docker-compose.yml`, `docker-compose.prod.yml` : cấu hình triển khai nhanh
- `nginx.conf` : cấu hình proxy/nginx nếu cần

---

## Kafka topics & WebSocket

- Các topic chính và cách sử dụng được mô tả trong `documents/` (ví dụ `WEBSOCKET_REALTIME_GUIDE.md`).
- Để thử WebSocket nhanh: mở `test-websocket.html` (root) hoặc `backend/consumer-service/websocket-test.html` nếu có.

---

## Scripts & Hỗ trợ phát triển

- Frontend
	- `npm run dev` — chạy dev server (Vite)
	- `npm run build` — build production
- Backend (NestJS)
	- `npm run start:dev` — chạy dev với hot-reload
	- `npm run start` — chạy production build
- Consumer
	- có các script `start-consumers.bat`, `quick-test.ps1` trong thư mục `backend/consumer-service` để test nhanh trên Windows.

---

## Tài liệu tham khảo & hướng dẫn chi tiết

- Xem thư mục `documents/` để biết các hướng dẫn chi tiết:
	- `CONSUMER_API.md` — API cho consumers
	- `CONSUMER_SEARCH_PAGINATION_GUIDE.md` — hướng dẫn phân trang tìm kiếm
	- `WEBSOCKET_REALTIME_GUIDE.md` — cách hoạt động WebSocket realtime
	- `RESTART_KAFKA.md`, `TOPIC_MANAGEMENT_FEATURES.md` — vận hành Kafka

---

## Ghi chú vận hành & khắc phục lỗi thường gặp

- Nếu không kết nối được Kafka: kiểm tra broker URL, firewall, và logs container Kafka.
- Nếu frontend không nhận message: kiểm tra kết nối WebSocket, port và CORS/nginx reverse proxy.
- Kiểm tra logs:

```powershell
docker-compose logs -f api-gateway-producer
docker-compose logs -f consumer-service
```

---

## Góp phần & Liên hệ

- Nếu muốn đóng góp, tạo Pull Request trên branch `main` hoặc mở Issue mô tả thay đổi.
- Để liên hệ: sử dụng Issue trên GitHub/GitLab hoặc liên hệ trực tiếp với nhóm phát triển (thông tin liên hệ nội bộ).

---

## License

Xem file `LICENSE` (nếu có) hoặc thêm license phù hợp cho dự án.
