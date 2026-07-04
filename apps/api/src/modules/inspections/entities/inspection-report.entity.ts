import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { InspectionStatus, InspectionChecklist } from '@futurefarm/types';
import { HarvestEntity } from '../../products/entities/harvest.entity';
import { InspectorProfileEntity } from './inspector-profile.entity';
import { InspectionPhotoEntity } from './inspection-photo.entity';

@Entity('inspection_reports')
export class InspectionReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'harvest_id' })
  harvestId: string;

  @ManyToOne(() => HarvestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'harvest_id' })
  harvest: HarvestEntity;

  @Index()
  @Column({ name: 'inspector_profile_id' })
  inspectorProfileId: string;

  @ManyToOne(() => InspectorProfileEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inspector_profile_id' })
  inspectorProfile: InspectorProfileEntity;

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    default: InspectionStatus.IN_PROGRESS,
  })
  status: InspectionStatus;

  @Column({ type: 'jsonb' })
  checklist: InspectionChecklist;

  @Column({ name: 'overall_notes', type: 'text', nullable: true })
  overallNotes: string | null;

  @Column({ name: 'site_visit_date', type: 'date' })
  siteVisitDate: Date;

  @Column({
    name: 'ai_pre_screen_score',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  aiPreScreenScore: number | null;

  @Column({ name: 'ai_pre_screen_notes', type: 'text', nullable: true })
  aiPreScreenNotes: string | null;

  @Column({
    name: 'final_quality_score',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  finalQualityScore: number | null;

  @OneToMany(() => InspectionPhotoEntity, (photo) => photo.inspectionReport, {
    cascade: true,
    eager: true,
  })
  photos: InspectionPhotoEntity[];

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
