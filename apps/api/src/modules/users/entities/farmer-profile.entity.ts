import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { UserEntity } from './user.entity';
import { ParcelEntity } from './parcel.entity';

@Entity('farmer_profiles')
export class FarmerProfileEntity {
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

  @Column('text')
  address: string;

  @Column('text', { nullable: true })
  bio: string | null;

  @Column({ name: 'is_certified', default: false })
  isCertified: boolean;

  @OneToMany(() => ParcelEntity, (parcel) => parcel.farmerProfile)
  parcels: ParcelEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
