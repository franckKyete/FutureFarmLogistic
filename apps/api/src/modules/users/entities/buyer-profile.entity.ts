import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { BuyerBusinessType } from '@futurefarm/types';
import { UserEntity } from './user.entity';

@Entity('buyer_profiles')
export class BuyerProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'company_name', length: 255 })
  companyName: string;

  @Column({ name: 'vat_number', length: 50 })
  vatNumber: string;

  @Column({
    name: 'business_type',
    type: 'enum',
    enum: BuyerBusinessType,
    default: BuyerBusinessType.RESTAURATEUR,
  })
  businessType: BuyerBusinessType;

  @Column({ name: 'billing_address', type: 'text' })
  billingAddress: string;

  @Column({ name: 'shipping_address', type: 'text' })
  shippingAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
