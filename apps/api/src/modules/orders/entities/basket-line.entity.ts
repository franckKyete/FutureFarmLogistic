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
import { BasketEntity } from './basket.entity';
import { HarvestEntity } from '../../products/entities/harvest.entity';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('basket_lines')
export class BasketLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'basket_id', type: 'uuid' })
  basketId: string;

  @ManyToOne(() => BasketEntity, (basket) => basket.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'basket_id' })
  basket: BasketEntity;

  @Index()
  @Column({ name: 'harvest_id', type: 'uuid' })
  harvestId: string;

  @ManyToOne(() => HarvestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'harvest_id' })
  harvest: HarvestEntity;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  quantity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
