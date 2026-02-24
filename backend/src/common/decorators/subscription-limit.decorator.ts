import { SetMetadata } from '@nestjs/common';

export type ResourceLimit = 'maxUsers' | 'maxDepartments' | 'maxWhatsApp';

export const LIMIT_KEY = 'subscription_limit';
export const SubscriptionLimit = (resource: ResourceLimit) => SetMetadata(LIMIT_KEY, resource);
