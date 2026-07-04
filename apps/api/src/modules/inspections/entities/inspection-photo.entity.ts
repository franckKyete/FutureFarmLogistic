import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InspectionReportEntity } from './inspection-report.entity';

@Entity('inspection_photos')
export class InspectionPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'inspection_report_id' })
  inspectionReportId: string;

  @ManyToOne(() => InspectionReportEntity, (report) => report.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inspection_report_id' })
  inspectionReport: InspectionReportEntity;

  @Column({ length: 1024 })
  url: string;

  @Column({ type: 'integer', nullable: true })
  size: number | null;

  @Column({ name: 'taken_at', type: 'timestamp', nullable: true })
  takenAt: Date | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
  })
  longitude: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
