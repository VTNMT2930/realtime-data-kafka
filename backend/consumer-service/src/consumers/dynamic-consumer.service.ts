import {
	Injectable,
	OnModuleDestroy,
	OnModuleInit,
	Logger,
} from "@nestjs/common";
import { Kafka, Consumer } from "kafkajs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConsumerInstance } from "./entities/consumer-instance.entity";
// 1. Import Entity và Enum Log
import { ConsumerLog, ConsumerLogStatus } from "./entities/consumer-log.entity";

@Injectable()
export class DynamicConsumerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(DynamicConsumerService.name);
	private kafka: Kafka;
	private activeConsumers: Map<string, Consumer> = new Map();

	constructor(
		@InjectRepository(ConsumerInstance)
		private instanceRepo: Repository<ConsumerInstance>,
		// 2. Inject Repository Log để lưu tin nhắn
		@InjectRepository(ConsumerLog)
		private logRepo: Repository<ConsumerLog>
	) {}

	onModuleInit() {
		this.kafka = new Kafka({
			clientId: "dynamic-manager",
			brokers: ["kafka:29092"],
		});

		this.restoreActiveConsumers();
	}

	async onModuleDestroy() {
		for (const consumer of this.activeConsumers.values()) {
			await consumer.disconnect();
		}
	}

	private async restoreActiveConsumers() {
		try {
			// Logic restore nếu cần (để trống tạm thời theo yêu cầu giữ nguyên logic cũ)
		} catch (error) {}
	}

	/**
	 * TẠO CONSUMER NÂNG CAO (Đã thêm logic lưu Log)
	 */
	async createAdvancedConsumer(
		groupId: string,
		topics: string[],
		instanceCount: number
	) {
		this.logger.log(
			`[Dynamic] Tạo Group: ${groupId} | Topics: ${topics} | Instance: ${instanceCount}`
		);

		const results: string[] = [];

		for (let i = 0; i < instanceCount; i++) {
			const instanceId = `${groupId}-inst-${i}`;

			if (this.activeConsumers.has(instanceId)) {
				this.logger.warn(`Instance ${instanceId} đã chạy, update DB.`);
				await this.saveInstanceToDB(instanceId, groupId, topics, "active");
				continue;
			}

			try {
				const consumer = this.kafka.consumer({ groupId: groupId });
				await consumer.connect();
				await consumer.subscribe({ topics: topics, fromBeginning: true });

				// --- LOGIC NHẬN VÀ LƯU TIN NHẮN ---
				await consumer.run({
					eachMessage: async ({ topic, partition, message }) => {
						const value = message.value ? message.value.toString() : "";
						const offset = message.offset;

						this.logger.debug(`[${instanceId}] Nhận tin: ${value}`);

						// 3. GỌI HÀM LƯU DB NGAY TẠI ĐÂY
						await this.saveMessageToDB(
							instanceId,
							groupId,
							topic,
							partition,
							offset,
							value
						);
					},
				});

				this.activeConsumers.set(instanceId, consumer);
				await this.saveInstanceToDB(instanceId, groupId, topics, "active");
				results.push(instanceId);
			} catch (error) {
				this.logger.error(`Lỗi tạo instance ${instanceId}:`, error);
				await this.saveInstanceToDB(instanceId, groupId, topics, "ERROR");
			}
		}

		return {
			success: true,
			message: `Đã khởi chạy ${results.length}/${instanceCount} instances.`,
			instances: results,
		};
	}

	// --- HÀM MỚI: LƯU MESSAGE VÀO DB ---
	private async saveMessageToDB(
		consumerId: string,
		groupId: string,
		topic: string,
		partition: number,
		offset: string,
		value: string
	) {
		try {
			// Thử parse JSON để lấy ID gốc nếu có (cho đẹp data), không thì random
			let originalLogId = `unknown-${Date.now()}`;
			try {
				const parsed = JSON.parse(value);
				if (parsed.id || parsed.transactionId) {
					originalLogId = parsed.id || parsed.transactionId;
				}
			} catch (e) {}

			// Tạo Entity theo đúng cấu trúc bạn đã gửi trong consumer-log.entity.ts
			const log = this.logRepo.create({
				consumerId: consumerId,
				groupId: groupId,
				originalLogId: originalLogId, // Field này bắt buộc trong entity của bạn
				topic: topic,
				partition: partition,
				offset: offset,
				data: value, // Lưu toàn bộ nội dung tin nhắn
				status: ConsumerLogStatus.PROCESSED, // Đánh dấu là đã xử lý thành công
				// timestamp tự động tạo
			});

			await this.logRepo.save(log);
			// this.logger.verbose(`Đã lưu log offset ${offset}`);
		} catch (error) {
			this.logger.error(`Lỗi lưu Log DB: ${error.message}`);
		}
	}

	// Helper: Lưu trạng thái Instance (Giữ nguyên logic cũ)
	private async saveInstanceToDB(
		instanceId: string,
		groupId: string,
		topics: string[],
		status: string
	) {
		try {
			const instanceData = {
				id: instanceId,
				groupId: groupId,
				topics: topics.join(","),
				status: status,
				topicName: topics[0],
				pid: 0,
				lastHeartbeat: new Date(),
				isDeleted: false,
			};

			const existing = await this.instanceRepo.findOne({
				where: { id: instanceId },
			});

			if (existing) {
				await this.instanceRepo.update(
					{ id: instanceId },
					{ ...instanceData, updatedAt: new Date() }
				);
			} else {
				const instance = this.instanceRepo.create(instanceData);
				await this.instanceRepo.save(instance);
			}
		} catch (error) {
			this.logger.error(`Lỗi lưu Instance DB: ${error.message}`);
		}
	}

	async stopGroup(groupId: string) {
		const keysToRemove: string[] = [];

		// Duyệt map để tìm các instance thuộc group này
		for (const key of this.activeConsumers.keys()) {
			if (key.startsWith(`${groupId}-`) || key === groupId) {
				const consumer = this.activeConsumers.get(key);
				if (consumer) {
					try {
						this.logger.log(`[Dynamic] Đang dừng triệt để consumer: ${key}`);
						// 1. Ngắt kết nối mạng
						await consumer.disconnect();
						// 2. Dừng vòng lặp xử lý (quan trọng để không rejoin)
						await consumer.stop();
					} catch (e) {
						this.logger.error(`Lỗi stop consumer ${key}`, e);
					}
				}
				keysToRemove.push(key);

				// Cập nhật DB thành INACTIVE ngay lập tức
				try {
					await this.instanceRepo.update({ id: key }, { status: "INACTIVE" });
				} catch (e) {}
			}
		}

		// Xóa khỏi RAM
		keysToRemove.forEach((k) => this.activeConsumers.delete(k));

		return { success: true, stopped: keysToRemove.length };
	}

	// Bổ sung hàm stop riêng lẻ cho 1 instance nếu cần (dùng cho nút Delete/Stop từng dòng)
	async stopInstance(instanceId: string) {
		const consumer = this.activeConsumers.get(instanceId);
		if (consumer) {
			try {
				await consumer.disconnect();
				await consumer.stop();
				this.activeConsumers.delete(instanceId);

				await this.instanceRepo.update(
					{ id: instanceId },
					{ status: "INACTIVE" }
				);

				return { success: true, message: `Instance ${instanceId} stopped` };
			} catch (e) {
				this.logger.error(`Failed to stop instance ${instanceId}`, e);
				throw e;
			}
		}
		return { success: false, message: "Instance not found in active list" };
	}
}
