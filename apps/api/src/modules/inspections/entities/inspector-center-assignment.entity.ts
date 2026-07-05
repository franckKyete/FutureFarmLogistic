import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InspectorProfileEntity } from './inspector-profile.entity';
import { InspectionCenterEntity } from './inspection-center.entity';

@Entity('inspector_center_assignments')
export class InspectorCenterAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'inspector_profile_id' })
  inspectorProfileId: string;

  @ManyToOne(() => InspectorProfileEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspector_profile_id' })
  inspectorProfile: InspectorProfileEntity;

  @Index()
  @Column({ name: 'inspection_center_id' })
  inspectionCenterId: string;

  @ManyToOne(() => InspectionCenterEntity, (center) => center.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inspection_center_id' })
  center: InspectionCenterEntity;

  @Column({ name: 'is_current_assignment', default: true })
  isCurrentAssignment: boolean;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;
}
