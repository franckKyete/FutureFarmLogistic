import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base entity pattern used by all business entities.
 * Replace "Example" and add your business-specific columns below.
 */
@Entity('examples')
export class ExampleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Add your columns here ---
  @Column({ length: 255 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;
  // --- End of custom columns ---

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
