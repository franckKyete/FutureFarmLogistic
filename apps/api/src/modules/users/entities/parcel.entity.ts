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

import { ParcelStatus } from '@futurefarm/types';
import { FarmerProfileEntity } from './farmer-profile.entity';
import { UserEntity } from './user.entity';

@Entity('parcels')
export class ParcelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'farmer_profile_id' })
  farmerProfileId: string;

  @ManyToOne(() => FarmerProfileEntity, (profile) => profile.parcels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'farmer_profile_id' })
  farmerProfile: FarmerProfileEntity;

  @Column({ name: 'cadastral_number', length: 100 })
  cadastralNumber: string;

  @Column({ name: 'size_hectares', type: 'decimal', precision: 10, scale: 2 })
  sizeHectares: number;

  @Column({ name: 'location_coordinates', length: 255 })
  locationCoordinates: string;

  @Column('simple-array')
  cropTypes: string[];

  @Column({
    type: 'enum',
    enum: ParcelStatus,
    default: ParcelStatus.PENDING,
  })
  status: ParcelStatus;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'verified_by_id', type: 'uuid', nullable: true })
  verifiedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy: UserEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
