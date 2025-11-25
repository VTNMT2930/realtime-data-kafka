// src/admin/admin.service.ts

import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Admin } from 'kafkajs'; // Import 'Admin' từ kafkajs
import { exec } from 'child_process'; // Dùng exec thay vì spawn
import { promisify } from 'util';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { CreateConsumerDto } from './dto/create-consumer.dto';
// Chuyển exec sang Promise để dùng await
const execAsync = promisify(exec);
@Injectable()
export class AdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminService.name);
  private kafkaAdmin: Admin; // Biến để giữ admin client
  private consumerServiceSocket: Socket; // WebSocket connection to Consumer Service
  // Cấu hình đường dẫn file Docker (được mount từ volume)
  private readonly DOCKER_COMPOSE_FILE = 'docker-compose.prod.yml';
  private readonly CONSUMER_SERVICE_NAME = 'consumer-service';

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  // Lấy admin client khi module khởi động
  async onModuleInit() {
    const kafkaJsClient = (this.kafkaClient as any).client;
    this.kafkaAdmin = kafkaJsClient.admin();
    await this.kafkaClient.connect();
    await this.kafkaAdmin.connect();
    console.log('Kafka Client và Admin Client đã kết nối!');

    // Khởi tạo WebSocket connection đến Consumer Service
    this.initializeConsumerServiceSocket();
  }

  // Cleanup khi module bị destroy
  onModuleDestroy() {
    if (this.consumerServiceSocket) {
      this.consumerServiceSocket.disconnect();
      console.log('[Admin] Disconnected from Consumer Service WebSocket');
    }
  }

  // Khởi tạo WebSocket connection đến Consumer Service
  private initializeConsumerServiceSocket() {
    const consumerServiceUrl =
      process.env.CONSUMER_SERVICE_URL || 'http://3.107.102.127:3001';

    console.log('[Admin] Connecting to Consumer Service WebSocket...');

    this.consumerServiceSocket = io(consumerServiceUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.consumerServiceSocket.on('connect', () => {
      console.log('[Admin] ✅ Connected to Consumer Service WebSocket');
    });

    this.consumerServiceSocket.on('connect_error', (error) => {
      console.error(
        '[Admin] ❌ Consumer Service WebSocket connection error:',
        error.message,
      );
    });

    this.consumerServiceSocket.on('disconnect', (reason) => {
      console.warn(
        '[Admin] ❌ Consumer Service WebSocket disconnected:',
        reason,
      );
    });
  }

  // Helper method để broadcast event đến Consumer Service
  private broadcastToConsumerService(event: string, data: any) {
    if (this.consumerServiceSocket && this.consumerServiceSocket.connected) {
      this.consumerServiceSocket.emit(event, data);
      console.log(`[Admin] Broadcasted ${event} to Consumer Service:`, data);
    } else {
      console.warn(
        `[Admin] Cannot broadcast ${event} - Consumer Service WebSocket not connected`,
      );
    }
  }

  private async getConsumerCount(
    topicName: string,
    status?: string,
  ): Promise<number> {
    try {
      const consumerServiceUrl =
        process.env.CONSUMER_SERVICE_URL || 'http://consumer-service:3001';

      // Tạo params: Luôn lọc theo topic
      const params: any = { topic: topicName };

      // ⚠️ ĐIỂM QUAN TRỌNG:
      // Nếu truyền status => Chỉ đếm theo status đó (ví dụ 'ACTIVE')
      // Nếu KHÔNG truyền status => Đếm TẤT CẢ (Active + Inactive)
      if (status) {
        params.status = status;
      }

      const response = await axios.get(
        `${consumerServiceUrl}/api/consumers/instances`,
        {
          params,
          timeout: 2000,
        },
      );

      if (Array.isArray(response.data)) return response.data.length;
      if (response.data && Array.isArray(response.data.data))
        return response.data.data.length;

      return 0;
    } catch (error) {
      return 0;
    }
  }

  // ==================================================================
  // PHẦN 1: TOPIC MANAGEMENT
  // ==================================================================
  //Hàm tạo topic mới
  async createTopic(
    topicName: string,
    numPartitions: number,
    replicationFactor: number,
  ) {
    console.log(
      `AdminService: Đang tạo topic ${topicName} với ${numPartitions} partition...`,
    );

    try {
      // Gọi hàm topicExists (đã được thêm ở dưới)
      const topicExists = await this.topicExists(topicName);
      if (topicExists) {
        console.log(`AdminService: Topic ${topicName} đã tồn tại.`);
        return { status: 'warn', message: 'Topic đã tồn tại.' };
      }

      await this.kafkaAdmin.createTopics({
        topics: [
          {
            topic: topicName,
            numPartitions: numPartitions,
            replicationFactor: replicationFactor,
          },
        ],
      });
      console.log(`AdminService: Đã tạo topic ${topicName} thành công.`);
      return {
        status: 'success',
        message: `Topic ${topicName} đã được tạo thành công.`,
      };
    } catch (error) {
      console.error('Lỗi khi tạo topic:', error);
      return { status: 'error', message: 'Không thể tạo topic.' };
    }
  }

  // Hàm lấy danh sách tất cả topic
  async listTopics() {
    try {
      const topics = await this.kafkaAdmin.listTopics();
      const metadata = await this.kafkaAdmin.fetchTopicMetadata({ topics });

      console.log('AdminService: Đang lấy danh sách topics...');

      // ✅ Lấy thêm producer statistics và consumer statistics
      const [producerStats, consumerStats] = await Promise.all([
        this.getProducerStatsByTopic(),
        this.getConsumerStatsByTopic(),
      ]);

      // ✅ Enrich topic data với statistics
      const enrichedTopics = metadata.topics.map((topic) => {
        const producerStat = producerStats[topic.name] || {
          totalRecords: 0,
          batches: 0,
        };
        const consumerStat = consumerStats[topic.name] || { consumerCount: 0 };

        return {
          name: topic.name,
          partitions: topic.partitions.length,
          totalRecords: producerStat.totalRecords,
          batches: producerStat.batches,
          consumerCount: consumerStat.consumerCount,
          // Keep original metadata for backward compatibility
          partitionDetails: topic.partitions,
        };
      });

      return {
        status: 'success',
        data: enrichedTopics,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách topic:', error);
      return { status: 'error', message: 'Không thể lấy danh sách topic.' };
    }
  }

  // Hàm kiểm tra topic đã tồn tại hay chưa
  private async topicExists(topicName: string): Promise<boolean> {
    const topics = await this.kafkaAdmin.listTopics();
    return topics.includes(topicName);
  }

  // Hàm xóa topic
  async deleteTopic(topicName: string) {
    this.logger.log(`Yêu cầu xóa topic ${topicName}...`);

    try {
      // 1. Kiểm tra Consumer liên kết
      // Gọi hàm đếm KHÔNG truyền status => Đếm cả Active lẫn Inactive
      const totalLinkedConsumers = await this.getConsumerCount(topicName);

      // Nếu còn bất kỳ consumer nào (kể cả đã Stop) -> CHẶN XÓA
      if (totalLinkedConsumers > 0) {
        return {
          status: 'error',
          message: `Không thể xóa! Có ${totalLinkedConsumers} consumer (Active/Inactive) vẫn đang liên kết với topic này. Vui lòng DELETE consumer vĩnh viễn trước.`,
        };
      }

      // 2. Kiểm tra Topic tồn tại
      const topicExists = await this.topicExists(topicName);
      if (!topicExists)
        return { status: 'warn', message: 'Topic không tồn tại.' };

      // 3. Thực hiện xóa
      await this.kafkaAdmin.deleteTopics({ topics: [topicName] });

      return {
        status: 'success',
        message: 'Topic đã được xóa thành công.',
      };
    } catch (error) {
      return { status: 'error', message: `Lỗi: ${error.message}` };
    }
  }

  // Hàm cập nhật cấu hình topic
  async updateTopic(
    topicName: string,
    numPartitions?: number,
    configs?: Record<string, string>,
  ) {
    console.log(`AdminService: Đang cập nhật topic ${topicName}...`, {
      numPartitions,
      configs,
    });

    try {
      // Kiểm tra topic có tồn tại không
      const topicExists = await this.topicExists(topicName);
      if (!topicExists) {
        console.log(`AdminService: Topic ${topicName} không tồn tại.`);
        return { status: 'warn', message: 'Topic không tồn tại.' };
      }

      // Tăng số partitions nếu được yêu cầu
      if (numPartitions) {
        await this.kafkaAdmin.createPartitions({
          topicPartitions: [
            {
              topic: topicName,
              count: numPartitions,
            },
          ],
        });
        console.log(
          `AdminService: Đã tăng số partition của topic ${topicName} lên ${numPartitions}.`,
        );
      }

      // Cập nhật configs nếu được yêu cầu
      if (configs && Object.keys(configs).length > 0) {
        // Convert configs to array format for alterConfigs
        const configEntries = Object.entries(configs).map(([name, value]) => ({
          name,
          value: value.toString(),
        }));

        await this.kafkaAdmin.alterConfigs({
          validateOnly: false,
          resources: [
            {
              type: 2, // TOPIC = 2
              name: topicName,
              configEntries,
            },
          ],
        });
        console.log(
          `AdminService: Đã cập nhật cấu hình của topic ${topicName}.`,
        );
      }

      return {
        status: 'success',
        message: `Topic ${topicName} đã được cập nhật thành công.`,
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật topic:', error);
      return {
        status: 'error',
        message: `Không thể cập nhật topic: ${error.message}`,
      };
    }
  }

  // Hàm lấy thông tin chi tiết một topic
  async getTopicDetail(topicName: string) {
    try {
      const topicExists = await this.topicExists(topicName);
      if (!topicExists)
        return { status: 'warn', message: 'Topic không tồn tại.' };

      const metadata = await this.kafkaAdmin.fetchTopicMetadata({
        topics: [topicName],
      });
      const configs = await this.kafkaAdmin.describeConfigs({
        includeSynonyms: false,
        resources: [{ type: 2, name: topicName }],
      });

      // Lấy tổng số consumer (để hiển thị cho user biết quy mô topic)
      const totalConsumerCount = await this.getConsumerCount(topicName);

      return {
        status: 'success',
        data: {
          metadata: metadata.topics[0],
          configs: configs.resources[0]?.configEntries || [],
          activeConsumers: totalConsumerCount,
        },
      };
    } catch (error) {
      return { status: 'error', message: 'Không thể lấy chi tiết topic.' };
    }
  }
  // ==================================================================
  // PHẦN 2: STATISTICS
  // ==================================================================
  // ✅ Helper: Lấy producer statistics theo topic
  private async getProducerStatsByTopic(): Promise<
    Record<string, { totalRecords: number; batches: number }>
  > {
    const producerServiceUrl =
      process.env.PRODUCER_SERVICE_URL || 'http://3.107.102.127:3000';
    try {
      // Query producer-log database để lấy statistics
      const response = await axios.get(
        `${producerServiceUrl}/api/producers/statistics`,
        {
          timeout: 5000,
        },
      );

      if (response.data.success && response.data.byTopic) {
        const stats: Record<string, { totalRecords: number; batches: number }> =
          {};

        // response.data.byTopic is already an array with topic breakdown
        response.data.byTopic.forEach((topicStat: any) => {
          stats[topicStat.topic] = {
            totalRecords: topicStat.totalRecords || 0,
            batches: topicStat.totalBatches || 0,
          };
        });

        return stats;
      }

      return {};
    } catch (error) {
      console.warn('[Admin] Cannot fetch producer stats:', error.message);
      return {};
    }
  }

  // ✅ Helper: Lấy consumer statistics theo topic
  private async getConsumerStatsByTopic(): Promise<
    Record<string, { consumerCount: number }>
  > {
    try {
      const consumerServiceUrl =
        process.env.CONSUMER_SERVICE_URL || 'http://consumer-service:3001';

      // Gọi API lấy danh sách tất cả instances
      const response = await axios.get(
        `${consumerServiceUrl}/api/consumers/instances`,
        { timeout: 5000 },
      );

      const stats: Record<string, { consumerCount: number }> = {};

      // ✅ FIX: Kiểm tra nếu response.data là mảng (Format mới)
      const instances = Array.isArray(response.data)
        ? response.data
        : response.data.data || [];

      // Đếm số lượng ACTIVE consumers cho mỗi topic
      instances.forEach((instance: any) => {
        // Chỉ đếm nếu status là ACTIVE (không phân biệt hoa thường)
        if (instance.status && instance.status.toUpperCase() === 'ACTIVE') {
          // Topic có thể là chuỗi "topic1,topic2" hoặc topicName đơn lẻ
          // Cần tách ra để đếm cho đúng từng topic
          const topics = (instance.topics || instance.topicName || '').split(
            ',',
          );

          topics.forEach((t) => {
            const topicName = t.trim();
            if (topicName) {
              if (!stats[topicName]) {
                stats[topicName] = { consumerCount: 0 };
              }
              stats[topicName].consumerCount++;
            }
          });
        }
      });

      return stats;
    } catch (error) {
      console.warn('[Admin] Cannot fetch consumer stats:', error.message);
      return {};
    }
  }

  /// ==================================================================
  // PHẦN 3: CONSUMER MANAGEMENT
  // ==================================================================

  /**
   * Helper: Đếm số lượng container đang chạy
   */
  private async getDockerConsumerCount(): Promise<number> {
    try {
      // Lệnh đếm số dòng ID container của service
      const command = `docker compose -f ${this.DOCKER_COMPOSE_FILE} ps -q ${this.CONSUMER_SERVICE_NAME} | wc -l`;
      const { stdout } = await execAsync(command);
      const count = parseInt(stdout.trim(), 10);
      return isNaN(count) ? 0 : count;
    } catch (error) {
      this.logger.error('Lỗi đếm docker process:', error);
      return 0;
    }
  }

  /**
   * Helper: Chạy lệnh Scale
   */
  private async scaleDockerService(count: number): Promise<void> {
    try {
      // Lệnh scale: up -d --scale service=X --no-recreate
      const command = `docker compose -f ${this.DOCKER_COMPOSE_FILE} up -d --scale ${this.CONSUMER_SERVICE_NAME}=${count} --no-recreate`;
      this.logger.log(`Thực thi: ${command}`);
      await execAsync(command);
    } catch (error) {
      this.logger.error(`Lỗi scale service lên ${count}:`, error);
      throw error;
    }
  }

  // /**
  //  * 1. CREATE CONSUMER -> Thay thế logic SPAWN cũ bằng SCALE UP
  //  */
  // async createConsumer(createConsumerDto: CreateConsumerDto) {
  //   try {
  //     this.logger.log(`Scale Up yêu cầu từ topic: ${createConsumerDto.topicName}`);

  //     // Lấy số lượng hiện tại + 1
  //     const currentCount = await this.getDockerConsumerCount();
  //     const newCount = currentCount + 1;

  //     // Thực hiện Scale
  //     await this.scaleDockerService(newCount);

  //     // Gửi socket thông báo (Optional)
  //     if (this.consumerServiceSocket) {
  //         this.consumerServiceSocket.emit('consumer-creating', {
  //           message: 'Docker scaling up...',
  //           targetCount: newCount
  //         });
  //     }

  //     return {
  //       status: 'success',
  //       message: `Đang khởi tạo instance thứ ${newCount}. Vui lòng đợi vài giây.`,
  //       data: {
  //           topic: createConsumerDto.topicName,
  //           groupId: createConsumerDto.groupId
  //       }
  //     };
  //   } catch (error) {
  //     this.logger.error('Lỗi Scale Up:', error);
  //     return { status: 'error', message: error.message };
  //   }
  // }

  // admin.service.ts
  async createAdvancedConsumer(
    groupId: string,
    topics: string[],
    count: number,
  ) {
    // Gọi sang Consumer Service
    const consumerServiceUrl =
      process.env.CONSUMER_SERVICE_URL || 'http://consumer-service:3001';
    const response = await axios.post(
      `${consumerServiceUrl}/api/consumers/dynamic/advanced`,
      {
        groupId,
        topics,
        count,
      },
    );
    return response.data;
  }

  /**
   * 2. STOP CONSUMER -> Thay thế logic cũ bằng SCALE DOWN
   */
  async stopConsumer(consumerId: string) {
    try {
      this.logger.log(`Scale Down yêu cầu (Stop)`);

      const currentCount = await this.getDockerConsumerCount();

      if (currentCount <= 1) {
        return {
          status: 'warning',
          message:
            'Đây là instance cuối cùng. Vui lòng dùng Delete nếu muốn xóa sạch.',
        };
      }

      const newCount = currentCount - 1;
      await this.scaleDockerService(newCount);

      return {
        status: 'success',
        message: `Đã giảm số lượng instance xuống còn ${newCount}`,
      };
    } catch (error) {
      this.logger.error('Lỗi Scale Down:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * 3. DELETE CONSUMER -> Giữ nguyên logic gọi API sang Consumer Service
   */
  async deleteConsumer(consumerId: string) {
    try {
      // Dùng tên service trong Docker network
      const consumerServiceUrl =
        process.env.CONSUMER_SERVICE_URL || 'http://consumer-service:3001';

      const response = await axios.delete(
        `${consumerServiceUrl}/api/consumers/instances/${consumerId}`,
        { timeout: 5000 },
      );

      if (response.data.success) {
        // Logic gửi socket cũ của bạn
        if (this.consumerServiceSocket) {
          this.consumerServiceSocket.emit('consumer-deleted', { consumerId });
        }
        return { status: 'success', message: `Đã xóa ${consumerId} khỏi DB` };
      }
      return { status: 'error', message: 'Lỗi từ Consumer Service' };
    } catch (error) {
      this.logger.error('Lỗi Delete Consumer:', error);
      return { status: 'error', message: error.message };
    }
  }
}
