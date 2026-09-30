export interface ImportDish { name: string; description: string | null; price: number | null; unclear: boolean }
export interface ImportCategory { name: string; dishes: ImportDish[] }
export type ParsedMenu =
  | { ok: false; message: string }
  | { ok: true; categories: ImportCategory[]; notes: string[]; problems: string[]; warnings: string[]; merged: number; total: number; unclear: number };
export declare const MENU_IMPORT_LIMITS: Readonly<{ categories: number; dishes: number; categoryName: number; dishName: number; description: number; price: number }>;
export declare const MENU_IMPORT_PROMPT: string;
export declare function dishKey(name: string): string;
export declare function parsePrice(value: unknown): number | null;
export declare function parseMenuImport(text: string): ParsedMenu;
export declare function compareWithMenu(
  categories: ImportCategory[],
  menu: { categories: { id: string; name: string }[]; products: { categoryId: string | null; name: string }[] },
): { rows: { name: string; isNew: boolean; dishes: (ImportDish & { exists: boolean })[] }[]; newDishes: number; newCategories: number };
export declare function toImportItems(categories: ImportCategory[]): { name: string; dishes: { name: string; description: string | null; price: number | null }[] }[];
export declare function parseImportRequest(body: unknown): { ok: true; merchantId: string; items: ReturnType<typeof toImportItems> } | { ok: false; message: string };
