import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    // Đăng ký client để kết nối Kafka
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE', // Tên service
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'producer',
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
            // ✅ Thêm retry logic
            retry: {
              initialRetryTime: 100,
              retries: 8,
            },
            // ✅ Timeout settings
            connectionTimeout: 10000,
            requestTimeout: 30000,
          },
          producer: {
            allowAutoTopicCreation: true,
            // ✅ Thêm idempotent để tránh duplicate messages
            idempotent: false,
            // ✅ Max in-flight requests
            maxInFlightRequests: 5,
            // ✅ Retry settings
            retry: {
              initialRetryTime: 100,
              retries: 5,
            },
          },
        },
      },
    ]),
  ],
  // Xuất ClientsModule
  exports: [ClientsModule],
})
export class KafkaModule {}
