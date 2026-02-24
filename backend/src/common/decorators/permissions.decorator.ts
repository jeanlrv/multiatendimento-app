import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../modules/auth/constants/permissions';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
