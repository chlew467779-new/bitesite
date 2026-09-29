export type MenuOpType =
  | "create_category" | "rename_category" | "reorder_categories" | "delete_category"
  | "create_product" | "update_product" | "move_product" | "reorder_products" | "delete_product";

export interface MenuCategory { id: string; name: string; sortOrder: number | null }
export interface MenuProduct {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number | null;
  discountPrice: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  showPrices: boolean;
  sortOrder: number | null;
}
export interface MenuSnapshot { categories: MenuCategory[]; products: MenuProduct[] }

export declare const MENU_OP_TYPES: readonly MenuOpType[];
export declare const MAX_MENU_BODY_BYTES: number;
export declare const MENU_LIMITS: Readonly<{ categoryName: number; dishName: number; description: number; maxPrice: number }>;

export declare function parseMenuRequest(body: unknown):
  | { ok: true; requestId: string; op: { type: MenuOpType } & Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string };
export declare function parsePriceInput(text: unknown): { ok: true; value: number | null } | { ok: false; message: string };
export declare function findDuplicateDishName<T extends Pick<MenuProduct, "id" | "categoryId" | "name">>(products: T[], categoryId: string, name: string, excludedId?: string | null): T | null;
export declare function mapMenuRpcError(error: unknown): { status: number; code: string; message: string };
export declare function menuResponse(result: unknown, requestId: string): { status: number; body: Record<string, unknown> };
