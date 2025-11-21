import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';

@Injectable()
export class DynamicConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicConsumerService.name);
  private kafka: Kafka;
  // Map quản lý: Key = "groupId-index", Value = Consumer Object
  private activeConsumers: Map<string, Consumer> = new Map();

  onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'dynamic-manager',
      brokers: ['kafka:29092'],
    });
  }

  async onModuleDestroy() {
    for (const consumer of this.activeConsumers.values()) {
      await consumer.disconnect();
    }
  }

  /**
   * TẠO CONSUMER NÂNG CAO
   * @param groupId Tên nhóm
   * @param topics Danh sách topic cần nghe (mảng)
   * @param instanceCount Số lượng instance giả lập (số kết nối song song)
   */
  async createAdvancedConsumer(groupId: string, topics: string[], instanceCount: number) {
    this.logger.log(`[Dynamic] Yêu cầu tạo Group: ${groupId} | Topics: ${topics} | Instance: ${instanceCount}`);

    const results = [];

    // Vòng lặp tạo ra N instance chạy song song
    for (let i = 0; i < instanceCount; i++) {
      const instanceId = `${groupId}-inst-${i}`; // ID định danh: group-a-inst-0, group-a-inst-1...

      if (this.activeConsumers.has(instanceId)) {
        this.logger.warn(`Instance ${instanceId} đã tồn tại, bỏ qua.`);
        continue;
      }

      try {
        // 1. Tạo consumer mới
        const consumer = this.kafka.consumer({ groupId: groupId });
        await consumer.connect();

        // 2. Subscribe vào NHIỀU topic cùng lúc
        await consumer.subscribe({ topics: topics, fromBeginning: true });

        // 3. Chạy consumer
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            const value = message.value?.toString();
            this.logger.log(`[${groupId}][Inst-${i}] Nhận từ ${topic} (Part ${partition}): ${value}`);
            // TODO: Bắn socket về UI nếu cần
          },
        });

        // 4. Lưu vào Map quản lý
        this.activeConsumers.set(instanceId, consumer);
        results.push(instanceId as never);
        
      } catch (error) {
        this.logger.error(`Lỗi tạo instance ${instanceId}:`, error);
      }
    }

    return {
      success: true,
      message: `Đã khởi chạy ${results.length}/${instanceCount} instances cho Group ${groupId}`,
      instances: results
    };
  }

  // Stop toàn bộ Group
  async stopGroup(groupId: string) {
    const keysToRemove = [];
    for (const key of this.activeConsumers.keys()) {
      if (key.startsWith(`${groupId}-`)) {
        const consumer = this.activeConsumers.get(key);
        if (consumer) {
          await consumer.disconnect();
          (keysToRemove as Array<string>).push(key);
        } else {
          this.logger.warn(`Consumer for key ${key} is undefined, cannot disconnect.`);
        }
      }
    }
    keysToRemove.forEach((k) => this.activeConsumers.delete(k));
    return { success: true, stopped: keysToRemove.length };
  }
}