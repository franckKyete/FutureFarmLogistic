import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VisitReason, VisitStatus } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('visits')
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'inspector_id' })
  inspectorId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspector_id' })
  inspector: UserEntity;

  @Index()
  @Column({ name: 'producer_id' })
  producerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producer_id' })
  producer: UserEntity;

  @Column({ name: 'planned_date', type: 'date' })
  plannedDate: Date;

  @Column({ name: 'planned_time', type: 'time', nullable: true })
  plannedTime: string | null;

  @Column({
    type: 'enum',
    enum: VisitReason,
    default: VisitReason.ROUTINE,
  })
  reason: VisitReason;

  @Column({
    type: 'enum',
    enum: VisitStatus,
    default: VisitStatus.PLANNED,
  })
  status: VisitStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
