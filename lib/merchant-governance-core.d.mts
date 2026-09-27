export type GovernanceAction = "publish" | "hide" | "suspend" | "unsuspend";

export interface GovernanceState {
  stateSource: "legacy" | "managed";
  public: boolean;
  restriction: "none" | "suspended" | "archived";
  isPublished: boolean | null;
  platformStatus: string | null;
  reviewStatus: string;
  listingVisibility: string;
  businessStatus: string | null;
  hasValidContact: boolean;
  allowedActions: GovernanceAction[];
}

export declare const GOVERNANCE_ACTIONS: readonly GovernanceAction[];
export declare const GOVERNANCE_REASON_MAX: number;
export declare const MAX_GOVERNANCE_BODY_BYTES: number;
export declare const GOVERNANCE_ACTION_INFO: Readonly<Record<GovernanceAction, { label: string; title: string; effect: string; reasonRequired: boolean; danger: boolean }>>;

export declare function parseGovernanceRequest(body: unknown):
  | { ok: true; requestId: string; action: GovernanceAction; reason: string | null }
  | { ok: false; status: number; code: string; message: string };
export declare function mapGovernanceRpcError(error: unknown): { status: number; code: string; message: string };
export declare function governanceResponse(result: unknown, requestId: string): { status: number; body: Record<string, unknown> };
export declare function describeGovernanceState(state: GovernanceState | null | undefined): string;
