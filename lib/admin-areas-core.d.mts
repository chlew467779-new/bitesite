export interface AreaWrite { country: 'MY'; state: string; name: string; aliases: string[] }
export interface AreaRecord { id: string; name: string }
export function parseCreateArea(value: unknown): AreaWrite;
export function parsePatchArea(value: unknown): { id: string; patch: { aliases?: string[]; is_active?: boolean } };
export function findAreaConflict(candidate: { name: string; aliases: string[] }, areas: AreaRecord[], excludedId?: string | null): string | null;
