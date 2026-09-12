import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { InspectorCenterAssignmentEntity } from './inspector-center-assignment.entity';

@Entity('inspector_profiles')
export class InspectorProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'license_number', length: 100, unique: true })
  licenseNumber: string;

  @Column({ name: 'agency_name', length: 255 })
  agencyName: string;

  @Column('simple-array')
  specializations: string[];

  @Column({ name: 'is_active_inspector', default: true })
  isActiveInspector: boolean;

  @OneToMany(
    () => InspectorCenterAssignmentEntity,
    (assignment) => assignment.inspectorProfile,
  )
  assignments: InspectorCenterAssignmentEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
