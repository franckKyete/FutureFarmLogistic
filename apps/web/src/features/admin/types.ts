import type { UserStatus, Permission } from '@futurefarm/types';

export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  phone?: string | null;
  roles: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoleDto {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}
