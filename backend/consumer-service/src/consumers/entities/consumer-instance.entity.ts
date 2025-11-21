import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('consumer_instances')
export class ConsumerInstance {
  // ID sẽ là dạng: "groupId-inst-0", "groupId-inst-1"
  @PrimaryColumn()
  consumerId: string;

  @Column()
  groupId: string;

  // Lưu danh sách topic dưới dạng chuỗi, ví dụ: "topic-a,topic-b"
  @Column({ type: 'text', nullable: true })
  topics: string;

  @Column({ default: 'active' }) // active | inactive
  status: string;

  // PID của process (nếu dùng spawn process cũ), với dynamic thì để null hoặc 0
  @Column({ nullable: true })
  pid: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}