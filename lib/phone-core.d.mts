export interface PhoneCountry {
  readonly code: string;
  readonly label: string;
  readonly example: string;
}

export declare const PHONE_COUNTRIES: readonly PhoneCountry[];
export declare function splitPhone(value: string | null | undefined): { country: string; local: string };
export declare function joinPhone(country: string, local: string): string | null;
export declare function phoneLinkDigits(value: string | null | undefined): string | null;
export declare function formatPhone(value: string | null | undefined): string;
