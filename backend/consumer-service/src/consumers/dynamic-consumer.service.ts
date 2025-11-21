import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Đảm bảo file entity này tồn tại ở đúng đường dẫn này
import { ConsumerInstance } from './entities/consumer-instance.entity';

@Injectable()
export class DynamicConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicConsumerService.name);
  private kafka: Kafka;
  // Map quản lý: Key = "groupId-index", Value = Consumer Object
  private activeConsumers: Map<string, Consumer> = new Map();

  constructor(
    // Inject Repository để thao tác với DB
    @InjectRepository(ConsumerInstance)
    private instanceRepo: Repository<ConsumerInstance>,
  ) {}

  onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'dynamic-manager',
      brokers: ['kafka:29092'],
    });
    
    // Tự động khôi phục các consumer khi restart container (nếu cần)
    this.restoreActiveConsumers();
  }

  async onModuleDestroy() {
    for (const consumer of this.activeConsumers.values()) {
      await consumer.disconnect();
    }
  }
  
  // Hàm khôi phục (Optional)
  private async restoreActiveConsumers() {
     try {
       const activeInstances = await this.instanceRepo.find({ where: { status: 'active' } });
       for(const instance of activeInstances) {
          this.logger.log(`[Restore] Tìm thấy instance cần restore: ${instance.id}`);
          // Logic restore cụ thể sẽ thêm ở đây sau
       }
     } catch (error) {
       this.logger.warn('Chưa thể restore consumer, có thể do bảng chưa khởi tạo.');
     }
  }

  /**
   * TẠO CONSUMER NÂNG CAO VÀ LƯU DB
   */
  async createAdvancedConsumer(groupId: string, topics: string[], instanceCount: number) {
    this.logger.log(`[Dynamic] Yêu cầu tạo Group: ${groupId} | Topics: ${topics} | Instance: ${instanceCount}`);

    const results = [];

    for (let i = 0; i < instanceCount; i++) {
      // Tạo ID duy nhất: groupName-inst-0, groupName-inst-1...
      const instanceId = `${groupId}-inst-${i}`;

      if (this.activeConsumers.has(instanceId)) {
        this.logger.warn(`Instance ${instanceId} đã tồn tại trong RAM, cập nhật lại DB.`);
        // Vẫn cập nhật DB để đảm bảo status là active
        await this.saveInstanceToDB(instanceId, groupId, topics, 'active');
        continue;
      }

      try {
        // 1. Khởi tạo Kafka Consumer
        const consumer = this.kafka.consumer({ groupId: groupId });
        await consumer.connect();
        await consumer.subscribe({ topics: topics, fromBeginning: true });

        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
             // Logic xử lý message (có thể lưu log vào bảng consumer_logs ở đây)
             // console.log(`Message: ${message.value.toString()}`);
          },
        });

        // 2. Lưu vào RAM
        this.activeConsumers.set(instanceId, consumer);
        
        // 3. QUAN TRỌNG: Lưu vào DATABASE
        await this.saveInstanceToDB(instanceId, groupId, topics, 'active');
        
        results.push(instanceId as never);
        
      } catch (error) {
        this.logger.error(`Lỗi tạo instance ${instanceId}:`, error);
        // Nếu lỗi thì lưu status inactive
        await this.saveInstanceToDB(instanceId, groupId, topics, 'error');
      }
    }

    return {
      success: true,
      message: `Đã khởi chạy ${results.length}/${instanceCount} instances.`,
      instances: results
    };
  }

  // Helper để lưu DB gọn gàng hơn
  private async saveInstanceToDB(instanceId: string, groupId: string, topics: string[], status: string) {
    try {
      // 1. Map dữ liệu vào đúng trường của Entity
      // Lưu ý: Entity dùng 'id', không phải 'consumerId'
      const instanceData = {
        id: instanceId,          // Map instanceId vào cột id
        groupId: groupId,        // Cột mới thêm
        topics: topics.join(','),// Cột mới thêm
        status: status,
        topicName: topics[0],    // Lưu topic đầu tiên vào cột cũ để tương thích (optional)
        pid: 0,
        lastHeartbeat: new Date(),
        isDeleted: false
      };

      // 2. Kiểm tra tồn tại và Upsert
      const existing = await this.instanceRepo.findOne({ where: { id: instanceId } });

      if (existing) {
        await this.instanceRepo.update(
          { id: instanceId }, 
          {
            ...instanceData,
            updatedAt: new Date()
          }
        );
      } else {
        const instance = this.instanceRepo.create(instanceData);
        await this.instanceRepo.save(instance);
      }
      
      this.logger.log(`[DB] Đã lưu instance ${instanceId} (Group: ${groupId}) vào Database.`);
    } catch (error) {
      this.logger.error(`Lỗi lưu DB cho ${instanceId}:`, error);
    }
  }

  async stopGroup(groupId: string) {
    const keysToRemove = [];
    for (const key of this.activeConsumers.keys()) {
      if (key.startsWith(`${groupId}-`)) {
        const consumer = this.activeConsumers.get(key);
        if (consumer) {
          try {
            await consumer.disconnect();
          } catch (e: any) {
            this.logger.error(`Lỗi disconnect ${key}`, e);
          }
        } else {
          this.logger.warn(`Không tìm thấy consumer cho key ${key} để disconnect.`);
        }
        keysToRemove.push(key as never);
        
        // Cập nhật DB thành inactive
        try {
            await this.instanceRepo.update({ id: key }, { status: 'inactive' });
        } catch (e) {
            this.logger.error(`Lỗi update DB status ${key}`, e);
        }
      }
    }
    
    keysToRemove.forEach(k => this.activeConsumers.delete(k));
    return { success: true, stopped: keysToRemove.length };
  }
}