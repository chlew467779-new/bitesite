export interface AnnouncementRow {
  title: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export declare const ANNOUNCEMENT_LIMITS: Readonly<{ title: number; body: number; linkLabel: number; url: number }>;
export declare function isAnnouncementLink(value: unknown): boolean;
export declare function parseAnnouncement(input: unknown): { ok: true; row: AnnouncementRow } | { ok: false; message: string };
export declare function isAnnouncementId(value: unknown): value is string;
export declare function isAnnouncementLive(row: Pick<AnnouncementRow, 'is_active' | 'starts_at' | 'ends_at'> | null | undefined, now?: Date): boolean;
