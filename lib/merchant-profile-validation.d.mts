/* bitesite/lib/merchant-profile-validation.d.mts */

/** Types for lib/merchant-profile-validation.mjs. */

export type ProfileTextField =
  | "tagline"
  | "description"
  | "phone"
  | "whatsapp"
  | "email"
  | "website"
  | "instagram"
  | "facebook"
  | "cover_image"
  | "logo_image"
  | "menu_pdf_url";

export type ProfileFieldErrors = Partial<Record<ProfileTextField, string>>;

export declare const PROFILE_TEXT_FIELDS: readonly ProfileTextField[];
export declare const PROFILE_FIELD_LIMITS: Readonly<Record<ProfileTextField, number>>;
export declare const URL_FIELDS: readonly ProfileTextField[];

export declare function isHttpUrl(value: string): boolean;
export declare function normalizeUrlInput(value: unknown): string;
export declare function validateProfileField(field: string, value: unknown, checkFormat?: boolean): string | null;
export declare function validateProfile(
  values: Partial<Record<string, string | null>>,
  /** The stored row; non-string columns are ignored. */
  previous?: Readonly<Record<string, unknown>>,
): ProfileFieldErrors;
