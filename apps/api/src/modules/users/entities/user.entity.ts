import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { UserStatus } from '@futurefarm/types';
import { RoleEntity } from '../../roles/entities/role.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 10, default: 'COD' })
  country: string;

  @Column({ name: 'preferred_currency', type: 'varchar', length: 10, default: 'CDF' })
  preferredCurrency: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ select: false })
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.APPROVED,
  })
  status: UserStatus;

  @Column({
    type: 'varchar',
    name: 'two_factor_secret',
    nullable: true,
    select: false,
  })
  twoFactorSecret: string | null;

  @Column({ name: 'is_two_factor_enabled', default: false })
  isTwoFactorEnabled: boolean;

  @Column({
    type: 'varchar',
    name: 'reset_password_token',
    nullable: true,
    select: false,
  })
  resetPasswordToken: string | null;

  @Column({
    name: 'reset_password_expires',
    type: 'timestamp',
    nullable: true,
    select: false,
  })
  resetPasswordExpires: Date | null;

  @ManyToMany(() => RoleEntity, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' },
  })
  roles: RoleEntity[];

  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  @Column({ name: 'created_by_actor_id', type: 'uuid', nullable: true })
  createdByActorId: string | null;

  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  @Column({ name: 'stripe_payment_method_id', type: 'varchar', length: 255, nullable: true })
  stripePaymentMethodId: string | null;

  @Column({ name: 'card_last4', type: 'varchar', length: 10, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_brand', type: 'varchar', length: 50, nullable: true })
  cardBrand: string | null;

  @Column({ name: 'card_exp_month', type: 'int', nullable: true })
  cardExpMonth: number | null;

  @Column({ name: 'card_exp_year', type: 'int', nullable: true })
  cardExpYear: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (
      this.password &&
      !this.password.startsWith('$2b$') &&
      !this.password.startsWith('$2a$')
    ) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }
}
