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
import { DisputeStatus, DisputeSeverity } from '@futurefarm/types';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('disputes')
export class DisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({
    type: 'enum',
    enum: DisputeSeverity,
  })
  severity: DisputeSeverity;

  @Column({ name: 'related_type', length: 50 })
  relatedType: string;

  @Column({ name: 'related_id' })
  relatedId: string;

  @Index()
  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: UserEntity;

  @Index()
  @Column({ name: 'assigned_to_id', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: UserEntity | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
