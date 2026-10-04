export function validateCredentials(value: unknown, newPassword?: boolean): { email: string; password: string } | null;
export function validateRestaurantDraft(value: unknown): { name: string; requestId: string; termsVersion: string; rightsDeclared: true; currency: "MYR" | "SGD" } | null;
