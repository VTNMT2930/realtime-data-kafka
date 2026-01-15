// api-gateway-producer/src/producers/producers.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Processor, Process } from '@nestjs/bull';
import * as Bull from 'bull'; // ✅ FIX: Import namespace
import * as fs from 'fs';
import csv = require('csv-parser');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProducerLog,
  LogStatus,
  LogType,
} from './entities/producer-log.entity';
import { ProducersGateway } from './producers.gateway';
import { Producer } from 'kafkajs'; // ✅ Import Producer type

@Processor('Producers')
@Injectable()
export class ProducersService {
  private kafkaProducer: Producer; // ✅ Native Kafka producer

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
    @InjectRepository(ProducerLog)
    private readonly logRepository: Repository<ProducerLog>,
    private readonly producersGateway: ProducersGateway,
  ) {}

  async onModuleInit() {
    try {
      await this.kafkaClient.connect();
      // ✅ Lấy native Kafka producer từ ClientKafka
      this.kafkaProducer = (this.kafkaClient as any).client.producer();
      await this.kafkaProducer.connect();
      console.log('✅ Kafka Producer Client đã kết nối!');
    } catch (error) {
      console.error('❌ Lỗi khi kết nối Kafka:', error.message);
      // Retry after 5 seconds
      setTimeout(() => this.onModuleInit(), 5000);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.kafkaProducer) {
        await this.kafkaProducer.disconnect();
      }
      await this.kafkaClient.close();
      console.log('✅ Kafka Producer Client đã ngắt kết nối!');
    } catch (error) {
      console.error('❌ Lỗi khi ngắt kết nối Kafka:', error.message);
    }
  }

  // --- HÀM 'CREATE' (SEND SINGLE) ---
  async create(
    createTransactionDto: CreateTransactionDto,
    topic: string = 'transactions_topic',
  ) {
    console.log(
      'Service: Đang xử lý message đơn lẻ:',
      createTransactionDto,
      'Topic:',
      topic,
    );

    const newLog = this.logRepository.create({
      type: LogType.SINGLE,
      status: LogStatus.PENDING,
      data: JSON.stringify(createTransactionDto), // ✅ Lưu dạng JSON string
      topic: topic, // ✅ Lưu topic động
    });
    const savedLog = await this.logRepository.save(newLog);

    try {
      console.log(
        `Service: Đang gửi message tới topic "${topic}" (logId: ${savedLog.id})...`,
      );
      const payload = {
        logId: savedLog.id,
        data: createTransactionDto,
      };

      // ✅ Dùng native Kafka producer để lấy RecordMetadata
      const recordMetadata = await this.kafkaProducer.send({
        topic,
        messages: [
          {
            key: savedLog.id,
            value: JSON.stringify(payload),
          },
        ],
      });

      // ✅ Lấy offset và partition từ response
      const metadata = recordMetadata[0];
      const partition = metadata?.partition ?? 0;
      const baseOffset = metadata?.baseOffset ?? '0';

      console.log(
        `Service: Đã gửi message (logId: ${savedLog.id}) thành công tới topic "${topic}" - Partition: ${partition}, Offset: ${baseOffset}.`,
      );

      // Cập nhật COMPLETED + offset/partition
      await this.logRepository.update(savedLog.id, {
        status: LogStatus.COMPLETED,
        offset: baseOffset.toString(), // Kafka offset là bigint, chuyển sang string
        partition: partition,
      });

      // ✅ Broadcast WebSocket event - log updated
      const updatedLog = await this.logRepository.findOne({
        where: { id: savedLog.id },
      });
      this.producersGateway.broadcastLogUpdated(savedLog.id, updatedLog);

      return {
        status: 'success',
        message: `Dữ liệu đã được gửi đến Kafka topic: ${topic}!`,
        logId: savedLog.id,
        topic: topic,
        offset: baseOffset.toString(),
        partition: partition,
      };
    } catch (error) {
      console.error('Service: Lỗi khi gửi message đơn lẻ:', error.message);

      // Cập nhật FAILED
      await this.logRepository.update(savedLog.id, {
        status: LogStatus.FAILED,
        errorMessage: error.message,
      });

      // ✅ Broadcast WebSocket event - log failed
      const failedLog = await this.logRepository.findOne({
        where: { id: savedLog.id },
      });
      this.producersGateway.broadcastLogUpdated(savedLog.id, failedLog);

      return { status: 'error', message: 'Không thể gửi message.' };
    }
  }

  // --- HÀM WORKER (UPLOAD CSV) ---
  @Process('process-csv-job')
  async processCsvJob(job: Bull.Job<any>) {
    const { filePath, logId, topic = 'transactions_topic' } = job.data; // ✅ Nhận topic từ job
    console.log(
      `[Worker] Bắt đầu xử lý file: ${filePath} (Log ID: ${logId}, Topic: ${topic})`,
    );

    if (!logId) {
      console.error(`[Worker] LỖI: Job thiếu logId. Hủy bỏ.`);
      return;
    }

    try {
      // 1. CẬP NHẬT TRẠNG THÁI 'PROCESSING'
      await this.logRepository.update(logId, { status: LogStatus.PROCESSING });

      const batch: any[] = [];
      const BATCH_SIZE = 100;
      let batchNumber = 0;
      let totalRecords = 0;

      // 2. Xử lý file CSV
      const stream = fs.createReadStream(filePath).pipe(csv());

      for await (const row of stream) {
        batch.push(row);
        totalRecords++;

        if (batch.length >= BATCH_SIZE) {
          batchNumber++;
          console.log(
            `[Worker] Gửi batch ${batchNumber}: ${batch.length} records tới topic "${topic}" (Log ID: ${logId})...`,
          );

          // ✅ TẠO LOG CHO TỪNG BATCH (chỉ lưu data thực tế, không lưu summary)
          const batchLog = this.logRepository.create({
            type: LogType.FILE,
            status: LogStatus.COMPLETED,
            data: JSON.stringify(batch), // ✅ Lưu toàn bộ data của batch
            originalFileName: `Batch ${batchNumber}`,
            topic: topic, // ✅ Lưu topic động
          });
          const savedBatchLog = await this.logRepository.save(batchLog);

          const payload = {
            logId: savedBatchLog.id, // ✅ Dùng logId của batch
            data: [...batch],
          };

          // ✅ Gửi batch và lấy offset/partition
          const recordMetadata = await this.kafkaProducer.send({
            topic,
            messages: [
              {
                key: savedBatchLog.id,
                value: JSON.stringify(payload),
              },
            ],
          });

          const metadata = recordMetadata[0];
          const partition = metadata?.partition ?? 0;
          const baseOffset = metadata?.baseOffset ?? '0';

          // ✅ Cập nhật offset/partition cho batch log
          await this.logRepository.update(savedBatchLog.id, {
            offset: baseOffset.toString(),
            partition: partition,
          });

          console.log(
            `[Worker] ✅ Batch ${batchNumber} sent - Partition: ${partition}, Offset: ${baseOffset}`,
          );

          batch.length = 0; // Xóa batch sau khi gửi
        }
      } // ĐÓNG VÒNG LẶP for await

      // 3. Gửi lô cuối cùng
      if (batch.length > 0) {
        batchNumber++;
        console.log(
          `[Worker] Gửi batch cuối ${batchNumber}: ${batch.length} records tới topic "${topic}" (Log ID: ${logId})...`,
        );

        // ✅ TẠO LOG CHO BATCH CUỐI
        const batchLog = this.logRepository.create({
          type: LogType.FILE,
          status: LogStatus.COMPLETED,
          data: JSON.stringify(batch), // ✅ Lưu toàn bộ data của batch cuối
          originalFileName: `Batch ${batchNumber}`,
          topic: topic, // ✅ Lưu topic động
        });
        const savedBatchLog = await this.logRepository.save(batchLog);

        const finalPayload = {
          logId: savedBatchLog.id, // ✅ Dùng logId của batch
          data: [...batch],
        };

        // ✅ Gửi batch cuối và lấy offset/partition
        const recordMetadata = await this.kafkaProducer.send({
          topic,
          messages: [
            {
              key: savedBatchLog.id,
              value: JSON.stringify(finalPayload),
            },
          ],
        });

        const metadata = recordMetadata[0];
        const partition = metadata?.partition ?? 0;
        const baseOffset = metadata?.baseOffset ?? '0';

        // ✅ Cập nhật offset/partition cho batch log cuối
        await this.logRepository.update(savedBatchLog.id, {
          offset: baseOffset.toString(),
          partition: partition,
        });

        console.log(
          `[Worker] ✅ Final batch ${batchNumber} sent - Partition: ${partition}, Offset: ${baseOffset}`,
        );
      }

      console.log(
        `[Worker] Đã xử lý VÀ GỬI KAFKA xong file CSV tới topic "${topic}": ${filePath} - Total: ${totalRecords} records in ${batchNumber} batches`,
      );

      // 4. ✅ CẬP NHẬT LOG CHÍNH với tóm tắt (không lưu offset/partition)
      const summaryData = {
        totalRecords,
        totalBatches: batchNumber,
        message: `Đã gửi thành công ${totalRecords} records tới Kafka topic: ${topic}`,
        topic: topic,
      };

      await this.logRepository.update(logId, {
        status: LogStatus.COMPLETED,
        data: JSON.stringify(summaryData),
        errorMessage: undefined,
      });

      console.log(
        `[Worker] ✅ ĐÃ CẬP NHẬT LOG SUMMARY (ID: ${logId}):`,
        summaryData,
      );

      // ✅ Broadcast WebSocket event - log completed
      const updatedLog = await this.logRepository.findOne({
        where: { id: logId },
      });
      if (updatedLog) {
        this.producersGateway.broadcastLogUpdated(logId, updatedLog);
        console.log(
          `[Worker] ✅ Đã broadcast log completed cho logId: ${logId}`,
        );
      }

      return {
        success: true,
        totalRecords,
        totalBatches: batchNumber,
        topic,
      };
    } catch (error) {
      // 5. CẬP NHẬT TRẠNG THÁI 'FAILED'
      console.error(`[Worker] Xử lý job ${logId} thất bại:`, error.message);
      await this.logRepository.update(logId, {
        status: LogStatus.FAILED,
        errorMessage: error.message,
      });

      // ✅ Broadcast WebSocket event - log failed
      const failedLog = await this.logRepository.findOne({
        where: { id: logId },
      });
      if (failedLog) {
        this.producersGateway.broadcastLogUpdated(logId, failedLog);
        console.log(`[Worker] ✅ Đã broadcast log failed cho logId: ${logId}`);
      }
    } finally {
      // 6. Luôn luôn xóa file tạm
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Worker] Đã xóa file tạm: ${filePath}`);
        }
      } catch (e) {
        console.error(`[Worker] Lỗi khi xóa file ${filePath}:`, e.message);
      }
    }
  }

  // --- HÀM LẤY STATISTICS ---
  async getStatistics() {
    try {
      // Lấy tất cả logs
      const allLogs = await this.logRepository.find();

      // Tính tổng số records (từ data)
      let totalRecords = 0;
      let totalBatches = 0;
      const topicStats = new Map<string, any>();

      for (const log of allLogs) {
        // Đếm số records từ data
        if (log.data) {
          try {
            const parsedData = JSON.parse(log.data);

            // ✅ CHỈ ĐẾM BATCH LOGS (array data), BỎ QUA SUMMARY LOGS
            if (Array.isArray(parsedData)) {
              totalRecords += parsedData.length;
              totalBatches++;
            }
            // ❌ BỎ QUA: else if (parsedData.totalRecords) - Đây là summary log, không đếm
            // Nếu không phải array và không phải summary → single message
            else if (!parsedData.totalRecords && !parsedData.message) {
              // Single message (không phải summary)
              totalRecords++;
            }
          } catch (e) {
            // Nếu không parse được, coi như 1 record
            totalRecords++;
          }
        }

        // Thống kê theo topic (giả sử dùng transactions_topic)
        const topic = log.topic || 'transactions_topic';
        if (!topicStats.has(topic)) {
          topicStats.set(topic, {
            topic,
            totalRecords: 0,
            totalBatches: 0,
            completed: 0,
            failed: 0,
            totalDuration: 0,
            count: 0,
          });
        }

        const stats = topicStats.get(topic);

        if (log.data) {
          try {
            const parsedData = JSON.parse(log.data);

            // ✅ CHỈ ĐẾM BATCH LOGS, BỎ QUA SUMMARY LOGS
            if (Array.isArray(parsedData)) {
              stats.totalRecords += parsedData.length;
              stats.totalBatches++;
            }
            // Nếu không phải array và không phải summary → single message
            else if (!parsedData.totalRecords && !parsedData.message) {
              stats.totalRecords++;
            }
            // ❌ BỎ QUA summary logs (parsedData.totalRecords)
          } catch (e) {
            stats.totalRecords++;
          }
        }

        if (log.status === LogStatus.COMPLETED) stats.completed++;
        if (log.status === LogStatus.FAILED) stats.failed++;

        // Tính duration (nếu có)
        if (log.createdAt && log.updatedAt) {
          const duration =
            new Date(log.updatedAt).getTime() -
            new Date(log.createdAt).getTime();
          stats.totalDuration += duration;
          stats.count++;
        }
      }

      // Tính average duration cho mỗi topic
      const byTopic = Array.from(topicStats.values()).map((stats) => ({
        ...stats,
        averageDuration:
          stats.count > 0 ? stats.totalDuration / stats.count : 0,
      }));

      const completedLogs = allLogs.filter(
        (log) => log.status === LogStatus.COMPLETED,
      ).length;
      const failedLogs = allLogs.filter(
        (log) => log.status === LogStatus.FAILED,
      ).length;

      return {
        success: true,
        summary: {
          totalRecords,
          totalBatches,
          completedLogs,
          failedLogs,
          totalLogs: allLogs.length,
        },
        byTopic,
      };
    } catch (error) {
      console.error('Service: Lỗi khi lấy statistics:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ Lấy file uploads summary (không bao gồm batch logs)
  async getFileUploads(topic?: string, page: number = 1, limit: number = 20) {
    try {
      const queryBuilder = this.logRepository
        .createQueryBuilder('log')
        .where('log.type = :type', { type: LogType.FILE })
        .andWhere('log.originalFileName IS NOT NULL')
        .andWhere('log.originalFileName NOT LIKE :batch', { batch: 'Batch %' })
        .orderBy('log.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (topic) {
        queryBuilder.andWhere('log.topic = :topic', { topic });
      }

      const [logs, total] = await queryBuilder.getManyAndCount();

      const summaries = logs.map((log) => {
        let summary = { totalRecords: 0, totalBatches: 0, message: '' };
        try {
          const data = JSON.parse(log.data);
          summary = {
            totalRecords: data.totalRecords || 0,
            totalBatches: data.totalBatches || 0,
            message: data.message || '',
          };
        } catch (error) {
          // ignore
        }
        return {
          id: log.id,
          type: log.type,
          status: log.status,
          topic: log.topic,
          originalFileName: log.originalFileName,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt,
          ...summary,
        };
      });

      return {
        success: true,
        data: summaries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Failed to get file uploads:', error.message);
      throw error;
    }
  }

  // ✅ Lấy logs với filter
  async findAll(
    topic?: string,
    page: number = 1,
    limit: number = 50,
    type?: string,
  ) {
    try {
      const queryBuilder = this.logRepository
        .createQueryBuilder('log')
        .where('log.isDeleted = :isDeleted', { isDeleted: false }) // ✅ Filter out deleted logs
        .orderBy('log.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (topic) {
        queryBuilder.andWhere('log.topic = :topic', { topic });
      }

      if (type === 'SINGLE') {
        queryBuilder.andWhere('log.type = :type', { type: LogType.SINGLE });
      } else if (type === 'FILE') {
        queryBuilder
          .andWhere('log.type = :type', { type: LogType.FILE })
          .andWhere('log.originalFileName IS NOT NULL')
          .andWhere('log.originalFileName NOT LIKE :batch', {
            batch: 'Batch %',
          });
      }

      const [logs, total] = await queryBuilder.getManyAndCount();

      return {
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      console.error('Failed to get logs:', error.message);
      throw error;
    }
  }
}
