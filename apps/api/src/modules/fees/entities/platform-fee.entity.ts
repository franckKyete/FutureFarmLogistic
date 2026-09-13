import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { FeeCalculationType } from '@futurefarm/types';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('platform_fees')
export class PlatformFeeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({
    name: 'calculation_type',
    type: 'enum',
    enum: FeeCalculationType,
    default: FeeCalculationType.FIXED,
  })
  calculationType: FeeCalculationType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  value: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
