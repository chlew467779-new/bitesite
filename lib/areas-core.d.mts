export interface AreaItem {
  name: string;
  state: string;
  country: string;
  aliases: string[];
}

export declare function findArea<T extends AreaItem>(areas: readonly T[], text: string | null | undefined): T | null;
export declare function matchAreas<T extends AreaItem>(areas: readonly T[], query: string | null | undefined, limit?: number): T[];
