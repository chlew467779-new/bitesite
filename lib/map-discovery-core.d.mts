import type { PublicMerchant } from '../types/index';
export declare function hasMapCoordinates(merchant: Pick<PublicMerchant, 'latitude' | 'longitude'>): boolean;
export declare function mapDiscoveryOptions<T extends Pick<PublicMerchant, 'area' | 'cuisine' | 'cuisine_type' | 'latitude' | 'longitude'>>(merchants: T[], areas: { name: string }[]): { mapped: T[]; missingCount: number; cuisines: string[]; areas: string[] };
