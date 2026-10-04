type Block = string | { list: string[] } | { items: [string, string][] };
type Policy = { lang: string; heading: string; effective: string; sections: { title: string; blocks: Block[] }[] };

export declare const PRIVACY_CONTACT_EMAIL: string;
export declare const PRIVACY_EFFECTIVE_DATE: Readonly<{ iso: string; en: string; ms: string }>;
export declare const PRIVACY_POLICY: Readonly<{ en: Policy; ms: Policy }>;
