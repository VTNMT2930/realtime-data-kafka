import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ SET GLOBAL PREFIX
  app.setGlobalPrefix('api');

  // ✅ ENABLE CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://nhanit.id.vn',
      'http://www.nhanit.id.vn',
      'http://3.27.218.52', // Giữ lại IP để test nếu cần
      'http://localhost:3000',
    ], // Cho phép mọi origin (dev only)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log('🚀 Producer Service running on http://localhost:3000');
}
bootstrap();
