import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ConsumersModule } from "./consumers/consumers.module";
import { ConsumerLog } from "./consumers/entities/consumer-log.entity";
import { ConsumerInstance } from "./consumers/entities/consumer-instance.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConsumersModule,
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      username: process.env.DB_USERNAME || "",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_DATABASE || "consumer_logs",
      entities: [ConsumerLog, ConsumerInstance],
      synchronize: process.env.DB_SYNC === "true", // Tự động tạo/cập nhật schema (chỉ dùng trong dev)
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
