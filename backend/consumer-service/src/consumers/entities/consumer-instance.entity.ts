// consumer-service/src/consumers/consumer-instance.entity.ts
import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ConsumerInstanceStatus {
  ACTIVE = "active",       // Sửa cho khớp với string 'active' của dynamic service
  INACTIVE = "inactive",
  ERROR = "error",         // Thêm trạng thái lỗi
}

@Entity("consumer_instances")
export class ConsumerInstance {
  // GIỮ NGUYÊN ID (Đây là khóa chính, ví dụ: "test1-inst-0")
  @PrimaryColumn({ type: "varchar", length: 255 })
  id: string; 

  // --- THÊM MỚI ---
  @Column({ type: "varchar", length: 255, nullable: true })
  groupId: string; // Lưu tên group (VD: test1)

  // --- THÊM MỚI ---
  @Column({ type: "text", nullable: true })
  topics: string; // Lưu danh sách topic (VD: "topic-a,topic-b")

  @Column({
    type: "varchar", // Đổi sang varchar để linh hoạt hoặc map enum
    default: ConsumerInstanceStatus.ACTIVE,
  })
  status: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  hostname: string;

  @Column({ type: "int", nullable: true })
  port: number;

  @Column({ type: "int", nullable: true })
  pid: number;

  // Giữ lại topicName cũ để tương thích ngược (nếu cần), hoặc có thể bỏ qua
  @Column({ type: "varchar", length: 255, nullable: true })
  topicName?: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastHeartbeat: Date;

  @Column({ type: "boolean", default: false })
  shouldStop: boolean;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}