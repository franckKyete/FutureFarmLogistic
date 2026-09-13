import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const numericTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : value.toString(),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity('currencies')
export class CurrencyEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  code: string; // e.g. 'USD', 'CDF', 'XOF'

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  symbol: string;

  @Column({
    name: 'rate_against_base',
    type: 'decimal',
    precision: 16,
    scale: 6,
    default: 1.0,
    transformer: numericTransformer,
  })
  rateAgainstBase: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_base', type: 'boolean', default: false })
  isBase: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
