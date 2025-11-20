// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <<< ĐÃ THÊM
import { BullModule } from '@nestjs/bull';
import { join } from 'path'; // <<< ĐÃ THÊM

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { AdminModule } from './admin/admin.module';
import { ProducersModule } from './producers/producers.module';

@Module({
  imports: [
    // --- 1. Cấu hình Database (PostgreSQL) ---
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'producer_logs',

      // Tự động tìm tất cả các file .entity.ts (như producer-log.entity.ts)
      entities: [join(__dirname, '**', '*.entity.{ts,js}')],

      // Tự động tạo/cập nhật bảng. Chỉ dùng cho development!
      synchronize: process.env.DB_SYNC === 'true',
    }),

    // --- 2. Cấu hình Bull (Redis Queue) ---
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),

    // --- 3. Các module nghiệp vụ ---
    ProducersModule,
    KafkaModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
