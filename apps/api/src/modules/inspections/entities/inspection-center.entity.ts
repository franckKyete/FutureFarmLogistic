import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { InspectorCenterAssignmentEntity } from './inspector-center-assignment.entity';

@Entity('inspection_centers')
export class InspectionCenterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ name: 'region_name', length: 255 })
  regionName: string;

  @Column('text')
  address: string;

  @Column('decimal', { precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Column('decimal', { precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(
    () => InspectorCenterAssignmentEntity,
    (assignment) => assignment.center,
  )
  assignments: InspectorCenterAssignmentEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
