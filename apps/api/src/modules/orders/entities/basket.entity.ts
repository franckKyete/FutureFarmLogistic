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
import { UserEntity } from '../../users/entities/user.entity';
import { BasketLineEntity } from './basket-line.entity';

@Entity('baskets')
export class BasketEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: `"status" = 'ACTIVE'` })
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: UserEntity;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'ACTIVE',
  })
  status: 'ACTIVE' | 'ABANDONED';

  @OneToMany(() => BasketLineEntity, (line) => line.basket, { cascade: true })
  lines: BasketLineEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
