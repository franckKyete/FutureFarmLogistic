import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AddressType, AddressableType } from '@futurefarm/types';

@Entity('addresses')
@Index(['addressableType', 'addressableId'])
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'addressable_type',
    type: 'varchar',
    length: 50,
  })
  addressableType: AddressableType;

  @Column({
    name: 'addressable_id',
    type: 'uuid',
  })
  addressableId: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: AddressType.SHIPPING,
  })
  type: AddressType;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  label: string | null;

  @Column({
    name: 'recipient_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  recipientName: string | null;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  phoneNumber: string | null;

  @Column({
    name: 'street_address',
    type: 'varchar',
    length: 255,
  })
  streetAddress: string;

  @Column({
    name: 'street_address_2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  streetAddress2: string | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  city: string;

  @Column({
    name: 'state_or_province',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  stateOrProvince: string | null;

  @Column({
    name: 'postal_code',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  postalCode: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'COD',
  })
  country: string;

  @Column('decimal', { precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Column('decimal', { precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  @Column({
    name: 'is_default',
    type: 'boolean',
    default: false,
  })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
