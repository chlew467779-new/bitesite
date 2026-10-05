export type LinkField = "website" | "instagram" | "facebook" | "menu_pdf_url" | "grabfood" | "shopeefood" | "foodpanda";
export type DeliveryLinkType = "grabfood" | "shopeefood" | "foodpanda";
export type LinkProblem = "too_long" | "https_only" | "credentials" | "host" | "host_instagram" | "host_facebook" | "host_grabfood" | "host_shopeefood" | "host_foodpanda" | "grab_main_site" | "delivery_home";

export interface LinkRequestItem {
  id: string;
  field: LinkField;
  proposedUrl: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
  createdAt: string;
  decidedAt: string | null;
  reviewNote: string | null;
}
export interface LinkQueueItem {
  id: string;
  merchantId: string;
  merchantName: string;
  slug: string;
  field: LinkField;
  proposedUrl: string | null;
  currentUrl: string | null;
  baseValue: string | null;
  createdAt: string;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const LINK_FIELDS: readonly { field: LinkField; label: string; placeholder: string }[];
export declare const DELIVERY_LINK_TYPES: readonly DeliveryLinkType[];
export declare function availableLinkFields(links: unknown): readonly { field: LinkField; label: string; placeholder: string }[];
export declare const MAX_LINK_BODY_BYTES: number;
export declare const LINK_PROBLEM_TEXT: Readonly<Record<LinkProblem, string>>;
export declare function linkProblem(field: LinkField | string, url: unknown): LinkProblem | null;
export declare function parseOwnerLinkRequest(body: unknown):
  | { ok: true; action: "request"; requestId: string; field: LinkField; url: string | null }
  | { ok: true; action: "withdraw"; requestId: string; linkRequestId: string }
  | Invalid;
export declare function parseAdminLinkSet(body: unknown): { ok: true; requestId: string; field: LinkField; url: string | null; expected: string | null } | Invalid;
export declare function parseLinkReview(body: unknown): { ok: true; requestId: string; linkRequestId: string; decision: "approve" | "reject"; note: string | null } | Invalid;
export declare function mapLinkRpcError(error: unknown): { status: number; code: string; message: string };
