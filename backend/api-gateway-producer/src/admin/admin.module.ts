import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { KafkaModule } from '../kafka/kafka.module';
import { ProducersModule } from '../producers/producers.module';
import { ProducerLog } from '../producers/entities/producer-log.entity';

@Module({
  imports: [
    KafkaModule,
    forwardRef(() => ProducersModule),
    TypeOrmModule.forFeature([ProducerLog]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
